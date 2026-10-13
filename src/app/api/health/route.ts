import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, any> = {};
  let overallHealthy = true;

  // 1. Database Connectivity & Query Latency Check
  try {
    const dbStartTime = Date.now();
    const { data, error } = await supabase.from('businesses').select('id').limit(1);
    const dbLatencyMs = Date.now() - dbStartTime;

    if (error) {
      checks.database = { status: 'unhealthy', latencyMs: dbLatencyMs, error: error.message };
      overallHealthy = false;
    } else {
      checks.database = { status: 'healthy', latencyMs: dbLatencyMs };
    }
  } catch (dbErr: any) {
    checks.database = { status: 'unhealthy', error: dbErr?.message || String(dbErr) };
    overallHealthy = false;
  }

  // 2. Integration Configuration Checks (Safe: Checks presence without exposing secrets)
  checks.integrations = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    googleSheets: Boolean(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && 
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && 
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    ),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    telegramWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    jwt: Boolean(process.env.JWT_SECRET)
  };

  // 3. Process & Memory Metrics
  const mem = process.memoryUsage();
  const memoryMetrics = {
    rssMb: Number((mem.rss / 1024 / 1024).toFixed(2)),
    heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
    heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
    externalMb: Number((mem.external / 1024 / 1024).toFixed(2)),
  };

  // 4. Sheets Sync Queue Metrics (Non-blocking inspection)
  let queueStats: any = null;
  try {
    const { getSyncStats } = require('@/lib/sheetsSyncQueue');
    // Global fallback stats
    queueStats = getSyncStats('global');
  } catch {
    queueStats = { status: 'in-memory' };
  }

  const totalDurationMs = Date.now() - startTime;

  return NextResponse.json({
    status: overallHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    durationMs: totalDurationMs,
    memory: memoryMetrics,
    checks,
    queue: queueStats,
    version: '1.0.0-optimized'
  }, {
    status: overallHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Response-Time': `${totalDurationMs}ms`
    }
  });
}
