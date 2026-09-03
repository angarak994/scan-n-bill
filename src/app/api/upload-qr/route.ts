import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const businessId = formData.get('business_id') as string;
    const file = formData.get('file') as File | null;
    const action = formData.get('action') as string; // 'upload' or 'remove'

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    if (action === 'remove') {
      const { error: updateError } = await supabase
        .from('businesses')
        .update({ payment_qr_config: { enabled: false, qr_url: null } })
        .eq('id', businessId);
        
      if (updateError) throw updateError;
      
      return NextResponse.json({ success: true, message: 'QR removed successfully' });
    }

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }
    
    // Validate file size (e.g., max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 5MB.' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${businessId}_${Date.now()}.${fileExt}`;
    const filePath = `${businessId}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('business_qrs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('business_qrs')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // Update business config
    const payment_qr_config = {
      enabled: true,
      qr_url: publicUrl
    };

    const { error: updateError } = await supabase
      .from('businesses')
      .update({ payment_qr_config })
      .eq('id', businessId);

    if (updateError) {
      console.error('Business Update Error:', updateError);
      return NextResponse.json({ error: 'Failed to update business settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true, qr_url: publicUrl });

  } catch (err: any) {
    console.error('QR Upload API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
