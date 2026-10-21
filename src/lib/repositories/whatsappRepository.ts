import { supabase } from '../supabaseClient';

export interface WhatsAppChatState {
  customer_phone: string;
  business_id?: string | null;
  active_business_id?: string | null;
  conversation_mode?: 'GLOBAL_DISCOVERY' | 'CLUB';
  current_step: string;
  context: Record<string, any>;
  expires_at?: string;
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

const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL

export const whatsappRepository = {
  getState: async (phone: string): Promise<WhatsAppChatState | null> => {
    const cleanPhone = phone.replace(/\D/g, '');
    const { data, error } = await supabase
      .from('whatsapp_chat_state')
      .select('*')
      .or(`customer_phone.eq.${phone},customer_phone.eq.${cleanPhone}`)
      .maybeSingle();
      
    if (error || !data) return null;

    // Check TTL from context or column
    const expiresAt = data.expires_at || data.context?.expires_at;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      // TTL expired: reset current step back to idle so stale draft doesn't block customer
      data.current_step = 'IDLE';
      data.context = { expired: true };
    }

    // Normalize active_business_id
    data.active_business_id = data.active_business_id || data.business_id || data.context?.active_business_id || null;
    data.conversation_mode = data.conversation_mode || data.context?.conversation_mode || (data.active_business_id ? 'CLUB' : 'GLOBAL_DISCOVERY');

    return data;
  },

  updateState: async (
    phone: string,
    businessId: string | null,
    step: string,
    context: Record<string, any> = {},
    mode: 'GLOBAL_DISCOVERY' | 'CLUB' = 'CLUB'
  ): Promise<void> => {
    const cleanPhone = phone.replace(/\D/g, '');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CONVERSATION_TTL_MS).toISOString();

    const mergedContext = {
      ...context,
      active_business_id: businessId,
      conversation_mode: mode,
      expires_at: expiresAt
    };

    const payload: any = {
      customer_phone: cleanPhone,
      business_id: businessId || null,
      current_step: step,
      context: mergedContext,
      updated_at: now.toISOString()
    };

    try {
      await supabase
        .from('whatsapp_chat_state')
        .upsert(payload);
    } catch (err) {
      console.error('Failed to update WhatsApp chat state:', err);
    }
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
    try {
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
        console.warn('Failed to log WhatsApp message to database:', error.message);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Updates delivery status (e.g. from Meta webhook) without regressing from later states.
   */
  updateMessageStatus: async (messageId: string, newStatus: string, errorMessage?: string | null): Promise<boolean> => {
    if (!messageId) return false;

    try {
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
    } catch (err) {
      console.warn('Status update warning:', err);
    }

    return false;
  },

  /**
   * Records a conversational turn for conversational memory.
   */
  recordChatHistory: async (businessId: string | null, customerPhone: string, role: 'user' | 'assistant' | 'system', content: string): Promise<void> => {
    try {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      await supabase
        .from('whatsapp_chat_history')
        .insert({
          business_id: businessId || null,
          customer_phone: cleanPhone,
          role,
          content,
          created_at: new Date().toISOString()
        });
    } catch {
      // Non-blocking
    }
  },

  /**
   * Retrieves paginated delivery logs and analytics for business message auditing.
   */
  getDeliveryLogs: async (businessId: string, options: { search?: string; status?: string; direction?: string; limit?: number; offset?: number } = {}): Promise<{ logs: any[]; totalCount: number; analytics: any }> => {
    const { search, status, limit = 50, offset = 0 } = options;
    try {
      let query = supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact' })
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (search) {
        query = query.or(`recipient_phone.ilike.%${search}%,recipient_name.ilike.%${search}%,content.ilike.%${search}%`);
      }

      const { data, count, error } = await query.range(offset, offset + limit - 1);

      const logs = data || [];
      const totalCount = count || logs.length;

      const analytics = {
        total: totalCount,
        delivered: logs.filter((l: any) => l.status === 'delivered' || l.status === 'read').length,
        failed: logs.filter((l: any) => l.status === 'failed').length,
        pending: logs.filter((l: any) => l.status === 'sent' || l.status === 'queued').length
      };

      return { logs, totalCount, analytics };
    } catch (err) {
      console.error('getDeliveryLogs error:', err);
      return { logs: [], totalCount: 0, analytics: { total: 0, delivered: 0, failed: 0, pending: 0 } };
    }
  }
};
