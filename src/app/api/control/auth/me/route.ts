import { NextResponse } from 'next/server';
import { getDeveloperSession, clearDeveloperSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getDeveloperSession(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    developer: {
      email: session.email,
      role: session.role,
    }
  });
}

export async function POST() {
  await clearDeveloperSession();
  return NextResponse.json({ success: true, message: 'Developer session cleared.' });
}
