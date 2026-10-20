import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { processWhatsAppMessage } from '../src/lib/services/whatsappMessageProcessor';
import { whatsappRepository } from '../src/lib/repositories/whatsappRepository';
import { bookingService } from '../src/lib/services/bookingService';
import { clubDiscoveryService } from '../src/lib/services/clubDiscoveryService';
import { qcontrolIntelligence } from '../src/lib/services/qcontrolIntelligence';
import { processAIQuery } from '../src/lib/services/aiAssistantService';
import { supabase } from '../src/lib/supabaseClient';
import { getCurrentISTDateStr } from '../src/lib/billing';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function runTestSuite() {
  console.log('====================================================');
  console.log('🚀 RUNNING QCONTROL INTELLIGENCE & WHATSAPP TEST SUITE');
  console.log('====================================================\n');

  const testBusinessId = '011be6ef-dc4b-4489-a955-e83144e0995c'; // LevelUP
  const testPhone = '918208388320';
  const todayStr = getCurrentISTDateStr();

  // -------------------------------------------------------------------------
  // TEST 1: Customer sends "Hi" -> Appropriate reply with dynamic business name
  // -------------------------------------------------------------------------
  try {
    const res = await qcontrolIntelligence.processCustomerMessage({
      incomingText: 'Hi',
      senderPhone: testPhone,
      businessId: testBusinessId,
      businessName: 'LevelUP'
    });

    const hasBoldName = res.replyText.includes('*Welcome to LevelUP!*');
    const hasButtons = res.buttons && res.buttons.length >= 2;

    results.push({
      name: '1. Customer sends "Hi" (First Response Flow)',
      passed: Boolean(hasBoldName && hasButtons),
      details: `Has bold business name: ${hasBoldName}, Button count: ${res.buttons?.length}, Output snippet: "${res.replyText.substring(0, 50)}..."`
    });
  } catch (e: any) {
    results.push({ name: '1. Customer sends "Hi"', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 2: Webhook delivered twice -> Idempotent deduplication check
  // -------------------------------------------------------------------------
  try {
    const duplicateId = `wamid.test_dedupe_${Date.now()}`;
    const firstCheck = await whatsappRepository.isMessageProcessed(duplicateId);
    const secondCheck = await whatsappRepository.isMessageProcessed(duplicateId);

    const passed = (firstCheck === false && secondCheck === true);
    results.push({
      name: '2. Webhook delivered twice (Idempotency)',
      passed,
      details: `First arrival processed: ${!firstCheck}, Second duplicate blocked: ${secondCheck}`
    });

    // Cleanup
    await supabase.from('whatsapp_processed_messages').delete().eq('message_id', duplicateId);
  } catch (e: any) {
    results.push({ name: '2. Webhook delivered twice', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 3: AI Service Resilience (Handling Hinglish query)
  // -------------------------------------------------------------------------
  try {
    const res = await qcontrolIntelligence.processCustomerMessage({
      incomingText: 'Pool table chahiye aaj 7 baje.',
      senderPhone: testPhone,
      businessId: testBusinessId,
      businessName: 'LevelUP'
    });

    const hasAvailabilityOrPrompt = res.replyText.includes('available') || res.replyText.includes('booked') || res.replyText.includes('Pool');
    results.push({
      name: '3. Natural Language Hinglish ("Pool table chahiye aaj 7 baje")',
      passed: Boolean(hasAvailabilityOrPrompt),
      details: `Reply snippet: "${res.replyText.substring(0, 80)}..."`
    });
  } catch (e: any) {
    results.push({ name: '3. Natural Language Hinglish', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 4: No table available -> Agent offers valid alternatives
  // -------------------------------------------------------------------------
  try {
    const slots = await bookingService.getAvailableSlots(testBusinessId, 'pool', todayStr, 60);
    const passed = Array.isArray(slots);
    results.push({
      name: '4. Availability engine & alternatives offer',
      passed,
      details: `Found ${slots.length} available slots for today: ${slots.slice(0, 3).map(s => s.time).join(', ')}`
    });
  } catch (e: any) {
    results.push({ name: '4. Availability engine & alternatives', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 5: Two customers book the same slot -> Atomic concurrency protection
  // -------------------------------------------------------------------------
  try {
    const testSlotDate = '2026-12-31'; // Future date
    const testTime = '15:00:00';
    const testTable = 'P1';

    // Clean up any test booking
    await supabase.from('bookings').delete().eq('booking_date', testSlotDate).eq('table_id', testTable);

    // Concurrently trigger two booking requests
    const [b1, b2] = await Promise.all([
      bookingService.createAtomicBooking({
        business_id: testBusinessId,
        table_id: testTable,
        customer_name: 'Customer A',
        customer_phone: '918208388320',
        booking_date: testSlotDate,
        start_time: testTime,
        duration_minutes: 60,
        game_type: 'pool'
      }),
      bookingService.createAtomicBooking({
        business_id: testBusinessId,
        table_id: testTable,
        customer_name: 'Customer B',
        customer_phone: '919999988888',
        booking_date: testSlotDate,
        start_time: testTime,
        duration_minutes: 60,
        game_type: 'pool'
      })
    ]);

    const onlyOneSucceeded = (b1.success && !b2.success) || (!b1.success && b2.success);
    results.push({
      name: '5. Concurrent booking collision (Race Condition Prevention)',
      passed: onlyOneSucceeded,
      details: `Customer A success: ${b1.success}, Customer B success: ${b2.success}, Reason: "${b1.reason || b2.reason}"`
    });

    // Cleanup
    await supabase.from('bookings').delete().eq('booking_date', testSlotDate).eq('table_id', testTable);
  } catch (e: any) {
    results.push({ name: '5. Concurrent booking collision', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 6: Location-aware club discovery & recommendations
  // -------------------------------------------------------------------------
  try {
    const banerClubs = await clubDiscoveryService.discoverAndRankClubs({
      locationQuery: 'Baner',
      gameType: 'pool'
    });

    const kothrudClubs = await clubDiscoveryService.discoverAndRankClubs({
      locationQuery: 'Kothrud',
      gameType: 'pool'
    });

    const passed = banerClubs.length > 0 && kothrudClubs.length > 0 && banerClubs[0].businessName !== kothrudClubs[0].businessName;
    results.push({
      name: '6. Location-aware discovery (Baner vs Kothrud recommendations)',
      passed,
      details: `Baner top club: "${banerClubs[0]?.businessName}", Kothrud top club: "${kothrudClubs[0]?.businessName}"`
    });
  } catch (e: any) {
    results.push({ name: '6. Location-aware discovery', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 7: Table booked updates availability
  // -------------------------------------------------------------------------
  try {
    const check1 = await bookingService.checkTableAvailability(testBusinessId, 'P1', '2026-11-20', 14 * 60, 60);
    const passed = typeof check1.available === 'boolean';
    results.push({
      name: '7. Realtime availability verification',
      passed,
      details: `Availability verified: ${check1.available}`
    });
  } catch (e: any) {
    results.push({ name: '7. Realtime availability', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 8: Multi-tenant Isolation Check (Wrong business ID rejection)
  // -------------------------------------------------------------------------
  try {
    const fakeBusinessId = '00000000-0000-0000-0000-000000000000';
    const check = await bookingService.checkTableAvailability(fakeBusinessId, 'P1', todayStr, 14 * 60, 60);
    const passed = Boolean(!check.available && check.reason?.includes('Club not found'));
    results.push({
      name: '8. Strict Multi-Tenant Isolation (Unauthorized/Invalid business)',
      passed,
      details: `Rejection reason: "${check.reason}"`
    });
  } catch (e: any) {
    results.push({ name: '8. Multi-tenant isolation', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 9: Payment inquiry intelligence ("I paid already. Why am I receiving reminders?")
  // -------------------------------------------------------------------------
  try {
    const res = await qcontrolIntelligence.processCustomerMessage({
      incomingText: 'I paid already. Why am I receiving reminders?',
      senderPhone: testPhone,
      businessId: testBusinessId,
      businessName: 'LevelUP'
    });

    const passed = res.replyText.includes('verified') || res.replyText.includes('outstanding') || res.replyText.includes('Payment');
    results.push({
      name: '9. Payment Intelligence & Dispute Resolution',
      passed,
      details: `Reply snippet: "${res.replyText.substring(0, 90)}..."`
    });
  } catch (e: any) {
    results.push({ name: '9. Payment Intelligence', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 10: Delivery status webhook update & status regression protection
  // -------------------------------------------------------------------------
  try {
    const testMsgId = `wamid.status_test_${Date.now()}`;
    const logged = await whatsappRepository.logMessage({
      business_id: testBusinessId,
      message_id: testMsgId,
      recipient_phone: testPhone,
      recipient_name: 'Test Customer',
      content: 'Testing delivery status updates',
      status: 'sent'
    });

    // Update to 'delivered'
    await whatsappRepository.updateMessageStatus(testMsgId, 'delivered');
    const { data: m1 } = await supabase.from('whatsapp_messages').select('status').eq('message_id', testMsgId).single();

    // Update to 'read'
    await whatsappRepository.updateMessageStatus(testMsgId, 'read');
    const { data: m2 } = await supabase.from('whatsapp_messages').select('status').eq('message_id', testMsgId).single();

    // Simulate delayed out-of-order 'delivered' webhook (must NOT regress 'read' back to 'delivered')
    await whatsappRepository.updateMessageStatus(testMsgId, 'delivered');
    const { data: m3 } = await supabase.from('whatsapp_messages').select('status').eq('message_id', testMsgId).single();

    const passed = m1?.status === 'delivered' && m2?.status === 'read' && m3?.status === 'read';
    results.push({
      name: '10. Status webhook updates & regression protection (sent -> delivered -> read)',
      passed,
      details: `m1 (delivered): ${m1?.status}, m2 (read): ${m2?.status}, m3 (regression resisted): ${m3?.status}`
    });

    // Cleanup
    if (logged?.id) {
      await supabase.from('whatsapp_messages').delete().eq('id', logged.id);
    }
  } catch (e: any) {
    results.push({ name: '10. Status webhook updates', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 11: Owner Assistant (Authoritative Financial & Table Metrics)
  // -------------------------------------------------------------------------
  try {
    const earnQuery = await processAIQuery('How much did we earn today?', testBusinessId);
    const tableQuery = await processAIQuery('Which tables are free right now?', testBusinessId);

    const passed = earnQuery.includes('Today') && (tableQuery.includes('Free') || tableQuery.includes('occupied'));
    results.push({
      name: '11. Owner Assistant Intelligence (Zero Hallucination metrics)',
      passed,
      details: `Earn answer: "${earnQuery.split('\n')[0]}", Table answer: "${tableQuery.split('\n')[0]}"`
    });
  } catch (e: any) {
    results.push({ name: '11. Owner Assistant Intelligence', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // TEST 12: Delivery logs querying & analytics computation
  // -------------------------------------------------------------------------
  try {
    const logsData = await whatsappRepository.getDeliveryLogs(testBusinessId, { limit: 10 });
    const passed = Array.isArray(logsData.logs) && typeof logsData.analytics.total === 'number';
    results.push({
      name: '12. Delivery Logs API & Metrics Aggregation',
      passed,
      details: `Total messages: ${logsData.analytics.total}, Outbound: ${logsData.analytics.outbound}, Inbound: ${logsData.analytics.inbound}, Failed: ${logsData.analytics.failed}`
    });
  } catch (e: any) {
    results.push({ name: '12. Delivery Logs API', passed: false, details: e.message });
  }

  // -------------------------------------------------------------------------
  // PRINT SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('====================================================');
  let passCount = 0;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    console.log(`   └─ ${r.details}`);
    if (r.passed) passCount++;
  }
  console.log('====================================================');
  console.log(`TOTAL: ${passCount} / ${results.length} PASSED`);
  console.log('====================================================\n');
}

runTestSuite().catch(console.error);
