'use client';

import { useEffect, useState } from 'react';
import Dashboard from '@/app/dashboard/page';
import { mockDashboardData, mockReportsData } from '@/lib/demo/mockData';
import { Toaster, toast } from 'react-hot-toast';

export default function StaticDemoSandbox() {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Intercept global fetch to serve mock data natively to the dashboard components
        const originalFetch = window.fetch;
        
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input.toString();

            if (url.includes('/api/dashboard-data')) {
                return new Response(JSON.stringify(mockDashboardData), { status: 200, headers: { 'Content-Type': 'application/json' }});
            }
            if (url.includes('/api/reports-kpis')) {
                return new Response(JSON.stringify(mockReportsData), { status: 200, headers: { 'Content-Type': 'application/json' }});
            }
            if (url.includes('/api/qkhata/transactions')) {
                return new Response(JSON.stringify({ transactions: mockDashboardData.qKhataTransactions }), { status: 200, headers: { 'Content-Type': 'application/json' }});
            }
            if (url.includes('/api/membership-plans')) {
                return new Response(JSON.stringify(mockDashboardData.membership_plans), { status: 200, headers: { 'Content-Type': 'application/json' }});
            }
            if (url.includes('/api/memberships')) {
                return new Response(JSON.stringify(mockDashboardData.memberships), { status: 200, headers: { 'Content-Type': 'application/json' }});
            }
            
            // Intercept mutating API calls to prevent breaking the static sandbox
            if (init && init.method && init.method !== 'GET') {
                return new Response(JSON.stringify({ success: true, message: 'Action simulated in Demo Mode' }), { status: 200, headers: { 'Content-Type': 'application/json' }});
            }

            // Fallback for unrecognized routes
            return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' }});
        };

        setIsReady(true);

        return () => {
            // Restore original fetch on unmount
            window.fetch = originalFetch;
        };
    }, []);

    if (!isReady) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent mb-4 mx-auto"></div>
                <p>Loading Interactive Sandbox...</p>
            </div>
        );
    }

    return (
        <div className="demo-sandbox-wrapper relative">
            {/* Demo Mode Banner overlay */}
            <div className="fixed top-0 left-0 w-full z-[9999] bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center py-1.5 text-sm font-semibold shadow-md flex justify-center items-center gap-3">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                READ-ONLY DEMO MODE
                <span className="font-normal opacity-80 text-xs ml-2 hidden sm:inline">(API mutations are disabled)</span>
            </div>
            
            {/* The actual dashboard pushed down by the banner */}
            <div className="pt-8 min-h-screen">
                <Dashboard />
            </div>
        </div>
    );
}
