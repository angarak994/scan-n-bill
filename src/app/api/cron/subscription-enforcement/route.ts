import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { invalidateBusinessCache } from '@/lib/businessManager';
import { invalidateEntitlementCache } from '@/lib/entitlements';
import { developerAuditService } from '@/lib/services/developerAuditService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleEnforcement(request);
}

export async function POST(request: Request) {
  return handleEnforcement(request);
}

async function handleEnforcement(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET || process.env.DEVELOPER_SECRET;

    // Verify cron authorization
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && request.headers.get('x-cron-secret') !== cronSecret) {
      // Also allow developer session cookie
      const { getDeveloperSession } = require('@/lib/auth');
      const dev = await getDeveloperSession(request);
      if (!dev) {
        return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Fetch all trialing and past_due subscriptions
    const { data: subs, error } = await supabase
      .from('business_subscriptions')
      .select('id, business_id, status, current_period_end, grace_period_days, agreed_price_paisa')
      .in('status', ['trialing', 'past_due', 'active']);

    if (error) throw error;

    const summary = {
      evaluated: (subs || []).length,
      trialsExpired: 0,
      suspendedPastDue: 0,
      preservedActiveSessions: 0,
    };

    for (const sub of subs || []) {
      if (!sub.current_period_end) continue;
      const periodEnd = new Date(sub.current_period_end);

      // Check if period has ended
      if (periodEnd.getTime() < now.getTime()) {
        const graceDays = sub.grace_period_days ?? 3;
        const graceExpiry = new Date(periodEnd.getTime() + graceDays * 86400000);

        if (sub.status === 'trialing') {
          // Transition to past_due within grace window
          if (now.getTime() < graceExpiry.getTime()) {
            await supabase
              .from('business_subscriptions')
              .update({ status: 'past_due', updated_at: nowIso })
              .eq('id', sub.id);
            summary.trialsExpired++;
          } else {
            // Beyond grace window: Suspend business safely
            await suspendBusinessSafely(sub.business_id, summary, nowIso);
            summary.suspendedPastDue++;
          }
        } else if (sub.status === 'past_due' && now.getTime() >= graceExpiry.getTime()) {
          // Grace period expired
          await suspendBusinessSafely(sub.business_id, summary, nowIso);
          summary.suspendedPastDue++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: nowIso,
      summary,
    });
  } catch (err: any) {
    console.error('[SubscriptionEnforcement] Error:', err);
    return NextResponse.json({ error: err.message || 'Enforcement failed' }, { status: 500 });
  }
}

async function suspendBusinessSafely(businessId: string, summary: any, timestamp: string) {
  // Safety rule: Check if business has currently running ACTIVE sessions
  const { count: activeCount } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'ACTIVE');

  if (activeCount && activeCount > 0) {
    // Preserve data and do not interrupt customers actively playing at tables
    summary.preservedActiveSessions += activeCount;
    console.log(`[SubscriptionEnforcement] Club ${businessId} has ${activeCount} active sessions. Deferring abrupt suspension.`);
    return;
  }

  // Update subscription and business status to SUSPENDED
  await supabase
    .from('business_subscriptions')
    .update({ status: 'suspended', updated_at: timestamp })
    .eq('business_id', businessId);

  await supabase
    .from('businesses')
    .update({ status: 'SUSPENDED', approval_notes: 'Suspended automatically due to trial/subscription expiration.' })
    .eq('id', businessId);

  invalidateBusinessCache(businessId);
  invalidateEntitlementCache(businessId);

  await developerAuditService.log({
    developer_email: 'cron@qcontrol.internal',
    action: 'SUBSCRIPTION_EXPIRED_SUSPENDED',
    target_business_id: businessId,
    details: { reason: 'Grace period expired without verified payment.' },
  });
}
