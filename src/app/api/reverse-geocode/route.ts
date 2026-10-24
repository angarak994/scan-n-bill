import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });
    }

    const body = await request.json();
    const lat = Number(body.latitude ?? body.lat);
    const lng = Number(body.longitude ?? body.lng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Invalid coordinates provided' }, { status: 400 });
    }

    // Call reliable reverse-geocoding provider with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
    
    let response: Response;
    try {
      response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'QControl-Business-Locator/1.0 (contact@qcontrol.club)',
          'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8'
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json({ error: 'Geocoding rate limit exceeded. Please type address manually.' }, { status: 429 });
      }
      return NextResponse.json({ error: 'Reverse geocoding service currently unavailable' }, { status: 502 });
    }

    const data = await response.json();
    const addressDetails = data.address || {};

    // Assemble human-readable Indian / international address format
    const parts: string[] = [];

    // Building / Venue / POI name
    const building = addressDetails.building || addressDetails.amenity || addressDetails.leisure || addressDetails.shop;
    if (building && typeof building === 'string') parts.push(building);

    // Street / Road
    const road = addressDetails.road || addressDetails.street || addressDetails.pedestrian;
    if (road && typeof road === 'string') parts.push(road);

    // Suburb / Locality / Sector
    const locality = addressDetails.suburb || addressDetails.neighbourhood || addressDetails.residential || addressDetails.subdistrict;
    if (locality && typeof locality === 'string' && !parts.includes(locality)) parts.push(locality);

    // City / Town / District
    const city = addressDetails.city || addressDetails.town || addressDetails.village || addressDetails.county;
    if (city && typeof city === 'string' && !parts.includes(city)) parts.push(city);

    // State
    const state = addressDetails.state;
    if (state && typeof state === 'string' && !parts.includes(state)) parts.push(state);

    // Postal Code
    const postcode = addressDetails.postcode;
    if (postcode && typeof postcode === 'string') parts.push(postcode);

    let formattedAddress = parts.join(', ');
    if (!formattedAddress && data.display_name) {
      formattedAddress = data.display_name.split(',').slice(0, 5).join(',').trim();
    }

    if (!formattedAddress) {
      formattedAddress = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
    }

    return NextResponse.json({
      success: true,
      address: formattedAddress,
      latitude: lat,
      longitude: lng,
      placeId: data.place_id ? String(data.place_id) : null,
      rawDetails: {
        city: city || null,
        state: state || null,
        postcode: postcode || null
      }
    });

  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return NextResponse.json({ error: 'Location lookup timed out. Please type address manually.' }, { status: 504 });
    }
    console.error('Reverse Geocode API Error:', error);
    return NextResponse.json({ error: 'Failed to resolve location address' }, { status: 500 });
  }
}
