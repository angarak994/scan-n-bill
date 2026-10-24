import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { businessManager } from '@/lib/businessManager';
import { normalizePhone } from '@/lib/utils/phoneValidation';
import { initializeGoogleSheet } from '@/lib/googleSheets';
import { setSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { refreshDemoTimestamps } from '@/lib/utils/refreshDemoData';
import { DEFAULT_LOCKED_FEATURES } from '@/lib/entitlements';
import { developerAuditService } from '@/lib/services/developerAuditService';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const {
      business_name,
      owner_name,
      contact_number,
      address,
      google_sheet_id,
      business_type,
      pricing_rules,
      tables,
      dashboard_pin,
      menu_items,
      is_demo
    } = data;

    if (!business_name || !owner_name || !contact_number || !google_sheet_id || !dashboard_pin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(contact_number);
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Contact number must be exactly 10 digits' }, { status: 400 });
    }

    // --- IDEMPOTENT DEMO BUSINESS LOGIC (Preserve for testing) ---
    if (is_demo) {
      const { data: existingDemos } = await supabase
        .from('businesses')
        .select('id, business_name, tables')
        .eq('business_name', 'Strike Zone (Demo)')
        .order('created_at', { ascending: true })
        .limit(1);

      if (existingDemos && existingDemos.length > 0) {
        const demoBiz = existingDemos[0];
        const businessId = demoBiz.id;

        await setSession(businessId, 'owner');
        
        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const businessSlug = demoBiz.business_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        const qrs = await Promise.all((demoBiz.tables || []).map(async (t: any) => {
          const tableId = t.id || t.table_id;
          const url = `${origin}/qr/${businessSlug}/${encodeURIComponent(tableId)}`;
          const dataUrl = await QRCode.toDataURL(url);
          return { name: t.name, dataUrl };
        }));

        const dashboardUrl = `${origin}/dashboard`;
        const dashboardQr = await QRCode.toDataURL(dashboardUrl);
        qrs.push({ name: 'Owner Dashboard', dataUrl: dashboardQr });

        await refreshDemoTimestamps(businessId);
        return NextResponse.json({ success: true, businessId, qrs, pin: '1234' }, { status: 200 });
      }
    }
    // -------------------------------------------------------------

    // Safe Google Sheet ID formatting
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
      console.warn('Google Sheets API Initialization Warning (Non-Fatal):', err?.message || err);
    }

    // Check duplicate registrations
    const { data: existingBiz } = await supabase
      .from('businesses')
      .select('id, business_name, status')
      .eq('contact_number', normalizedPhone)
      .maybeSingle();

    if (existingBiz) {
      const exStatus = (existingBiz.status || '').toUpperCase();
      if (exStatus === 'APPROVED' || exStatus === 'ACTIVE') {
        return NextResponse.json({
          error: 'A club is already registered and active with this contact number. Please log in with your Admin PIN.',
          businessId: existingBiz.id,
        }, { status: 409 });
      }
      if (exStatus === 'PENDING_APPROVAL') {
        return NextResponse.json({
          success: true,
          pendingApproval: true,
          businessId: existingBiz.id,
          business_name: existingBiz.business_name,
          message: 'Your registration application is already submitted and pending developer approval.',
        }, { status: 200 });
      }
    }

    const hashedPin = await bcrypt.hash(dashboard_pin.toString(), 10);
    const dynamicTables = (tables && tables.length > 0) ? tables : [
      { name: 'Table 1', id: 'Table 1', type: 'general' }
    ];

    // Create pending business application with locked initial feature entitlements
    const businessId = await businessManager.registerBusiness({
      business_name,
      owner_name,
      contact_number: normalizedPhone,
      address,
      google_sheet_id: finalSheetId,
      business_type,
      status: 'PENDING_APPROVAL',
      feature_entitlements: DEFAULT_LOCKED_FEATURES,
      pricing_rules,
      tables: dynamicTables,
      dashboard_pin: hashedPin,
      menu_items,
      created_at: new Date().toISOString()
    });

    // Create pending subscription record with 15-day trial configuration
    const { data: defaultPlan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('name', 'Growth')
      .maybeSingle();

    if (defaultPlan) {
      const subRes = await supabase.from('business_subscriptions').insert([{
        business_id: businessId,
        plan_id: defaultPlan.id,
        status: 'PENDING_APPROVAL',
        trial_duration_days: 15,
        agreed_price_paisa: 0,
        current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      }]);
      if (subRes.error) {
        await supabase.from('business_subscriptions').insert([{
          business_id: businessId,
          plan_id: defaultPlan.id,
          status: 'PENDING_APPROVAL',
          current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
        }]);
      }
    }

    // Immutable developer audit log
    await developerAuditService.log({
      developer_email: 'system@qcontrol.internal',
      action: 'BUSINESS_REGISTRATION_SUBMITTED',
      target_business_id: businessId,
      details: {
        business_name,
        owner_name,
        contact_number: normalizedPhone,
        tables_count: dynamicTables.length,
      },
      ip_address: request.headers.get('x-forwarded-for') || null,
    });

    // IMPORTANT: In Phase 3, pending businesses do NOT receive an active session cookie!
    // They must wait for the developer to approve and configure terms in /control.
    return NextResponse.json({
      success: true,
      pendingApproval: true,
      businessId,
      business_name,
      message: 'Registration application submitted successfully! Your club is currently pending platform developer review.',
    }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Registration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
