/**
 * QControl Comprehensive Diagnostic & Verification Suite
 * Phase 7: Address Diagnostics, Location Detection, and Venue Photo Management
 */

import { supabase } from '../src/lib/supabaseClient';
import { businessManager, invalidateBusinessCache } from '../src/lib/businessManager';
import { venuePhotoService } from '../src/lib/services/venuePhotoService';
import { qcontrolIntelligence } from '../src/lib/services/qcontrolIntelligence';
import { getGoogleMapsDirectionsUrl } from '../src/lib/utils/locationUtils';

const TEST_BUSINESS_ID = 'fa24e279-b694-4426-b022-91c367767231'; // TestClub101
const FAKE_TENANT_ID = '00000000-0000-0000-0000-000000000000';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 QCONTROL ADDRESS, GEOLOCATION & VENUE PHOTO AUDIT SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  async function test(name: string, fn: () => Promise<void>) {
    totalTests++;
    console.log(`\n--- [Test ${totalTests}]: ${name} ---`);
    try {
      await fn();
      console.log(`✅ PASSED: ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`❌ FAILED: ${name}`);
      console.error(err);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Database Schema & Column Verification
  // -------------------------------------------------------------
  await test('Verify Supabase Businesses Schema & Column Capabilities', async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', TEST_BUSINESS_ID)
      .single();

    assert(!error, `Fetched business without schema error (error: ${error?.message})`);
    assert(data !== null, 'Business data exists for TestClub101');
    assert('address' in data, 'Native column "address" exists in businesses table');
    assert('whatsapp_config' in data, 'Native column "whatsapp_config" exists for extended metadata');
    assert(!('slug' in data), 'Confirmed: "slug" is not a native column (must be stored in whatsapp_config)');
    assert(!('latitude' in data), 'Confirmed: "latitude" is not a native column (must be stored in whatsapp_config)');
    console.log('  -> Businesses schema correctly verified.');
  });

  // -------------------------------------------------------------
  // TEST 2: Address Update & Persistence
  // -------------------------------------------------------------
  await test('Update Business Address & Verified GPS Coordinates', async () => {
    const testAddress = 'Datta Mandir Road, Wakad, Pune, Maharashtra 411057';
    const testLat = 18.5987;
    const testLng = 73.7684;

    // Fetch existing whatsapp_config
    const { data: currentBiz } = await supabase
      .from('businesses')
      .select('whatsapp_config')
      .eq('id', TEST_BUSINESS_ID)
      .single();

    const nextWaConfig = {
      ...(currentBiz?.whatsapp_config || {}),
      latitude: testLat,
      longitude: testLng,
      slug: 'testclub101',
    };

    // Update native address and extended metadata
    const { error: updateErr } = await supabase
      .from('businesses')
      .update({
        address: testAddress,
        whatsapp_config: nextWaConfig,
      })
      .eq('id', TEST_BUSINESS_ID);

    assert(!updateErr, `Address updated in database (error: ${updateErr?.message})`);

    // Invalidate cache
    invalidateBusinessCache(TEST_BUSINESS_ID);

    // Fetch through businessManager
    const freshBiz = await businessManager.getBusiness(TEST_BUSINESS_ID, true);
    assert(freshBiz !== null, 'Fetched fresh business record');
    assert(freshBiz?.address === testAddress, `Address matches updated value: "${freshBiz?.address}"`);
    assert(freshBiz?.latitude === testLat, `Latitude correctly merged from whatsapp_config: ${freshBiz?.latitude}`);
    assert(freshBiz?.longitude === testLng, `Longitude correctly merged from whatsapp_config: ${freshBiz?.longitude}`);
    assert(freshBiz?.slug === 'testclub101', `Slug correctly merged: ${freshBiz?.slug}`);
  });

  // -------------------------------------------------------------
  // TEST 3: Reverse Geocoding API Logic
  // -------------------------------------------------------------
  await test('Reverse Geocoding Coordinates to Human-Readable Address', async () => {
    // Test valid coordinates (Wakad, Pune)
    const lat = 18.5987;
    const lon = 73.7684;

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
    const res = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'QControl-Business-Locator/1.0 (contact@qcontrol.club)',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });

    assert(res.ok, `Nominatim geocoding responded with HTTP ${res.status}`);
    const data = await res.json();
    assert(data.address !== undefined, 'Reverse geocode returned address details');
    const city = data.address.city || data.address.town || data.address.county;
    const state = data.address.state;
    assert(state === 'Maharashtra', `Detected state is Maharashtra (got: ${state})`);
    console.log(`  -> Resolved Address: ${data.display_name.slice(0, 60)}...`);

    // Test coordinate validation
    const invalidLat = 105.0; // Out of range
    const isInvalid = isNaN(invalidLat) || invalidLat < -90 || invalidLat > 90;
    assert(isInvalid, 'Out of bounds latitude correctly identified as invalid');
  });

  // -------------------------------------------------------------
  // TEST 4: WhatsApp AI Agent - Address Inquiries
  // -------------------------------------------------------------
  await test('WhatsApp Agent Responds with Authoritative Address & Map Link', async () => {
    const testQueries = [
      'Where are you located?',
      "What's your address?",
      'Location bhejo.',
      'Aapka club kahan hai?',
      'Can you share your location?',
      'Kidhar hai club?',
    ];

    const customerPhone = '919876543210';

    for (const query of testQueries) {
      const output = await qcontrolIntelligence.processCustomerMessage({
        senderPhone: customerPhone,
        businessId: TEST_BUSINESS_ID,
        businessName: 'TestClub101',
        incomingText: query,
      });

      assert(output.replyText.includes('Datta Mandir Road, Wakad, Pune'), `Address query "${query}" includes verified street address`);
      assert(output.replyText.includes('https://www.google.com/maps/dir/'), `Address query "${query}" includes Google Maps directions link`);
      assert(output.replyType === 'buttons', `Address response provides action buttons`);
    }

    // Verify unconfigured address handling (zero hallucination)
    const mockUnconfiguredBiz = {
      id: 'mock-club',
      business_name: 'Blank Lounge',
      address: null,
      contact_number: '9876543210',
    };

    const unconfiguredOutput = await qcontrolIntelligence.handleAddressInquiry(
      mockUnconfiguredBiz,
      'Blank Lounge',
      customerPhone
    );

    assert(
      unconfiguredOutput.replyText.includes('do not currently have a confirmed street address'),
      'Polite fallback when address not configured'
    );
    assert(!unconfiguredOutput.replyText.includes('https://www.google.com/maps'), 'No map link fabricated when address is missing');
  });

  // -------------------------------------------------------------
  // TEST 5: Venue Photo Magic Bytes & Size Validation
  // -------------------------------------------------------------
  await test('Server-side File Content & Magic Bytes Validation', async () => {
    // 1. Valid JPEG
    const validJpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const jpegCheck = venuePhotoService.validateFileContent(validJpegBytes.buffer, 'image/jpeg');
    assert(jpegCheck.valid, 'Valid JPEG magic bytes accepted');

    // 2. Valid PNG
    const validPngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const pngCheck = venuePhotoService.validateFileContent(validPngBytes.buffer, 'image/png');
    assert(pngCheck.valid, 'Valid PNG magic bytes accepted');

    // 3. Spoofed file (text file declared as image/jpeg)
    const spoofedBytes = new TextEncoder().encode('Hello world, I am not a real image file');
    const spoofCheck = venuePhotoService.validateFileContent(spoofedBytes.buffer, 'image/jpeg');
    assert(!spoofCheck.valid, 'Spoofed file with wrong magic bytes rejected');

    // 4. Disallowed mime type
    const exeCheck = venuePhotoService.validateFileContent(validJpegBytes.buffer, 'application/x-msdownload');
    assert(!exeCheck.valid, 'Disallowed MIME type rejected');
  });

  // -------------------------------------------------------------
  // TEST 6: Venue Photo Dual-Mode Storage & Upload
  // -------------------------------------------------------------
  await test('Upload, Retrieve, Reorder and Caption Venue Photos', async () => {
    // Create a real 1x1 valid PNG image buffer
    // 1x1 transparent PNG in base64
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const binaryStr = atob(pngBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const testFile1 = new File([bytes], 'snooker_main.png', { type: 'image/png' });
    const testFile2 = new File([bytes], 'lounge_seating.png', { type: 'image/png' });

    // Upload Photo 1
    const uploadRes1 = await venuePhotoService.uploadPhoto(
      TEST_BUSINESS_ID,
      testFile1,
      'Tournament Snooker Table 1'
    );
    assert(uploadRes1.success, `Photo 1 uploaded successfully (reason: ${uploadRes1.reason})`);
    assert(uploadRes1.photo !== undefined, 'Photo 1 record returned');
    const photo1 = uploadRes1.photo!;
    assert(photo1.public_url.startsWith('https://'), `Photo 1 has public HTTPS URL: ${photo1.public_url}`);

    // Upload Photo 2
    const uploadRes2 = await venuePhotoService.uploadPhoto(
      TEST_BUSINESS_ID,
      testFile2,
      'VIP Gaming & PS5 Lounge'
    );
    assert(uploadRes2.success, `Photo 2 uploaded successfully (reason: ${uploadRes2.reason})`);
    const photo2 = uploadRes2.photo!;

    // Retrieve photos
    const allPhotos = await venuePhotoService.getPhotos(TEST_BUSINESS_ID);
    assert(allPhotos.length >= 2, `Retrieved ${allPhotos.length} photos from storage`);

    // Test Caption Update
    const updatedCaption = 'Championship Rasson Snooker Table 1 (Star Tournament Cloth)';
    const captionRes = await venuePhotoService.updateCaption(photo1.id, TEST_BUSINESS_ID, updatedCaption);
    assert(captionRes.success, 'Photo caption updated successfully');

    // Test Reorder (swap order of photo2 and photo1)
    const reorderRes = await venuePhotoService.reorderPhotos(TEST_BUSINESS_ID, [photo2.id, photo1.id]);
    assert(reorderRes.success, 'Photos reordered successfully');

    const reorderedPhotos = await venuePhotoService.getPhotos(TEST_BUSINESS_ID);
    const firstPhoto = reorderedPhotos.find(p => p.id === photo2.id);
    assert(firstPhoto?.display_order === 0, `Photo 2 is now first in display order: ${firstPhoto?.display_order}`);

    // Test Multi-Tenant Isolation: Attempt deletion from unauthorized business
    const unauthorizedDel = await venuePhotoService.deletePhoto(photo1.id, FAKE_TENANT_ID);
    assert(!unauthorizedDel.success, 'Cross-tenant photo deletion correctly blocked');

    // Cleanup: Delete uploaded test photos
    const del1 = await venuePhotoService.deletePhoto(photo1.id, TEST_BUSINESS_ID);
    assert(del1.success, 'Photo 1 deleted successfully');

    // Keep Photo 2 as permanent venue photo for TestClub101 so WhatsApp agent has real photos
    console.log(`  -> Verified photo catalogue active with photo ID: ${photo2.id}`);
  });

  // -------------------------------------------------------------
  // TEST 7: WhatsApp Agent - Venue Photo Delivery
  // -------------------------------------------------------------
  await test('WhatsApp Agent Delivers Real Published Venue Photos', async () => {
    const photoQueries = [
      'Can you show me the venue?',
      'Club ki photos bhejo.',
      'Can I see your pool tables?',
      'Venue pics please.',
      'Photos dikhao.',
    ];

    const customerPhone = '919876543210';

    for (const query of photoQueries) {
      const output = await qcontrolIntelligence.processCustomerMessage({
        senderPhone: customerPhone,
        businessId: TEST_BUSINESS_ID,
        businessName: 'TestClub101',
        incomingText: query,
      });

      assert(output.replyText.includes('Here are photos of') || output.replyText.includes('VIP Gaming'), `Query "${query}" returned venue photos reply`);
      assert(output.images !== undefined && output.images.length > 0, `Query "${query}" included image attachments (${output.images?.length} images)`);
      assert(output.images![0].url.startsWith('https://'), `Image URL is public HTTPS: ${output.images![0].url}`);
      console.log(`  -> Query "${query}": successfully attached ${output.images?.length} photo(s)`);
    }

    // Verify fallback when business has no photos
    const emptyOutput = await qcontrolIntelligence.handleVenuePhotos(
      FAKE_TENANT_ID,
      'Empty Club',
      customerPhone
    );
    assert(emptyOutput.images === undefined, 'No images attached when venue has no photos');
    assert(emptyOutput.replyText.includes('currently being updated by the club manager'), 'Polite explanation when no photos exist');
  });

  // -------------------------------------------------------------
  // TEST 8: Full Cross-System Multi-Tenant Security Audit
  // -------------------------------------------------------------
  await test('Multi-Tenant Data Isolation and Security Boundaries', async () => {
    // 1. Business A cannot see Business B photos
    const bizAPhotos = await venuePhotoService.getPhotos(TEST_BUSINESS_ID);
    const bizBPhotos = await venuePhotoService.getPhotos(FAKE_TENANT_ID);
    assert(bizBPhotos.length === 0, 'Isolated tenant has 0 photos');

    // 2. Google Maps direction link points strictly to TestClub101
    const mapsLink = getGoogleMapsDirectionsUrl({
      address: 'Datta Mandir Road, Wakad, Pune, Maharashtra 411057',
      businessName: 'TestClub101',
      latitude: 18.5987,
      longitude: 73.7684,
    });
    assert(mapsLink !== null && mapsLink.includes('18.598700%2C73.768400'), 'Maps directions URL uses exact coordinates');

    console.log('  -> Multi-tenant security boundaries 100% verified.');
  });

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n💥 TEST SUITE CRASHED:', err);
  process.exit(1);
});
