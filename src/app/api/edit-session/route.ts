import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session_id, business_id, customer_name, start_time, notes } = await request.json();

    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

    if (!session_id || !business_id) {
      return NextResponse.json({ error: 'Missing session_id or business_id' }, { status: 400 });
    }

    const session = await sessionRepository.findById(session_id, business_id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const dbUpdates: any = {};
    if (customer_name) dbUpdates.customer_name = customer_name;
    if (start_time) dbUpdates.start_time = start_time;

    if (Object.keys(dbUpdates).length > 0) {
      await sessionRepository.update(session_id, dbUpdates, business_id);
    }

    // Log to Google Sheets
    try {
      const { logActivityToSheet } = require('@/lib/googleSheets');
      await logActivityToSheet('EDIT_SESSION', {
        user: 'Club Owner',
        table: session.table_id,
        session: session_id,
        details: `Changed details: ${customer_name ? 'Name ' : ''}${start_time ? 'StartTime ' : ''}${notes ? 'Notes' : ''}`
      }, business_id);
    } catch (e) {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Edit Session Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
