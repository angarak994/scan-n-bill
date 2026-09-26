import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { processWhatsAppMessage } from '@/lib/services/whatsappMessageProcessor';

export async function POST(request: Request) {
  // This endpoint is meant to be called asynchronously by the webhook receiver
  // or by a cron job to process pending webhook events.

  try {
    // 1. Claim pending events (SELECT FOR UPDATE equivalent in Supabase via RPC or simply optimistic locking)
    // For simplicity without RPC, we'll fetch pending and try to update status to 'processing'
    const { data: pendingEvents, error: fetchError } = await supabase
      .from('whatsapp_webhook_events')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError || !pendingEvents || pendingEvents.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    let processedCount = 0;

    for (const event of pendingEvents) {
      // Optimistic lock: try to set status to 'processing'
      const { data: updated, error: updateError } = await supabase
        .from('whatsapp_webhook_events')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', event.id)
        .eq('status', 'pending')
        .select();

      if (updateError || !updated || updated.length === 0) {
        continue; // Another worker picked it up
      }

      try {
        await processWhatsAppMessage(event.payload);
        
        await supabase
          .from('whatsapp_webhook_events')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', event.id);
        
        processedCount++;
      } catch (err: any) {
        console.error(`Error processing webhook event ${event.id}:`, err);
        await supabase
          .from('whatsapp_webhook_events')
          .update({ status: 'failed', error_message: err.message, updated_at: new Date().toISOString() })
          .eq('id', event.id);
      }
    }

    return NextResponse.json({ ok: true, processed: processedCount });
  } catch (error) {
    console.error('Queue Processing Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
