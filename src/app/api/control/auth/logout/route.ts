import { NextResponse } from 'next/server';
import { clearDeveloperSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  await clearDeveloperSession();
  return NextResponse.json({ success: true, message: 'Developer session cleared.' });
}
