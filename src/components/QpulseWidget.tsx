'use client';

import { useState, useEffect } from 'react';

export default function QpulseWidget({ onNavigate }: { onNavigate?: (tab: string) => void }) {
    const [insight, setInsight] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Fetch on mount
        fetch('/api/qpulse')
            .then(res => res.json())
            .then(data => {
                if (data.show && data.insight) {
                    setInsight(data.insight);
                    setTimeout(() => setIsVisible(true), 300);
                }
            })
            .catch(err => console.error("Failed to load Qpulse", err));
    }, []);

    const handleDismiss = async () => {
        setIsVisible(false);
        try {
            await fetch('/api/qpulse', { method: 'POST' }); // Marks as shown
        } catch (err) {
            console.error("Failed to dismiss Qpulse", err);
        }
    };

    if (!insight || !isVisible) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
                <div className="w-full h-full bg-bg-surface rounded-3xl shadow-sm border border-border-theme overflow-hidden transition-all duration-500">
                    <div className="p-8 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(141,213,182,0.6)]"></div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-accent">Qpulse Insight</span>
                                </div>
                            </div>
                            
                            <h3 className="text-2xl font-bold text-text-primary leading-tight mb-2">
                                "{insight.message}"
                            </h3>
                            <p className="text-text-primary font-medium mb-1">
                                {insight.stat}
                            </p>
                            <p className="text-text-secondary text-sm italic mb-6">
                                "{insight.subtext}"
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-auto">
                            <button 
                                onClick={() => onNavigate && onNavigate('reports')}
                                className="bg-accent hover:bg-accent/90 text-bg-primary font-bold py-2.5 px-6 rounded-xl transition-colors text-sm"
                            >
                                View Insights
                            </button>
                            <button 
                                onClick={handleDismiss}
                                className="text-text-secondary hover:text-text-primary font-medium py-2 px-4 text-sm transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Quick Action / Summary Panel */}
            <div className="hidden lg:flex bg-bg-card rounded-3xl p-6 border border-border-theme flex-col justify-between h-full">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="font-bold tracking-wide text-text-primary text-lg">Quick Links</h3>
                    </div>
                    
                    <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                        Manage unpaid sessions, track outstanding customer balances, and verify recent payments efficiently.
                    </p>
                </div>

                <div className="flex flex-col gap-3 mt-auto">
                    <button 
                        onClick={() => onNavigate && onNavigate('qkhata')}
                        className="w-full bg-bg-surface border border-border-theme hover:border-accent hover:text-accent transition-all text-text-primary text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
                    >
                        Settle Balances (QKhata)
                    </button>
                    <button 
                        onClick={() => onNavigate && onNavigate('payments')}
                        className="w-full bg-bg-surface border border-border-theme hover:border-accent hover:text-accent transition-all text-text-primary text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
                    >
                        Recent Transactions
                    </button>
                </div>
            </div>
        </div>
    );
}
