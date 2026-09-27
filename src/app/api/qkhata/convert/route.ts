import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session_id, business_id } = await request.json();

    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the session
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .eq('business_id', business_id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.payment_status === 'Pending' && session.amount_paid === 0) {
      // Already QKhata or unpaid
      return NextResponse.json({ success: true, message: 'Already marked as unpaid/credit' });
    }

    const amountPaidToReverse = session.amount_paid || 0;

    // Find customer by member_id or name/phone
    let customerId;
    if (session.member_id) {
      const { data: member } = await supabase.from('memberships').select('phone').eq('id', session.member_id).single();
      if (member) {
        const { data: cust } = await supabase.from('customers').select('*').eq('business_id', business_id).eq('phone', member.phone).single();
        if (cust) customerId = cust.id;
      }
    } else {
      const { data: cust } = await supabase.from('customers').select('*').eq('business_id', business_id).or(`name.ilike.${session.customer_name},phone.eq.${session.customer_name}`).limit(1).single();
      if (cust) customerId = cust.id;
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Customer must be registered to use QKhata' }, { status: 400 });
    }

    // 1. Delete the Cash payment record (if any)
    await supabase.from('payments').delete().eq('session_id', session_id);

    // 3. Reverse the original billing:
    const { data: currentCust } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (currentCust) {
        const reversedTotalBilled = Number(currentCust.total_billed || 0) - session.cost;
        const reversedTotalPaid = Number(currentCust.total_paid || 0) - amountPaidToReverse;
        const reversedOutstanding = reversedTotalBilled - reversedTotalPaid;
        await supabase.from('customers').update({
            total_billed: reversedTotalBilled,
            total_paid: reversedTotalPaid,
            outstanding_balance: reversedOutstanding
        }).eq('id', customerId);
    }
    
    // Now createLedgerEntryAndPayment will correctly re-add totalBilled and 0 paid!
    const { createLedgerEntryAndPayment } = require('@/lib/services/paymentService');
    await createLedgerEntryAndPayment({
      businessId: business_id,
      sessionId: session_id,
      customerName: session.customer_name,
      totalBilled: session.cost,
      amountPaid: 0,
      paymentMethod: 'QKhata',
      paymentStatus: 'Pending',
      source: session.completed_by || 'Dashboard'
    });

    // 4. Update the session itself
    await supabase.from('sessions').update({ payment_status: 'Pending', amount_paid: 0 }).eq('id', session_id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Convert to QKhata error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
