import { NextResponse } from 'next/server';
import { startSession } from '@/lib/sessionManager';
import { GameType } from '@/lib/pricing';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    let { table_id, game_type, customer_name, business_id, num_players, member_id, start_time } = await request.json();
    
    // If an owner is logged in, strictly enforce their business ID to prevent cross-business IDOR attacks.
    // If no session exists, it falls back to the client-provided business_id (for unauthenticated QR code scans).
    if (sessionCookie && sessionCookie.businessId) {
       business_id = sessionCookie.businessId;
    }

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

    const result = await startSession(table_id, game_type as GameType, customer_name, business_id, num_players || 1, member_id, start_time);
    
    
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
