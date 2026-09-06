import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { sendWhatsAppTemplate, sendWhatsAppText } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, phoneId, token } = body;

    let whatsapp_config = null;

    if (action === 'connect') {
      if (!phoneId || !token) {
        return NextResponse.json({ error: 'Phone Number ID and Token are required' }, { status: 400 });
      }
      whatsapp_config = {
        enabled: true,
        phoneId,
        token
      };
    } else if (action === 'disconnect') {
      whatsapp_config = {
        enabled: false,
        phoneId: null,
        token: null
      };
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error } = await supabase
      .from('businesses')
      .update({ whatsapp_config })
      .eq('id', sessionCookie.businessId);

    if (error) {
      console.error('Update Whatsapp Config Error:', error);
      return NextResponse.json({ error: 'Failed to update WhatsApp configuration' }, { status: 500 });
    }

    // Send a confirmation message if connecting
    if (action === 'connect') {
      try {
        const { data: business } = await supabase
          .from('businesses')
          .select('contact_number, business_name')
          .eq('id', sessionCookie.businessId)
          .single();

        if (business?.contact_number) {
          const cleanPhone = business.contact_number.replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            // Meta requires first messages to be templates if outside the 24hr window.
            // Using the default pre-approved 'hello_world' template to initialize the chat.
            await sendWhatsAppTemplate(cleanPhone, 'hello_world', 'en_US', [], whatsapp_config.token, whatsapp_config.phoneId);
            
            // Wait slightly to ensure ordering, then send a custom welcome text
            await new Promise(resolve => setTimeout(resolve, 500));
            await sendWhatsAppText(
              cleanPhone, 
              `*Qcontrol - WhatsApp Integration Successful*\n\nHello from Qcontrol! ✅\n\nYour business, *${business.business_name}*, is now securely connected to the official Meta WhatsApp API.\n\nYou can now leverage this integration to:\n• Send automated QKhata payment reminders\n• Broadcast bulk promotional messages\n• Send real-time booking confirmations\n\nTo manage this connection, please visit the Settings tab in your Qcontrol Dashboard.`, 
              false, 
              whatsapp_config.token, 
              whatsapp_config.phoneId
            );
          }
        }
      } catch (err) {
        console.error('Failed to send confirmation message:', err);
      }
    }

    return NextResponse.json({ success: true, enabled: whatsapp_config.enabled });
  } catch (error: any) {
    console.error('Update Whatsapp Config API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
