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

    const { data: businesses } = await supabase.from('businesses').select('id');
    if (!businesses) return NextResponse.json({ success: true, count: 0 });

    let cutoffCount = 0;
    const nowMs = Date.now();

    for (const business of businesses) {
      // We can fetch active sessions natively
      const { data: activeSessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('business_id', business.id)
        .eq('status', 'ACTIVE');

      if (!activeSessions) continue;

      for (const s of activeSessions) {
        if (s.start_time) {
          const startMs = new Date(s.start_time).getTime();
          if (nowMs - startMs > TWELVE_HOURS_MS) {
            try {
              await endSession(s.table_id, business.id);
              cutoffCount++;
            } catch (e) {
              console.error(`Failed to auto-end session ${s.id} in cron`, e);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, cutoffCount });
  } catch (error: any) {
    console.error('Cron auto-cutoff error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
