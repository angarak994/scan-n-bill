import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getDeveloperSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { developerAuditService } from '@/lib/services/developerAuditService';
import { invalidateBusinessCache } from '@/lib/businessManager';
import { invalidateEntitlementCache } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const devSession = await getDeveloperSession(request);
    if (!devSession) {
      return NextResponse.json({ error: 'Unauthorized: Developer access required.' }, { status: 401 });
    }

    const { businessId } = await request.json();

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required.' }, { status: 400 });
    }

    // 1. Fetch business & subscription records
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (bizError || !business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }

    const { data: subscription } = await supabase
      .from('business_subscriptions')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    // 2. Comprehensive Pre-Launch Checklist Validation
    const issues: string[] = [];
    const bStatus = (business.status || '').toUpperCase().trim();

    if (bStatus !== 'APPROVED' && bStatus !== 'ACTIVE') {
      issues.push(`Business status is '${bStatus}'. Business must be APPROVED before launching production.`);
    }

    const tables = business.tables || [];
    if (!Array.isArray(tables) || tables.length === 0) {
      issues.push('No tables or consoles are configured for this club.');
    }

    if (!business.google_sheet_id || business.google_sheet_id.trim().length === 0) {
      issues.push('Google Sheet ID is missing or invalid.');
    }

    if (!business.contact_number) {
      issues.push('Owner contact phone number is missing.');
    }

    if (!subscription) {
      issues.push('No subscription agreement found for this business.');
    }

    if (issues.length > 0) {
      return NextResponse.json({
        error: 'Pre-launch validation failed. Resolve the following requirements before activating production onboarding:',
        issues,
      }, { status: 422 });
    }

    // 3. Activate Production Onboarding
    const now = new Date().toISOString();
    const trialDays = subscription?.trial_duration_days || 15;
    const periodEnd = new Date(Date.now() + trialDays * 86400000).toISOString();

    const currentQpulse = (business.qpulse_config || {}) as Record<string, any>;
    const updatedQpulse = {
      ...currentQpulse,
      onboarded_at: now,
      onboarded_by: devSession.email,
    };

    const bizUpdateRes = await supabase
      .from('businesses')
      .update({
        onboarded_at: now,
        onboarded_by: devSession.email,
        status: 'APPROVED',
        qpulse_config: updatedQpulse,
      })
      .eq('id', businessId);

    if (bizUpdateRes.error) {
      await supabase
        .from('businesses')
        .update({
          status: 'APPROVED',
          qpulse_config: updatedQpulse,
        })
        .eq('id', businessId);
    }

    await supabase
      .from('business_subscriptions')
      .update({
        status: 'trialing',
        start_date: now,
        current_period_start: now,
        current_period_end: periodEnd,
        updated_at: now,
      })
      .eq('business_id', businessId);

    invalidateBusinessCache(businessId);
    invalidateEntitlementCache(businessId);

    // 4. Generate Production QR codes for convenience
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'https://billiards-qr-sessions.vercel.app';
    const businessSlug = (business.slug || business.business_name).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const qrs = await Promise.all(tables.map(async (t: any) => {
      const tableId = t.id || t.table_id || t.name;
      const url = `${origin}/qr/${businessSlug}/${encodeURIComponent(tableId)}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 300 });
      return {
        tableId,
        tableName: t.name || tableId,
        url,
        dataUrl,
      };
    }));

    await developerAuditService.log({
      developer_email: devSession.email,
      action: 'PRODUCTION_ONBOARDING_LAUNCHED',
      target_business_id: businessId,
      details: {
        business_name: business.business_name,
        tables_count: tables.length,
        trial_duration_days: trialDays,
        period_end: periodEnd,
      },
    });

    return NextResponse.json({
      success: true,
      businessId,
      businessName: business.business_name,
      onboardedAt: now,
      onboardedBy: devSession.email,
      trialDurationDays: trialDays,
      currentPeriodEnd: periodEnd,
      qrs,
      message: `Production onboarding successfully launched for '${business.business_name}'.`,
    });
  } catch (err: any) {
    console.error('Production onboarding launch error:', err);
    return NextResponse.json({ error: err.message || 'Failed to launch production onboarding' }, { status: 500 });
  }
}
