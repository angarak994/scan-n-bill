import { supabase } from '../src/lib/supabaseClient';
import { signToken } from '../src/lib/auth';
import { POST as sendOtpHandler } from '../src/app/api/otp/send/route';
import { POST as verifyOtpHandler } from '../src/app/api/otp/verify/route';
import { GET as getMembershipsHandler, POST as createMembershipHandler, DELETE as deleteMembershipHandler } from '../src/app/api/memberships/route';
import crypto from 'crypto';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string, details?: any) {
  if (!condition) {
    throw new Error(message + (details ? ` Details: ${JSON.stringify(details)}` : ''));
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING PRODUCTION MEMBER VERIFICATION SYSTEM TEST SUITE');
  console.log('============================================================\n');

  // 0. Setup test business credentials
  const { data: businesses } = await supabase.from('businesses').select('id, business_name').limit(2);
  if (!businesses || businesses.length === 0) {
    throw new Error('No businesses found in database for testing.');
  }

  const businessAId = businesses[0].id;
  const businessBId = businesses.length > 1 ? businesses[1].id : '11111111-1111-1111-1111-111111111111';

  const ownerTokenA = await signToken({ businessId: businessAId, role: 'owner' });
  const staffTokenA = await signToken({ businessId: businessAId, role: 'staff' });
  const unauthorizedTokenA = await signToken({ businessId: businessAId, role: 'unauthorized_customer' });
  const ownerTokenB = await signToken({ businessId: businessBId, role: 'owner' });

  // Test phone numbers
  const testPhoneOtp = '9800000001';
  const testPhoneManual = '9800000002';
  const testPhoneExpired = '9800000003';
  const testPhoneAttempts = '9800000004';
  const testPhoneCooldown = '9800000005';
  const testPhoneOverride = '9800000006';
  const testPhoneIsolation = '9800000007';

  const allTestPhones = [
    testPhoneOtp, testPhoneManual, testPhoneExpired,
    testPhoneAttempts, testPhoneCooldown, testPhoneOverride, testPhoneIsolation
  ];

  // Cleanup past test data
  await supabase.from('memberships').delete().in('mobile', allTestPhones);
  await supabase.from('otp_verifications').delete().in('mobile', allTestPhones);

  // -------------------------------------------------------------
  // SUITE 1: Standard Customer OTP Verification Flow
  // -------------------------------------------------------------
  try {
    console.log('▶ [Suite 1] Testing Standard Customer OTP Verification Flow...');

    // Step 1: Send OTP
    const sendReq = new Request('http://localhost:3000/api/otp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerTokenA}`
      },
      body: JSON.stringify({ contact: testPhoneOtp })
    });

    const sendRes = await sendOtpHandler(sendReq);
    const sendData = await sendRes.json();
    assert(sendRes.status === 200, `Send OTP failed with status ${sendRes.status}`, sendData);
    assert(sendData.success === true, 'Send OTP response success should be true');

    // Step 2: Verify OTP is securely hashed in DB and not leaked
    const { data: verifs } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('business_id', businessAId)
      .eq('mobile', testPhoneOtp)
      .order('created_at', { ascending: false })
      .limit(1);

    assert(Boolean(verifs && verifs.length === 1), 'OTP verification record must exist in DB');
    const verifRecord = verifs![0];
    assert(!!verifRecord.otp_hash, 'OTP hash must exist in DB');
    assert(!('otp' in verifRecord), 'Plain text OTP must NEVER be stored as a column');
    assert(!('otp' in sendData), 'Plain text OTP must NEVER be returned in API response');

    // Create a known OTP hash for verification test
    const knownOtp = '748291';
    const knownHash = crypto.createHash('sha256').update(knownOtp).digest('hex');
    await supabase.from('otp_verifications').update({ otp_hash: knownHash }).eq('id', verifRecord.id);

    // Step 3: Verify with correct OTP
    const verifyReq = new Request('http://localhost:3000/api/otp/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerTokenA}`
      },
      body: JSON.stringify({ contact: testPhoneOtp, otp: knownOtp })
    });

    const verifyRes = await verifyOtpHandler(verifyReq);
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200, `Verify OTP failed with status ${verifyRes.status}`, verifyData);
    assert(verifyData.success === true, 'Verify OTP success must be true');
    assert(!!verifyData.verificationToken, 'Verification token must be returned');
    assert(verifyData.verificationId === verifRecord.id, 'Verification ID must match');

    // Step 4: Register member with OTP verification token
    const regReq = new Request('http://localhost:3000/api/memberships', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerTokenA}`
      },
      body: JSON.stringify({
        name: 'Arjun OTP Verified',
        mobile: testPhoneOtp,
        email: 'arjun@example.com',
        tier: 'Standard',
        verificationMethod: 'OTP_VERIFIED',
        verificationToken: verifyData.verificationToken,
        verificationId: verifyData.verificationId
      })
    });

    const regRes = await createMembershipHandler(regReq);
    const regData = await regRes.json();
    assert(regRes.status === 200, `Membership registration failed: ${regData.error}`, regData);
    assert(regData.success === true, 'Registration success must be true');
    assert(regData.membership.name === 'Arjun OTP Verified', 'Member name must match');
    assert(regData.membership.verification_method === 'OTP_VERIFIED', 'Verification method must be OTP_VERIFIED');
    assert(regData.membership.is_phone_verified === true, 'Phone must be marked as verified (is_phone_verified = true)');

    // Step 5: Verify replay prevention (verification token cannot be reused)
    const replayReq = new Request('http://localhost:3000/api/memberships', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerTokenA}`
      },
      body: JSON.stringify({
        name: 'Replay Attacker',
        mobile: '9800000099',
        tier: 'Standard',
        verificationMethod: 'OTP_VERIFIED',
        verificationToken: verifyData.verificationToken,
        verificationId: verifyData.verificationId
      })
    });

    const replayRes = await createMembershipHandler(replayReq);
    assert(replayRes.status === 403, 'Replay of consumed verification token must be rejected with 403');

    results.push({ suite: 'Standard OTP Verification', name: 'Complete OTP flow and replay prevention', passed: true });
    console.log('  ✅ Standard OTP Verification Flow Passed');
  } catch (err: any) {
    results.push({ suite: 'Standard OTP Verification', name: 'Complete OTP flow', passed: false, error: err.message });
    console.error('  ❌ Standard OTP Verification Flow Failed:', err.message);
  }

  // -------------------------------------------------------------
  // SUITE 2: Business Owner Manual Verification Flow
  // -------------------------------------------------------------
  try {
    console.log('▶ [Suite 2] Testing Business Owner Manual Verification Flow...');

    const manualReq = new Request('http://localhost:3000/api/memberships', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerTokenA}`
      },
      body: JSON.stringify({
        name: 'Rohan Sharma Manual',
        mobile: testPhoneManual,
        email: 'rohan@example.com',
        tier: 'Standard',
        verificationMethod: 'MANUAL_OWNER_VERIFICATION',
        notes: 'Regular club player known personally to owner'
      })
    });

    const manualRes = await createMembershipHandler(manualReq);
    const manualData = await manualRes.json();
    assert(manualRes.status === 200, `Manual owner verification failed: ${manualData.error}`, manualData);
    assert(manualData.success === true, 'Manual verification success must be true');

    const member = manualData.membership;
    assert(member.verification_method === 'MANUAL_OWNER_VERIFICATION', 'Verification method must be MANUAL_OWNER_VERIFICATION');
    // CRITICAL REQUIREMENT: Do NOT falsely mark phone as OTP-verified
    assert(member.is_phone_verified === false, 'Phone must NOT be marked as OTP-verified for manual approval (is_phone_verified === false)');
    assert(member.verified_by === 'Owner', 'Verified by must record owner role/identity');
    assert(member.audit_info && member.audit_info.method === 'MANUAL_OWNER_VERIFICATION', 'Audit info must record MANUAL_OWNER_VERIFICATION');
    assert(member.audit_info.approval_notes.includes('Regular club player'), 'Audit info must include approval notes');
    assert(!!member.verified_at, 'Verification timestamp must be present');

    results.push({ suite: 'Owner Manual Verification', name: 'Manual approval and audit record check', passed: true });
    console.log('  ✅ Business Owner Manual Verification Flow Passed');
  } catch (err: any) {
    results.push({ suite: 'Owner Manual Verification', name: 'Manual approval and audit record check', passed: false, error: err.message });
    console.error('  ❌ Business Owner Manual Verification Failed:', err.message);
  }

  // -------------------------------------------------------------
  // SUITE 3: Expired OTP Enforcement
  // -------------------------------------------------------------
  try {
    console.log('▶ [Suite 3] Testing Expired OTP Enforcement...');

    const expiredHash = crypto.createHash('sha256').update('112233').digest('hex');
    const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

    await supabase.from('otp_verifications').insert([{
      business_id: businessAId,
      mobile: testPhoneExpired,
      otp_hash: expiredHash,
      expires_at: pastDate,
      attempts: 0,
      verified: false
    }]);

    const expReq = new Request('http://localhost:3000/api/otp/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerTokenA}`
      },
      body: JSON.stringify({ contact: testPhoneExpired, otp: '112233' })
    });

    const expRes = await verifyOtpHandler(expReq);
    const expData = await expRes.json();
    assert(expRes.status === 400, 'Expired OTP must return 400 status');
    assert(expData.error?.includes('expired'), 'Error message must state that OTP has expired');

    results.push({ suite: 'Expired OTP', name: 'Expired OTP rejection', passed: true });
    console.log('  ✅ Expired OTP Enforcement Passed');
  } catch (err: any) {
    results.push({ suite: 'Expired OTP', name: 'Expired OTP rejection', passed: false, error: err.message });
    console.error('  ❌ Expired OTP Enforcement Failed:', err.message);
  }

  // -------------------------------------------------------------
  // SUITE 4: Repeated Attempts Limit (Brute Force Protection)
  // -------------------------------------------------------------
  try {
    console.log('▶ [Suite 4] Testing Repeated Verification Attempts Limit...');

    const targetHash = crypto.createHash('sha256').update('888999').digest('hex');
    const futureDate = new Date(Date.now() + 300000).toISOString();

    const { data: verifRow } = await supabase.from('otp_verifications').insert([{
      business_id: businessAId,
      mobile: testPhoneAttempts,
      otp_hash: targetHash,
      expires_at: futureDate,
      attempts: 0,
      verified: false
    }]).select('id').single();

    // 1st wrong attempt
    let attReq = new Request('http://localhost:3000/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTokenA}` },
      body: JSON.stringify({ contact: testPhoneAttempts, otp: '000001' })
    });
    let attRes = await verifyOtpHandler(attReq);
    let attData = await attRes.json();
    assert(attRes.status === 400, 'Wrong attempt 1 must return 400');
    assert(attData.error?.includes('2 attempt(s) remaining'), 'Must inform 2 attempts remaining');

    // 2nd wrong attempt
    attReq = new Request('http://localhost:3000/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTokenA}` },
      body: JSON.stringify({ contact: testPhoneAttempts, otp: '000002' })
    });
    attRes = await verifyOtpHandler(attReq);
    attData = await attRes.json();
    assert(attData.error?.includes('1 attempt(s) remaining'), 'Must inform 1 attempt remaining');

    // 3rd wrong attempt
    attReq = new Request('http://localhost:3000/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTokenA}` },
      body: JSON.stringify({ contact: testPhoneAttempts, otp: '000003' })
    });
    attRes = await verifyOtpHandler(attReq);
    attData = await attRes.json();
    assert(attData.error?.includes('Maximum verification attempts exceeded'), 'Must inform attempts exceeded on 3rd failure');

    // 4th attempt with actual correct OTP: must still be blocked!
    attReq = new Request('http://localhost:3000/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTokenA}` },
      body: JSON.stringify({ contact: testPhoneAttempts, otp: '888999' })
    });
    attRes = await verifyOtpHandler(attReq);
    attData = await attRes.json();
    assert(attRes.status === 400, '4th attempt must be blocked');
    assert(attData.error?.includes('Maximum verification attempts exceeded'), 'Must block verification after 3 failures');

    results.push({ suite: 'Repeated Attempts Limit', name: 'Max 3 attempts lock-out', passed: true });
    console.log('  ✅ Repeated Attempts Limit Passed');
  } catch (err: any) {
    results.push({ suite: 'Repeated Attempts Limit', name: 'Max 3 attempts lock-out', passed: false, error: err.message });
    console.error('  ❌ Repeated Attempts Limit Failed:', err.message);
  }

  // -------------------------------------------------------------
  // SUITE 5: Resend Cooldown Rate Limiting
  // -------------------------------------------------------------
  try {
    console.log('▶ [Suite 5] Testing OTP Resend Cooldown...');

    // 1st request
    const firstReq = new Request('http://localhost:3000/api/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTokenA}` },
      body: JSON.stringify({ contact: testPhoneCooldown })
    });
    const firstRes = await sendOtpHandler(firstReq);
    assert(firstRes.status === 200, 'First OTP request must succeed');

    // Immediate 2nd request (must trigger 60-second cooldown)
    const secondReq = new Request('http://localhost:3000/api/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTokenA}` },
      body: JSON.stringify({ contact: testPhoneCooldown })
    });
    const secondRes = await sendOtpHandler(secondReq);
    const secondData = await secondRes.json();
    assert(secondRes.status === 429, `Immediate resend must return 429 Too Many Requests (got ${secondRes.status})`);
    assert(secondData.error?.includes('seconds before requesting another OTP'), 'Error must specify cooldown');

    results.push({ suite: 'Resend Cooldown', name: '60s cooldown enforcement', passed: true });
    console.log('  ✅ Resend Cooldown Rate Limiting Passed');
  } catch (err: any) {
    results.push({ suite: 'Resend Cooldown', name: '60s cooldown enforcement', passed: false, error: err.message });
    console.error('  ❌ Resend Cooldown Rate Limiting Failed:', err.message);
  }

  // -------------------------------------------------------------
  // SUITE 6: Unauthorized Overrides & Security Checks
  // -------------------------------------------------------------
  try {
    console.log('▶ [Suite 6] Testing Unauthorized Overrides & Security Safeguards...');

    // 1. Attempt manual approval without authentication
    const unauthReq = new Request('http://localhost:3000/api/memberships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hacker',
        mobile: testPhoneOverride,
        verificationMethod: 'MANUAL_OWNER_VERIFICATION'
      })
    });
    const unauthRes = await createMembershipHandler(unauthReq);
    assert(unauthRes.status === 401, 'Unauthenticated manual approval must return 401');

    // 2. Attempt manual approval with an unauthorized role (e.g. non-owner/non-staff customer)
    const badRoleReq = new Request('http://localhost:3000/api/memberships', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unauthorizedTokenA}`
      },
      body: JSON.stringify({
        name: 'Unauthorized User',
        mobile: testPhoneOverride,
        verificationMethod: 'MANUAL_OWNER_VERIFICATION'
      })
    });
    const badRoleRes = await createMembershipHandler(badRoleReq);
    const badRoleData = await badRoleRes.json();
    assert(badRoleRes.status === 403, `Unauthorized role manual approval must return 403 (got ${badRoleRes.status})`);
    assert(badRoleData.error?.includes('Forbidden'), 'Error must state Forbidden for unauthorized roles');

    // 3. Attempt universal hardcoded OTP bypass (e.g. '123456')
    const bypassHash = crypto.createHash('sha256').update('654321').digest('hex');
    await supabase.from('otp_verifications').insert([{
      business_id: businessAId,
      mobile: testPhoneOverride,
      otp_hash: bypassHash,
      expires_at: new Date(Date.now() + 300000).toISOString(),
      attempts: 0,
      verified: false
    }]);

    const bypassReq = new Request('http://localhost:3000/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTokenA}` },
      body: JSON.stringify({ contact: testPhoneOverride, otp: '123456' })
    });
    const bypassRes = await verifyOtpHandler(bypassReq);
    assert(bypassRes.status === 400, 'Universal code bypass (123456) must be rejected with 400 Invalid OTP');

    results.push({ suite: 'Security Safeguards', name: 'Unauthorized override and backdoor rejection', passed: true });
    console.log('  ✅ Unauthorized Overrides & Security Safeguards Passed');
  } catch (err: any) {
    results.push({ suite: 'Security Safeguards', name: 'Unauthorized override and backdoor rejection', passed: false, error: err.message });
    console.error('  ❌ Security Safeguards Failed:', err.message);
  }

  // -------------------------------------------------------------
  // SUITE 7: Duplicate Member Prevention
  // -------------------------------------------------------------
  try {
    console.log('▶ [Suite 7] Testing Duplicate Member Prevention...');

    // testPhoneOtp is already registered in Suite 1. Attempt to register again.
    const dupReq = new Request('http://localhost:3000/api/memberships', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerTokenA}`
      },
      body: JSON.stringify({
        name: 'Duplicate Arjun',
        mobile: testPhoneOtp,
        verificationMethod: 'MANUAL_OWNER_VERIFICATION'
      })
    });

    const dupRes = await createMembershipHandler(dupReq);
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, `Duplicate mobile membership must return 409 Conflict (got ${dupRes.status})`);
    assert(dupData.error?.includes('already registered'), 'Error message must state mobile is already registered');

    results.push({ suite: 'Duplicate Member Prevention', name: '409 Conflict on existing mobile', passed: true });
    console.log('  ✅ Duplicate Member Prevention Passed');
  } catch (err: any) {
    results.push({ suite: 'Duplicate Member Prevention', name: '409 Conflict on existing mobile', passed: false, error: err.message });
    console.error('  ❌ Duplicate Member Prevention Failed:', err.message);
  }

  // -------------------------------------------------------------
  // SUITE 8: Multi-Tenant Isolation
  // -------------------------------------------------------------
  try {
    console.log('▶ [Suite 8] Testing Multi-Tenant Isolation...');

    // Register member in Business A
    const regAReq = new Request('http://localhost:3000/api/memberships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTokenA}` },
      body: JSON.stringify({
        name: 'Isolated Member A',
        mobile: testPhoneIsolation,
        tier: 'Standard',
        verificationMethod: 'MANUAL_OWNER_VERIFICATION'
      })
    });
    const regARes = await createMembershipHandler(regAReq);
    const regAData = await regARes.json();
    assert(regARes.status === 200, 'Member registration in Business A must succeed');

    // Query Business B memberships: must NOT contain member from Business A
    const getBReq = new Request('http://localhost:3000/api/memberships', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerTokenB}` }
    });
    const getBRes = await getMembershipsHandler(getBReq);
    const getBData = await getBRes.json();
    assert(getBRes.status === 200, 'Query Business B memberships must succeed');
    const bMembers = getBData.memberships || [];
    const leakFound = bMembers.some((m: any) => m.mobile === testPhoneIsolation);
    assert(!leakFound, 'Business B must NOT see Business A member records (Tenant leak detected!)');

    // Business B attempts to delete Business A's member: must fail
    const delBReq = new Request('http://localhost:3000/api/memberships', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTokenB}` },
      body: JSON.stringify({ id: regAData.membership.id })
    });
    await deleteMembershipHandler(delBReq);

    // Verify member still exists in Business A
    const { data: memberStillThere } = await supabase
      .from('memberships')
      .select('id')
      .eq('id', regAData.membership.id)
      .single();
    assert(!!memberStillThere, 'Business B must not be able to delete Business A member');

    results.push({ suite: 'Multi-Tenant Isolation', name: 'Cross-tenant access and mutation prevention', passed: true });
    console.log('  ✅ Multi-Tenant Isolation Passed');
  } catch (err: any) {
    results.push({ suite: 'Multi-Tenant Isolation', name: 'Cross-tenant access and mutation prevention', passed: false, error: err.message });
    console.error('  ❌ Multi-Tenant Isolation Failed:', err.message);
  }

  // Cleanup test data
  await supabase.from('memberships').delete().in('mobile', allTestPhones);
  await supabase.from('otp_verifications').delete().in('mobile', allTestPhones);

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log('\n============================================================');
  console.log('📊 TEST EXECUTION SUMMARY:');
  console.log('============================================================');
  let allPassed = true;
  for (const r of results) {
    const statusIcon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${statusIcon} | [${r.suite}] ${r.name}${r.error ? ` -> ${r.error}` : ''}`);
    if (!r.passed) allPassed = false;
  }
  console.log('============================================================');
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! System is fully production-ready.');
  } else {
    console.error('⚠️ SOME TESTS FAILED. Please review the output above.');
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
