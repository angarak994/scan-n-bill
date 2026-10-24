import { NextResponse } from 'next/server';
import { getDeveloperSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { invalidateBusinessCache } from '@/lib/businessManager';
import { invalidateEntitlementCache } from '@/lib/entitlements';
import { developerAuditService } from '@/lib/services/developerAuditService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const devSession = await getDeveloperSession(request);
    if (!devSession) {
      return NextResponse.json({ error: 'Unauthorized: Developer access required.' }, { status: 401 });
    }

    const { businessId, action, notes, reason } = await request.json();

    if (!businessId || !action) {
      return NextResponse.json({ error: 'businessId and action are required.' }, { status: 400 });
    }

    const cleanAction = action.toUpperCase().trim();
    if (cleanAction !== 'APPROVE' && cleanAction !== 'REJECT' && cleanAction !== 'SUSPEND' && cleanAction !== 'REACTIVATE') {
      return NextResponse.json({ error: 'Invalid action. Supported: APPROVE, REJECT, SUSPEND, REACTIVATE' }, { status: 400 });
    }

    const { data: business, error: findError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (findError || !business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    let nextStatus = 'PENDING_APPROVAL';
    const updatePayload: Record<string, any> = {};

    if (cleanAction === 'APPROVE') {
      nextStatus = 'APPROVED';
      updatePayload.status = 'APPROVED';
      updatePayload.approved_at = now;
      updatePayload.approved_by = devSession.email;
      updatePayload.approval_notes = notes || null;
      updatePayload.rejection_reason = null;

      // Also ensure subscription has trialing status
      await supabase
        .from('business_subscriptions')
        .update({
          status: 'trialing',
          current_period_end: new Date(Date.now() + 15 * 86400000).toISOString(),
          updated_at: now,
        })
        .eq('business_id', businessId);
    } else if (cleanAction === 'REJECT') {
      nextStatus = 'REJECTED';
      updatePayload.status = 'REJECTED';
      updatePayload.rejection_reason = reason || notes || 'Application rejected by platform developer.';
    } else if (cleanAction === 'SUSPEND') {
      nextStatus = 'SUSPENDED';
      updatePayload.status = 'SUSPENDED';
      updatePayload.approval_notes = notes || 'Suspended by platform administrator.';
    } else if (cleanAction === 'REACTIVATE') {
      nextStatus = 'APPROVED';
      updatePayload.status = 'APPROVED';
      updatePayload.approval_notes = notes || 'Reactivated by platform administrator.';
    }

    const currentQpulse = (business.qpulse_config || {}) as Record<string, any>;
    const updatedQpulse = {
      ...currentQpulse,
      approval_info: {
        status: nextStatus,
        action: cleanAction,
        notes: notes || reason || null,
        updated_at: now,
        updated_by: devSession.email,
      }
    };

    const updatePayloadWithFallback = {
      ...updatePayload,
      qpulse_config: updatedQpulse,
    };

    let { error: updateError } = await supabase
      .from('businesses')
      .update(updatePayloadWithFallback)
      .eq('id', businessId);

    if (updateError) {
      const fallbackResult = await supabase
        .from('businesses')
        .update({
          status: nextStatus,
          qpulse_config: updatedQpulse,
        })
        .eq('id', businessId);
      if (fallbackResult.error) throw fallbackResult.error;
    }

    // Invalidate runtime caches
    invalidateBusinessCache(businessId);
    invalidateEntitlementCache(businessId);

    // Immutable audit log
    await developerAuditService.log({
      developer_email: devSession.email,
      action: `BUSINESS_${cleanAction}`,
      target_business_id: businessId,
      details: {
        business_name: business.business_name,
        contact_number: business.contact_number,
        previous_status: business.status,
        new_status: nextStatus,
        notes: notes || reason || null,
      },
    });

    return NextResponse.json({
      success: true,
      businessId,
      status: nextStatus,
      message: `Business successfully ${cleanAction.toLowerCase()}d.`,
    });
  } catch (err: any) {
    console.error('Error executing business approval action:', err);
    return NextResponse.json({ error: err.message || 'Failed to update business approval status' }, { status: 500 });
  }
}
