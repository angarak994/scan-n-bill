import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Check, Star, Zap, CreditCard, Calendar, Clock, AlertCircle, FileText, ArrowRight, ShieldCheck, X } from 'lucide-react';

interface SubscriptionTabProps {
  businessId: string;
}

type TabType = 'plan' | 'billing' | 'history' | 'manage';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function SubscriptionTab({ businessId }: SubscriptionTabProps) {
  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState<any>(null);
  const [usage, setUsage] = useState<any>({ tables: 0 });
  const [history, setHistory] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('plan');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchData();
    fetchPlans();
    fetchHistory();
  }, [businessId]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/subscriptions/details');
      const data = await res.json();
      if (res.ok) {
        setSubData(data.subscription);
        setUsage(data.usage);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/subscriptions/history');
      const data = await res.json();
      if (res.ok) {
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error(e);
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
      setIsProcessing(true);
      toast.loading('Initializing secure checkout...', { id: 'checkout' });
      
      const res = await fetch('/api/subscriptions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      const resScript = await loadRazorpayScript();
      if (!resScript) {
        throw new Error('Razorpay SDK failed to load. Are you online?');
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_dummy',
        amount: data.amount,
        currency: data.currency,
        name: 'QControl Platform',
        description: `Subscription for ${data.planName}`,
        order_id: data.orderId,
        handler: async function (response: any) {
          toast.loading('Verifying payment...', { id: 'checkout' });
          try {
             const verifyRes = await fetch('/api/subscriptions/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    planId: planId
                })
             });
             
             if (verifyRes.ok) {
                 toast.success('Payment successful!', { id: 'checkout' });
                 fetchData();
                 fetchHistory();
             } else {
                 const errData = await verifyRes.json();
                 toast.error(errData.error || 'Payment verification failed', { id: 'checkout' });
             }
          } catch (e) {
             toast.error('Payment verification failed', { id: 'checkout' });
          }
        },
        prefill: {
          name: subData?.owner_name || 'Business Owner',
          email: 'owner@example.com'
        },
        theme: {
          color: '#10b981'
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.on('payment.failed', function (response: any) {
         toast.error(response.error.description || 'Payment Failed', { id: 'checkout' });
      });
      paymentObject.open();

    } catch (error: any) {
      toast.error(error.message, { id: 'checkout' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscriptionAction = async (action: 'cancel' | 'reactivate') => {
    try {
      setIsProcessing(true);
      toast.loading(`Processing request...`, { id: 'sub-action' });
      const res = await fetch('/api/subscriptions/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success(data.message, { id: 'sub-action' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message, { id: 'sub-action' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="w-64 h-10 bg-border-light/50 rounded-lg animate-pulse mb-6" />
      <div className="w-full h-32 bg-border-light/50 rounded-2xl animate-pulse" />
      <div className="w-full h-[400px] bg-border-light/50 rounded-2xl animate-pulse" />
    </div>
  );

  const currentPlan = subData?.subscription_plans;
  const isExpired = subData && new Date(subData.current_period_end).getTime() < Date.now();
  const isCancelling = subData?.cancel_at_period_end;
  
  let statusBadge = null;
  if (isExpired) {
    statusBadge = <span className="bg-danger/10 text-danger border border-danger/20 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5"><AlertCircle className="w-3 h-3"/> Expired</span>;
  } else if (isCancelling) {
    statusBadge = <span className="bg-warning/10 text-warning border border-warning/20 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3 h-3"/> Cancels Soon</span>;
  } else if (subData?.status === 'active') {
    statusBadge = <span className="bg-accent/10 text-accent border border-accent/20 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5"><ShieldCheck className="w-3 h-3"/> Active</span>;
  } else if (subData?.status === 'trialing') {
    statusBadge = <span className="bg-info/10 text-info border border-info/20 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5"><Zap className="w-3 h-3"/> Trial</span>;
  } else {
    statusBadge = <span className="bg-bg-base text-text-secondary border border-border-theme text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider">No Plan</span>;
  }

  const tabs = [
    { id: 'plan', label: 'Plan & Usage', icon: Star },
    { id: 'billing', label: 'Payment Details', icon: CreditCard },
    { id: 'history', label: 'Invoices', icon: FileText },
    { id: 'manage', label: 'Manage Subscription', icon: Zap },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-entrance pb-20">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black text-text-primary">Billing & Subscription</h1>
          <p className="text-text-secondary mt-1">Manage your plan, limits, and billing history.</p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-bg-surface to-bg-surface/50 border border-border-theme rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-sm relative overflow-hidden">
        {/* Subtle background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <h2 className="text-3xl font-black text-text-primary">
              {currentPlan?.name || 'Free Plan'}
            </h2>
            {statusBadge}
          </div>
          <p className="text-text-secondary flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {currentPlan ? (
              isCancelling ? (
                <>Access ends on <strong className="text-text-primary">{new Date(subData.current_period_end).toLocaleDateString()}</strong></>
              ) : (
                <>Renews on <strong className="text-text-primary">{new Date(subData.current_period_end).toLocaleDateString()}</strong></>
              )
            ) : (
              'You do not have an active subscription.'
            )}
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1 relative z-10">
           <div className="text-4xl font-black text-text-primary">₹{currentPlan?.monthly_price || 0}<span className="text-lg text-text-secondary font-medium">/month</span></div>
           {currentPlan && (
             <div className="text-sm text-text-secondary mt-1">Plus applicable GST</div>
           )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 p-1 bg-bg-surface/50 border border-border-theme rounded-xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                isActive 
                  ? 'bg-bg-base text-text-primary shadow-sm ring-1 ring-border-theme/50' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : ''}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content Area */}
      <div className="bg-bg-surface border border-border-theme rounded-2xl p-6 sm:p-8 min-h-[400px]">
        
        {/* --- PLAN & USAGE --- */}
        {activeTab === 'plan' && (
          <div className="space-y-8 animate-entrance">
            <h3 className="text-xl font-bold text-text-primary border-b border-border-theme pb-4">Usage & Limits</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Limit Visualizer */}
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-bold text-text-primary">Active Tables</span>
                    <span className="text-sm font-medium text-text-secondary">
                      {usage.tables} / {currentPlan?.features?.max_tables || 0}
                    </span>
                  </div>
                  <div className="h-3 w-full bg-bg-base rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent rounded-full transition-all duration-1000 ease-out"
                      style={{ 
                        width: `${Math.min(100, (usage.tables / (currentPlan?.features?.max_tables || 1)) * 100)}%`,
                        backgroundColor: (usage.tables >= (currentPlan?.features?.max_tables || 0)) ? '#ef4444' : undefined
                      }}
                    ></div>
                  </div>
                  {usage.tables >= (currentPlan?.features?.max_tables || 0) && (
                    <p className="text-danger text-xs mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> You have reached your table limit.</p>
                  )}
                </div>
              </div>

              {/* Feature List */}
              <div>
                <h4 className="font-bold text-text-primary mb-4">Included Features</h4>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-sm">
                    {currentPlan?.features?.has_qkhata ? <Check className="w-5 h-5 text-accent" /> : <X className="w-5 h-5 text-text-secondary/50" />}
                    <span className={currentPlan?.features?.has_qkhata ? 'text-text-primary' : 'text-text-secondary/50'}>QKhata Digital Ledger</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    {currentPlan?.features?.has_whatsapp ? <Check className="w-5 h-5 text-accent" /> : <X className="w-5 h-5 text-text-secondary/50" />}
                    <span className={currentPlan?.features?.has_whatsapp ? 'text-text-primary' : 'text-text-secondary/50'}>WhatsApp Notifications</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    {currentPlan?.features?.has_telegram ? <Check className="w-5 h-5 text-accent" /> : <X className="w-5 h-5 text-text-secondary/50" />}
                    <span className={currentPlan?.features?.has_telegram ? 'text-text-primary' : 'text-text-secondary/50'}>Telegram Bot Access</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    {currentPlan?.features?.has_ai ? <Check className="w-5 h-5 text-accent" /> : <X className="w-5 h-5 text-text-secondary/50" />}
                    <span className={currentPlan?.features?.has_ai ? 'text-text-primary' : 'text-text-secondary/50'}>AI Business Assistant</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* --- PAYMENT & BILLING --- */}
        {activeTab === 'billing' && (
          <div className="space-y-8 animate-entrance">
            <h3 className="text-xl font-bold text-text-primary border-b border-border-theme pb-4">Payment Method & Billing Info</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-bg-base border border-border-theme p-6 rounded-xl flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4 text-text-secondary">
                  <CreditCard className="w-6 h-6" />
                  <span className="font-bold">Primary Payment Method</span>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-text-primary font-medium text-lg">Razorpay Secure Checkout</p>
                  <p className="text-sm text-text-secondary mt-1">Cards, UPI, and Netbanking supported.</p>
                </div>
                <button className="mt-6 text-accent font-bold text-sm hover:underline self-start">Update Payment Method</button>
              </div>
              
              <div className="bg-bg-base border border-border-theme p-6 rounded-xl flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4 text-text-secondary">
                  <FileText className="w-6 h-6" />
                  <span className="font-bold">Billing Address & GST</span>
                </div>
                <div className="flex-1">
                  <p className="text-text-primary font-medium">Business Owner</p>
                  <p className="text-sm text-text-secondary mt-1">GSTIN: Not provided</p>
                  <p className="text-sm text-text-secondary mt-1">Tax applied at checkout based on region (18% standard).</p>
                </div>
                <button className="mt-6 text-accent font-bold text-sm hover:underline self-start">Edit Details</button>
              </div>
            </div>
          </div>
        )}

        {/* --- INVOICES & HISTORY --- */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-entrance">
            <h3 className="text-xl font-bold text-text-primary border-b border-border-theme pb-4">Payment History</h3>
            
            {history.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No payment history found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border-theme">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-base text-text-secondary text-sm">
                      <th className="p-4 font-bold border-b border-border-theme">Date</th>
                      <th className="p-4 font-bold border-b border-border-theme">Amount</th>
                      <th className="p-4 font-bold border-b border-border-theme">Status</th>
                      <th className="p-4 font-bold border-b border-border-theme">Transaction ID</th>
                      <th className="p-4 font-bold border-b border-border-theme text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((log) => (
                      <tr key={log.id} className="border-b border-border-theme/50 hover:bg-bg-base/50 transition-colors">
                        <td className="p-4 text-sm font-medium">{new Date(log.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-sm font-bold">₹{log.amount}</td>
                        <td className="p-4 text-sm">
                          <span className="bg-accent/10 text-accent text-xs px-2 py-1 rounded font-bold">{log.status}</span>
                        </td>
                        <td className="p-4 text-sm text-text-secondary font-mono">{log.gateway_payment_id || '-'}</td>
                        <td className="p-4 text-right">
                          <button className="text-accent text-sm font-bold hover:underline">Download</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- MANAGE SUBSCRIPTION --- */}
        {activeTab === 'manage' && (
          <div className="space-y-8 animate-entrance">
            <h3 className="text-xl font-bold text-text-primary border-b border-border-theme pb-4">Manage Subscription</h3>
            
            {/* Danger / Action Zone */}
            {currentPlan && !isExpired && (
              <div className={`p-6 rounded-xl border ${isCancelling ? 'bg-bg-base border-border-theme' : 'bg-danger/5 border-danger/20'} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
                <div>
                  <h4 className={`font-bold ${isCancelling ? 'text-text-primary' : 'text-danger'} mb-1`}>
                    {isCancelling ? 'Reactivate Subscription' : 'Cancel Subscription'}
                  </h4>
                  <p className="text-sm text-text-secondary">
                    {isCancelling 
                      ? 'Your subscription is set to cancel at the end of the billing period. Reactivate to continue.' 
                      : 'Cancel your subscription. You will still have access until the end of your billing cycle.'}
                  </p>
                </div>
                <button 
                  onClick={() => handleSubscriptionAction(isCancelling ? 'reactivate' : 'cancel')}
                  disabled={isProcessing}
                  className={`px-5 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${
                    isCancelling 
                      ? 'bg-accent text-white hover:bg-accent/90' 
                      : 'bg-danger text-white hover:bg-danger/90'
                  } disabled:opacity-50`}
                >
                  {isCancelling ? 'Reactivate Plan' : 'Cancel Plan'}
                </button>
              </div>
            )}

            {/* Upgrade Options */}
            <div>
              <h4 className="font-bold text-text-primary mb-4">Change Plan</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const isCurrent = currentPlan?.id === plan.id;
                  return (
                    <div key={plan.id} className={`bg-bg-base border ${isCurrent ? 'border-accent/50' : 'border-border-theme'} rounded-xl p-5 flex items-center justify-between gap-4 hover:border-accent/30 transition-colors`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-bold text-text-primary">{plan.name}</h5>
                          {isCurrent && <span className="bg-accent/10 text-accent text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Current</span>}
                        </div>
                        <div className="text-text-secondary text-sm">Up to {plan.features.max_tables} tables, {plan.features.has_ai ? 'AI included' : 'Standard features'}</div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <div className="font-black text-lg">₹{plan.monthly_price}<span className="text-xs font-normal text-text-secondary">/mo</span></div>
                        {!isCurrent && (
                          <button 
                            onClick={() => handleCheckout(plan.id)}
                            disabled={isProcessing}
                            className="text-accent text-sm font-bold flex items-center gap-1 hover:underline mt-1"
                          >
                            Upgrade <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}

