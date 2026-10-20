import { supabase } from '../supabaseClient';

export interface WhatsAppChatState {
  customer_phone: string;
  business_id: string;
  current_step: string;
  context: Record<string, any>;
  updated_at?: string;
}

export interface WhatsAppMessageRecord {
  id?: string;
  business_id: string;
  message_id?: string | null;
  recipient_phone: string;
  recipient_name?: string;
  content: string;
  status: 'received' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

const STATUS_PRECEDENCE: Record<string, number> = {
  queued: 1,
  sending: 2,
  sent: 3,
  delivered: 4,
  read: 5,
  received: 10,
  failed: 0,
};

export const whatsappRepository = {
  getState: async (phone: string): Promise<WhatsAppChatState | null> => {
    const cleanPhone = phone.replace(/\D/g, '');
    const { data, error } = await supabase
      .from('whatsapp_chat_state')
      .select('*')
      .or(`customer_phone.eq.${phone},customer_phone.eq.${cleanPhone}`)
      .maybeSingle();
      
    if (error || !data) return null;
    return data;
  },

  updateState: async (phone: string, businessId: string, step: string, context: Record<string, any> = {}): Promise<void> => {
    const cleanPhone = phone.replace(/\D/g, '');
    await supabase
      .from('whatsapp_chat_state')
      .upsert({
        customer_phone: cleanPhone,
        business_id: businessId,
        current_step: step,
        context: context,
        updated_at: new Date().toISOString()
      });
  },

  clearState: async (phone: string): Promise<void> => {
    const cleanPhone = phone.replace(/\D/g, '');
    await supabase
      .from('whatsapp_chat_state')
      .delete()
      .or(`customer_phone.eq.${phone},customer_phone.eq.${cleanPhone}`);
  },

  isMessageProcessed: async (messageId: string): Promise<boolean> => {
    if (!messageId) return false;
    const { error } = await supabase
      .from('whatsapp_processed_messages')
      .insert({ message_id: messageId });
      
    if (error) {
       return true; // Already processed
    }
    return false;
  },

  /**
   * Logs an inbound or outbound message into whatsapp_messages.
   */
  logMessage: async (msg: WhatsAppMessageRecord): Promise<any> => {
    const cleanPhone = (msg.recipient_phone || '').replace(/\D/g, '');
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert({
        business_id: msg.business_id,
        message_id: msg.message_id || null,
        recipient_phone: cleanPhone || msg.recipient_phone,
        recipient_name: msg.recipient_name || 'Customer',
        content: msg.content,
        status: msg.status,
        error_message: msg.error_message || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to log WhatsApp message to database:', error);
      return null;
    }
    return data;
  },

  /**
   * Updates delivery status (e.g. from Meta webhook) without regressing from later states.
   */
  updateMessageStatus: async (messageId: string, newStatus: string, errorMessage?: string | null): Promise<boolean> => {
    if (!messageId) return false;

    // Check existing message to prevent status regression (e.g. read -> delivered)
    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id, status')
      .eq('message_id', messageId)
      .maybeSingle();

    if (existing) {
      const currentRank = STATUS_PRECEDENCE[existing.status] || 0;
      const newRank = STATUS_PRECEDENCE[newStatus] || 0;
      
      // If current is read and new is delivered/sent, ignore the regression
      if (currentRank >= 5 && newRank < 5 && newRank > 0) {
        return true;
      }

      await supabase
        .from('whatsapp_messages')
        .update({
          status: newStatus,
          error_message: errorMessage || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      return true;
    }

    return false;
  },

  /**
   * Records a conversational turn for conversational memory.
   */
  recordChatHistory: async (businessId: string, customerPhone: string, role: 'user' | 'assistant' | 'system', content: string): Promise<void> => {
    try {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      await supabase
        .from('whatsapp_chat_history')
        .insert({
          business_id: businessId,
          customer_phone: cleanPhone,
          role,
          content
        });
    } catch (e) {
      console.warn('Failed to record chat history:', e);
    }
  },

  /**
   * Retrieves recent conversational history for context window.
   */
  getChatHistory: async (customerPhone: string, limit = 8): Promise<Array<{ role: string; content: string }>> => {
    try {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      const { data } = await supabase
        .from('whatsapp_chat_history')
        .select('role, content')
        .or(`customer_phone.eq.${customerPhone},customer_phone.eq.${cleanPhone}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!data) return [];
      return data.reverse();
    } catch (e) {
      console.warn('Failed to fetch chat history:', e);
      return [];
    }
  },

  /**
   * Retrieves delivery logs with metrics for the dashboard.
   */
  getDeliveryLogs: async (businessId: string, options: {
    search?: string;
    status?: string;
    direction?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const { search, status, direction, limit = 50, offset = 0 } = options;

    let query = supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId);

    if (status && status !== 'all') {
      query = query.eq('status', status.toLowerCase());
    }

    if (direction === 'inbound') {
      query = query.eq('status', 'received');
    } else if (direction === 'outbound') {
      query = query.neq('status', 'received');
    }

    if (search && search.trim()) {
      const s = search.trim();
      query = query.or(`recipient_name.ilike.%${s}%,recipient_phone.ilike.%${s}%,content.ilike.%${s}%,message_id.ilike.%${s}%`);
    }

    const { data: logs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Compute aggregated KPI counts for all records for this business
    const { data: allStats } = await supabase
      .from('whatsapp_messages')
      .select('status')
      .eq('business_id', businessId);

    const total = allStats?.length || 0;
    const inbound = allStats?.filter(m => m.status === 'received').length || 0;
    const outbound = total - inbound;
    const sent = allStats?.filter(m => m.status === 'sent').length || 0;
    const delivered = allStats?.filter(m => m.status === 'delivered').length || 0;
    const read = allStats?.filter(m => m.status === 'read').length || 0;
    const failed = allStats?.filter(m => m.status === 'failed').length || 0;
    const failureRate = outbound > 0 ? Number(((failed / outbound) * 100).toFixed(1)) : 0;

    return {
      logs: logs || [],
      totalCount: count || 0,
      analytics: {
        total,
        inbound,
        outbound,
        sent,
        delivered,
        read,
        failed,
        failureRate,
      },
      error: error?.message || null
    };
  }
};
