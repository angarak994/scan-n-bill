import { supabase } from '@/lib/supabaseClient';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { businessManager } from '@/lib/businessManager';

export async function handleSessionIntervention(params: {
  action: string;
  session_id: string;
  business_id: string;
  amount_recovered?: number;
  payment_method?: string;
  due_date?: string;
  transfer_table_id?: string;
  performed_by?: string;
  split_payments?: Array<{ method: string; amount: number }>;
}) {
  const { action, session_id, business_id, amount_recovered, payment_method, due_date, transfer_table_id, performed_by = 'dashboard_user', split_payments } = params;

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
      const sessionResult = await endSession(session.table_id, business_id, sourceLabel, amount_recovered, payment_method, due_date, split_payments);
      
      dbUpdates = {
        status: 'COMPLETED',
        end_time: sessionResult.end_time || now,
        duration: sessionResult.duration || 0,
        applied_pricing: sessionResult.applied_pricing,
        cost: sessionResult.cost,
        discount_amount: sessionResult.discount_amount !== undefined ? sessionResult.discount_amount : (sessionResult.discounts || 0),
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
    const { syncSessionLifecycle } = require('../sheetsSyncQueue');
    syncSessionLifecycle(session_id, business_id);
  } else {
    await sessionRepository.update(session_id, dbUpdates, business_id);
  }

  // Log intervention (non-blocking / non-fatal)
  try {
    await supabase.from('session_interventions').insert([{
      session_id,
      intervention_type: interventionType,
      amount_recovered: amount_recovered || 0,
      performed_by
    }]);
  } catch (logErr) {
    console.error('Session intervention DB log error (non-fatal):', logErr);
  }

  return { success: true, dbUpdates, sessionResult: action === 'force_end' ? (dbUpdates as any) : undefined };
}
