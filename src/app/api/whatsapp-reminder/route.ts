import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendWhatsAppText } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone, amount, customerName, businessName } = await request.json();

    if (!phone || !amount) {
      return NextResponse.json({ error: 'Phone and amount are required' }, { status: 400 });
    }

    // Clean phone number (strip everything but numbers, assuming standard format or add country code if needed)
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`; // Default to India if just 10 digits
    }

    const message = `*QKhata Reminder*\n\nHi ${customerName},\n\nYour outstanding balance at *${businessName}* is ₹${amount}. Please settle it at your convenience.\n\nThank you!`;

    await sendWhatsAppText(cleanPhone, message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('WhatsApp Reminder Error:', error);
    return NextResponse.json({ error: 'Failed to send reminder' }, { status: 500 });
  }
}
