import { NextResponse } from 'next/server';
import { getTableStatus } from '@/lib/sessionManager';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table_id = searchParams.get('table_id');

    if (!table_id) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 });
    }

    const status = await getTableStatus(table_id);
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode ?? 500 });
  }
}
