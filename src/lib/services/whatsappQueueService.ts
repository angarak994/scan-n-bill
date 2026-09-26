import { supabase } from '@/lib/supabaseClient';

export const whatsappQueueService = {
  async enqueueWebhook(payload: any) {
    const { error } = await supabase.from('whatsapp_webhook_events').insert({
      payload,
      status: 'pending',
    });
    if (error) {
      console.error('Failed to enqueue webhook:', error);
      throw error;
    }
  },

  async processQueue() {
    // This would be called by a worker or cron
  }
};
