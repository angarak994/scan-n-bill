import { supabase } from '@/lib/supabaseClient';

const MAX_PHOTOS_PER_BUSINESS = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const STORAGE_BUCKET = 'venue_photos';

// JPEG/PNG/WebP magic bytes for server-side validation
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // "RIFF" — full check also validates bytes 8-11 as "WEBP"
};

export interface VenuePhoto {
  id: string;
  business_id: string;
  storage_path: string;
  public_url: string;
  caption: string | null;
  display_order: number;
  file_size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

export const venuePhotoService = {
  /**
   * Validates file content by checking magic bytes (not just MIME type).
   */
  validateFileContent(buffer: ArrayBuffer, declaredMime: string): { valid: boolean; reason?: string } {
    if (!ALLOWED_MIME_TYPES.includes(declaredMime)) {
      return { valid: false, reason: `File type "${declaredMime}" is not allowed. Use JPEG, PNG, or WebP.` };
    }

    const bytes = new Uint8Array(buffer);
    if (bytes.length < 12) {
      return { valid: false, reason: 'File is too small to be a valid image.' };
    }

    const expectedMagic = MAGIC_BYTES[declaredMime];
    if (expectedMagic) {
      const matches = expectedMagic.every((byte, i) => bytes[i] === byte);
      if (!matches) {
        return { valid: false, reason: 'File content does not match declared type. Possible malicious upload.' };
      }
    }

    // Additional WebP check: bytes 8-11 should be "WEBP"
    if (declaredMime === 'image/webp') {
      const webpSignature = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      if (webpSignature !== 'WEBP') {
        return { valid: false, reason: 'File is not a valid WebP image.' };
      }
    }

    return { valid: true };
  },

  /**
   * Uploads a venue photo to Supabase Storage with validation and business isolation.
   */
  async uploadPhoto(
    businessId: string,
    file: File,
    caption?: string
  ): Promise<{ success: boolean; photo?: VenuePhoto; reason?: string }> {
    // 1. Check photo limit
    const { count } = await supabase
      .from('venue_photos')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if ((count || 0) >= MAX_PHOTOS_PER_BUSINESS) {
      return { success: false, reason: `Maximum ${MAX_PHOTOS_PER_BUSINESS} photos allowed per venue. Please delete an existing photo first.` };
    }

    // 2. Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { success: false, reason: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum is 5MB.` };
    }

    // 3. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { success: false, reason: `File type "${file.type}" is not allowed. Use JPEG, PNG, or WebP.` };
    }

    // 4. Validate magic bytes
    const buffer = await file.arrayBuffer();
    const contentCheck = this.validateFileContent(buffer, file.type);
    if (!contentCheck.valid) {
      return { success: false, reason: contentCheck.reason };
    }

    // 5. Generate storage path (business-isolated directory)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${safeExt}`;
    const storagePath = `${businessId}/${fileName}`;

    // 6. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '86400', // 24h cache
        upsert: false,
      });

    if (uploadError) {
      console.error('Venue photo upload error:', uploadError);
      return { success: false, reason: 'Failed to upload image to storage.' };
    }

    // 7. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;

    // 8. Determine next display_order
    const { data: maxOrderRow } = await supabase
      .from('venue_photos')
      .select('display_order')
      .eq('business_id', businessId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrderRow?.display_order ?? -1) + 1;

    // 9. Insert metadata record
    const { data: photoRecord, error: insertError } = await supabase
      .from('venue_photos')
      .insert({
        business_id: businessId,
        storage_path: storagePath,
        public_url: publicUrl,
        caption: caption?.trim() || null,
        display_order: nextOrder,
        file_size_bytes: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (insertError || !photoRecord) {
      console.error('Venue photo DB insert error:', insertError);
      // Cleanup: remove uploaded file if DB insert fails
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return { success: false, reason: 'Failed to save photo record.' };
    }

    return { success: true, photo: photoRecord };
  },

  /**
   * Lists all venue photos for a business, ordered by display_order.
   */
  async getPhotos(businessId: string): Promise<VenuePhoto[]> {
    const { data, error } = await supabase
      .from('venue_photos')
      .select('*')
      .eq('business_id', businessId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching venue photos:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Gets public URLs for a business's venue photos (for WhatsApp delivery).
   */
  async getPhotoUrls(businessId: string): Promise<{ url: string; caption: string | null }[]> {
    const photos = await this.getPhotos(businessId);
    return photos.map(p => ({
      url: p.public_url,
      caption: p.caption,
    }));
  },

  /**
   * Deletes a venue photo by ID. Enforces business_id isolation.
   */
  async deletePhoto(photoId: string, businessId: string): Promise<{ success: boolean; reason?: string }> {
    // 1. Fetch photo record with business_id check
    const { data: photo, error: fetchError } = await supabase
      .from('venue_photos')
      .select('*')
      .eq('id', photoId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (fetchError || !photo) {
      return { success: false, reason: 'Photo not found or does not belong to this business.' };
    }

    // 2. Remove from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([photo.storage_path]);

    if (storageError) {
      console.warn('Storage deletion warning (non-blocking):', storageError);
    }

    // 3. Delete DB record
    const { error: deleteError } = await supabase
      .from('venue_photos')
      .delete()
      .eq('id', photoId)
      .eq('business_id', businessId);

    if (deleteError) {
      return { success: false, reason: 'Failed to delete photo record.' };
    }

    return { success: true };
  },

  /**
   * Reorders venue photos for a business.
   */
  async reorderPhotos(businessId: string, photoIds: string[]): Promise<{ success: boolean; reason?: string }> {
    try {
      for (let i = 0; i < photoIds.length; i++) {
        await supabase
          .from('venue_photos')
          .update({ display_order: i, updated_at: new Date().toISOString() })
          .eq('id', photoIds[i])
          .eq('business_id', businessId);
      }
      return { success: true };
    } catch (err) {
      console.error('Reorder photos error:', err);
      return { success: false, reason: 'Failed to reorder photos.' };
    }
  },

  /**
   * Updates caption for a photo. Enforces business_id isolation.
   */
  async updateCaption(photoId: string, businessId: string, caption: string): Promise<{ success: boolean; reason?: string }> {
    const { error } = await supabase
      .from('venue_photos')
      .update({ caption: caption.trim(), updated_at: new Date().toISOString() })
      .eq('id', photoId)
      .eq('business_id', businessId);

    if (error) {
      return { success: false, reason: 'Failed to update caption.' };
    }
    return { success: true };
  },
};
