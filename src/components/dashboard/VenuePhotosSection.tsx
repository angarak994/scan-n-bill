'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, Trash2, ArrowUp, ArrowDown, Star, UploadCloud, RefreshCw, MapPin, Check, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface VenuePhoto {
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

interface VenuePhotosSectionProps {
  businessId: string;
  businessData: any;
}

export default function VenuePhotosSection({ businessId, businessData }: VenuePhotosSectionProps) {
  const [photos, setPhotos] = useState<VenuePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = async () => {
    if (!businessId) return;
    try {
      const res = await fetch(`/api/venue-photos?businessId=${encodeURIComponent(businessId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.photos)) {
        setPhotos(data.photos);
      }
    } catch (err) {
      console.error('Failed to fetch venue photos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [businessId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPEG, PNG, and WebP images are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleCancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !businessId) return;

    if (photos.length >= 10) {
      toast.error('Maximum 10 venue photos allowed. Please delete an existing photo first.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('businessId', businessId);
      formData.append('file', selectedFile);
      if (uploadCaption.trim()) {
        formData.append('caption', uploadCaption.trim());
      }

      const res = await fetch('/api/venue-photos', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Venue photo uploaded successfully!');
        handleCancelPreview();
        await fetchPhotos();
      } else {
        toast.error(data.error || 'Failed to upload photo.');
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      toast.error('Network error during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this venue photo?')) return;

    try {
      const res = await fetch(`/api/venue-photos?id=${encodeURIComponent(photoId)}&businessId=${encodeURIComponent(businessId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Photo removed.');
        setPhotos(prev => prev.filter(p => p.id !== photoId));
      } else {
        toast.error(data.error || 'Failed to delete photo.');
      }
    } catch (err) {
      toast.error('Error deleting photo.');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const newPhotos = [...photos];
    const temp = newPhotos[index];
    newPhotos[index] = newPhotos[targetIndex];
    newPhotos[targetIndex] = temp;
    setPhotos(newPhotos);

    try {
      const photoIds = newPhotos.map(p => p.id);
      const res = await fetch('/api/venue-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          businessId,
          photoIds,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error('Failed to save photo order.');
        await fetchPhotos();
      }
    } catch {
      await fetchPhotos();
    }
  };

  const handleSaveCaption = async (photoId: string) => {
    try {
      const res = await fetch('/api/venue-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'caption',
          businessId,
          photoId,
          caption: editingCaption,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Caption updated.');
        setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption: editingCaption } : p));
        setEditingPhotoId(null);
      } else {
        toast.error(data.error || 'Failed to update caption.');
      }
    } catch {
      toast.error('Error saving caption.');
    }
  };

  const googleRating = businessData?.google_rating ? Number(businessData.google_rating) : null;
  const reviewCount = businessData?.google_review_count || null;
  const lat = businessData?.latitude;
  const lng = businessData?.longitude;

  return (
    <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8 shadow-sm mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <Camera className="w-6 h-6 text-accent" />
            <span>Venue Photos & Ambience</span>
          </h2>
          <p className="text-text-secondary text-xs sm:text-sm mt-1">
            Upload high-resolution lounge photos shown automatically when customers explore your club via WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-accent/15 border border-accent/30 text-accent font-bold">
            {photos.length} / 10 Photos
          </span>
          <span className="px-3 py-1 rounded-full text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Synced with WhatsApp AI
          </span>
        </div>
      </div>

      {/* Upload Box */}
      <div className="mb-8">
        <form onSubmit={handleUpload} className="bg-bg-primary/50 border-2 border-dashed border-border-theme/80 hover:border-accent/60 transition-colors rounded-xl p-5 sm:p-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            id="venue-photo-upload"
          />

          {!previewUrl ? (
            <label
              htmlFor="venue-photo-upload"
              className="flex flex-col items-center justify-center cursor-pointer text-center py-6"
            >
              <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center text-accent mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-text-primary">Click or drag & drop to upload a venue photo</p>
              <p className="text-xs text-text-secondary mt-1">Supports JPEG, PNG, WebP up to 5MB (Max 10 photos)</p>
            </label>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative w-36 h-28 sm:w-44 sm:h-32 rounded-lg overflow-hidden border border-border-theme shrink-0 bg-black/40">
                <img
                  src={previewUrl}
                  alt="Upload preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 w-full space-y-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Photo Caption (Optional)</label>
                  <input
                    type="text"
                    value={uploadCaption}
                    onChange={(e) => setUploadCaption(e.target.value)}
                    placeholder="e.g. Tournament 9ft Pool Table with Simonis 860 cloth"
                    className="w-full px-4 py-2.5 bg-bg-surface border border-border-light rounded-lg focus:border-accent outline-none text-xs text-text-primary"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="px-5 py-2 bg-accent text-black font-extrabold rounded-lg text-xs hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload Photo</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPreview}
                    disabled={isUploading}
                    className="px-4 py-2 bg-bg-surface hover:bg-bg-primary text-text-secondary rounded-lg text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Photo Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-text-secondary text-sm flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-accent" />
          <span>Loading venue gallery...</span>
        </div>
      ) : photos.length === 0 ? (
        <div className="py-10 text-center border border-border-theme/40 rounded-xl bg-bg-primary/20">
          <ImageIcon className="w-10 h-10 text-text-secondary/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-text-secondary">No venue photos uploaded yet</p>
          <p className="text-xs text-text-secondary/60 mt-1 max-w-md mx-auto">
            Upload photos of your pool tables, VIP lounge, or lighting. The WhatsApp assistant automatically delivers these when customers ask for photos!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="group relative bg-bg-primary/60 border border-border-theme rounded-xl overflow-hidden shadow-sm flex flex-col transition-all hover:border-accent/40"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
                <img
                  src={photo.public_url}
                  alt={photo.caption || 'Venue photo'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white border border-white/10">
                  {index === 0 ? '⭐ Featured (#1)' : `#${index + 1}`}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(photo.id)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between">
                {editingPhotoId === photo.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingCaption}
                      onChange={(e) => setEditingCaption(e.target.value)}
                      placeholder="Photo caption"
                      className="w-full px-2 py-1 bg-bg-surface border border-accent rounded text-xs text-text-primary outline-none"
                      autoFocus
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveCaption(photo.id)}
                        className="px-2.5 py-1 bg-accent text-black text-[10px] font-bold rounded"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPhotoId(null)}
                        className="px-2 py-1 text-text-secondary text-[10px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p
                      onClick={() => {
                        setEditingPhotoId(photo.id);
                        setEditingCaption(photo.caption || '');
                      }}
                      className="text-xs text-text-primary line-clamp-2 cursor-pointer hover:text-accent transition-colors"
                      title="Click to edit caption"
                    >
                      {photo.caption || <span className="text-text-secondary italic">Add caption...</span>}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-theme/40 text-[10px] text-text-secondary">
                  <span>{(photo.file_size_bytes ? (photo.file_size_bytes / (1024 * 1024)).toFixed(1) + ' MB' : '')}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      className="p-1 hover:text-accent disabled:opacity-30 transition-colors"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === photos.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      className="p-1 hover:text-accent disabled:opacity-30 transition-colors"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Google Rating & Location Sync Card */}
      <div className="mt-8 pt-6 border-t border-border-theme bg-bg-primary/30 rounded-xl p-4 sm:p-5 border border-border-theme/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Google Places Rating & Discovery Status</span>
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Google review score and GPS coordinates used for proximity calculations in WhatsApp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-bg-surface px-3 py-1.5 rounded-lg border border-border-theme text-xs font-mono">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="font-bold text-text-primary">
                {googleRating ? `${googleRating.toFixed(1)} / 5.0` : 'Not connected'}
              </span>
              {reviewCount && (
                <span className="text-text-secondary">({reviewCount} reviews)</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 bg-bg-surface px-3 py-1.5 rounded-lg border border-border-theme text-xs font-mono text-text-secondary">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <span>
                {lat && lng ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : 'GPS not set'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
