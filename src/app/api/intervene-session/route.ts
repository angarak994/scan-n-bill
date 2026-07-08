import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { calculateBilling } from '@/lib/billing';
import { businessManager } from '@/lib/businessManager';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, session_id, business_id, amount_recovered, transfer_table_id } = body;

    if (!session_id || !business_id || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const session = await sessionRepository.findById(session_id, business_id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    const now = new Date().toISOString();

    let interventionType = '';
    let dbUpdates: any = {};

    switch (action) {
      case 'pause':
        interventionType = 'pause';
        dbUpdates = { paused_at: now };
        break;
      case 'resume':
        if (!session.paused_at) {
          return NextResponse.json({ error: 'Session is not paused' }, { status: 400 });
        }
        interventionType = 'resume';
        const pausedSecs = Math.floor((new Date().getTime() - new Date(session.paused_at).getTime()) / 1000);
        dbUpdates = { 
          paused_at: null,
          paused_duration_seconds: (session.paused_duration_seconds || 0) + pausedSecs,
          last_activity_at: now
        };
        break;
      case 'transfer':
        if (!transfer_table_id) {
          return NextResponse.json({ error: 'Transfer table required' }, { status: 400 });
        }
        interventionType = 'transfer';
        dbUpdates = {
          transferred_from_table_id: session.table_id,
          table_id: transfer_table_id,
          last_activity_at: now
        };
        break;
      case 'force_end':
        interventionType = 'force_close';
        // Calculate final bill
        const business = await businessManager.getBusiness(business_id);
        const activeDiscount = business?.active_discounts?.[session.table_id];
        const res = calculateBilling(
          session.start_time, 
          now, 
          session.game_type, 
          business?.pricing_rules, 
          session.num_players, 
          activeDiscount
        );
        
        dbUpdates = {
          status: 'COMPLETED',
          end_time: now,
          duration: res.duration,
          applied_pricing: res.slabs_applied,
          cost: res.cost,
          base_cost: res.baseCost,
          discount_amount: res.discountAmount,
          closure_type: 'manual_force',
          last_activity_at: now
        };
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (action === 'force_end') {
      // Use repository to ensure Google Sheets sync and DB update happens atomically
      await sessionRepository.update(session_id, dbUpdates, business_id);
    } else {
      // Apply session update via supabase directly for pause/resume/transfer
      const { error: updateError } = await supabase
        .from('sessions')
        .update(dbUpdates)
        .eq('id', session_id);
        
      if (updateError) throw updateError;
    }

    // Log intervention
    await supabase.from('session_interventions').insert([{
      session_id,
      intervention_type: interventionType,
      amount_recovered: amount_recovered || 0,
      performed_by: 'dashboard_user'
    }]);

    try {
      const { logActivityToSheet } = require('@/lib/googleSheets');
      await logActivityToSheet(`${interventionType.toUpperCase()}_SESSION`, {
        user: 'Club Owner',
        table: session.table_id,
        session: session_id,
        details: `Session ${interventionType}`
      });
    } catch (e) {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Intervention Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
