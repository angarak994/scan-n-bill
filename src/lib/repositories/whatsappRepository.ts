import { supabase } from '../supabaseClient';

export interface WhatsAppChatState {
  customer_phone: string;
  business_id: string;
  current_step: string;
  context: Record<string, any>;
  updated_at?: string;
}

export const whatsappRepository = {
  getState: async (phone: string): Promise<WhatsAppChatState | null> => {
    const { data, error } = await supabase
      .from('whatsapp_chat_state')
      .select('*')
      .eq('customer_phone', phone)
      .maybeSingle();
      
    if (error || !data) return null;
    return data;
  },

  updateState: async (phone: string, businessId: string, step: string, context: Record<string, any> = {}): Promise<void> => {
    await supabase
      .from('whatsapp_chat_state')
      .upsert({
        customer_phone: phone,
        business_id: businessId,
        current_step: step,
        context: context,
        updated_at: new Date().toISOString()
      });
  },

  clearState: async (phone: string): Promise<void> => {
    await supabase
      .from('whatsapp_chat_state')
      .delete()
      .eq('customer_phone', phone);
  },

  isMessageProcessed: async (messageId: string): Promise<boolean> => {
    // Attempt to insert message_id. If it fails (unique constraint), it was already processed.
    const { error } = await supabase
      .from('whatsapp_processed_messages')
      .insert({ message_id: messageId });
      
    if (error) {
       return true; // Likely a unique violation meaning it exists
    }
    return false; // Successfully inserted, so it's a new message
  }
};
