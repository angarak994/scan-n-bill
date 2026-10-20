import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { sendWhatsAppText } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId } = await request.json();
    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // 1. Fetch failed message with tenant isolation check
    const { data: dbMsg, error: fetchErr } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('id', messageId)
      .eq('business_id', sessionCookie.businessId)
      .single();

    if (fetchErr || !dbMsg) {
      return NextResponse.json({ error: 'Message not found or unauthorized' }, { status: 404 });
    }

    // 2. Fetch business WhatsApp config
    const { data: business } = await supabase
      .from('businesses')
      .select('whatsapp_config, business_name')
      .eq('id', sessionCookie.businessId)
      .single();

    const config = business?.whatsapp_config as any;
    const token = config?.enabled ? config?.token : undefined;
    const phoneId = config?.enabled ? config?.phoneId : undefined;

    // 3. Mark as sending
    await supabase
      .from('whatsapp_messages')
      .update({ status: 'sending', error_message: null, updated_at: new Date().toISOString() })
      .eq('id', messageId);

    // 4. Re-attempt send
    const res = await sendWhatsAppText(
      dbMsg.recipient_phone,
      dbMsg.content,
      false,
      token,
      phoneId
    );

    if (res && res.error) {
      const errReason = res.error.message || 'WhatsApp API rejected message on retry';
      await supabase
        .from('whatsapp_messages')
        .update({
          status: 'failed',
          error_message: errReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      return NextResponse.json({ success: false, error: errReason }, { status: 400 });
    }

    const wamid = res?.messages?.[0]?.id || null;
    await supabase
      .from('whatsapp_messages')
      .update({
        status: 'sent',
        message_id: wamid,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    return NextResponse.json({ success: true, message_id: wamid, status: 'sent' });
  } catch (error: any) {
    console.error('Error retrying message:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
