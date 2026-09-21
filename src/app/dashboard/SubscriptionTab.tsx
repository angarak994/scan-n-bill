import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Check, Star, Zap, CreditCard, Calendar } from 'lucide-react';

interface SubscriptionTabProps {
  businessId: string;
}

export default function SubscriptionTab({ businessId }: SubscriptionTabProps) {
  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    fetchSubscription();
    fetchPlans();
  }, [businessId]);

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('business_subscriptions')
        .select(`
          status,
          current_period_end,
          subscription_plans (
            id,
            name,
            monthly_price,
            features
          )
        `)
        .eq('business_id', businessId)
        .single();
      
      if (!error && data) {
        setSubData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('monthly_price', { ascending: true });
      if (!error && data) {
        setPlans(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckout = async (planId: string) => {
    try {
      toast.loading('Initializing secure checkout...', { id: 'checkout' });
      const res = await fetch('/api/subscriptions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      // In a real integration, load Razorpay script and open checkout here
      toast.success('Test payment successful! Webhook will update status.', { id: 'checkout' });
      
      // Simulate webhook for local testing if Razorpay UI isn't loaded
      await fetch('/api/webhooks/razorpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              event: 'order.paid',
              payload: { payment: { entity: { amount: data.amount, currency: 'INR', notes: { business_id: businessId, plan_id: planId } } } }
          })
      });

      fetchSubscription();
    } catch (error: any) {
      toast.error(error.message, { id: 'checkout' });
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Loading Subscription Data...</div>;

  const currentPlan = subData?.subscription_plans;
  const isExpired = subData && new Date(subData.current_period_end).getTime() < Date.now();
  const statusDisplay = isExpired ? 'Expired' : subData?.status.charAt(0).toUpperCase() + subData?.status.slice(1) || 'No active plan';

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Current Subscription Status */}
      <div className="bg-bg-surface border border-border-theme rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
            {currentPlan?.name || 'Free Plan'}
            {subData?.status === 'trialing' && !isExpired && (
              <span className="bg-warning/20 text-warning text-xs px-2.5 py-1 rounded-full font-bold">14-Day Trial</span>
            )}
            {subData?.status === 'active' && !isExpired && (
              <span className="bg-accent/20 text-accent text-xs px-2.5 py-1 rounded-full font-bold">Active</span>
            )}
            {isExpired && (
              <span className="bg-danger/20 text-danger text-xs px-2.5 py-1 rounded-full font-bold">Expired</span>
            )}
          </h2>
          <p className="text-text-secondary text-sm">
            {currentPlan ? (
              <>Your current billing cycle ends on <strong className="text-text-primary">{new Date(subData.current_period_end).toLocaleDateString()}</strong></>
            ) : (
              'You do not have an active subscription.'
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <div className="text-3xl font-black">₹{currentPlan?.monthly_price || 0}<span className="text-sm text-text-secondary font-normal">/mo</span></div>
           {subData && !isExpired && (
              <button className="text-danger text-sm font-bold hover:underline">Cancel Subscription</button>
           )}
        </div>
      </div>

      {/* Pricing Tiers */}
      <div>
        <h3 className="text-xl font-bold mb-6">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrent = currentPlan?.id === plan.id;
            return (
              <div key={plan.id} className={`bg-bg-surface border ${isCurrent ? 'border-accent shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-border-theme'} rounded-2xl p-6 flex flex-col`}>
                <h4 className="text-lg font-black mb-2">{plan.name}</h4>
                <div className="text-3xl font-black mb-6">₹{plan.monthly_price}<span className="text-xs text-text-secondary font-normal">/mo</span></div>
                
                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-center gap-2 text-sm text-text-primary"><Check className="w-4 h-4 text-accent" /> Up to {plan.features.max_tables} Tables</li>
                  {plan.features.has_qkhata && <li className="flex items-center gap-2 text-sm text-text-primary"><Check className="w-4 h-4 text-accent" /> QKhata Ledgers</li>}
                  {plan.features.has_whatsapp && <li className="flex items-center gap-2 text-sm text-text-primary"><Check className="w-4 h-4 text-accent" /> WhatsApp Automations</li>}
                  {plan.features.has_telegram && <li className="flex items-center gap-2 text-sm text-text-primary"><Check className="w-4 h-4 text-accent" /> Telegram Bot</li>}
                  {plan.features.has_ai && <li className="flex items-center gap-2 text-sm text-text-primary"><Check className="w-4 h-4 text-accent" /> AI Assistant</li>}
                </ul>

                {isCurrent ? (
                  <button disabled className="w-full py-3 bg-bg-base border border-accent text-accent font-bold rounded-xl opacity-70">Current Plan</button>
                ) : (
                  <button onClick={() => handleCheckout(plan.id)} className="w-full py-3 bg-accent text-white font-bold rounded-xl hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">Upgrade to {plan.name}</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}
