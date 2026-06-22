import { NextResponse } from 'next/server';
import { startSession } from '@/lib/sessionManager';
import { GameType } from '@/lib/pricing';

export async function POST(request: Request) {
  try {
    const { table_id, game_type } = await request.json();
    
    if (!table_id || !game_type) {
      return NextResponse.json({ error: 'table_id and game_type are required' }, { status: 400 });
    }
    if (game_type !== 'snooker' && game_type !== 'pool') {
      return NextResponse.json({ error: 'game_type must be snooker or pool' }, { status: 400 });
    }

    const result = await startSession(table_id, game_type as GameType);
    return NextResponse.json(result, { status: result.isExisting ? 200 : 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode ?? 500 });
  }
}
