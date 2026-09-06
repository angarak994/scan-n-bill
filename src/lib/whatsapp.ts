const WHATSAPP_API = 'https://graph.facebook.com/v19.0';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export async function sendWhatsAppMessage(to: string, message: Record<string, unknown>, overrideToken?: string, overridePhoneId?: string) {
  const token = overrideToken || WHATSAPP_TOKEN;
  const phoneId = overridePhoneId || WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.error('WhatsApp configuration missing');
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
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch (e) {
      jsonResponse = { error: { message: responseText } };
    }

    if (!res.ok) {
      console.error('WhatsApp API Error:', responseText);
    }
    
    return jsonResponse;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    return null;
  }
}

export async function sendWhatsAppText(to: string, text: string, previewUrl: boolean = false, overrideToken?: string, overridePhoneId?: string) {
  return sendWhatsAppMessage(to, {
    type: 'text',
    text: {
      body: text,
      preview_url: previewUrl
    }
  }, overrideToken, overridePhoneId);
}

export async function sendWhatsAppTemplate(to: string, templateName: string, languageCode: string = 'en_US', components: any[] = [], overrideToken?: string, overridePhoneId?: string) {
  return sendWhatsAppMessage(to, {
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components
    }
  }, overrideToken, overridePhoneId);
}

export async function sendWhatsAppButtons(to: string, bodyText: string, buttons: { id: string, title: string }[], overrideToken?: string, overridePhoneId?: string) {
  return sendWhatsAppMessage(to, {
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
  }, overrideToken, overridePhoneId);
}

export async function sendWhatsAppInteractiveList(to: string, header: string, bodyText: string, footer: string, buttonText: string, sections: any[], overrideToken?: string, overridePhoneId?: string) {
  return sendWhatsAppMessage(to, {
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
  }, overrideToken, overridePhoneId);
}

export async function sendWhatsAppList(to: string, bodyText: string, buttonText: string, sections: { title: string, rows: { id: string, title: string, description?: string }[] }[], overrideToken?: string, overridePhoneId?: string) {
  return sendWhatsAppMessage(to, {
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
  }, overrideToken, overridePhoneId);
}
