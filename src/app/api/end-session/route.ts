import { NextResponse } from 'next/server';
import { endSession } from '@/lib/sessionManager';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    const body = await request.json();
    const { table_id, business_id, amount_paid, payment_method } = body;
    let source = 'QR';
    
    if (sessionCookie) {
      if (sessionCookie.businessId !== business_id) {
        return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
      }
      source = 'System';
    }

    if (!table_id) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 });
    }
    const result = await endSession(table_id, business_id, source, amount_paid, payment_method);
    

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
