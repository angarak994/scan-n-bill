import { NextResponse } from 'next/server';
import { processWhatsAppMessage } from '@/lib/services/whatsappMessageProcessor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const configuredToken = (process.env.WHATSAPP_VERIFY_TOKEN || 'qcontrol_secret_token_123').trim();

  // Allow match against configured token or default secret token
  const isMatch = token && (token === configuredToken || token === 'qcontrol_secret_token_123');

  if (mode === 'subscribe' && isMatch) {
    console.log('[WhatsApp Webhook] Verification successful for challenge:', challenge);
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  } else {
    console.warn('[WhatsApp Webhook] Verification failed. Received token:', token, 'Mode:', mode);
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function POST(request: Request) {
  const correlationId = `wa_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const body = await request.json();

    if (body.object !== 'whatsapp_business_account') {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Process asynchronously with timeout protection
    // Immediate ACK to Meta (< 50ms) to prevent timeout / retry storming
    Promise.resolve().then(async () => {
      try {
        await Promise.race([
          processWhatsAppMessage(body, correlationId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('WhatsApp processing timeout (>15s)')), 15000))
        ]);
      } catch (err: any) {
        console.error(`[WhatsApp Background Worker] Correlation: ${correlationId} Error:`, err);
      }
    });

    return NextResponse.json({ ok: true, correlation_id: correlationId });
  } catch (error: any) {
    console.error(`[WhatsApp Webhook Error] Correlation: ${correlationId}`, error);
    // Always return 200 OK with error acknowledgment to prevent Meta from disabling the webhook
    return NextResponse.json({ ok: true, error_logged: true, correlation_id: correlationId });
  }
}
