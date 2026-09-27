import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import QRCode from 'qrcode';
import { businessManager } from '@/lib/businessManager';
import { normalizePhone } from '@/lib/utils/phoneValidation';
import { initializeGoogleSheet } from '@/lib/googleSheets';
import bcrypt from 'bcryptjs';
import { setSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { business_name, owner_name, contact_number, address, google_sheet_id, business_type, pricing_rules, tables, dashboard_pin, menu_items } = data;

    if (!business_name || !owner_name || !contact_number || !google_sheet_id || !dashboard_pin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(contact_number);
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Contact number must be exactly 10 digits' }, { status: 400 });
    }

    let finalSheetId = google_sheet_id.trim();
    if (finalSheetId.includes('/d/')) {
      const match = finalSheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        finalSheetId = match[1];
      }
    }

    try {
      await initializeGoogleSheet(finalSheetId);
    } catch (err: any) {
      console.warn("Google Sheets API Initialization Warning (Non-Fatal):", err?.message || err);
    }

    const hashedPin = await bcrypt.hash(dashboard_pin.toString(), 10);
    const dynamicTables = (tables && tables.length > 0) ? tables : [
      { name: 'Table 1', id: 'Table 1', type: 'general' }
    ];

    const businessId = await businessManager.registerBusiness({
      business_name,
      owner_name,
      contact_number: normalizedPhone,
      address,
      google_sheet_id: finalSheetId,
      business_type,
      pricing_rules,
      tables: dynamicTables,
      dashboard_pin: hashedPin,
      menu_items,
      created_at: new Date().toISOString()
    });

    const { data: growthPlan } = await supabase.from('subscription_plans').select('id').eq('name', 'Growth').single();
    if (growthPlan) {
       await supabase.from('business_subscriptions').insert([{
          business_id: businessId,
          plan_id: growthPlan.id,
          status: 'trialing',
          current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
       }]);
    }

    await setSession(businessId, 'owner');

    const origin = request.headers.get('origin') || 'https://billiards-qr-sessions.vercel.app';
    const businessSlug = business_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const qrs = await Promise.all(dynamicTables.map(async (t: any) => {
      const tableId = t.id || t.table_id;
      const url = `${origin}/qr/${businessSlug}/${encodeURIComponent(tableId)}`;
      const dataUrl = await QRCode.toDataURL(url);
      return {
        name: t.name,
        dataUrl,
      };
    }));

    const dashboardUrl = `${origin}/dashboard`;
    const dashboardQr = await QRCode.toDataURL(dashboardUrl);
    qrs.push({ name: 'Owner Dashboard', dataUrl: dashboardQr });

    return NextResponse.json({ success: true, businessId, qrs, pin: dashboard_pin }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
