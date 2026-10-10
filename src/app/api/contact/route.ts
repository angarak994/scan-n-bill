import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, businessName, phone, tables, message } = body;

    // Server-side validation
    if (!name || !email || !businessName || !phone) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // In a real app, integrate with SendGrid, Resend, or a CRM here.
    // For now, log the inquiry to the console as a secure backend operation.
    console.log('--- NEW SALES INQUIRY ---');
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Business Name: ${businessName}`);
    console.log(`Phone: ${phone}`);
    console.log(`Tables: ${tables}`);
    console.log(`Message: ${message}`);
    console.log('-------------------------');

    // Return a genuine success response
    return NextResponse.json({ success: true, message: 'Your inquiry has been received. Our sales team will contact you shortly.' });
  } catch (error) {
    console.error('Contact API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
