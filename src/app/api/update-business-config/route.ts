import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { getBusinessEntitlement } from '@/lib/entitlements';
import { invalidateBusinessCache } from '@/lib/businessManager';
import { normalizePhone } from '@/lib/utils/phoneValidation';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const business_id = sessionCookie.businessId;

    if (body.business_id && body.business_id !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

    if (body.action === 'refresh_sheet_structure') {
      if (!body.google_sheet_id) return NextResponse.json({ error: 'No sheet ID provided' }, { status: 400 });
      const { initializeGoogleSheet } = require('@/lib/googleSheets');
      await initializeGoogleSheet(body.google_sheet_id);
      return NextResponse.json({ success: true });
    }

    const updatePayload: any = {};
    if (body.pricing_rules !== undefined) updatePayload.pricing_rules = body.pricing_rules;
    
    const entitlement = await getBusinessEntitlement(business_id);
    if (!entitlement.hasAccess) {
      return NextResponse.json({ error: 'Your subscription is inactive. Please upgrade to manage configuration.' }, { status: 403 });
    }

    if (body.tables !== undefined) {
      if (body.tables.length > entitlement.features.max_tables) {
        return NextResponse.json({ error: `Your ${entitlement.planName} plan only supports up to ${entitlement.features.max_tables} tables. Upgrade to add more.` }, { status: 403 });
      }
      updatePayload.tables = body.tables;
    }

    if (body.qpulse_config !== undefined) updatePayload.qpulse_config = body.qpulse_config;
    if (body.menu_items !== undefined) updatePayload.menu_items = body.menu_items;
    if (body.google_sheet_id !== undefined) updatePayload.google_sheet_id = body.google_sheet_id;
    if (body.business_name !== undefined) {
      updatePayload.business_name = body.business_name;
      // Auto-generate human-readable deep-link slug if not explicitly provided
      if (!body.slug) {
        updatePayload.slug = String(body.business_name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      }
    }
    if (body.slug !== undefined) {
      updatePayload.slug = String(body.slug)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    }
    if (body.owner_name !== undefined) updatePayload.owner_name = body.owner_name;

    // 1. Owner Login Phone Number Validation & Normalization
    if (body.contact_number !== undefined) {
      const normalizedOwnerPhone = normalizePhone(String(body.contact_number));
      if (!normalizedOwnerPhone) {
        return NextResponse.json({ error: 'Owner login contact number must be a valid 10-digit mobile number.' }, { status: 400 });
      }

      // Check uniqueness to prevent login collisions
      const { data: existingBiz } = await supabase
        .from('businesses')
        .select('id')
        .eq('contact_number', normalizedOwnerPhone)
        .neq('id', business_id)
        .maybeSingle();

      if (existingBiz) {
        return NextResponse.json({ error: 'Another club is already registered with this owner contact number.' }, { status: 409 });
      }

      updatePayload.contact_number = normalizedOwnerPhone;
    }

    // 2. Public Club Customer-Support Contact Number Validation & Normalization
    if (body.public_contact_number !== undefined) {
      if (body.public_contact_number && String(body.public_contact_number).trim() !== '') {
        const normalizedPublicPhone = normalizePhone(String(body.public_contact_number));
        if (!normalizedPublicPhone) {
          return NextResponse.json({ error: 'Club public contact number must be a valid 10-digit mobile number.' }, { status: 400 });
        }
        updatePayload.public_contact_number = normalizedPublicPhone;
      } else {
        updatePayload.public_contact_number = null;
      }
    }

    if (body.address !== undefined) updatePayload.address = body.address;
    if (body.business_type !== undefined) updatePayload.business_type = body.business_type;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('businesses')
      .update(updatePayload)
      .eq('id', business_id);

    if (error) {
      console.error('Error updating business config in Supabase:', error);
      throw error;
    }
    
    // Invalidate business cache across all subsystems (Telegram bot, Dashboard, etc.)
    invalidateBusinessCache(business_id);

    return NextResponse.json({ success: true, updated: updatePayload });
  } catch (error: any) {
    console.error('Update Business Config Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update business configuration' }, { status: 500 });
  }
}
