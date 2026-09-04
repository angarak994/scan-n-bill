import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sendWhatsAppText } from '@/lib/whatsapp';

export async function GET(request: Request) {
  // CRON endpoint to send QKhata reminders
  // Note: Secure this endpoint with an authorization header in production
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find all pending QKhata payments with a due date
    const { data: pendingPayments, error: paymentError } = await supabase
      .from('payments')
      .select('*, customers(name, phone, outstanding_balance), businesses(business_name)')
      .eq('status', 'Pending')
      .eq('payment_method', 'QKhata')
      .not('metadata->due_date', 'is', null);

    if (paymentError) {
      throw paymentError;
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending reminders found.' });
    }

    const today = new Date().toISOString().split('T')[0];
    let sentCount = 0;

    for (const payment of pendingPayments) {
      const dueDate = payment.metadata?.due_date;
      if (!dueDate) continue;
      
      const customer = payment.customers;
      const business = payment.businesses;

      if (!customer || !customer.phone || customer.phone.length < 10) continue;

      // Ensure outstanding balance is still > 0
      if (Number(customer.outstanding_balance) <= 0) continue;

      // For simplicity, we send a reminder exactly on the due date.
      // In a real system, we might check business_settings for reminder offsets (e.g. 1 day before).
      if (dueDate === today) {
        // Send WhatsApp Reminder
        const cleanPhone = customer.phone.replace(/\D/g, '');
        const message = `Hi ${customer.name},\n\nYour Qcontrol balance of ₹${Number(customer.outstanding_balance).toFixed(0)} is due today (${dueDate}) at *${business.business_name}*.\n\nYou can clear it whenever convenient. We look forward to seeing you again!`;

        try {
          await sendWhatsAppText(cleanPhone, message);
          
          // Mark reminder as sent in metadata to avoid duplicate sends
          const newMetadata = { ...payment.metadata, reminder_sent_at: new Date().toISOString() };
          await supabase.from('payments').update({ metadata: newMetadata }).eq('id', payment.id);
          
          sentCount++;
          // Small delay for rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`Failed to send QKhata reminder to ${cleanPhone}`, err);
        }
      }
    }

    return NextResponse.json({ success: true, sentCount });

  } catch (error: any) {
    console.error('QKhata Reminder Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
