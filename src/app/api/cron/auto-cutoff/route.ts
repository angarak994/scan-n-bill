import { NextResponse } from 'next/server';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { endSession } from '@/lib/sessionManager';
import { supabase } from '@/lib/supabaseClient';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export async function GET(request: Request) {
  try {
    // Optional: Protect cron endpoint using a secret token from Vercel
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const nowMs = Date.now();
    const cutoffThreshold = new Date(nowMs - TWELVE_HOURS_MS).toISOString();

    // 1. Single batch query across all businesses for overdue active sessions
    const { data: overdueSessions, error: queryError } = await supabase
      .from('sessions')
      .select('id, table_id, business_id, start_time')
      .eq('status', 'ACTIVE')
      .lt('start_time', cutoffThreshold);

    if (queryError) {
      console.error('Failed to query overdue sessions:', queryError);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    let cutoffCount = 0;
    if (overdueSessions && overdueSessions.length > 0) {
      for (const s of overdueSessions) {
        try {
          if (!s.business_id) {
            await supabase.from('sessions').update({
              status: 'COMPLETED',
              end_time: new Date().toISOString(),
              closure_type: 'auto_cutoff',
              completed_by: 'Auto-Cutoff Cron'
            }).eq('id', s.id);
            cutoffCount++;
            continue;
          }
          await endSession(s.table_id, s.business_id, 'Auto-Cutoff');
          cutoffCount++;
        } catch (e) {
          console.error(`Failed to auto-end session ${s.id} in cron`, e);
        }
      }
    }

    // 2. Automated Retention Cleanup: purge ephemeral realtime sync events older than 24 hours
    // This prevents unbounded storage growth in Supabase while preserving all business data & audit logs.
    let cleanedSyncCount = 0;
    try {
      const oneDayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('dashboard_syncs')
        .delete({ count: 'exact' })
        .lt('created_at', oneDayAgo);
      cleanedSyncCount = count || 0;
    } catch (cleanupErr) {
      console.warn('Non-critical dashboard_syncs cleanup warning:', cleanupErr);
    }

    if (cutoffCount > 0) {
      try {
        const { flushSheetsSyncQueue } = require('@/lib/sheetsSyncQueue');
        await flushSheetsSyncQueue(undefined, 5000);
      } catch (sheetSyncErr) {
        console.warn('[AutoCutoff] Sheets sync flush warning:', sheetSyncErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      cutoffCount, 
      cleanedSyncCount,
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    console.error('Cron auto-cutoff error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
