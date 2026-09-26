import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  } else {
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (body.object !== 'whatsapp_business_account') {
      return new NextResponse('Not Found', { status: 404 });
    }

    // 1. Ingest webhook FAST into database queue
    const { error: insertError } = await supabase
      .from('whatsapp_webhook_events')
      .insert({
        payload: body,
        status: 'pending'
      });

    if (insertError) {
      console.error('Failed to enqueue webhook:', insertError);
      // Fallback: we still want to ACK to Meta, but this is a critical error
      return NextResponse.json({ ok: true, error_logged: true });
    }

    // 2. Trigger async queue processor (Fire and Forget)
    // In Edge/Vercel environments, using unstable_after or a background trigger is ideal.
    // For local or standard node, a non-awaited fetch triggers the worker.
    const baseUrl = process.env.APP_BASE_URL || request.headers.get('origin') || 'http://localhost:3000';
    fetch(`${baseUrl}/api/process-whatsapp-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(err => {
      console.error('Async trigger failed:', err);
    });

    // 3. Return 200 OK immediately to Meta (less than 8 seconds)
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('WhatsApp Webhook Error:', error);
    return NextResponse.json({ ok: true, error_logged: true });
  }
}
