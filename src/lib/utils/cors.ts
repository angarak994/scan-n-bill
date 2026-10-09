import { NextResponse } from 'next/server';

// Allowed origins for CORS. Add specific domains here for production.
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://billiards-qr-sessions.vercel.app', // Adding the known vercel app based on previous code
];

export function getCorsHeaders(origin: string | null) {
  // If no origin or not in the allowed list, validate it.
  const isAllowed = origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app'));
  
  const headers = new Headers();
  
  if (isAllowed) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    // If we're denying CORS, we don't return the wildcard
    headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]); 
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400'); // 24 hours caching for preflight

  return headers;
}

export function handleOptionsResponse(request: Request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) });
}

export function withCorsHeaders(response: NextResponse, request: Request) {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin);
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}
