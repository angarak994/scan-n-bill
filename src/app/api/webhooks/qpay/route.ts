import { NextResponse } from 'next/server';
import { handleWebhookEvent } from '@/lib/services/paymentService';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Very basic mock webhook signature verification can be added here
        // e.g. checking a custom header X-Qpay-Signature
        
        // In a real implementation, you would extract the provider from the URL or headers
        const provider = 'mock'; 
        
        await handleWebhookEvent(provider, body);
        
        return NextResponse.json({ received: true }, { status: 200 });
    } catch (err: any) {
        console.error('QPay Webhook Error:', err);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 400 });
    }
}
