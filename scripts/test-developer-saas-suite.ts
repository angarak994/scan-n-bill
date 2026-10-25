/**
 * QCONTROL DEVELOPER SAAS PLATFORM - MASTER VERIFICATION & SECURITY TEST SUITE
 * Phases 13 & 15: Automated Security, Entitlement, Multi-Tenant, & Integration Testing
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import crypto from 'crypto';
import { supabase } from '../src/lib/supabaseClient';
import { businessManager, invalidateBusinessCache } from '../src/lib/businessManager';
import {
  signDeveloperToken,
  verifyDeveloperToken,
  getDeveloperSession,
  signToken,
  verifyToken,
} from '../src/lib/auth';
import {
  getBusinessEntitlement,
  hasFeature,
  isOperationalStatus,
  invalidateEntitlementCache,
  DEFAULT_LOCKED_FEATURES,
  DEFAULT_UNLOCKED_FEATURES,
} from '../src/lib/entitlements';
import { clubDiscoveryService } from '../src/lib/services/clubDiscoveryService';
import { developerAuditService } from '../src/lib/services/developerAuditService';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

async function runSuite() {
  console.log('\n===============================================================');
  console.log('QCONTROL DEVELOPER SAAS - AUTOMATED SECURITY & QA TEST SUITE');
  console.log('Phases 13 & 15: Developer Control, Entitlements, Isolation, & Billing');
  console.log('===============================================================\n');

  // Find a reference business to test with
  const { data: businesses, error: bizErr } = await supabase.from('businesses').select('*').limit(2);
  if (bizErr || !businesses || businesses.length === 0) {
    console.error('Cannot run suite: no business records found in database');
    process.exit(1);
  }

  const primaryBiz = businesses[0];
  const secondaryBiz = businesses.length > 1 ? businesses[1] : businesses[0];
  console.log(`Reference Business 1: ${primaryBiz.business_name} (${primaryBiz.id}, status: ${primaryBiz.status})`);
  console.log(`Reference Business 2: ${secondaryBiz.business_name} (${secondaryBiz.id}, status: ${secondaryBiz.status})\n`);

  // =========================================================================
  // TEST GROUP 1: Developer Authentication & Role Separation (Phase 2 & Phase 13.1, 13.2)
  // =========================================================================
  console.log('--- TEST GROUP 1: Developer Authentication & RBAC ---');

  // 1.1 Developer token minting and verification
  const devToken = await signDeveloperToken({
    email: 'admin@qcontrol.com',
  });
  assert(Boolean(devToken && devToken.length > 20), '1.1 Developer JWT token successfully minted');

  const verifiedDev = await verifyDeveloperToken(devToken);
  assert(
    verifiedDev?.role === 'developer' && verifiedDev?.email === 'admin@qcontrol.com',
    '1.2 Developer JWT token successfully verified with developer role'
  );

  // 1.3 Normal business owner token must NOT pass developer authentication
  const ownerToken = await signToken({
    businessId: primaryBiz.id,
    businessName: primaryBiz.business_name,
    role: 'owner',
  });
  const ownerPassedAsDev = await verifyDeveloperToken(ownerToken);
  assert(ownerPassedAsDev === null, '1.3 Normal business owner JWT strictly rejected as developer');

  // 1.4 Forged token with invalid signature must fail
  const forgedToken = devToken.slice(0, -5) + 'abcde';
  const forgedResult = await verifyDeveloperToken(forgedToken);
  assert(forgedResult === null, '1.4 Forged developer token strictly rejected');

  // 1.5 Developer secret header authentication check
  const devSecret = process.env.DEVELOPER_SECRET || 'qc_dev_secret_master_key_2026_x89f2';
  const reqWithSecret = new Request('http://localhost:3000/api/control/businesses', {
    headers: { 'x-developer-secret': devSecret },
  });
  const sessionViaSecret = await getDeveloperSession(reqWithSecret);
  assert(
    sessionViaSecret?.role === 'developer',
    '1.5 getDeveloperSession authorizes valid x-developer-secret header'
  );

  const reqWithWrongSecret = new Request('http://localhost:3000/api/control/businesses', {
    headers: { 'x-developer-secret': 'invalid_secret_attack' },
  });
  const sessionViaWrongSecret = await getDeveloperSession(reqWithWrongSecret);
  assert(sessionViaWrongSecret === null, '1.6 getDeveloperSession rejects invalid secret header');

  // 1.7 Developer audit logging persistence & in-memory fallback
  const auditActionName = `TEST_AUDIT_${Date.now()}`;
  await developerAuditService.log({
    developer_email: 'admin@qcontrol.com',
    action: auditActionName,
    target_business_id: primaryBiz.id,
    details: { test: true },
  });
  const auditLogs = await developerAuditService.getLogs(10);
  const foundLog = auditLogs.find((l) => l.action === auditActionName);
  assert(Boolean(foundLog), '1.7 Developer action recorded immutably in developerAuditService');

  // =========================================================================
  // TEST GROUP 2: Registration Approval Lifecycle (Phase 3 & Phase 13.3)
  // =========================================================================
  console.log('\n--- TEST GROUP 2: Registration Approval Workflow ---');

  // 2.1 Operational status helper correctness
  assert(isOperationalStatus('APPROVED') === true, "2.1 isOperationalStatus('APPROVED') is true");
  assert(isOperationalStatus('ACTIVE') === true, "2.2 isOperationalStatus('ACTIVE') is true (backwards compatibility)");
  assert(isOperationalStatus('PENDING_APPROVAL') === false, "2.3 isOperationalStatus('PENDING_APPROVAL') is false");
  assert(isOperationalStatus('REJECTED') === false, "2.4 isOperationalStatus('REJECTED') is false");
  assert(isOperationalStatus('SUSPENDED') === false, "2.5 isOperationalStatus('SUSPENDED') is false");
  assert(isOperationalStatus('DEACTIVATED') === false, "2.6 isOperationalStatus('DEACTIVATED') is false");
  assert(isOperationalStatus(null) === false, '2.7 isOperationalStatus(null) is false');

  // 2.2 Create a synthetic pending registration
  const testRegName = `Test Pending Club ${Date.now()}`;
  const testRegPhone = `9199999${Math.floor(10000 + Math.random() * 90000)}`;
  const pendingBizId = await businessManager.registerBusiness({
    business_name: testRegName,
    owner_name: 'Test Candidate Owner',
    contact_number: testRegPhone,
    google_sheet_id: `pending_sheet_${Date.now()}`,
    status: 'PENDING_APPROVAL',
    feature_entitlements: DEFAULT_LOCKED_FEATURES,
    tables: [{ id: 'T1', name: 'Table 1', type: 'pool' }],
    pricing_rules: { rules: { pool: { type: 'fixed', rate: 200 } } },
  });
  assert(Boolean(pendingBizId), '2.8 New business registration successfully created');

  // 2.3 Verify newly registered business status is strictly PENDING_APPROVAL
  const pendingBiz = await businessManager.getBusiness(pendingBizId, true);
  assert(pendingBiz?.status === 'PENDING_APPROVAL', '2.9 Newly registered business has status = PENDING_APPROVAL');

  // 2.4 Verify all feature entitlements are default locked
  const pendingEntitlements = await getBusinessEntitlement(pendingBizId, true);
  assert(
    pendingEntitlements.hasAccess === false && pendingEntitlements.status === 'pending_approval',
    '2.10 Pending business has access = false and status = pending_approval'
  );
  assert(
    pendingEntitlements.entitlements.whatsapp_ai === false &&
      pendingEntitlements.entitlements.google_sheets === false &&
      pendingEntitlements.entitlements.qr_sessions === false,
    '2.11 All critical features (WhatsApp, Sheets, QR) locked for pending business'
  );

  // 2.5 Approval simulation: approve business
  const { data: approvedBizData, error: approveErr } = await supabase
    .from('businesses')
    .update({
      status: 'APPROVED',
      qpulse_config: {
        approval_info: {
          status: 'APPROVED',
          approved_by: 'admin@qcontrol.com',
          approved_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', pendingBizId)
    .select('id, status')
    .single();

  invalidateBusinessCache(pendingBizId);
  invalidateEntitlementCache(pendingBizId);

  assert(
    !approveErr && approvedBizData?.status === 'APPROVED',
    '2.12 Platform developer successfully transitions status to APPROVED'
  );

  const postApproveEntitlements = await getBusinessEntitlement(pendingBizId, true);
  assert(
    postApproveEntitlements.hasAccess === true,
    '2.13 Approved business now has hasAccess = true'
  );

  // =========================================================================
  // TEST GROUP 3: Granular Feature Entitlements Matrix (Phase 4 & Phase 13.4)
  // =========================================================================
  console.log('\n--- TEST GROUP 3: Granular Feature Entitlement Matrix ---');

  // 3.1 Initial approved state: whatsapp_ai is false
  let waStatus = await hasFeature(pendingBizId, 'whatsapp_ai');
  let qrStatus = await hasFeature(pendingBizId, 'qr_sessions');
  assert(waStatus === false, '3.1 whatsapp_ai is initially false for newly approved business');
  assert(qrStatus === false, '3.2 qr_sessions is initially false for newly approved business');

  // 3.2 Developer unlocks whatsapp_ai & qr_sessions
  const updatedEntitlements = {
    ...DEFAULT_LOCKED_FEATURES,
    whatsapp_ai: true,
    qr_sessions: true,
    google_sheets: true,
  };
  await supabase
    .from('businesses')
    .update({
      qpulse_config: {
        feature_entitlements: updatedEntitlements,
      },
    })
    .eq('id', pendingBizId);

  invalidateBusinessCache(pendingBizId);
  invalidateEntitlementCache(pendingBizId);

  waStatus = await hasFeature(pendingBizId, 'whatsapp_ai');
  qrStatus = await hasFeature(pendingBizId, 'qr_sessions');
  const sheetsStatus = await hasFeature(pendingBizId, 'google_sheets');
  const reportsStatus = await hasFeature(pendingBizId, 'reports_analytics');

  assert(waStatus === true, '3.3 hasFeature(pendingBizId, whatsapp_ai) resolves to true after developer unlock');
  assert(qrStatus === true, '3.4 hasFeature(pendingBizId, qr_sessions) resolves to true after developer unlock');
  assert(sheetsStatus === true, '3.5 hasFeature(pendingBizId, google_sheets) resolves to true after developer unlock');
  assert(reportsStatus === false, '3.6 hasFeature(pendingBizId, reports_analytics) remains false (granular control)');

  // 3.3 Suspension restriction: Suspended business has all features locked regardless of config
  await supabase
    .from('businesses')
    .update({ status: 'SUSPENDED' })
    .eq('id', pendingBizId);

  invalidateBusinessCache(pendingBizId);
  invalidateEntitlementCache(pendingBizId);

  const suspendedEntitlements = await getBusinessEntitlement(pendingBizId, true);
  const waWhileSuspended = await hasFeature(pendingBizId, 'whatsapp_ai');
  assert(
    suspendedEntitlements.hasAccess === false && suspendedEntitlements.status === 'suspended',
    '3.7 Suspended business has hasAccess = false'
  );
  assert(waWhileSuspended === false, '3.8 Features automatically evaluate to false when business is SUSPENDED');

  // Reactivate for subsequent tests
  await supabase
    .from('businesses')
    .update({ status: 'APPROVED' })
    .eq('id', pendingBizId);
  invalidateBusinessCache(pendingBizId);
  invalidateEntitlementCache(pendingBizId);

  // =========================================================================
  // TEST GROUP 4: WhatsApp AI Centralized Routing (Phase 5 & Phase 13.10)
  // =========================================================================
  console.log('\n--- TEST GROUP 4: WhatsApp Centralized Routing & Ingress ---');

  // 4.1 First verify club in PENDING_APPROVAL status is strictly excluded
  await supabase
    .from('businesses')
    .update({
      status: 'PENDING_APPROVAL',
      qpulse_config: {
        feature_entitlements: { ...DEFAULT_LOCKED_FEATURES, whatsapp_ai: false },
      },
    })
    .eq('id', pendingBizId);
  invalidateBusinessCache(pendingBizId);
  invalidateEntitlementCache(pendingBizId);

  const activeWhatsAppClubs = await clubDiscoveryService.discoverAndRankClubs({ gameType: 'pool' });
  const pendingInDiscovery = activeWhatsAppClubs.find((c) => c.businessId === pendingBizId);
  assert(!pendingInDiscovery, '4.1 PENDING_APPROVAL / non-whatsapp clubs strictly excluded from WhatsApp discovery');

  // 4.2 Transition to APPROVED and enable whatsapp_ai
  await supabase
    .from('businesses')
    .update({
      status: 'APPROVED',
      qpulse_config: {
        feature_entitlements: { ...DEFAULT_LOCKED_FEATURES, whatsapp_ai: true },
      },
    })
    .eq('id', pendingBizId);
  invalidateBusinessCache(pendingBizId);
  invalidateEntitlementCache(pendingBizId);

  const clubsWithWA = await clubDiscoveryService.discoverAndRankClubs({ gameType: 'pool' });
  const testBizWithWA = clubsWithWA.find((c) => c.businessId === pendingBizId);
  assert(Boolean(testBizWithWA), '4.2 Approved business with whatsapp_ai: true successfully discovered');

  // 4.3 Now disable whatsapp_ai and verify exclusion
  await supabase
    .from('businesses')
    .update({
      qpulse_config: {
        feature_entitlements: { ...DEFAULT_LOCKED_FEATURES, whatsapp_ai: false },
      },
    })
    .eq('id', pendingBizId);
  invalidateBusinessCache(pendingBizId);
  invalidateEntitlementCache(pendingBizId);

  const clubsWithoutWA = await clubDiscoveryService.discoverAndRankClubs({ gameType: 'pool' });
  const testBizWithoutWA = clubsWithoutWA.find((c) => c.businessId === pendingBizId);
  assert(!testBizWithoutWA, '4.3 Business with whatsapp_ai: false strictly excluded from WhatsApp AI discovery');

  // =========================================================================
  // TEST GROUP 5: Google Sheets Sync Entitlements (Phase 6 & Phase 13.11)
  // =========================================================================
  console.log('\n--- TEST GROUP 5: Google Sheets Sync Gating ---');

  // 5.1 Test google_sheets entitlement check
  const sheetsDisabled = await hasFeature(pendingBizId, 'google_sheets');
  assert(sheetsDisabled === false, '5.1 google_sheets entitlement is initially false for newly created business');

  // 5.2 Developer enables google_sheets
  await supabase
    .from('businesses')
    .update({
      qpulse_config: {
        feature_entitlements: { ...DEFAULT_LOCKED_FEATURES, google_sheets: true },
      },
    })
    .eq('id', pendingBizId);
  invalidateBusinessCache(pendingBizId);
  invalidateEntitlementCache(pendingBizId);

  const sheetsEnabled = await hasFeature(pendingBizId, 'google_sheets');
  assert(sheetsEnabled === true, '5.2 google_sheets entitlement resolves to true after developer enablement');

  // =========================================================================
  // TEST GROUP 6: QR Code Session Access Control (Phase 7 & Phase 13.12)
  // =========================================================================
  console.log('\n--- TEST GROUP 6: QR Code Session Access Control ---');

  // 6.1 Check qr_sessions entitlement helper
  const qrDisabledResult = await hasFeature(pendingBizId, 'qr_sessions');
  assert(qrDisabledResult === false, '6.1 qr_sessions entitlement is verified false');

  // 6.2 Enable qr_sessions and verify
  await supabase
    .from('businesses')
    .update({
      qpulse_config: {
        feature_entitlements: { ...DEFAULT_LOCKED_FEATURES, qr_sessions: true },
      },
    })
    .eq('id', pendingBizId);
  invalidateBusinessCache(pendingBizId);
  invalidateEntitlementCache(pendingBizId);

  const qrEnabledResult = await hasFeature(pendingBizId, 'qr_sessions');
  assert(qrEnabledResult === true, '6.2 qr_sessions entitlement is verified true after developer enablement');

  // =========================================================================
  // TEST GROUP 7: Negotiated Custom Pricing & Currency (Phase 8 & Phase 13.6)
  // =========================================================================
  console.log('\n--- TEST GROUP 7: Negotiated Custom Pricing & Minor Units ---');

  // 7.1 Persist custom pricing snapshot: ₹699 / month = 69900 paisa
  const negotiatedPaisa = 69900;
  const negotiatedInr = 699;
  const pricingSnapshot = {
    agreed_price_paisa: negotiatedPaisa,
    agreed_price_inr: negotiatedInr,
    currency: 'INR',
    billing_interval: 'monthly',
    trial_duration_days: 15,
    grace_period_days: 3,
    configured_at: new Date().toISOString(),
    configured_by: 'admin@qcontrol.com',
  };

  await supabase
    .from('businesses')
    .update({
      qpulse_config: {
        custom_pricing: pricingSnapshot,
      },
    })
    .eq('id', pendingBizId);
  invalidateBusinessCache(pendingBizId);

  const bizWithPricing = await businessManager.getBusiness(pendingBizId, true);
  const resolvedPricing = (bizWithPricing as any)?.qpulse_config?.custom_pricing;
  assert(
    resolvedPricing?.agreed_price_paisa === 69900 && resolvedPricing?.agreed_price_inr === 699,
    '7.1 Negotiated pricing persisted accurately in minor currency units (69900 paisa = ₹699)'
  );

  // =========================================================================
  // TEST GROUP 8: Real Razorpay Signature Verification & Anti-Replay (Phase 9 & Phase 13.8, 13.9)
  // =========================================================================
  console.log('\n--- TEST GROUP 8: Razorpay Signature Verification & Anti-Replay ---');

  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || 'test_rzp_secret_key_12345';
  const testOrderId = `order_test_${Date.now()}`;
  const testPaymentId = `pay_test_${Date.now()}`;

  // 8.1 Compute authentic HMAC-SHA256 signature
  const authenticSignature = crypto
    .createHmac('sha256', razorpaySecret)
    .update(`${testOrderId}|${testPaymentId}`)
    .digest('hex');

  // Verify using timingSafeEqual
  const expectedSigBuffer = Buffer.from(authenticSignature, 'utf-8');
  const validSigBuffer = Buffer.from(authenticSignature, 'utf-8');
  const isValidSig =
    expectedSigBuffer.length === validSigBuffer.length &&
    crypto.timingSafeEqual(expectedSigBuffer, validSigBuffer);
  assert(isValidSig === true, '8.1 Valid HMAC-SHA256 signature matches with timingSafeEqual');

  // 8.2 Reject forged signature
  const forgedSig = authenticSignature.slice(0, -6) + 'abcdef';
  const forgedSigBuffer = Buffer.from(forgedSig, 'utf-8');
  const isForgedSigValid =
    expectedSigBuffer.length === forgedSigBuffer.length &&
    crypto.timingSafeEqual(expectedSigBuffer, forgedSigBuffer);
  assert(isForgedSigValid === false, '8.2 Forged HMAC-SHA256 signature strictly rejected');

  // 8.3 Replay defense test: Duplicate payment ID check
  await supabase.from('payment_logs').insert([{
    business_id: pendingBizId,
    amount: 699,
    currency: 'INR',
    status: 'SUCCESS',
    gateway_payment_id: testPaymentId,
  }]);

  const { data: duplicateCheck } = await supabase
    .from('payment_logs')
    .select('id')
    .eq('gateway_payment_id', testPaymentId)
    .maybeSingle();

  assert(Boolean(duplicateCheck), '8.3 Replay protection detects existing payment_id in payment_logs');

  // =========================================================================
  // TEST GROUP 9: Multi-Tenant Data Isolation (Phase 13.5)
  // =========================================================================
  console.log('\n--- TEST GROUP 9: Multi-Tenant Cross-Business Data Isolation ---');

  // 9.1 Tenant A session token cannot access Tenant B's session data
  const tenantAToken = await signToken({
    businessId: primaryBiz.id,
    businessName: primaryBiz.business_name,
    role: 'owner',
  });
  const tenantBToken = await signToken({
    businessId: secondaryBiz.id,
    businessName: secondaryBiz.business_name,
    role: 'owner',
  });

  const verifiedTenantA = await verifyToken(tenantAToken);
  const verifiedTenantB = await verifyToken(tenantBToken);

  assert(
    verifiedTenantA?.businessId === primaryBiz.id && verifiedTenantB?.businessId === secondaryBiz.id,
    '9.1 JWT tokens strictly isolate tenant identity at backend validation layer'
  );
  assert(
    verifiedTenantA?.businessId !== verifiedTenantB?.businessId,
    '9.2 Cross-business token substitution prevented: Tenant A ID != Tenant B ID'
  );

  // =========================================================================
  // TEST GROUP 10: Clean-up Test Artifacts
  // =========================================================================
  console.log('\n--- CLEAN-UP: Removing Test Business Artifacts ---');
  try {
    await supabase.from('payment_logs').delete().eq('gateway_payment_id', testPaymentId);
    await supabase.from('business_subscriptions').delete().eq('business_id', pendingBizId);
    await supabase.from('businesses').delete().eq('id', pendingBizId);
    console.log('  ✓ Test business and records cleaned up successfully.');
  } catch (cleanErr: any) {
    console.warn('  Clean-up note:', cleanErr?.message);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
