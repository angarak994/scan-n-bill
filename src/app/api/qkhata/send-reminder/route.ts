import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, outstandingAmount, customerPhone, customerName } = await request.json();

    if (!customerPhone || !outstandingAmount) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Fetch business details
    const { data: business } = await supabase
      .from('businesses')
      .select('business_name')
      .eq('id', sessionCookie.businessId)
      .single();

    const businessName = business?.business_name || 'Our Club';

    // Format Message
    const messageBody = `Hi ${customerName || 'there'},\n\nThis is a gentle reminder from ${businessName} regarding an outstanding balance of ₹${outstandingAmount} on your ledger. Please clear it at your earliest convenience.\n\nThank you!`;

    // Twilio Integration
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !twilioNumber) {
        console.error("Twilio credentials missing.");
        return NextResponse.json({ error: 'WhatsApp is not connected. Please connect WhatsApp first.' }, { status: 400 });
    }

    const client = twilio(accountSid, authToken);

    // Ensure E.164 formatting
    let toPhone = customerPhone;
    if (!toPhone.startsWith('+')) {
        toPhone = `+91${toPhone}`; // Assuming India default if no country code
    }

    // Determine if sending via WhatsApp or SMS based on the sender number
    const isWhatsApp = twilioNumber.startsWith('whatsapp:');
    const fromStr = isWhatsApp ? twilioNumber : twilioNumber;
    const toStr = isWhatsApp ? `whatsapp:${toPhone}` : toPhone;

    await client.messages.create({
      body: messageBody,
      from: fromStr,
      to: toStr
    });

    return NextResponse.json({ success: true, message: 'Reminder sent successfully' });
  } catch (error: any) {
    console.error('Send Reminder API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
