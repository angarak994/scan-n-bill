import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const startTime = Date.now();
    // Warm up Supabase connection pool and TLS session
    const { data, error } = await supabase.from('businesses').select('id').limit(1);
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'warm',
      healthy: !error,
      pingMs: durationMs,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
