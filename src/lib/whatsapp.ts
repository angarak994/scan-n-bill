import { whatsappRepository } from '@/lib/repositories/whatsappRepository';

const WHATSAPP_API = 'https://graph.facebook.com/v19.0';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export interface WhatsAppLogContext {
  businessId?: string;
  recipientName?: string;
  content?: string;
}

export async function sendWhatsAppMessage(
  to: string,
  message: Record<string, unknown>,
  overrideToken?: string,
  overridePhoneId?: string,
  logContext?: WhatsAppLogContext
) {
  const token = overrideToken || WHATSAPP_TOKEN;
  const phoneId = overridePhoneId || WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.error('WhatsApp configuration missing');
    if (logContext?.businessId) {
      await whatsappRepository.logMessage({
        business_id: logContext.businessId,
        recipient_phone: to,
        recipient_name: logContext.recipientName || 'Customer',
        content: logContext.content || '[Unknown message]',
        status: 'failed',
        error_message: 'WhatsApp configuration missing (Token or Phone ID)'
      });
    }
    return null;
  }

  try {
    const res = await fetch(`${WHATSAPP_API}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        ...message
      })
    });
    
    const responseText = await res.text();
    let jsonResponse: any;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch {
      jsonResponse = { error: { message: responseText } };
    }

    const wamid = jsonResponse?.messages?.[0]?.id || null;

    if (!res.ok) {
      console.error('WhatsApp API Error:', responseText);
      if (logContext?.businessId) {
        const providerError = jsonResponse?.error?.message || jsonResponse?.error?.error_data?.details || responseText;
        await whatsappRepository.logMessage({
          business_id: logContext.businessId,
          recipient_phone: to,
          recipient_name: logContext.recipientName || 'Customer',
          content: logContext.content || '[WhatsApp message]',
          status: 'failed',
          error_message: providerError
        });
      }
    } else if (logContext?.businessId) {
      await whatsappRepository.logMessage({
        business_id: logContext.businessId,
        message_id: wamid,
        recipient_phone: to,
        recipient_name: logContext.recipientName || 'Customer',
        content: logContext.content || '[WhatsApp message]',
        status: 'sent',
        error_message: null
      });
    }
    
    return jsonResponse;
  } catch (error: any) {
    console.error('Failed to send WhatsApp message:', error);
    if (logContext?.businessId) {
      await whatsappRepository.logMessage({
        business_id: logContext.businessId,
        recipient_phone: to,
        recipient_name: logContext.recipientName || 'Customer',
        content: logContext.content || '[WhatsApp message]',
        status: 'failed',
        error_message: error.message || 'Network error while contacting WhatsApp API'
      });
    }
    return null;
  }
}

export async function sendWhatsAppText(
  to: string,
  text: string,
  previewUrl: boolean = false,
  overrideToken?: string,
  overridePhoneId?: string,
  logContext?: WhatsAppLogContext
) {
  return sendWhatsAppMessage(
    to,
    {
      type: 'text',
      text: {
        body: text,
        preview_url: previewUrl
      }
    },
    overrideToken,
    overridePhoneId,
    { ...logContext, content: logContext?.content || text }
  );
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'en_US',
  components: any[] = [],
  overrideToken?: string,
  overridePhoneId?: string,
  logContext?: WhatsAppLogContext
) {
  return sendWhatsAppMessage(
    to,
    {
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        },
        components
      }
    },
    overrideToken,
    overridePhoneId,
    { ...logContext, content: logContext?.content || `[Template: ${templateName}]` }
  );
}

export async function sendWhatsAppButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  overrideToken?: string,
  overridePhoneId?: string,
  logContext?: WhatsAppLogContext
) {
  return sendWhatsAppMessage(
    to,
    {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.substring(0, 20) }
          }))
        }
      }
    },
    overrideToken,
    overridePhoneId,
    { ...logContext, content: logContext?.content || bodyText }
  );
}

export async function sendWhatsAppInteractiveList(
  to: string,
  header: string,
  bodyText: string,
  footer: string,
  buttonText: string,
  sections: any[],
  overrideToken?: string,
  overridePhoneId?: string,
  logContext?: WhatsAppLogContext
) {
  return sendWhatsAppMessage(
    to,
    {
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: header },
        body: { text: bodyText },
        footer: { text: footer },
        action: {
          button: buttonText,
          sections
        }
      }
    },
    overrideToken,
    overridePhoneId,
    { ...logContext, content: logContext?.content || bodyText }
  );
}

export async function sendWhatsAppList(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
  overrideToken?: string,
  overridePhoneId?: string,
  logContext?: WhatsAppLogContext
) {
  return sendWhatsAppMessage(
    to,
    {
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Please Select' },
        body: { text: bodyText },
        action: {
          button: buttonText.substring(0, 20),
          sections: sections.map(s => ({
            title: s.title.substring(0, 24),
            rows: s.rows.map(r => ({
              id: r.id,
              title: r.title.substring(0, 24),
              description: r.description?.substring(0, 72)
            }))
          }))
        }
      }
    },
    overrideToken,
    overridePhoneId,
    { ...logContext, content: logContext?.content || bodyText }
  );
}

