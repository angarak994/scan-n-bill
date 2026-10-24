import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function proxy(request: NextRequest) {
  const secret = process.env.JWT_SECRET || 'super_secret_qcontrol_development_key';
  const pathname = request.nextUrl.pathname;

  // 1. Secure Platform Developer Control Center Protection
  if (pathname.startsWith('/control')) {
    const isLogin = pathname === '/control/login';
    const devToken = request.cookies.get('qcontrol_dev_session')?.value;
    let isValidDev = false;

    if (devToken) {
      try {
        const verified = await jwtVerify(devToken, new TextEncoder().encode(secret));
        if (verified.payload && verified.payload.role === 'developer') {
          isValidDev = true;
        }
      } catch {
        isValidDev = false;
      }
    }

    if (isLogin) {
      if (isValidDev) {
        return NextResponse.redirect(new URL('/control', request.url));
      }
      return NextResponse.next();
    }

    if (!isValidDev) {
      const loginUrl = new URL('/control/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      if (devToken) response.cookies.delete('qcontrol_dev_session');
      return response;
    }

    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  }

  // 2. Business Owner Dashboard Protection
  const token = request.cookies.get('qcontrol_session')?.value;
  const isDashboard = pathname.startsWith('/dashboard') || pathname.startsWith('/settings') || pathname.startsWith('/profile');

  if (isDashboard) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
    } catch (err) {
      const response = NextResponse.redirect(new URL('/login', request.url));
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
  matcher: ['/control/:path*', '/dashboard/:path*', '/settings/:path*', '/profile/:path*'],
};

