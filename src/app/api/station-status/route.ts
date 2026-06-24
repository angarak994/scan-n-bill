import { NextResponse } from 'next/server';
import { getTableStatus } from '@/lib/sessionManager';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table_id = searchParams.get('table_id');
    const business_id = searchParams.get('b') || undefined;

    if (!table_id) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 });
    }

    const status = await getTableStatus(table_id, business_id);
    return NextResponse.json(status);
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
