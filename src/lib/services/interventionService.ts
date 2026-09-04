import { supabase } from '@/lib/supabaseClient';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { calculateBilling } from '@/lib/billing';
import { businessManager } from '@/lib/businessManager';
import { logActivityToSheet, logSessionEndToSheet } from '@/lib/googleSheets';

export async function handleSessionIntervention(params: {
  action: string;
  session_id: string;
  business_id: string;
  amount_recovered?: number;
  payment_method?: string;
  due_date?: string;
  transfer_table_id?: string;
  performed_by?: string;
}) {
  const { action, session_id, business_id, amount_recovered, payment_method, due_date, transfer_table_id, performed_by = 'dashboard_user' } = params;

  if (!session_id || !business_id || !action) {
    throw new Error('Missing parameters');
  }

  const session = await sessionRepository.findById(session_id, business_id);
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status !== 'ACTIVE') {
    throw new Error('Session is not active');
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
        throw new Error('Session is not paused');
      }
      interventionType = 'resume';
      const pausedSecs = Math.max(0, Math.floor((new Date().getTime() - new Date(session.paused_at).getTime()) / 1000));
      dbUpdates = { 
        paused_at: null,
        paused_duration_seconds: (session.paused_duration_seconds || 0) + pausedSecs,
        last_activity_at: now
      };
      break;
    case 'transfer':
      if (!transfer_table_id) {
        throw new Error('Transfer table required');
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
      let sourceLabel = 'System';
      if (performed_by === 'telegram_bot' || performed_by === 'Qbot') {
        sourceLabel = 'Qbot';
      } else if (performed_by === 'dashboard_user') {
        sourceLabel = 'Manual Force';
      }
      
      const { endSession } = require('../sessionManager');
      const sessionResult = await endSession(session.table_id, business_id, sourceLabel, amount_recovered, payment_method, due_date);
      
      dbUpdates = {
        status: 'COMPLETED',
        end_time: sessionResult.end_time || now,
        duration: sessionResult.duration || 0,
        applied_pricing: sessionResult.applied_pricing,
        cost: sessionResult.cost,
        discount_amount: sessionResult.discounts,
        paused_duration_seconds: sessionResult.paused_duration_seconds,
        last_activity_at: now
      };
      break;
    case 'confirm_playing':
      interventionType = 'confirm_playing';
      dbUpdates = {
        last_activity_at: now
      };
      break;
    default:
      throw new Error('Invalid action');
  }

  if (action === 'force_end') {
    // Session is already updated inside endSession
  } else {
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
    performed_by
  }]);

  // Log intervention to Google Sheets asynchronously (fire-and-forget)
  Promise.all([
    logActivityToSheet(`${interventionType.toUpperCase()}_SESSION`, {
      user: (performed_by === 'telegram_bot' || performed_by === 'Qbot') ? 'Qbot' : 'Club Owner',
      table: session.table_id,
      session: session_id,
      details: `Session ${interventionType}`
    }, business_id),
    
    action === 'force_end' 
      ? logSessionEndToSheet({
          id: session_id,
          business_id,
          customer_name: session.customer_name,
          table_id: session.table_id,
          start_time: session.start_time,
          end_time: dbUpdates.end_time,
          duration: dbUpdates.duration,
          cost: dbUpdates.cost,
          discounts: dbUpdates.discount_amount,
          date: session.date,
          game_type: session.game_type,
          num_players: session.num_players,
          paused_duration_seconds: dbUpdates.paused_duration_seconds,
          applied_pricing: dbUpdates.applied_pricing,
          completed_by: dbUpdates.completed_by
        }, business_id)
      : Promise.resolve()
  ]).catch(e => console.error('Google Sheets Intervention Sync Error:', e));

  return { success: true, dbUpdates };
}
