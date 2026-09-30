import { NextResponse } from 'next/server';
import { startSession } from '@/lib/sessionManager';
import { GameType } from '@/lib/pricing';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    let { table_id, game_type, customer_name, business_id, num_players, member_id, start_time, notes } = await request.json();
    
    // If an owner is logged in, strictly enforce their business ID to prevent cross-business IDOR attacks.
    // If no session exists, it falls back to the client-provided business_id (for unauthenticated QR code scans).
    const isOwner = sessionCookie && sessionCookie.businessId;
    if (isOwner) {
       business_id = sessionCookie.businessId;
    }

    if (!table_id || !game_type || !customer_name) {
      return NextResponse.json({ error: 'table_id, game_type, and customer_name are required' }, { status: 400 });
    }

    // Verify Business and Table Ownership
    const { businessManager } = require('@/lib/businessManager');
    const business = await businessManager.getBusiness(business_id);
    if (!business) {
      return NextResponse.json({ error: 'Invalid business' }, { status: 404 });
    }

    if (!isOwner) {
       // Unauthenticated QR Flow: Verify business allows QR actions
       const prefs = business.pricing_rules?.globalSettings?.preferences || {};
       if (prefs.auto_qr_billing === false) {
           return NextResponse.json({ error: 'QR billing is disabled for this business' }, { status: 403 });
       }
    }

    if (member_id && business_id) {
      const { supabase } = require('@/lib/supabaseClient');
      let { data: membership, error: memberError } = await supabase
        .from('customers')
        .select('name, business_id')
        .eq('id', member_id)
        .eq('business_id', business_id)
        .single();
        
      if (!membership) {
         // Fallback to memberships table if not found in customers
         const { data: memRecord } = await supabase
           .from('memberships')
           .select('id, name, mobile, business_id')
           .eq('id', member_id)
           .eq('business_id', business_id)
           .single();
           
         if (memRecord) {
           // Insert into customers table to satisfy foreign key constraint on sessions
           const { data: newCustomer, error: insertErr } = await supabase
             .from('customers')
             .insert([{
               id: memRecord.id,
               business_id: memRecord.business_id,
               name: memRecord.name,
               phone: memRecord.mobile || '',
               outstanding_balance: 0
             }])
             .select()
             .single();
             
           if (insertErr) {
             console.error('[CRITICAL] Failed to auto-register customer from membership:', insertErr);
             return NextResponse.json({ error: 'Failed to sync member to customer ledger: ' + insertErr.message }, { status: 500 });
           }
           membership = newCustomer;
         }
      }
        
      if (!membership) {
        return NextResponse.json({ error: 'Invalid member selected for this business.' }, { status: 403 });
      }
      
      // Forcefully overwrite the customer_name with the real, validated DB name
      customer_name = membership.name;
    }

    const result = await startSession(table_id, game_type as GameType, customer_name, business_id, num_players || 1, member_id, start_time, notes);
    
    
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
