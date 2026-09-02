const WHATSAPP_API = 'https://graph.facebook.com/v19.0';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export async function sendWhatsAppMessage(to: string, message: Record<string, unknown>) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.error('WhatsApp configuration missing');
    return null;
  }

  try {
    const res = await fetch(`${WHATSAPP_API}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        ...message
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('WhatsApp API Error:', errorText);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    return null;
  }
}

export async function sendWhatsAppText(to: string, text: string) {
  return sendWhatsAppMessage(to, {
    type: 'text',
    text: { body: text }
  });
}

export async function sendWhatsAppButtons(to: string, bodyText: string, buttons: { id: string, title: string }[]) {
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
  });
}

export async function sendWhatsAppList(to: string, bodyText: string, buttonText: string, sections: { title: string, rows: { id: string, title: string, description?: string }[] }[]) {
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
  });
}
