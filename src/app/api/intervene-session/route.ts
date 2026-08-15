import { NextResponse } from 'next/server';
import { handleSessionIntervention } from '@/lib/services/interventionService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, session_id, business_id, amount_recovered, transfer_table_id } = body;

    await handleSessionIntervention({
      action,
      session_id,
      business_id,
      amount_recovered,
      transfer_table_id,
      performed_by: 'dashboard_user'
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Intervention Error:', error);
    // Determine status code based on error message
    let status = 500;
    if (error.message.includes('Missing') || error.message.includes('Invalid') || error.message.includes('is not')) {
      status = 400;
    } else if (error.message.includes('not found')) {
      status = 404;
    }
    return NextResponse.json({ error: error.message }, { status });
  }
}
