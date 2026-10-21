import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { processWhatsAppMessage } from '@/lib/services/whatsappMessageProcessor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const configuredToken = process.env.WHATSAPP_VERIFY_TOKEN;

  // Strict token check: must match WHATSAPP_VERIFY_TOKEN
  const isMatch = token && configuredToken && token.trim() === configuredToken.trim();

  if (mode === 'subscribe' && isMatch) {
    console.log('[WhatsApp Webhook] Verification successful for challenge:', challenge);
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  } else {
    console.warn('[WhatsApp Webhook] Verification failed. Mode:', mode);
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function POST(request: Request) {
  const correlationId = `wa_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const rawBody = await request.text();

    // 1. Meta Webhook HMAC-SHA256 Signature Verification
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const signatureHeader = request.headers.get('x-hub-signature-256');

    if (appSecret) {
      if (!signatureHeader) {
        console.warn(`[WhatsApp Security] Rejected webhook missing X-Hub-Signature-256. Correlation: ${correlationId}`);
        return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
      }

      const expectedSignature = `sha256=${crypto
        .createHmac('sha256', appSecret)
        .update(rawBody)
        .digest('hex')}`;

      // Constant-time buffer comparison to prevent timing attacks
      const signatureBuffer = Buffer.from(signatureHeader);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (
        signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
      ) {
        console.warn(`[WhatsApp Security] Invalid X-Hub-Signature-256. Correlation: ${correlationId}`);
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);

    if (body.object !== 'whatsapp_business_account') {
      return new NextResponse('Not Found', { status: 404 });
    }

    // 2. Execute webhook processing directly
    try {
      await Promise.race([
        processWhatsAppMessage(body, correlationId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('WhatsApp processing timeout (>15s)')), 15000))
      ]);
    } catch (err: any) {
      console.error(`[WhatsApp Processing Error] Correlation: ${correlationId}`, err);
    }

    return NextResponse.json({ ok: true, correlation_id: correlationId });
  } catch (error: any) {
    console.error(`[WhatsApp Webhook Error] Correlation: ${correlationId}`, error);
    return NextResponse.json({ ok: true, error_logged: true, correlation_id: correlationId });
  }
}
