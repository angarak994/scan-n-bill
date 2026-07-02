import { NextResponse } from 'next/server';
import { processWhatsAppMessage } from '@/lib/aiAgent';
import twilio from 'twilio';

// In production, we'd look up the business ID by mapping the 'To' number to a specific business.
// For this demo, we'll use a fallback ID or query the first business.
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    // Twilio sends data as application/x-www-form-urlencoded
    const text = await request.text();
    const params = new URLSearchParams(text);
    
    const body = params.get('Body');
    const from = params.get('From'); // e.g. "whatsapp:+1234567890"
    const to = params.get('To'); // e.g. "whatsapp:+1987654321"
    
    if (!body || !from || !to) {
      return new NextResponse('Missing Body, From, or To', { status: 400 });
    }
    
    // Extract actual phone numbers
    const senderPhone = from.replace('whatsapp:', '');
    const twilioNumber = to.replace('whatsapp:', '');
    
    // Find the business ID by mapping the Twilio number
    // We check the whatsapp_number column in the businesses table.
    // If not found, we fallback to the first business for sandbox testing if needed,
    // but in production it should strictly fail if no business is found.
    const { data: b, error: bErr } = await supabase
      .from('businesses')
      .select('id')
      .eq('whatsapp_number', twilioNumber)
      .limit(1)
      .single();
      
    let businessId = null;
    if (b) {
      businessId = b.id;
    } else {
      // Fallback for Sandbox / Development mode if the exact number isn't mapped
      const { data: fallback } = await supabase.from('businesses').select('id').limit(1).single();
      if (fallback) businessId = fallback.id;
    }

    if (!businessId) {
      return new NextResponse('No business registered for this number', { status: 404 });
    }

    // Process the message using our AI Agent
    const aiResponse = await processWhatsAppMessage(body, senderPhone, businessId);

    // Create Twilio TwiML response
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(aiResponse);

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });

  } catch (error) {
    console.error('Webhook Error:', error);
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("I'm sorry, our booking system is currently down for maintenance.");
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}
