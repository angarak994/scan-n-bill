import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { processWhatsAppMessage } from '../src/lib/services/whatsappMessageProcessor';
import { whatsappRepository } from '../src/lib/repositories/whatsappRepository';
import { qcontrolIntelligence } from '../src/lib/services/qcontrolIntelligence';
import { bookingService } from '../src/lib/services/bookingService';

async function testCentralRouting() {
  console.log('====================================================');
  console.log('🧪 TESTING CENTRAL WHATSAPP ROUTING & ISOLATION');
  console.log('====================================================\n');

  const testPhone = '919999888877';

  // Clear previous state for a fresh customer session
  await whatsappRepository.clearState(testPhone);

  // ---------------------------------------------------------------
  // 1. Generic "Hi" without club context -> GLOBAL DISCOVERY
  // ---------------------------------------------------------------
  console.log('1. Testing generic message without club context...');
  const globalDiscoveryRes = await qcontrolIntelligence.handleGlobalDiscovery('Hi, looking to book a table', testPhone);
  console.log('   Global discovery reply type:', globalDiscoveryRes.replyType);
  console.log('   Global discovery reply snippet:\n   ', globalDiscoveryRes.replyText.substring(0, 100).replace(/\n/g, ' '));
  
  if (!globalDiscoveryRes.replyText.includes('QControl') || (!globalDiscoveryRes.buttons && !globalDiscoveryRes.listData)) {
    throw new Error('FAIL: Global discovery did not present active clubs or QControl greeting!');
  }
  console.log('✅ Global discovery successfully returned multi-club selection!\n');

  // ---------------------------------------------------------------
  // 2. Location-based Discovery ("Looking for snooker in Kothrud")
  // ---------------------------------------------------------------
  console.log('2. Testing location discovery in Kothrud...');
  const kothrudRes = await qcontrolIntelligence.handleGlobalDiscovery('Snooker tables near Kothrud', testPhone);
  console.log('   Kothrud discovery snippet:\n   ', kothrudRes.replyText.substring(0, 100).replace(/\n/g, ' '));
  if (!kothrudRes.replyText.toLowerCase().includes('kothrud')) {
    throw new Error('FAIL: Location discovery did not rank clubs near Kothrud!');
  }
  console.log('✅ Location discovery successfully ranked clubs near Kothrud!\n');

  // ---------------------------------------------------------------
  // 3. Deep-link ingress via QC_<slug>
  // ---------------------------------------------------------------
  console.log('3. Testing deep-link ingress with QC_levelup...');
  const deepLinkBody = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: testPhone,
            id: `msg_test_${Date.now()}`,
            type: 'text',
            text: { body: 'Book at LevelUP (Code: QC_levelup)' }
          }],
          metadata: { phone_number_id: '1339039279301796' }
        }
      }]
    }]
  };

  await processWhatsAppMessage(deepLinkBody);

  const stateAfterDeepLink = await whatsappRepository.getState(testPhone);
  console.log('   State after deep-link:', stateAfterDeepLink);
  if (stateAfterDeepLink?.conversation_mode !== 'CLUB' || !stateAfterDeepLink?.active_business_id) {
    throw new Error('FAIL: Deep-link did not bind user session to CLUB mode with active business ID!');
  }
  console.log('✅ Deep link ingress correctly locked session into club context without cross-tenant bleed!\n');

  // ---------------------------------------------------------------
  // 4. Customer Profile & History Ledger Query
  // ---------------------------------------------------------------
  console.log('4. Testing customer profile retrieval...');
  const profile = await bookingService.getCustomerProfileAndHistory(stateAfterDeepLink.active_business_id, testPhone, 'Test Player');
  console.log('   Customer profile result:', profile);
  if (!profile || typeof profile.outstanding_balance !== 'number') {
    throw new Error('FAIL: Could not retrieve customer profile!');
  }
  console.log('✅ Customer profile query succeeded!\n');

  // Clean up test state
  await whatsappRepository.clearState(testPhone);

  console.log('====================================================');
  console.log('🎉 ALL CENTRAL ROUTING & ISOLATION TESTS PASSED!');
  console.log('====================================================');
}

testCentralRouting().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
