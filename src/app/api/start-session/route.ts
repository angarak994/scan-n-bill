import { NextResponse } from 'next/server';
import { startSession } from '@/lib/sessionManager';
import { GameType } from '@/lib/pricing';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    let { table_id, game_type, customer_name, business_id, num_players, member_id } = await request.json();
    
    // Note: Cookie validation is intentionally omitted here to allow 
    // QR code scans (which are inherently unauthenticated) to start sessions,
    // as well as to allow owners of Business A to scan QR codes at Business B.
    if (!table_id || !game_type || !customer_name) {
      return NextResponse.json({ error: 'table_id, game_type, and customer_name are required' }, { status: 400 });
    }

    if (member_id && business_id) {
      const { supabase } = require('@/lib/supabaseClient');
      const { data: membership, error: memberError } = await supabase
        .from('memberships')
        .select('name, business_id')
        .eq('id', member_id)
        .eq('business_id', business_id)
        .single();
        
      if (memberError || !membership) {
        return NextResponse.json({ error: 'Invalid member selected for this business.' }, { status: 403 });
      }
      
      // Forcefully overwrite the customer_name with the real, validated DB name
      customer_name = membership.name;
    }

    const result = await startSession(table_id, game_type as GameType, customer_name, business_id, num_players || 1, member_id);
    
    // Sync to Google Sheets asynchronously (non-blocking)
    Promise.resolve().then(async () => {
      try {
        const { logSessionStartToSheet } = require('@/lib/googleSheets');
        await logSessionStartToSheet(result, business_id);
      } catch (sheetError) {
        console.error('Google Sheets Sync Error:', sheetError);
      }
    });
    
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
