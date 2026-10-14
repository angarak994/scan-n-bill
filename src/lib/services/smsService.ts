import { supabase } from '@/lib/supabaseClient';

export interface SMSConfig {
  enabled: boolean;
  provider: 'msg91' | 'exotel' | 'twilio';
  authKey?: string;
  senderId?: string;
  accountSid?: string;
  authToken?: string;
  fromPhone?: string;
}

/**
 * Reusable SMS service that logs messages if possible and handles provider API requests.
 */
export async function sendSMS(
  businessId: string, 
  recipientPhone: string, 
  recipientName: string, 
  messageContent: string, 
  templateId: string, 
  config: SMSConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  
  if (!config || !config.enabled) {
    return { success: false, error: 'SMS service is not enabled for this business.' };
  }

  // Pre-log message safely (does not throw if sms_messages table doesn't exist)
  let dbMessageId: string | null = null;
  try {
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
  } catch (err) {
    // Non-fatal if sms_messages table does not exist
  }

  try {
    let resultMessageId: string | null = null;

    if (config.provider === 'msg91') {
      if (!config.authKey || !config.senderId) {
        return { success: false, error: 'MSG91 requires both Auth Key and Sender ID.' };
      }

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
          var1: recipientName || 'Customer',
          var2: messageContent
        })
      });

      const data = await response.json();
      
      if (data.type === 'error' || !response.ok) {
        throw new Error(data.message || `MSG91 SMS API error (HTTP ${response.status})`);
      }

      resultMessageId = data.message || data.request_id || 'msg91_sent';
    } else if (config.provider === 'twilio') {
      const sid = config.accountSid || process.env.TWILIO_ACCOUNT_SID;
      const token = config.authToken || process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = config.fromPhone || process.env.TWILIO_PHONE_NUMBER;

      if (!sid || !token || !fromNumber) {
        return { success: false, error: 'Twilio SMS credentials or Sender Phone missing.' };
      }

      const twilioModule = await import('twilio');
      const twilioClient = twilioModule.default(sid, token);
      
      const cleanTo = recipientPhone.startsWith('+') ? recipientPhone : `+91${recipientPhone.replace(/\D/g, '').slice(-10)}`;
      const message = await twilioClient.messages.create({
        body: messageContent,
        from: fromNumber,
        to: cleanTo
      });
      resultMessageId = message.sid;
    } else {
      throw new Error(`SMS provider "${config.provider}" is not yet configured or supported.`);
    }

    if (dbMessageId) {
      try {
        await supabase.from('sms_messages').update({
          message_id: resultMessageId,
          status: 'sent'
        }).eq('id', dbMessageId);
      } catch (e) { /* ignore */ }
    }

    return { success: true, messageId: resultMessageId || undefined };
  } catch (error: any) {
    console.error('SMS Send Error:', error);
    if (dbMessageId) {
      try {
        await supabase.from('sms_messages').update({
          status: 'failed',
          error_message: error.message || 'Unknown error'
        }).eq('id', dbMessageId);
      } catch (e) { /* ignore */ }
    }
    return { success: false, error: error.message || 'SMS delivery failed' };
  }
}
