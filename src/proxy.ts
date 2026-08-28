import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('qcontrol_session')?.value;
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/settings') || request.nextUrl.pathname.startsWith('/profile');

  if (isDashboard) {
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    try {
      const secret = process.env.JWT_SECRET || 'super_secret_qcontrol_development_key';
      await jwtVerify(token, new TextEncoder().encode(secret));
    } catch (err) {
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('qcontrol_session');
      return response;
    }
  }

  const response = NextResponse.next();

  if (isDashboard) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/profile/:path*'],
};
