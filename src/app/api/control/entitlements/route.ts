import { NextResponse } from 'next/server';
import { getDeveloperSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { invalidateBusinessCache } from '@/lib/businessManager';
import {
  invalidateEntitlementCache,
  BusinessFeatureEntitlements,
  DEFAULT_LOCKED_FEATURES,
  DEFAULT_UNLOCKED_FEATURES
} from '@/lib/entitlements';
import { developerAuditService } from '@/lib/services/developerAuditService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const devSession = await getDeveloperSession(request);
    if (!devSession) {
      return NextResponse.json({ error: 'Unauthorized: Developer access required.' }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, feature, enabled, entitlements } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required.' }, { status: 400 });
    }

    const { data: business, error: findError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (findError || !business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }

    const bStatus = (business.status || '').toUpperCase();
    const baseDefaults = bStatus === 'ACTIVE' ? DEFAULT_UNLOCKED_FEATURES : DEFAULT_LOCKED_FEATURES;
    const rawEntitlements = business.feature_entitlements || business.qpulse_config?.feature_entitlements || {};
    const currentEntitlements: BusinessFeatureEntitlements = {
      ...baseDefaults,
      ...rawEntitlements,
    };

    let updatedEntitlements: BusinessFeatureEntitlements = { ...currentEntitlements };

    if (feature !== undefined && enabled !== undefined) {
      (updatedEntitlements as any)[feature] = Boolean(enabled);
    } else if (entitlements && typeof entitlements === 'object') {
      updatedEntitlements = {
        ...updatedEntitlements,
        ...entitlements,
      };
    } else {
      return NextResponse.json({ error: 'Provide either { feature, enabled } or { entitlements }' }, { status: 400 });
    }

    const currentQpulse = (business.qpulse_config || {}) as Record<string, any>;
    const updatedQpulse = { ...currentQpulse, feature_entitlements: updatedEntitlements };

    const updateResult = await supabase
      .from('businesses')
      .update({
        feature_entitlements: updatedEntitlements,
        qpulse_config: updatedQpulse,
      })
      .eq('id', businessId);

    if (updateResult.error) {
      const fallbackResult = await supabase
        .from('businesses')
        .update({ qpulse_config: updatedQpulse })
        .eq('id', businessId);
      if (fallbackResult.error) throw fallbackResult.error;
    }

    invalidateBusinessCache(businessId);
    invalidateEntitlementCache(businessId);

    await developerAuditService.log({
      developer_email: devSession.email,
      action: 'FEATURE_ENTITLEMENT_UPDATED',
      target_business_id: businessId,
      details: {
        business_name: business.business_name,
        changed_feature: feature || 'batch_update',
        new_state: feature ? enabled : updatedEntitlements,
      },
    });

    return NextResponse.json({
      success: true,
      businessId,
      entitlements: updatedEntitlements,
      message: 'Feature entitlements updated successfully.',
    });
  } catch (err: any) {
    console.error('Error updating entitlements:', err);
    return NextResponse.json({ error: err.message || 'Failed to update feature entitlements' }, { status: 500 });
  }
}
