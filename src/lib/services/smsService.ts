import { supabase } from '@/lib/supabaseClient';

export interface SMSConfig {
  enabled: boolean;
  provider: 'msg91' | 'exotel';
  authKey: string;
  senderId: string;
}

/**
 * Reusable SMS service that logs everything to sms_messages and handles the actual API request.
 */
export async function sendSMS(
  businessId: string, 
  recipientPhone: string, 
  recipientName: string, 
  messageContent: string, 
  templateId: string, 
  config: SMSConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  
  if (!config || !config.enabled || !config.authKey || !config.senderId) {
    return { success: false, error: 'SMS configuration missing or disabled.' };
  }

  // Pre-log message
  let dbMessageId = null;
  const { data: dbMsg } = await supabase.from('sms_messages').insert({
    business_id: businessId,
    recipient_phone: recipientPhone,
    recipient_name: recipientName || 'Customer',
    content: messageContent,
    status: 'queued'
  }).select('id').single();

  if (dbMsg) {
    dbMessageId = dbMsg.id;
  }

  try {
    let resultMessageId = null;

    if (config.provider === 'msg91') {
      // MSG91 Send SMS API
      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          'authkey': config.authKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          template_id: templateId,
          sender: config.senderId,
          short_url: "0",
          mobiles: `91${recipientPhone.replace(/\D/g, '').slice(-10)}`, // Ensure Indian format without +
          var1: recipientName,
          var2: messageContent
        })
      });

      const data = await response.json();
      
      if (data.type === 'error' || !response.ok) {
        throw new Error(data.message || 'SMS Provider Error');
      }

      resultMessageId = data.message; // MSG91 returns request ID in `message`
    } else {
      // Stub for Exotel or others
      throw new Error('Provider not implemented yet');
    }

    if (dbMessageId) {
      await supabase.from('sms_messages').update({
        message_id: resultMessageId,
        status: 'sent'
      }).eq('id', dbMessageId);
    }

    return { success: true, messageId: resultMessageId };
  } catch (error: any) {
    console.error('SMS Send Error:', error);
    if (dbMessageId) {
      await supabase.from('sms_messages').update({
        status: 'failed',
        error_message: error.message || 'Unknown error'
      }).eq('id', dbMessageId);
    }
    return { success: false, error: error.message };
  }
}
