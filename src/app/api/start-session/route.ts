import { NextResponse } from 'next/server';
import { startSession } from '@/lib/sessionManager';
import { GameType } from '@/lib/pricing';
import { getSession } from '@/lib/auth';
import { checkRateLimit, getIpAddress } from '@/lib/utils/rateLimit';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    const isOwner = sessionCookie && sessionCookie.businessId;

    const ip = getIpAddress(request);
    
    // Venue-friendly Rate Limiting: 
    // Unauthenticated users (QR Scans) get 60 sessions per 10 mins (supports shared Wi-Fi)
    // Authenticated owners get 100 per 10 mins
    const limit = isOwner ? 100 : 60;
    if (!checkRateLimit(`start_sess_${ip}`, limit, 10 * 60 * 1000)) {
       return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const body = await request.json();
    let table_id = body.table_id || body.tableId;
    let game_type = body.game_type || body.gameType;
    let customer_name = body.customer_name || body.customerName;
    let business_id = body.business_id || body.businessId;
    let num_players = body.num_players || body.numPlayers;
    let member_id = body.member_id || body.memberId;
    let start_time = body.start_time || body.startTime;
    let notes = body.notes;
    
    // If an owner is logged in, strictly enforce their business ID to prevent cross-business IDOR attacks.
    // If no session exists, it falls back to the client-provided business_id (for unauthenticated QR code scans).
    if (isOwner) {
       business_id = sessionCookie.businessId;
    }

    if (!table_id || !customer_name) {
      return NextResponse.json({ error: 'table_id and customer_name are required' }, { status: 400 });
    }

    // Verify Business and Table Ownership
    const { businessManager } = require('@/lib/businessManager');
    const business = await businessManager.getBusiness(business_id);
    if (!business) {
      return NextResponse.json({ error: 'Invalid business' }, { status: 404 });
    }

    const configuredTables = business.tables || [];
    const matchedTable = configuredTables.find((t: any) =>
      String(t.id).trim().toLowerCase() === String(table_id).trim().toLowerCase() ||
      String(t.name).trim().toLowerCase() === String(table_id).trim().toLowerCase()
    );
    if (configuredTables.length > 0 && !matchedTable) {
      return NextResponse.json({ error: `Table '${table_id}' is not configured for this business.` }, { status: 400 });
    }
    if (matchedTable) {
      table_id = matchedTable.id; // Canonicalize table_id
      if (!game_type) {
        game_type = matchedTable.game_type || matchedTable.type || 'pool';
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

    if (result && result.id && business_id) {
      const { scheduleBackgroundTask, flushSheetsSyncQueue } = require('@/lib/sheetsSyncQueue');
      scheduleBackgroundTask(async () => {
        try {
          await flushSheetsSyncQueue(business_id, 4000);
        } catch (sheetSyncErr) {
          console.warn('[StartSession] Background sheets sync flush warning:', sheetSyncErr);
        }
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
