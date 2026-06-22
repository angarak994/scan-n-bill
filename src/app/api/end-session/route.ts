import { NextResponse } from 'next/server';
import { endSession } from '@/lib/sessionManager';

export async function POST(request: Request) {
  try {
    const { table_id } = await request.json();
    if (!table_id) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 });
    }
    const result = await endSession(table_id);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode ?? 500 });
  }
}
