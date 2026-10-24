import { NextResponse } from 'next/server';
import { getDeveloperSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const devSession = await getDeveloperSession(request);
    if (!devSession) {
      return NextResponse.json({ error: 'Unauthorized: Developer access required.' }, { status: 401 });
    }

    const startTime = Date.now();
    const { count: bizCount, error: bizErr } = await supabase
      .from('businesses')
      .select('id', { count: 'exact', head: true });
    const dbLatencyMs = Date.now() - startTime;

    const { count: pendingCount } = await supabase
      .from('businesses')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING_APPROVAL');

    const { count: activeSessionsCount } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    const integrations = {
      whatsapp: {
        configured: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
        hasVerifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
        hasAppSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
      },
      googleSheets: {
        configured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
      },
      telegram: {
        configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      },
      razorpay: {
        configured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
        hasWebhookSecret: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      },
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        connected: !bizErr,
        latencyMs: dbLatencyMs,
        totalBusinesses: bizCount || 0,
        pendingApprovals: pendingCount || 0,
        activeSessions: activeSessionsCount || 0,
      },
      integrations,
    });
  } catch (err: any) {
    console.error('Developer health check error:', err);
    return NextResponse.json({ error: err.message || 'System health check failed' }, { status: 500 });
  }
}
