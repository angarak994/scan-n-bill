import { businessManager } from '../businessManager';
import { supabase } from '../supabaseClient';

export interface Session {
  id?: string;
  business_id?: string;
  date: string;
  customer_name: string;
  table_id: string;
  game_type: string;
  start_time: string;
  end_time: string | null;
  duration: string | null;
  applied_pricing: string | null;
  cost: number | null;
  status: 'ACTIVE' | 'COMPLETED';
  food_cost?: number;
  num_players?: number;
  last_activity_at?: string;
  closure_type?: string;
  paused_at?: string | null;
  paused_duration_seconds?: number;
  transferred_from_table_id?: string | null;
  locked_rate?: number;
  locked_rate_name?: string;
  member_id?: string;
  notes?: string | null;
  base_cost?: number;
  discount_amount?: number;
  payment_status?: string;
  payment_method?: string;
  amount_paid?: number;
  customer_id?: string;
  completed_by?: string;
}

export const sessionRepository = {
  findActiveByTable: async (table_id: string, businessId?: string): Promise<Session | null> => {
    if (!businessId) return null;
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('business_id', businessId)
      .ilike('table_id', table_id)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as Session;
  },

  findActiveCount: async (businessId?: string): Promise<number> => {
    if (!businessId) return 0;
    const { count, error } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'ACTIVE');

    if (error) return 0;
    return count || 0;
  },

  findAllToday: async (dateStr: string, businessId?: string): Promise<Session[]> => {
    if (!businessId) return [];
    
    // Fetch all active sessions (could cross over midnight) OR sessions completed today
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('business_id', businessId)
      .or(`date.eq.${dateStr},status.eq.ACTIVE`);

    if (error || !data) return [];
    return data as Session[];
  },

  findAllByDateRange: async (startDate: string, endDate: string, businessId?: string): Promise<Session[]> => {
    if (!businessId) return [];
    
    // Fetch sessions between startDate and endDate based on date (start) OR end_time, PLUS any currently active sessions
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('business_id', businessId)
      .or(`and(date.gte.${startDate},date.lte.${endDate}),and(end_time.gte.${startDate}T00:00:00,end_time.lte.${endDate}T23:59:59),status.eq.ACTIVE`);

    if (error || !data) return [];
    return data as Session[];
  },

  findById: async (id: string, businessId?: string): Promise<Session | null> => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as Session;
  },

  create: async (session: Session, businessId?: string): Promise<void> => {
    if (!businessId) throw new Error("businessId required for Supabase DB");

    // 1. Insert into Supabase (Source of Truth)
    const { data: insertedData, error } = await supabase
      .from('sessions')
      .insert([{
        id: session.id,
        business_id: businessId,
        date: session.date,
        customer_name: session.customer_name,
        table_id: session.table_id,
        game_type: session.game_type,
        start_time: session.start_time,
        status: session.status,
        food_cost: session.food_cost || 0,
        num_players: session.num_players || 1,
        locked_rate: session.locked_rate,
        locked_rate_name: session.locked_rate_name,
        base_cost: session.base_cost || 0,
        discount_amount: session.discount_amount || 0,
        payment_status: session.payment_status || 'Pending',
        completed_by: session.completed_by || 'System',
        member_id: session.member_id || null,
      }])
      .select('id')
      .single();

    if (error || !insertedData) {
      if (error?.code === '23505' || error?.message?.includes('unique_active_table_session')) {
        // Idempotent recovery: active session already exists for this table
        const existing = await sessionRepository.findActiveByTable(session.table_id, businessId);
        if (existing) {
          return;
        }
      }
      throw new Error("Failed to create session in Database: " + error?.message);
    }

    // --- IN-MEMORY LOCKS HANDLE DUPLICATES, DB CHECK OMITTED FOR SPEED ---
    // The activeTableLocks in sessionManager.ts handles >99% of rapid double clicks.
    // We intentionally skip a secondary DB-level activeCheck here to shave off ~150ms of latency,
    // ensuring startSession resolves nearly instantly for the user.
    // -----------------------------------------------------------
    // 2. Enqueue Google Sheets synchronization for session creation
    try {
      const { syncSessionLifecycle } = require('../sheetsSyncQueue');
      syncSessionLifecycle(session.id, businessId);
    } catch (sheetError) {
      console.warn("Google Sheets Sync Queue Error on Create:", sheetError);
    }
  },

  update: async (id: string, updates: Partial<Session>, businessId?: string, requireActive?: boolean, skipSheetsSync?: boolean): Promise<void> => {
    const updatePayload: Record<string, any> = {};
    if (updates.end_time !== undefined) updatePayload.end_time = updates.end_time;
    if (updates.duration !== undefined) updatePayload.duration = updates.duration;
    if (updates.applied_pricing !== undefined) updatePayload.applied_pricing = updates.applied_pricing;
    if (updates.cost !== undefined) updatePayload.cost = updates.cost;
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.food_cost !== undefined) updatePayload.food_cost = updates.food_cost;
    if (updates.num_players !== undefined) updatePayload.num_players = updates.num_players;
    if (updates.base_cost !== undefined) updatePayload.base_cost = updates.base_cost;
    if (updates.discount_amount !== undefined) updatePayload.discount_amount = updates.discount_amount;
    if (updates.payment_status !== undefined) updatePayload.payment_status = updates.payment_status;
    if (updates.completed_by !== undefined) updatePayload.completed_by = updates.completed_by;
    if ((updates as any).amount_paid !== undefined) updatePayload.amount_paid = (updates as any).amount_paid;
    if ((updates as any).paused_at !== undefined) updatePayload.paused_at = (updates as any).paused_at;
    if ((updates as any).paused_duration_seconds !== undefined) updatePayload.paused_duration_seconds = (updates as any).paused_duration_seconds;
    if ((updates as any).member_id !== undefined) updatePayload.member_id = (updates as any).member_id;
    if ((updates as any).notes !== undefined) updatePayload.notes = (updates as any).notes;

    let query = supabase
      .from('sessions')
      .update(updatePayload)
      .eq('id', id);

    if (requireActive) {
      query = query.eq('status', 'ACTIVE');
    }

    const { data: updatedData, error } = await query.select('*').single();

    if (error || !updatedData) {
      if (requireActive) {
         throw new Error("Session is already closed or modified.");
      }
      throw new Error("Failed to update session in Database: " + error?.message);
    }

    // 2. Sync update to Google Sheets via non-blocking asynchronous queue (unless deferred to caller)
    if (!skipSheetsSync) {
      try {
        const { syncSessionLifecycle } = require('../sheetsSyncQueue');
        syncSessionLifecycle(id, businessId || updatedData.business_id);
      } catch (sheetError) {
        console.error("Google Sheets Sync Queue Error on Update:", sheetError);
      }
    }
  }
};
