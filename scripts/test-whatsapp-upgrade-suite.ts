import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { calculateDistanceKm, formatDistance } from '../src/lib/utils/locationUtils';
import { venuePhotoService } from '../src/lib/services/venuePhotoService';
import { googleRatingsService } from '../src/lib/services/googleRatingsService';
import { clubDiscoveryService } from '../src/lib/services/clubDiscoveryService';
import { qcontrolIntelligence } from '../src/lib/services/qcontrolIntelligence';
import { processWhatsAppMessage } from '../src/lib/services/whatsappMessageProcessor';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function runTestSuite() {
  console.log('================================================================');
  console.log('🎱 RUNNING QCONTROL WHATSAPP AGENT UPGRADE TEST SUITE');
  console.log('   Multi-Club Discovery • Nearby Lounges • Venue Photos • Ratings');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST 1: Haversine Distance Calculation & Formatting
  // ---------------------------------------------------------------------------
  try {
    // Kothrud (18.5074, 73.8077) to Baner (18.5590, 73.7868) is ~6.1 km
    const distKm = calculateDistanceKm(18.5074, 73.8077, 18.5590, 73.7868);
    const formatted = formatDistance(distKm);

    const isAccurate = distKm >= 5.5 && distKm <= 6.8;
    const isFormattedKm = formatted.includes('km');

    // Short distance (< 1km)
    const shortDist = formatDistance(0.45);
    const isMeters = shortDist.includes('m') && !shortDist.includes('km');

    results.push({
      name: '1. Haversine Distance & Format (Kothrud to Baner)',
      passed: isAccurate && isFormattedKm && isMeters,
      details: `Calculated: ${distKm.toFixed(2)} km, Formatted: "${formatted}", Short: "${shortDist}"`
    });
  } catch (e: any) {
    results.push({ name: '1. Haversine Distance & Format', passed: false, details: e.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Venue Photo Security & Magic-Byte Validation
  // ---------------------------------------------------------------------------
  try {
    // Valid JPEG (0xFF, 0xD8, 0xFF)
    const validJpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]).buffer;
    const jpegCheck = venuePhotoService.validateFileContent(validJpeg, 'image/jpeg');

    // Valid PNG (0x89, 0x50, 0x4E, 0x47)
    const validPng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]).buffer;
    const pngCheck = venuePhotoService.validateFileContent(validPng, 'image/png');

    // Valid WebP (0x52, 0x49, 0x46, 0x46 ... 'WEBP')
    const validWebp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
    ]).buffer;
    const webpCheck = venuePhotoService.validateFileContent(validWebp, 'image/webp');

    // Spoofed file: Plain text claiming to be JPEG
    const fakeJpeg = new TextEncoder().encode('GIF89a Fake image with malicious payload!').buffer;
    const fakeCheck = venuePhotoService.validateFileContent(fakeJpeg, 'image/jpeg');

    // Disallowed mime type
    const exeBuffer = new Uint8Array(20).buffer;
    const exeCheck = venuePhotoService.validateFileContent(exeBuffer, 'application/x-msdownload');

    const passed = jpegCheck.valid && pngCheck.valid && webpCheck.valid && !fakeCheck.valid && !exeCheck.valid;

    results.push({
      name: '2. Magic-Byte Validation & Anti-Spoofing',
      passed,
      details: `JPEG: ${jpegCheck.valid}, PNG: ${pngCheck.valid}, WebP: ${webpCheck.valid}, Spoofed rejected: ${!fakeCheck.valid}, Exe rejected: ${!exeCheck.valid}`
    });
  } catch (e: any) {
    results.push({ name: '2. Magic-Byte Validation', passed: false, details: e.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Google Ratings Service (Never Fabricates)
  // ---------------------------------------------------------------------------
  try {
    const formattedNull = googleRatingsService.formatRatingDisplay({
      rating: null,
      reviewCount: null,
      placeId: null,
      isStale: true,
      lastUpdated: null,
    });

    const formattedRated = googleRatingsService.formatRatingDisplay({
      rating: 4.8,
      reviewCount: 142,
      placeId: 'ChIJ123',
      isStale: false,
      lastUpdated: new Date().toISOString(),
    });

    const formattedStale = googleRatingsService.formatRatingDisplay({
      rating: 4.5,
      reviewCount: 88,
      placeId: 'ChIJ456',
      isStale: true,
      lastUpdated: new Date().toISOString(),
    });

    const passed =
      formattedNull.includes('Not available') &&
      formattedRated.includes('4.8/5') &&
      formattedRated.includes('142 reviews') &&
      formattedStale.includes('(cached)');

    results.push({
      name: '3. Google Ratings Formatter & Zero-Fabrication Guarantee',
      passed,
      details: `Null: "${formattedNull}", Fresh: "${formattedRated}", Stale: "${formattedStale}"`
    });
  } catch (e: any) {
    results.push({ name: '3. Google Ratings Formatter', passed: false, details: e.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Intent Classification for Venue Photos, Rating, and Nearby
  // ---------------------------------------------------------------------------
  try {
    const photoIntent1 = qcontrolIntelligence.detectIntent('show me photos of the club');
    const photoIntent2 = qcontrolIntelligence.detectIntent('ambience kaisa hai club ka? pics bhejo');
    const ratingIntent1 = qcontrolIntelligence.detectIntent('what is the google rating?');
    const ratingIntent2 = qcontrolIntelligence.detectIntent('customer reviews kaisa hai?');
    const nearbyIntent1 = qcontrolIntelligence.detectIntent('is there any pool club near me?');
    const nearbyIntent2 = qcontrolIntelligence.detectIntent('closest snooker lounge');

    const passed =
      photoIntent1 === 'VENUE_PHOTOS' &&
      photoIntent2 === 'VENUE_PHOTOS' &&
      ratingIntent1 === 'GOOGLE_RATING' &&
      ratingIntent2 === 'GOOGLE_RATING' &&
      nearbyIntent1 === 'NEARBY_CLUBS' &&
      nearbyIntent2 === 'NEARBY_CLUBS';

    results.push({
      name: '4. Deterministic Intent Classification for New Features',
      passed,
      details: `Photos: [${photoIntent1}, ${photoIntent2}], Ratings: [${ratingIntent1}, ${ratingIntent2}], Nearby: [${nearbyIntent1}, ${nearbyIntent2}]`
    });
  } catch (e: any) {
    results.push({ name: '4. Deterministic Intent Classification', passed: false, details: e.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Nearby Lounges Prompt & Location Sharing Guidance
  // ---------------------------------------------------------------------------
  try {
    const promptOutput = qcontrolIntelligence.handleNearbyPrompt();

    const mentionsPin = promptOutput.replyText.includes('Location');
    const mentionsEphemeral = promptOutput.replyText.includes('never stored');
    const hasButtons = promptOutput.replyType === 'buttons' && promptOutput.buttons && promptOutput.buttons.length > 0;

    results.push({
      name: '5. Nearby Lounges Prompt & Privacy Guidance',
      passed: Boolean(mentionsPin && mentionsEphemeral && hasButtons),
      details: `Mentions pin: ${mentionsPin}, Explains privacy: ${mentionsEphemeral}, Button count: ${promptOutput.buttons?.length}`
    });
  } catch (e: any) {
    results.push({ name: '5. Nearby Lounges Prompt', passed: false, details: e.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Venue Photos WhatsApp Response Structure
  // ---------------------------------------------------------------------------
  try {
    const dummyBizId = '011be6ef-dc4b-4489-a955-e83144e0995c';
    const photosOutput = await qcontrolIntelligence.handleVenuePhotos(dummyBizId, 'LevelUP', '919876543210');

    // Should return text and interactive buttons (either images or graceful empty note)
    const hasText = photosOutput.replyText.length > 0;
    const hasButtons = photosOutput.buttons && photosOutput.buttons.length > 0;

    results.push({
      name: '6. Venue Photos Delivery Handler',
      passed: Boolean(hasText && hasButtons),
      details: `Reply type: ${photosOutput.replyType}, Images count: ${photosOutput.images?.length || 0}, Buttons: ${photosOutput.buttons?.map(b => b.title).join(', ')}`
    });
  } catch (e: any) {
    results.push({ name: '6. Venue Photos Delivery Handler', passed: false, details: e.message });
  }

  // ---------------------------------------------------------------------------
  // TEST 7: GPS Location-Aware Nearby Lounges Ranking
  // ---------------------------------------------------------------------------
  try {
    // Pune coordinates: 18.5204° N, 73.8567° E
    const nearbyOutput = await qcontrolIntelligence.handleNearbyClubs(18.5204, 73.8567, '919876543210', 'pool');

    const hasReply = nearbyOutput.replyText.length > 0;
    const isListOrButtons = nearbyOutput.replyType === 'list' || nearbyOutput.replyType === 'buttons';

    results.push({
      name: '7. GPS Location Distance Discovery Flow',
      passed: Boolean(hasReply && isListOrButtons),
      details: `Type: ${nearbyOutput.replyType}, Snippet: "${nearbyOutput.replyText.substring(0, 60)}..."`
    });
  } catch (e: any) {
    results.push({ name: '7. GPS Location Distance Discovery Flow', passed: false, details: e.message });
  }

  // ---------------------------------------------------------------------------
  // Print Summary Table
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('================================================================');

  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    console.log(`   └─ ${r.details}\n`);
    if (!r.passed) allPassed = false;
  }

  console.log('================================================================');
  if (allPassed) {
    console.log('🎉 ALL 7 TESTS PASSED! QControl WhatsApp Agent Upgrade is 100% Solid.');
  } else {
    console.log('⚠️ SOME TESTS FAILED. Please review the details above.');
  }
  console.log('================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runTestSuite().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
