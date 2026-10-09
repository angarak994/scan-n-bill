import { NextResponse } from 'next/server';
import { endSession } from '@/lib/sessionManager';
import { getSession } from '@/lib/auth';
import { checkRateLimit, getIpAddress } from '@/lib/utils/rateLimit';

export async function POST(request: Request) {
  try {
    const ip = getIpAddress(request);
    if (!checkRateLimit(`end_sess_${ip}`, 30, 10 * 60 * 1000)) {
       return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const sessionCookie = await getSession();
    const body = await request.json();
    let { table_id, business_id, amount_paid, payment_method } = body;
    let source = 'QR';
    
    if (sessionCookie && sessionCookie.businessId) {
      if (business_id && sessionCookie.businessId !== business_id) {
        return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
      }
      business_id = sessionCookie.businessId; // Force business_id to match token
      source = 'System';
    } else {
      // Unauthenticated QR Flow
      if (!business_id) {
        return NextResponse.json({ error: 'business_id is required for QR actions' }, { status: 400 });
      }
      const { businessManager } = require('@/lib/businessManager');
      const business = await businessManager.getBusiness(business_id);
      if (!business) return NextResponse.json({ error: 'Invalid business' }, { status: 404 });
      
      const prefs = business.pricing_rules?.globalSettings?.preferences || {};
      if (prefs.auto_qr_billing === false) {
          return NextResponse.json({ error: 'QR billing is disabled for this business' }, { status: 403 });
      }
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
