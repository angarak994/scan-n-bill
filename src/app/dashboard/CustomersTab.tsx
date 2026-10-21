'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Award, 
  DollarSign, 
  Phone, 
  ShieldCheck, 
  Smartphone, 
  Check 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Tooltip } from './components';
import { getMemberPlanInfo } from '@/lib/membershipUtils';
import { formatPhoneInput } from '@/lib/utils/formatPhoneInput';
import { useLanguage } from '@/context/LanguageContext';

interface CustomersTabProps {
  businessId: string;
  memberships: any[];
  membershipPlans: any[];
  fetchMemberships: () => void | Promise<void>;
  fetchMembershipPlans: () => void | Promise<void>;
  isMembershipsLoading?: boolean;
  isAuthorized?: boolean;
}

export default function CustomersTab({
  businessId,
  memberships,
  membershipPlans,
  fetchMemberships,
  fetchMembershipPlans,
  isMembershipsLoading = false,
  isAuthorized = false
}: CustomersTabProps) {
  const { t } = useLanguage();

  // Bulk SMS State
  const [selectedBulkSmsCustomers, setSelectedBulkSmsCustomers] = useState<string[]>([]);
  const [showBulkSmsModal, setShowBulkSmsModal] = useState(false);
  const [bulkSmsMessage, setBulkSmsMessage] = useState('');
  const [bulkSmsTemplateId, setBulkSmsTemplateId] = useState('promotional_v1');
  const [isSendingBulkSms, setIsSendingBulkSms] = useState(false);

  // Profile Modal State
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<any>(null);

  // Registration & Verification State
  const [verificationMode, setVerificationMode] = useState<'otp' | 'manual'>('otp');
  const [registrationStep, setRegistrationStep] = useState<1 | 2 | 3>(1);
  const [newMember, setNewMember] = useState({ name: '', mobile: '', email: '', plan_id: '' });
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [manualApprovalNotes, setManualApprovalNotes] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isCreatingMember, setIsCreatingMember] = useState(false);

  // OTP Cooldown Timer (isolated to CustomersTab to avoid re-rendering entire dashboard)
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const interval = setInterval(() => {
      setOtpCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpCooldown]);

  // Handlers
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMember.mobile || newMember.mobile.length < 5) return toast.error('Enter a valid 10-digit mobile number');
    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: newMember.mobile })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Verification code sent to customer phone');
        setRegistrationStep(2);
        setOtpCooldown(data.cooldownSeconds || 60);
      } else {
        toast.error(data.error || 'Failed to send OTP');
        if (data.retryAfter) {
          setOtpCooldown(data.retryAfter);
        }
      }
    } catch {
      toast.error('Network error. Please check your connection.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) return toast.error('Enter valid 6-digit OTP');
    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: newMember.mobile, otp: cleanOtp })
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationId(data.verificationId);
        setVerificationToken(data.verificationToken);
        setRegistrationStep(3);
        toast.success('Mobile verified successfully!');
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch {
      toast.error('Network error. Please check your connection.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleCreateMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingMember) return;
    if (!newMember.name?.trim()) return toast.error('Please enter customer full name');
    if (!newMember.mobile) return toast.error('Please enter mobile number');
    if (!newMember.plan_id) return toast.error('Please select a membership plan');

    setIsCreatingMember(true);
    try {
      const selectedPlan = membershipPlans.find((p: any) => p.id === newMember.plan_id);
      const payload: any = {
        name: newMember.name.trim(),
        mobile: newMember.mobile,
        email: newMember.email?.trim() || undefined,
        tier: selectedPlan?.name || 'Member',
        plan_id: newMember.plan_id,
        duration_months: selectedPlan?.duration_months || 12
      };

      if (verificationMode === 'manual') {
        payload.verificationMethod = 'MANUAL_OWNER_VERIFICATION';
        payload.notes = manualApprovalNotes || 'Customer known to owner';
      } else {
        payload.verificationMethod = 'OTP_VERIFIED';
        payload.verificationToken = verificationToken;
        payload.verificationId = verificationId;
      }

      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewMember({ name: '', mobile: '', email: '', plan_id: '' });
        setRegistrationStep(1);
        setOtp('');
        setVerificationToken('');
        setVerificationId('');
        setManualApprovalNotes('');
        setVerificationMode('otp');
        fetchMemberships();
        fetchMembershipPlans();
        toast.success(data.message || 'Customer profile created.');
      } else {
        toast.error(data.error || "Failed to create customer profile.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to create customer profile. Please check your connection.");
    } finally {
      setIsCreatingMember(false);
    }
  };

  const handleDeleteMembership = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete the customer profile for ${name}? Historical data will not be deleted.`)) return;
    try {
      const res = await fetch('/api/memberships', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        toast.success(`Customer profile for ${name} deleted.`);
        fetchMemberships();
      } else {
        toast.error('Failed to delete customer profile.');
      }
    } catch {
      toast.error('Error deleting profile.');
    }
  };

  // Metrics Calculation
  const totalMembers = memberships.length;
  let activeMembers = 0;
  let expiredMembers = 0;
  let totalLtvSpend = 0;
  let realizedPlanRevenue = 0;
  let totalDiscountsGranted = 0;

  for (const m of memberships) {
    const pInfo = getMemberPlanInfo(m, membershipPlans);
    if (pInfo.isExpired) {
      expiredMembers++;
    } else {
      activeMembers++;
    }
    totalLtvSpend += Number(m.total_spend) || 0;
    totalDiscountsGranted += Number(m.total_discounts_received) || 0;
    if (pInfo.plan && pInfo.plan.price) {
      realizedPlanRevenue += Number(pInfo.plan.price) || 0;
    }
  }

  const sustainabilityRatio = totalDiscountsGranted > 0 
    ? (totalLtvSpend / totalDiscountsGranted).toFixed(1)
    : '∞';

  return (
    <div className="flex flex-col gap-8 mt-4 px-3 sm:px-6 md:px-0">
      {/* Owner Financial & Retention Intelligence Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-card border border-border-theme rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-accent/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Enrolled Members</span>
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-text-primary">{totalMembers}</span>
              <span className="text-xs font-bold text-accent">({activeMembers} Active)</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {expiredMembers > 0 ? (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {expiredMembers} Expired Plan{expiredMembers > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-text-secondary">All plans in good standing</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-bg-card border border-border-theme rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-accent/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Total Member LTV</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-text-primary">₹{totalLtvSpend.toLocaleString('en-IN')}</div>
            <p className="text-[11px] text-text-secondary mt-1">Cumulative session & facility revenue</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-theme rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-accent/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Plan Subscription Fees</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-accent">₹{realizedPlanRevenue.toLocaleString('en-IN')}</div>
            <p className="text-[11px] text-text-secondary mt-1">Upfront enrolled subscription value</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-theme rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-accent/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Discounts & ROI Ratio</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-text-primary">₹{totalDiscountsGranted.toLocaleString('en-IN')}</span>
              <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Member Spend to Discount Ratio">
                {sustainabilityRatio}x ROI
              </span>
            </div>
            <p className="text-[11px] text-text-secondary mt-1">Spend realized per ₹1 discount granted</p>
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border-theme bg-bg-primary/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-text-primary">Membership Directory</h3>
            <p className="text-xs text-text-secondary mt-1 italic">Manage your loyal members</p>
          </div>
          <div className="flex gap-2 sm:gap-3 items-center w-full sm:w-auto justify-between sm:justify-end">
            {selectedBulkSmsCustomers.length > 0 && (
              <button 
                onClick={() => setShowBulkSmsModal(true)} 
                className="min-h-[44px] touch-target px-4 py-2 bg-accent text-black font-extrabold text-sm rounded-lg hover:bg-accent/90 transition-colors shadow shadow-accent/20"
              >
                Send Bulk SMS ({selectedBulkSmsCustomers.length})
              </button>
            )}
            <button 
              onClick={fetchMemberships} 
              className="min-h-[44px] min-w-[44px] touch-target p-2.5 bg-bg-surface border border-border-theme rounded-lg hover:bg-border-theme transition-colors flex items-center justify-center ml-auto sm:ml-0"
              aria-label="Refresh Directory"
            >
              <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
          </div>
        </div>

        {/* Mobile Member Card List (Visible on screens < 768px) */}
        <div className="md:hidden divide-y divide-border-theme/60">
          {isMembershipsLoading ? (
            <div className="p-8 text-center text-text-secondary text-sm animate-pulse">Loading directory...</div>
          ) : memberships.length === 0 ? (
            <div className="p-8 text-center text-text-secondary text-sm">Ready to build loyalty? Create your first customer profile today.</div>
          ) : (
            memberships.map((m, i) => {
              const planInfo = getMemberPlanInfo(m, membershipPlans);
              return (
                <div key={i} className="p-4 flex flex-col gap-3 bg-bg-card hover:bg-bg-surface/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={m.mobile ? selectedBulkSmsCustomers.includes(m.mobile) : false}
                        onChange={(e) => {
                          if (!m.mobile) return;
                          if (e.target.checked) setSelectedBulkSmsCustomers([...selectedBulkSmsCustomers, m.mobile]);
                          else setSelectedBulkSmsCustomers(selectedBulkSmsCustomers.filter(phone => phone !== m.mobile));
                        }}
                        className="w-5 h-5 rounded border-border-theme text-accent focus:ring-accent" 
                      />
                      <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-black text-accent shrink-0">
                        {m.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">{m.name}</p>
                        {m.mobile && (
                          <a href={`tel:${m.mobile}`} className="text-xs font-mono text-accent hover:underline flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-accent shrink-0" />
                            <span>{m.mobile}</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border uppercase ${planInfo.isExpired ? 'border-danger/50 text-danger bg-danger/10' : (m.status === 'Active' ? 'border-accent/50 text-accent bg-accent/10' : 'border-neutral-500/50 text-neutral-400 bg-neutral-500/10')}`}>
                      {planInfo.isExpired ? 'EXPIRED' : (m.status || 'ACTIVE')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-bg-surface p-2.5 rounded-lg border border-border-theme/60 text-xs">
                    <div>
                      <span className="text-[10px] text-text-secondary block">Tier</span>
                      <span className="font-bold text-accent text-[11px] truncate block">
                        {planInfo.planName}
                      </span>
                      {planInfo.discountLabel && (
                        <span className="text-[9px] text-emerald-400 font-mono block">
                          {planInfo.discountLabel}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-text-secondary block">Spend</span>
                      <span className="font-mono font-bold text-text-primary text-[11px] block">₹{m.total_spend || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-secondary block">Points</span>
                      <span className="font-mono font-bold text-accent text-[11px] block">{m.loyalty_points || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      {m.verification_method === 'MANUAL_OWNER_VERIFICATION' ? (
                        <button
                          type="button"
                          onClick={() => setSelectedMemberProfile(m)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold tracking-wide border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all text-left shadow-sm min-h-[36px]"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Owner Approved</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedMemberProfile(m)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold tracking-wide border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-left shadow-sm min-h-[36px]"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>OTP Verified</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSelectedMemberProfile(m)}
                        className="min-h-[44px] min-w-[44px] touch-target flex items-center justify-center p-2 text-text-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-colors border border-border-theme"
                        aria-label="View Profile"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteMembership(m.id, m.name)}
                        className="min-h-[44px] min-w-[44px] touch-target flex items-center justify-center p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors border border-border-theme"
                        aria-label="Delete Profile"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Desktop Table (Hidden on screens < 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-bg-primary/30 text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                <th className="p-5 font-bold w-10">
                  <input type="checkbox" onChange={(e) => {
                    if (e.target.checked) setSelectedBulkSmsCustomers(memberships.map(m => m.mobile).filter(Boolean));
                    else setSelectedBulkSmsCustomers([]);
                  }} className="w-4 h-4 rounded border-border-theme text-accent focus:ring-accent" />
                </th>
                <th className="p-5 font-bold">{t('members', 'Member')}</th>
                <th className="p-5 font-bold">{t('phone_number', 'Contact')}</th>
                <th className="p-5 font-bold">{t('tier', 'Tier')}</th>
                <th className="p-5 font-bold">{t('loyalty_points', 'Points')}</th>
                <th className="p-5 font-bold">{t('total_spend', 'Spend')}</th>
                <th className="p-5 font-bold">{t('expiry_date', 'Expiry Date')}</th>
                <th className="p-5 font-bold">Verification</th>
                <th className="p-5 font-bold">{t('status', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {isMembershipsLoading ? (
                <tr><td colSpan={9} className="p-8 text-center text-text-secondary text-sm animate-pulse">Loading directory...</td></tr>
              ) : memberships.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-text-secondary text-sm">Ready to build loyalty? Create your first customer profile today.</td></tr>
              ) : (
                memberships.map((m, i) => {
                  const planInfo = getMemberPlanInfo(m, membershipPlans);
                  return (
                    <tr key={i} className="border-b border-border-theme/50 hover:bg-bg-surface/50 transition-colors">
                      <td className="p-5">
                        <input 
                          type="checkbox" 
                          checked={m.mobile ? selectedBulkSmsCustomers.includes(m.mobile) : false}
                          onChange={(e) => {
                            if (!m.mobile) return;
                            if (e.target.checked) setSelectedBulkSmsCustomers([...selectedBulkSmsCustomers, m.mobile]);
                            else setSelectedBulkSmsCustomers(selectedBulkSmsCustomers.filter(phone => phone !== m.mobile));
                          }}
                          className="w-4 h-4 rounded border-border-theme text-accent focus:ring-accent" 
                        />
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                            {m.name.substring(0, 2).toUpperCase()}
                          </div>
                          <p className="text-sm font-bold">{m.name}</p>
                        </div>
                      </td>
                      <td className="p-5">
                        <p className="text-sm font-mono">{m.mobile}</p>
                        <p className="text-[10px] text-text-secondary mt-0.5">{m.email || 'No email'}</p>
                      </td>
                      <td className="p-5">
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className="px-2 py-1 rounded text-[10px] font-bold tracking-widest border border-accent text-accent bg-accent/10 uppercase">
                            {planInfo.planName}
                          </span>
                          {planInfo.discountLabel && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              {planInfo.discountLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-5"><span className="text-sm font-mono font-bold text-accent">{m.loyalty_points || 0}</span></td>
                      <td className="p-5"><span className="text-sm font-mono">₹{m.total_spend || 0}</span></td>
                      <td className="p-5">
                        <div className="flex flex-col">
                          <span className={`text-sm font-mono ${planInfo.isExpired ? 'text-danger font-bold' : 'text-text-primary'}`}>
                            {m.expiry_date ? m.expiry_date.split('T')[0] : 'N/A'}
                          </span>
                          {m.expiry_date && (
                            <span className={`text-[10px] ${planInfo.isExpired ? 'text-danger font-semibold' : (planInfo.daysRemaining !== null && planInfo.daysRemaining <= 7 ? 'text-amber-400 font-semibold' : 'text-text-secondary')}`}>
                              {planInfo.isExpired ? 'Plan Expired' : `${planInfo.daysRemaining} days left`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-5">
                        {m.verification_method === 'MANUAL_OWNER_VERIFICATION' ? (
                          <button
                            type="button"
                            onClick={() => setSelectedMemberProfile(m)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all text-left shadow-sm min-h-[32px]"
                            title="Manually approved by owner (Phone unverified). Click for audit info."
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Owner Approved</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedMemberProfile(m)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-left shadow-sm min-h-[32px]"
                            title="Verified via Phone OTP. Click for details."
                          >
                            <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>OTP Verified</span>
                          </button>
                        )}
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-widest border uppercase ${planInfo.isExpired ? 'border-danger/50 text-danger bg-danger/10' : (m.status === 'Active' ? 'border-accent/50 text-accent bg-accent/10' : 'border-neutral-500/50 text-neutral-400 bg-neutral-500/10')}`}>
                            {planInfo.isExpired ? 'EXPIRED' : (m.status || 'ACTIVE')}
                          </span>
                          <Tooltip text="View Profile & Audit Details">
                            <button 
                              onClick={() => setSelectedMemberProfile(m)}
                              className="p-2 min-h-[36px] min-w-[36px] touch-target flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                          </Tooltip>
                          <Tooltip text="Delete Profile">
                            <button 
                              onClick={() => handleDeleteMembership(m.id, m.name)}
                              className="p-2 min-h-[36px] min-w-[36px] touch-target flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showBulkSmsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowBulkSmsModal(false)}>
          <div className="bg-bg-card border border-border-theme rounded-t-2xl sm:rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-border-theme rounded-full mx-auto my-2 sm:hidden shrink-0" />
            <div className="p-4 sm:p-6 border-b border-border-theme flex justify-between items-center bg-bg-primary/50 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-text-primary">Send Bulk SMS</h3>
              <button onClick={() => setShowBulkSmsModal(false)} className="min-h-[44px] min-w-[44px] touch-target flex items-center justify-center text-text-secondary hover:text-text-primary">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-secondary mb-2">DLT Template ID</label>
                <input 
                  type="text" 
                  value={bulkSmsTemplateId} 
                  onChange={e => setBulkSmsTemplateId(e.target.value)} 
                  className="w-full p-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm font-mono" 
                  placeholder="e.g. promo_v1" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-secondary mb-2">Message Content (Approved Template)</label>
                <textarea 
                  value={bulkSmsMessage} 
                  onChange={e => setBulkSmsMessage(e.target.value)} 
                  className="w-full p-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm h-32" 
                  placeholder="Hi {{name}}, enjoy 10% off today!" 
                />
                <p className="text-xs text-text-secondary mt-1">Placeholders: `{"{{"}name{"}}"}`</p>
              </div>
              <div className="bg-accent/10 text-accent p-3 rounded-lg text-sm font-bold text-center">
                Sending to {selectedBulkSmsCustomers.length} customers
              </div>
            </div>
            <div className="p-4 border-t border-border-theme flex justify-end gap-3 bg-bg-surface shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button onClick={() => setShowBulkSmsModal(false)} className="min-h-[44px] touch-target px-5 py-2.5 rounded-lg text-sm font-bold text-text-secondary hover:bg-bg-primary transition-colors">Cancel</button>
              <button 
                onClick={async () => {
                  setIsSendingBulkSms(true);
                  const toastId = toast.loading(`Sending ${selectedBulkSmsCustomers.length} messages...`);
                  try {
                    const customersToSend = memberships.filter(m => selectedBulkSmsCustomers.includes(m.mobile)).map(m => ({ phone: m.mobile, name: m.name }));
                    const res = await fetch('/api/sms-bulk-send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ businessId, customers: customersToSend, templateId: bulkSmsTemplateId, messageTemplate: bulkSmsMessage })
                    });
                    const resData = await res.json();
                    if (!res.ok || resData.error) throw new Error(resData.error || 'Failed to send');
                    toast.success(`Sent ${resData.successCount} messages. Failed: ${resData.failureCount}`, { id: toastId });
                    setShowBulkSmsModal(false);
                  } catch (e: any) {
                    toast.error(e.message || 'Error sending bulk SMS', { id: toastId });
                  } finally {
                    setIsSendingBulkSms(false);
                  }
                }} 
                disabled={isSendingBulkSms || !bulkSmsMessage || !bulkSmsTemplateId}
                className="min-h-[44px] touch-target px-5 py-2.5 rounded-lg text-sm font-extrabold bg-accent text-black hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {isSendingBulkSms ? 'Sending...' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register New Member Section */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-border-theme/60">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Register New Member</h2>
            <p className="text-text-secondary text-xs mt-1">Activate customer membership with phone verification or owner approval</p>
          </div>
          
          {/* Two Clear Choices: Verify via OTP vs Owner Approval */}
          <div className="flex items-center p-1 bg-bg-primary rounded-xl border border-border-theme shadow-inner w-full sm:w-auto">
            <button
              type="button"
              onClick={() => { setVerificationMode('otp'); setRegistrationStep(1); }}
              className={`flex-1 sm:flex-initial min-h-[44px] touch-target flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all ${
                verificationMode === 'otp'
                  ? 'bg-accent text-black shadow-sm ring-1 ring-accent/30'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>Verify via OTP</span>
            </button>
            {isAuthorized && (
              <button
                type="button"
                onClick={() => { setVerificationMode('manual'); }}
                className={`flex-1 sm:flex-initial min-h-[44px] touch-target flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  verificationMode === 'manual'
                    ? 'bg-amber-500 text-black shadow-sm font-black ring-1 ring-amber-400/50'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Only authenticated owners/permitted staff can approve members manually"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Owner Approval</span>
              </button>
            )}
          </div>
        </div>

        {/* METHOD 1: STANDARD CUSTOMER OTP VERIFICATION */}
        {verificationMode === 'otp' && (
          <div>
            {/* Step Indicators */}
            <div className="flex items-center gap-2 mb-6 max-w-xl">
              <div className={`flex items-center gap-2 text-xs font-bold ${registrationStep === 1 ? 'text-accent' : 'text-text-secondary'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${registrationStep === 1 ? 'bg-accent text-black font-black' : 'bg-bg-surface border border-border-theme'}`}>1</span>
                Phone
              </div>
              <div className="flex-1 h-0.5 bg-border-theme"></div>
              <div className={`flex items-center gap-2 text-xs font-bold ${registrationStep === 2 ? 'text-accent' : 'text-text-secondary'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${registrationStep === 2 ? 'bg-accent text-black font-black' : 'bg-bg-surface border border-border-theme'}`}>2</span>
                OTP Code
              </div>
              <div className="flex-1 h-0.5 bg-border-theme"></div>
              <div className={`flex items-center gap-2 text-xs font-bold ${registrationStep === 3 ? 'text-accent' : 'text-text-secondary'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${registrationStep === 3 ? 'bg-accent text-black font-black' : 'bg-bg-surface border border-border-theme'}`}>3</span>
                Details
              </div>
            </div>

            {registrationStep === 1 && (
              <form onSubmit={handleSendOtp} className="max-w-xl grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Customer Mobile Number <span className="text-danger">*</span></label>
                  <input 
                    required 
                    type="tel" 
                    value={newMember.mobile} 
                    onChange={e => setNewMember({...newMember, mobile: formatPhoneInput(e.target.value)})} 
                    className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm font-mono min-h-[44px]" 
                    placeholder="9876543210" 
                    maxLength={10}
                  />
                  <p className="text-[11px] text-text-secondary mt-1.5">A 6-digit verification code will be dispatched to this number via SMS.</p>
                </div>

                <button type="submit" disabled={isSendingOtp} className="w-full bg-accent text-black font-black py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2 shadow-sm min-h-[44px] touch-target">
                  {isSendingOtp ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <span>Send Verification OTP</span>
                  )}
                </button>

                {isAuthorized && (
                  <div className="p-3 bg-bg-surface rounded-lg border border-border-theme/60 text-xs text-text-secondary flex justify-between items-center">
                    <span>Customer known to you in person?</span>
                    <button 
                      type="button" 
                      onClick={() => setVerificationMode('manual')}
                      className="text-amber-400 font-bold hover:underline min-h-[44px] flex items-center"
                    >
                      Verify Manually as Owner →
                    </button>
                  </div>
                )}
              </form>
            )}

            {registrationStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="max-w-xl grid grid-cols-1 gap-4">
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-xs text-text-secondary">
                  Enter the 6-digit verification code sent to <strong className="text-text-primary font-mono">{newMember.mobile}</strong>.
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Enter 6-Digit OTP <span className="text-danger">*</span></label>
                  <input 
                    required 
                    type="text" 
                    value={otp} 
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                    className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-xl font-mono text-center tracking-[0.5em] font-bold min-h-[48px]" 
                    placeholder="••••••" 
                    maxLength={6} 
                    autoFocus
                  />
                  <div className="flex justify-between items-center text-xs text-text-secondary mt-2">
                    <button type="button" onClick={() => setRegistrationStep(1)} className="text-accent hover:underline min-h-[44px] flex items-center">
                      ← Change mobile number
                    </button>
                    <div>
                      {otpCooldown > 0 ? (
                        <span className="text-text-secondary">Resend in <strong className="text-accent font-mono">{otpCooldown}s</strong></span>
                      ) : (
                        <button type="button" onClick={() => handleSendOtp()} className="text-accent font-bold hover:underline min-h-[44px] flex items-center">
                          Resend Code
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isVerifyingOtp || otp.length !== 6} className="w-full bg-accent text-black font-black py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2 shadow-sm min-h-[44px] touch-target">
                  {isVerifyingOtp ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <span>Verify Code & Continue</span>
                  )}
                </button>

                {isAuthorized && (
                  <div className="pt-2 text-center">
                    <button 
                      type="button" 
                      onClick={() => setVerificationMode('manual')}
                      className="text-xs text-amber-400 font-bold hover:underline min-h-[44px] inline-flex items-center"
                    >
                      Customer having trouble with SMS? Verify Manually as Owner →
                    </button>
                  </div>
                )}
              </form>
            )}

            {registrationStep === 3 && (
              <form onSubmit={handleCreateMembership} className="max-w-xl grid grid-cols-2 gap-4">
                <div className="col-span-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between text-xs text-emerald-400">
                  <span className="flex items-center gap-2 font-bold">
                    <Check className="w-4 h-4 text-accent" />
                    <span>Mobile verified successfully via OTP</span>
                  </span>
                  <span className="font-mono text-text-primary">{newMember.mobile}</span>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Full Name <span className="text-danger">*</span></label>
                  <input required type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm min-h-[44px]" placeholder="John Doe" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Mobile Number (Verified)</label>
                  <input disabled type="tel" value={newMember.mobile} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg opacity-60 cursor-not-allowed outline-none text-base sm:text-sm font-mono min-h-[44px]" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Email Address (Optional)</label>
                  <input type="email" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm min-h-[44px]" placeholder="john@example.com" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Select Membership Plan <span className="text-danger">*</span></label>
                  <select required value={newMember.plan_id} onChange={e => setNewMember({...newMember, plan_id: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm font-bold text-accent min-h-[44px]">
                    <option value="" disabled>Select a plan...</option>
                    {membershipPlans.filter((p: any) => p.status === 'Active').map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} - ₹{p.price} ({p.duration_months} Months)</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 mt-2">
                  <button type="submit" disabled={isCreatingMember} className="w-full bg-accent text-black font-black py-3.5 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2 shadow-sm min-h-[44px] touch-target">
                    {isCreatingMember ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        <span>Registering Member...</span>
                      </>
                    ) : (
                      <span>Complete Registration</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* METHOD 2: BUSINESS OWNER MANUAL VERIFICATION */}
        {verificationMode === 'manual' && isAuthorized && (
          <form onSubmit={handleCreateMembership} className="max-w-xl grid grid-cols-2 gap-4">
            {/* Audit & Compliance Disclosure Banner */}
            <div className="col-span-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Verify Manually — Customer Known to Owner</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                You are approving this membership without sending a customer OTP. The member will be activated with verification method <strong className="text-text-primary font-mono text-[11px]">MANUAL_OWNER_VERIFICATION</strong>. Your approval will be recorded in the audit log, and the phone number will <strong className="text-amber-400">NOT</strong> be marked as OTP-verified.
              </p>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Customer Full Name <span className="text-danger">*</span></label>
              <input 
                required 
                type="text" 
                value={newMember.name} 
                onChange={e => setNewMember({...newMember, name: e.target.value})} 
                className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm min-h-[44px]" 
                placeholder="John Doe" 
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Mobile Number <span className="text-danger">*</span></label>
              <input 
                required 
                type="tel" 
                value={newMember.mobile} 
                onChange={e => setNewMember({...newMember, mobile: formatPhoneInput(e.target.value)})} 
                className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm font-mono min-h-[44px]" 
                placeholder="9876543210" 
                maxLength={10} 
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Email Address (Optional)</label>
              <input 
                type="email" 
                value={newMember.email} 
                onChange={e => setNewMember({...newMember, email: e.target.value})} 
                className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm min-h-[44px]" 
                placeholder="john@example.com" 
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Select Membership Plan <span className="text-danger">*</span></label>
              <select 
                required 
                value={newMember.plan_id} 
                onChange={e => setNewMember({...newMember, plan_id: e.target.value})} 
                className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm font-bold text-accent min-h-[44px]"
              >
                <option value="" disabled>Select a plan...</option>
                {membershipPlans.filter((p: any) => p.status === 'Active').map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} - ₹{p.price} ({p.duration_months} Months)</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Approval Reason / Audit Notes (Optional)</label>
              <input 
                type="text" 
                value={manualApprovalNotes} 
                onChange={e => setManualApprovalNotes(e.target.value)} 
                className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm min-h-[44px]" 
                placeholder="e.g. Regular club player known to owner" 
              />
            </div>

            <div className="col-span-2 mt-2">
              <button 
                type="submit" 
                disabled={isCreatingMember} 
                className="w-full bg-amber-500 text-black font-extrabold py-3.5 rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 shadow-md flex items-center justify-center gap-2 min-h-[44px] touch-target"
              >
                {isCreatingMember ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    <span>Approving Member...</span>
                  </>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm & Approve Membership</span>
                  </span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Member Profile & Verification Audit Modal */}
      {selectedMemberProfile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedMemberProfile(null)}>
          <div className="bg-bg-card border border-border-theme rounded-t-2xl sm:rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-border-theme rounded-full mx-auto my-2 sm:hidden shrink-0" />
            <div className="p-4 sm:p-6 border-b border-border-theme flex justify-between items-center bg-bg-primary/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                  {selectedMemberProfile.name?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-text-primary">{selectedMemberProfile.name}</h3>
                  <p className="text-xs text-text-secondary font-mono">{selectedMemberProfile.mobile}</p>
                </div>
              </div>
              <button onClick={() => setSelectedMemberProfile(null)} className="text-text-secondary hover:text-text-primary p-2 min-h-[44px] min-w-[44px] touch-target flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {/* Verification Audit Status Card */}
              <div className={`p-4 rounded-xl border ${
                selectedMemberProfile.verification_method === 'MANUAL_OWNER_VERIFICATION' 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'bg-emerald-500/10 border-emerald-500/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Verification Method</span>
                  {selectedMemberProfile.verification_method === 'MANUAL_OWNER_VERIFICATION' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Owner Approved</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Phone OTP Verified</span>
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Phone Number Status:</span>
                    <span className="font-semibold text-text-primary">
                      {selectedMemberProfile.is_phone_verified ? 'Verified via SMS' : 'Unverified (Owner Override)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Verified / Approved By:</span>
                    <span className="font-semibold text-text-primary font-mono">{selectedMemberProfile.verified_by || 'Owner'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Timestamp:</span>
                    <span className="text-text-primary">{selectedMemberProfile.verified_at ? new Date(selectedMemberProfile.verified_at).toLocaleString() : 'N/A'}</span>
                  </div>
                  {selectedMemberProfile.audit_info?.approval_notes && (
                    <div className="pt-2 border-t border-border-theme/40">
                      <span className="text-text-secondary block mb-0.5">Approval Note:</span>
                      <p className="italic text-text-primary bg-bg-surface p-2 rounded border border-border-theme">{selectedMemberProfile.audit_info.approval_notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Membership Summary Grid */}
              {(() => {
                const profilePlanInfo = getMemberPlanInfo(selectedMemberProfile, membershipPlans);
                return (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-bg-surface rounded-lg border border-border-theme">
                      <span className="text-text-secondary block mb-1">Plan Tier</span>
                      <span className="font-bold text-accent uppercase truncate block">
                        {profilePlanInfo.planName}
                      </span>
                      {profilePlanInfo.discountLabel && (
                        <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                          {profilePlanInfo.discountLabel}
                        </span>
                      )}
                    </div>
                    <div className="p-3 bg-bg-surface rounded-lg border border-border-theme">
                      <span className="text-text-secondary block mb-1">Status</span>
                      <span className={`font-bold uppercase ${profilePlanInfo.isExpired ? 'text-danger' : 'text-text-primary'}`}>
                        {profilePlanInfo.isExpired ? 'EXPIRED' : (selectedMemberProfile.status || 'Active')}
                      </span>
                    </div>
                    <div className="p-3 bg-bg-surface rounded-lg border border-border-theme">
                      <span className="text-text-secondary block mb-1">Total Spend</span>
                      <span className="font-mono font-bold text-text-primary">₹{selectedMemberProfile.total_spend || 0}</span>
                    </div>
                    <div className="p-3 bg-bg-surface rounded-lg border border-border-theme">
                      <span className="text-text-secondary block mb-1">Discounts Saved</span>
                      <span className="font-mono font-bold text-emerald-400">₹{selectedMemberProfile.total_discounts_received || 0}</span>
                    </div>
                    <div className="p-3 bg-bg-surface rounded-lg border border-border-theme col-span-2 flex justify-between items-center">
                      <div>
                        <span className="text-text-secondary block mb-0.5">Expiry Date:</span>
                        <span className={`font-mono font-bold ${profilePlanInfo.isExpired ? 'text-danger' : 'text-text-primary'}`}>
                          {selectedMemberProfile.expiry_date ? selectedMemberProfile.expiry_date.split('T')[0] : 'N/A'}
                        </span>
                      </div>
                      {selectedMemberProfile.expiry_date && (
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${profilePlanInfo.isExpired ? 'border-danger/30 text-danger bg-danger/10' : (profilePlanInfo.daysRemaining !== null && profilePlanInfo.daysRemaining <= 7 ? 'border-amber-400/30 text-amber-400 bg-amber-400/10' : 'border-accent/30 text-accent bg-accent/10')}`}>
                          {profilePlanInfo.isExpired ? 'Expired' : `${profilePlanInfo.daysRemaining} days remaining`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-border-theme flex justify-end bg-bg-surface shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button 
                onClick={() => setSelectedMemberProfile(null)}
                className="min-h-[44px] touch-target px-5 py-2 rounded-lg text-sm font-bold bg-bg-primary border border-border-theme text-text-primary hover:bg-border-theme transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
