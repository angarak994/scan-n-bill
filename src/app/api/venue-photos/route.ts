import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { venuePhotoService } from '@/lib/services/venuePhotoService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const photos = await venuePhotoService.getPhotos(businessId);
    return NextResponse.json({ success: true, photos });
  } catch (error: any) {
    console.error('Error fetching venue photos:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle JSON payloads (reorder, update caption)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const businessId = body.businessId || sessionCookie.businessId;

      if (businessId !== sessionCookie.businessId) {
        return NextResponse.json({ error: 'Forbidden: Business mismatch' }, { status: 403 });
      }

      if (body.action === 'reorder') {
        const { photoIds } = body;
        if (!Array.isArray(photoIds)) {
          return NextResponse.json({ error: 'photoIds must be an array' }, { status: 400 });
        }
        const result = await venuePhotoService.reorderPhotos(businessId, photoIds);
        if (!result.success) {
          return NextResponse.json({ error: result.reason }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      if (body.action === 'caption') {
        const { photoId, caption } = body;
        if (!photoId) {
          return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
        }
        const result = await venuePhotoService.updateCaption(photoId, businessId, caption || '');
        if (!result.success) {
          return NextResponse.json({ error: result.reason }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Handle Multipart Form Data (Photo Upload)
    const formData = await request.formData();
    const businessId = (formData.get('businessId') as string) || sessionCookie.businessId;
    const file = formData.get('file') as File | null;
    const caption = (formData.get('caption') as string) || '';

    if (businessId !== sessionCookie.businessId) {
      return NextResponse.json({ error: 'Forbidden: Business mismatch' }, { status: 403 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const result = await venuePhotoService.uploadPhoto(businessId, file, caption);

    if (!result.success) {
      return NextResponse.json({ error: result.reason || 'Failed to upload photo' }, { status: 400 });
    }

    return NextResponse.json({ success: true, photo: result.photo });
  } catch (error: any) {
    console.error('Error handling venue photo upload:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get('id');
    const businessId = searchParams.get('businessId') || sessionCookie.businessId;

    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 });
    }

    if (businessId !== sessionCookie.businessId) {
      return NextResponse.json({ error: 'Forbidden: Business mismatch' }, { status: 403 });
    }

    const result = await venuePhotoService.deletePhoto(photoId, businessId);

    if (!result.success) {
      return NextResponse.json({ error: result.reason || 'Failed to delete photo' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting venue photo:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
