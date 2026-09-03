import { NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/services/paymentService';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { business_id, session_id, amount, customer_name } = body;
        
        if (!business_id || !amount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const metadata = {
            sessionId: session_id,
            businessId: business_id,
            customerName: customer_name
        };
        
        const result = await createCheckoutSession(business_id, amount, 'INR', metadata);
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('Checkout error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
