'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function CheckoutContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const amount = searchParams.get('amount');
    const paymentId = searchParams.get('payment_id');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSuccess = async () => {
        setIsProcessing(true);
        // Simulate Webhook Call
        try {
            await fetch('/api/webhooks/qpay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentId,
                    status: 'success'
                })
            });
            setTimeout(() => {
                alert('Payment Successful!');
                router.back();
            }, 1000);
        } catch (e) {
            alert('Failed to process payment');
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h1 className="text-2xl font-bold mb-2">QPay Mock Checkout</h1>
                <p className="text-gray-500 mb-6">You are paying</p>
                <div className="text-5xl font-black text-blue-600 mb-8">₹{amount}</div>
                
                <button
                    onClick={handleSuccess}
                    disabled={isProcessing}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-colors mb-4"
                >
                    {isProcessing ? 'Processing...' : 'Simulate Success'}
                </button>
                <button
                    onClick={() => router.back()}
                    disabled={isProcessing}
                    className="w-full text-gray-500 hover:text-gray-700 py-3 font-medium transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

export default function MockCheckoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <CheckoutContent />
        </Suspense>
    );
}
