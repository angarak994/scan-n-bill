'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  Search,
  RefreshCw,
  LogOut,
  Building2,
  Sliders,
  MessageSquare,
  FileSpreadsheet,
  QrCode,
  CreditCard,
  Rocket,
  History,
  Activity,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';

interface BusinessItem {
  id: string;
  business_name: string;
  owner_name: string;
  contact_number: string;
  address?: string;
  business_type?: string;
  google_sheet_id: string;
  status: string;
  approval_notes?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
  onboarded_at?: string | null;
  onboarded_by?: string | null;
  tables_count: number;
  created_at: string;
  feature_entitlements: Record<string, boolean>;
  subscription?: {
    id: string;
    status: string;
    plan_name: string;
    monthly_price: number;
    agreed_price_paisa: number;
    agreed_price_inr: number;
    billing_currency: string;
    billing_interval: string;
    trial_duration_days: number;
    current_period_end: string;
    grace_period_days: number;
    custom_pricing_notes?: string | null;
  } | null;
}

interface AuditLog {
  id?: string;
  developer_email: string;
  action: string;
  target_business_id?: string | null;
  details?: Record<string, any>;
  created_at?: string;
}

type TabType =
  | 'overview'
  | 'approvals'
  | 'businesses'
  | 'features'
  | 'whatsapp'
  | 'sheets'
  | 'qr'
  | 'subscriptions'
  | 'payments'
  | 'onboarding'
  | 'audit'
  | 'health';

export default function DeveloperControlCenter() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [developerEmail, setDeveloperEmail] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal States
  const [selectedBizForPricing, setSelectedBizForPricing] = useState<BusinessItem | null>(null);
  const [agreedPriceInr, setAgreedPriceInr] = useState('1999');
  const [trialDays, setTrialDays] = useState('15');
  const [graceDays, setGraceDays] = useState('3');
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [pricingNotes, setPricingNotes] = useState('');

  const [selectedBizForLaunch, setSelectedBizForLaunch] = useState<BusinessItem | null>(null);
  const [launchResult, setLaunchResult] = useState<any>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // 1. Initial auth verification & data loading
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch('/api/control/auth/me');
      if (!meRes.ok) {
        router.push('/control/login');
        return;
      }
      const meData = await meRes.json();
      setDeveloperEmail(meData.developer?.email || 'admin@qcontrol.com');

      const bizRes = await fetch('/api/control/businesses');
      if (bizRes.ok) {
        const bizData = await bizRes.json();
        setBusinesses(bizData.businesses || []);
        if (bizData.counts) setCounts(bizData.counts);
      }

      const logsRes = await fetch('/api/control/audit-logs?limit=50');
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData.logs || []);
      }

      const healthRes = await fetch('/api/control/health');
      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealthData(hData);
      }
    } catch (err) {
      console.error('Error loading developer control center:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Logout handler
  const handleLogout = async () => {
    await fetch('/api/control/auth/logout', { method: 'POST' });
    router.push('/control/login');
  };

  // Approval action handler
  const handleApprovalAction = async (businessId: string, action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'REACTIVATE', notes?: string) => {
    setActionLoading(`approve_${businessId}`);
    try {
      const res = await fetch('/api/control/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, action, notes }),
      });
      if (res.ok) {
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Action failed');
      }
    } catch (e: any) {
      alert(e.message || 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  // Feature entitlement toggle handler
  const handleFeatureToggle = async (businessId: string, feature: string, currentValue: boolean) => {
    setActionLoading(`feature_${businessId}_${feature}`);
    try {
      const res = await fetch('/api/control/entitlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, feature, enabled: !currentValue }),
      });
      if (res.ok) {
        // Optimistic update
        setBusinesses(prev => prev.map(b => {
          if (b.id !== businessId) return b;
          return {
            ...b,
            feature_entitlements: {
              ...b.feature_entitlements,
              [feature]: !currentValue,
            }
          };
        }));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update feature');
      }
    } catch (e: any) {
      alert(e.message || 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  // Save custom pricing handler
  const handleSaveCustomPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBizForPricing) return;
    setActionLoading('saving_pricing');

    try {
      const res = await fetch('/api/control/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: selectedBizForPricing.id,
          agreedPriceInr: Number(agreedPriceInr),
          trialDurationDays: Number(trialDays),
          gracePeriodDays: Number(graceDays),
          billingInterval,
          notes: pricingNotes,
        }),
      });

      if (res.ok) {
        setSelectedBizForPricing(null);
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save pricing terms');
      }
    } catch (e: any) {
      alert(e.message || 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  // Launch production onboarding handler
  const handleLaunchProduction = async () => {
    if (!selectedBizForLaunch) return;
    setActionLoading('launching_production');
    setLaunchError(null);
    setLaunchResult(null);

    try {
      const res = await fetch('/api/control/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: selectedBizForLaunch.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLaunchError(data.error || 'Production launch failed');
      } else {
        setLaunchResult(data);
        await loadData();
      }
    } catch (e: any) {
      setLaunchError(e.message || 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered businesses
  const filteredBusinesses = useMemo(() => {
    return businesses.filter(b => {
      const matchSearch = searchQuery === '' ||
        b.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.contact_number.includes(searchQuery) ||
        b.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'ALL' ||
        (statusFilter === 'APPROVED' ? (b.status === 'APPROVED' || b.status === 'ACTIVE') : b.status === statusFilter);

      return matchSearch && matchStatus;
    });
  }, [businesses, searchQuery, statusFilter]);

  const pendingBusinesses = useMemo(() => {
    return businesses.filter(b => b.status === 'PENDING_APPROVAL');
  }, [businesses]);

  const approvedBusinesses = useMemo(() => {
    return businesses.filter(b => b.status === 'APPROVED' || b.status === 'ACTIVE');
  }, [businesses]);

  const formatINR = (val?: number) => {
    if (val === undefined || isNaN(val)) return '₹0';
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-[#090D14] text-[#F3F4F6] font-sans flex flex-col selection:bg-emerald-500/30 selection:text-emerald-400">
      
      {/* Top Header */}
      <header className="border-b border-[#1E293B] bg-[#0F172A]/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-lg tracking-tight">QControl</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Developer Control Center
              </span>
            </div>
            <p className="text-xs text-[#64748B]">Platform Owner Administrative Portal • Multi-Tenant SaaS</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="p-2 rounded-xl bg-[#1E293B] text-[#94A3B8] hover:text-white transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-white">{developerEmail}</span>
            <span className="text-[10px] text-emerald-400 font-mono">Platform Developer Role</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Navigation Sidebar */}
        <aside className="w-64 border-r border-[#1E293B] bg-[#0A101D] p-4 flex flex-col gap-1 overflow-y-auto shrink-0 hidden md:flex">
          
          <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider px-3 py-2">
            Governance & Ops
          </div>

          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4" />
              <span>1. Overview</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'approvals'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>2. Business Approvals</span>
            </div>
            {counts.pending > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black">
                {counts.pending}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('businesses')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'businesses'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4" />
              <span>3. Registered Businesses</span>
            </div>
            <span className="text-[10px] text-[#64748B] font-mono">{counts.total}</span>
          </button>

          <button
            onClick={() => setActiveTab('features')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'features'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>4. Feature Management</span>
            </div>
          </button>

          <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider px-3 py-2 mt-4">
            Integration Gates
          </div>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'whatsapp'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-[#25D366]" />
              <span>5. WhatsApp AI Access</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'sheets'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>6. Google Sheets Sync</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'qr'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <QrCode className="w-4 h-4 text-purple-400" />
              <span>7. QR Code Access</span>
            </div>
          </button>

          <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider px-3 py-2 mt-4">
            Monetization & Launch
          </div>

          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'subscriptions'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span>8. Subscriptions & Pricing</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'payments'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>9. Payments & Invoices</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('onboarding')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'onboarding'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Rocket className="w-4 h-4 text-pink-400" />
              <span>10. Production Onboarding</span>
            </div>
          </button>

          <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider px-3 py-2 mt-4">
            Audit & Reliability
          </div>

          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'audit'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <History className="w-4 h-4 text-teal-400" />
              <span>11. Audit Logs</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'health'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>12. System Health</span>
            </div>
          </button>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          
          {/* Section 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">SaaS Platform Overview</h2>
                <p className="text-sm text-[#94A3B8] mt-1">Multi-tenant health, pending approvals, and active operations.</p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 shadow-lg">
                  <div className="flex justify-between items-center text-xs font-semibold text-[#94A3B8] mb-2 uppercase">
                    <span>Pending Approvals</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-amber-400 font-mono">{counts.pending}</div>
                  <p className="text-[11px] text-[#64748B] mt-2">New business registrations awaiting review</p>
                </div>

                <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 shadow-lg">
                  <div className="flex justify-between items-center text-xs font-semibold text-[#94A3B8] mb-2 uppercase">
                    <span>Active / Approved</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-400 font-mono">{counts.approved}</div>
                  <p className="text-[11px] text-[#64748B] mt-2">Authorized operational clubs</p>
                </div>

                <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 shadow-lg">
                  <div className="flex justify-between items-center text-xs font-semibold text-[#94A3B8] mb-2 uppercase">
                    <span>Live Table Sessions</span>
                    <Activity className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-blue-400 font-mono">
                    {healthData?.database?.activeSessions ?? '—'}
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-2">Currently active game sessions in network</p>
                </div>

                <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 shadow-lg">
                  <div className="flex justify-between items-center text-xs font-semibold text-[#94A3B8] mb-2 uppercase">
                    <span>Total Venues</span>
                    <Building2 className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono">{counts.total}</div>
                  <p className="text-[11px] text-[#64748B] mt-2">Total registered clubs in database</p>
                </div>
              </div>

              {/* Actionable Pending Approvals Banner */}
              {counts.pending > 0 && (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        {counts.pending} Business Application{counts.pending > 1 ? 's' : ''} Pending Review
                      </h4>
                      <p className="text-xs text-[#94A3B8]">
                        Review submitted club info, configure agreed pricing, and authorize production onboarding.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('approvals')}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-all shrink-0"
                  >
                    Review Applications →
                  </button>
                </div>
              )}

              {/* Quick Health Summary */}
              <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-lg">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Infrastructure Gates</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-[#090D14] border border-[#1E293B]">
                    <span className="text-[#64748B]">WhatsApp AI Platform</span>
                    <div className="font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Ready & Centralized
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#090D14] border border-[#1E293B]">
                    <span className="text-[#64748B]">Google Sheets Engine</span>
                    <div className="font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Service Account Active
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#090D14] border border-[#1E293B]">
                    <span className="text-[#64748B]">Database Latency</span>
                    <div className="font-bold text-white mt-1 font-mono">
                      {healthData?.database?.latencyMs ? `${healthData.database.latencyMs}ms` : 'Active'}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#090D14] border border-[#1E293B]">
                    <span className="text-[#64748B]">Telegram Integrations</span>
                    <div className="font-bold text-blue-400 mt-1 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Bot Connected
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Business Approvals */}
          {activeTab === 'approvals' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Business Registration Approvals</h2>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Only approved venues can proceed to authorized onboarding. Pending businesses have zero operational access.
                </p>
              </div>

              {pendingBusinesses.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#0F172A] border border-[#1E293B]">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white">All Caught Up!</h3>
                  <p className="text-xs text-[#94A3B8] mt-1">There are no pending club applications awaiting approval.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingBusinesses.map((biz) => (
                    <div
                      key={biz.id}
                      className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B] shadow-xl flex flex-col lg:flex-row justify-between gap-6"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-white">{biz.business_name}</h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            PENDING_APPROVAL
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs text-[#94A3B8]">
                          <div><span className="text-[#64748B]">Owner:</span> {biz.owner_name}</div>
                          <div><span className="text-[#64748B]">Contact:</span> {biz.contact_number}</div>
                          <div><span className="text-[#64748B]">Tables:</span> {biz.tables_count} configured</div>
                          <div><span className="text-[#64748B]">Sheet ID:</span> {biz.google_sheet_id.slice(0, 16)}...</div>
                          <div><span className="text-[#64748B]">Applied:</span> {new Date(biz.created_at).toLocaleDateString()}</div>
                          <div><span className="text-[#64748B]">Type:</span> {biz.business_type || 'Billiards / Gaming'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedBizForPricing(biz);
                            setAgreedPriceInr(String(biz.subscription?.agreed_price_inr || 1999));
                            setTrialDays(String(biz.subscription?.trial_duration_days || 15));
                          }}
                          className="px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-semibold transition-all"
                        >
                          Configure Terms
                        </button>

                        <button
                          onClick={() => handleApprovalAction(biz.id, 'APPROVE')}
                          disabled={actionLoading === `approve_${biz.id}`}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>

                        <button
                          onClick={() => {
                            const reason = prompt('Rejection reason (optional):');
                            if (reason !== null) {
                              handleApprovalAction(biz.id, 'REJECT', reason);
                            }
                          }}
                          disabled={actionLoading === `approve_${biz.id}`}
                          className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Registered Businesses */}
          {activeTab === 'businesses' && (
            <div className="space-y-6 max-w-7xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Registered Businesses</h2>
                  <p className="text-sm text-[#94A3B8] mt-1">Complete multi-tenant business directory.</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search club or owner..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING_APPROVAL">Pending</option>
                    <option value="APPROVED">Approved / Active</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0A101D] text-[#64748B] font-semibold border-b border-[#1E293B]">
                      <tr>
                        <th className="p-4">Business</th>
                        <th className="p-4">Owner Contact</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Agreed Terms</th>
                        <th className="p-4">Production Launch</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]">
                      {filteredBusinesses.map((b) => (
                        <tr key={b.id} className="hover:bg-[#1E293B]/20 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-white">{b.business_name}</div>
                            <div className="text-[10px] text-[#64748B] font-mono">{b.id}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-white">{b.owner_name}</div>
                            <div className="text-[10px] text-[#64748B] font-mono">{b.contact_number}</div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.status === 'APPROVED' || b.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : b.status === 'PENDING_APPROVAL'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-mono text-emerald-400 font-semibold">
                              {b.subscription?.agreed_price_inr
                                ? `${formatINR(b.subscription.agreed_price_inr)}/${b.subscription.billing_interval || 'mo'}`
                                : 'Standard Plan'}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              Trial: {b.subscription?.trial_duration_days || 15}d
                            </div>
                          </td>
                          <td className="p-4">
                            {b.onboarded_at ? (
                              <div className="text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Launched</span>
                              </div>
                            ) : (
                              <div className="text-[#64748B] text-[11px]">Not Launched</div>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedBizForPricing(b);
                                setAgreedPriceInr(String(b.subscription?.agreed_price_inr || 1999));
                                setTrialDays(String(b.subscription?.trial_duration_days || 15));
                              }}
                              className="px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#334155] text-white text-[11px] font-medium"
                            >
                              Terms
                            </button>

                            {b.status === 'APPROVED' || b.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleApprovalAction(b.id, 'SUSPEND')}
                                className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-medium"
                              >
                                Suspend
                              </button>
                            ) : b.status === 'SUSPENDED' ? (
                              <button
                                onClick={() => handleApprovalAction(b.id, 'REACTIVATE')}
                                className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium"
                              >
                                Reactivate
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Feature Management */}
          {activeTab === 'features' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Feature Entitlement Matrix</h2>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Developer switches to enable or disable specific features per business with server-side enforcement.
                </p>
              </div>

              <div className="space-y-6">
                {filteredBusinesses.map((b) => (
                  <div key={b.id} className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B] shadow-xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-4 border-b border-[#1E293B]">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-white text-base">{b.business_name}</h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.status === 'APPROVED' || b.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#64748B] font-mono">{b.id}</span>
                      </div>

                      <div className="text-xs text-[#94A3B8]">
                        Sheet: <span className="font-mono text-emerald-400">{b.google_sheet_id.slice(0, 14)}...</span>
                      </div>
                    </div>

                    {/* 11 Feature Switches Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-xs">
                      {[
                        { key: 'whatsapp_ai', label: '1. WhatsApp AI Agent', desc: 'Centralized discovery & booking' },
                        { key: 'google_sheets', label: '2. Google Sheets Sync', desc: 'Session & ledger synchronization' },
                        { key: 'qr_sessions', label: '3. QR Code Sessions', desc: 'Customer self-service table scan' },
                        { key: 'telegram_bot', label: '4. Telegram Bot', desc: 'Owner alerts & remote stop' },
                        { key: 'manual_booking', label: '5. Manual Booking', desc: 'Desk table creation' },
                        { key: 'online_booking', label: '6. Online Booking', desc: 'Public customer reservation' },
                        { key: 'memberships', label: '7. Memberships', desc: 'Tier discounts & perks' },
                        { key: 'reports_analytics', label: '8. Reports & Analytics', desc: 'Financial aggregations' },
                        { key: 'advanced_billing', label: '9. Advanced Billing', desc: 'Happy hour & dynamic rates' },
                        { key: 'payment_automation', label: '10. Payment Automation', desc: 'Razorpay UPI & gateway' },
                        { key: 'fnb_inventory', label: '11. F&B Engine', desc: 'Food ordering & item tabs' },
                      ].map(({ key, label, desc }) => {
                        const isEnabled = Boolean(b.feature_entitlements[key]);
                        const isBusy = actionLoading === `feature_${b.id}_${key}`;

                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                              isEnabled
                                ? 'bg-[#090D14] border-emerald-500/30 text-white'
                                : 'bg-[#090D14]/40 border-[#1E293B] text-[#64748B]'
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-[11px] text-white">{label}</div>
                              <div className="text-[10px] text-[#64748B]">{desc}</div>
                            </div>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleFeatureToggle(b.id, key, isEnabled)}
                              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                                isEnabled ? 'bg-emerald-500' : 'bg-[#1E293B]'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                                  isEnabled ? 'left-6' : 'left-1'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: WhatsApp AI Access */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Centralized WhatsApp AI Access</h2>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Only authorized businesses with WhatsApp AI access enabled participate in the central QControl agent discovery.
                </p>
              </div>

              <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  <Info className="w-5 h-5 shrink-0" />
                  <span>
                    When a customer asks QControl WhatsApp bot for clubs, only businesses marked <strong>ACTIVE</strong> with <strong>WhatsApp AI: ENABLED</strong> are returned. Pending or unentitled venues are filtered out with zero-hallucination guarantees.
                  </span>
                </div>

                <div className="space-y-3">
                  {approvedBusinesses.map((b) => {
                    const waEnabled = Boolean(b.feature_entitlements.whatsapp_ai);

                    return (
                      <div
                        key={b.id}
                        className="p-4 rounded-xl bg-[#090D14] border border-[#1E293B] flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="font-bold text-white text-sm">{b.business_name}</div>
                          <div className="text-xs text-[#94A3B8]">
                            Tables: {b.tables_count} • Contact: {b.contact_number}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                            waEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#1E293B] text-[#64748B]'
                          }`}>
                            {waEnabled ? 'DISCOVERABLE' : 'HIDDEN'}
                          </span>

                          <button
                            onClick={() => handleFeatureToggle(b.id, 'whatsapp_ai', waEnabled)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                              waEnabled
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                            }`}
                          >
                            {waEnabled ? 'Disable WhatsApp' : 'Enable WhatsApp'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Section 6: Google Sheets Integrations */}
          {activeTab === 'sheets' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Google Sheets Synchronization Entitlements</h2>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Manage spreadsheet synchronization per venue. Disabling stops background queue jobs safely without deleting data.
                </p>
              </div>

              <div className="space-y-3">
                {approvedBusinesses.map((b) => {
                  const sheetsEnabled = Boolean(b.feature_entitlements.google_sheets);

                  return (
                    <div
                      key={b.id}
                      className="p-5 rounded-2xl bg-[#0F172A] border border-[#1E293B] flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-white text-sm">{b.business_name}</div>
                        <div className="text-xs text-[#94A3B8] font-mono">
                          Sheet ID: <span className="text-emerald-400">{b.google_sheet_id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${b.google_sheet_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#1E293B] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#334155]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Sheet</span>
                        </a>

                        <button
                          onClick={() => handleFeatureToggle(b.id, 'google_sheets', sheetsEnabled)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            sheetsEnabled
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-600 text-white hover:bg-emerald-500'
                          }`}
                        >
                          {sheetsEnabled ? 'Disable Sync' : 'Enable Sync'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 7: QR Code Access */}
          {activeTab === 'qr' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">QR Code Session Access</h2>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Control self-service QR table scanning per venue. Disabled venues show a friendly desk notice to scanning patrons.
                </p>
              </div>

              <div className="space-y-3">
                {approvedBusinesses.map((b) => {
                  const qrEnabled = Boolean(b.feature_entitlements.qr_sessions);

                  return (
                    <div
                      key={b.id}
                      className="p-5 rounded-2xl bg-[#0F172A] border border-[#1E293B] flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="font-bold text-white text-sm">{b.business_name}</div>
                        <div className="text-xs text-[#94A3B8]">
                          {b.tables_count} tables configured • Status: <span className="font-bold text-white">{b.status}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleFeatureToggle(b.id, 'qr_sessions', qrEnabled)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            qrEnabled
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-900/20'
                          }`}
                        >
                          {qrEnabled ? 'Disable QR Sessions' : 'Enable QR Sessions'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 8: Subscription and Trial Management */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Trial & Negotiated Pricing Management</h2>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Set mutually agreed commercial terms separately for each business. Negotiated prices take precedence over landing page defaults.
                </p>
              </div>

              <div className="space-y-4">
                {businesses.map((b) => {
                  const sub = b.subscription;
                  const agreedPrice = sub?.agreed_price_inr;

                  return (
                    <div
                      key={b.id}
                      className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B] flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-white text-base">{b.business_name}</h3>
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#1E293B] text-white font-mono">
                            {sub?.plan_name || 'Growth'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-[#64748B]">Agreed Price:</span>
                            <div className="font-bold text-emerald-400 font-mono text-sm">
                              {agreedPrice ? formatINR(agreedPrice) : 'Standard ₹1,999'}
                            </div>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Billing Interval:</span>
                            <div className="text-white capitalize">{sub?.billing_interval || 'monthly'}</div>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Trial Duration:</span>
                            <div className="text-white">{sub?.trial_duration_days || 15} days</div>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Grace Period:</span>
                            <div className="text-white">{sub?.grace_period_days || 3} days</div>
                          </div>
                        </div>

                        {sub?.custom_pricing_notes && (
                          <p className="text-xs text-[#94A3B8] italic">Note: “{sub.custom_pricing_notes}”</p>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedBizForPricing(b);
                          setAgreedPriceInr(String(sub?.agreed_price_inr || 1999));
                          setTrialDays(String(sub?.trial_duration_days || 15));
                          setGraceDays(String(sub?.grace_period_days || 3));
                          setBillingInterval(sub?.billing_interval || 'monthly');
                          setPricingNotes(sub?.custom_pricing_notes || '');
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all shrink-0"
                      >
                        Edit Commercial Terms
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 9: Payments & Invoices */}
          {activeTab === 'payments' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Payments & Subscription Invoices</h2>
                <p className="text-sm text-[#94A3B8] mt-1">Verified payment provider transactions and mandate statuses.</p>
              </div>

              <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs mb-6">
                  <CreditCard className="w-5 h-5 shrink-0" />
                  <span>
                    All Razorpay orders enforce cryptographic HMAC-SHA256 signature verification and charging using the agreed per-business negotiated rate.
                  </span>
                </div>

                <div className="space-y-3">
                  {approvedBusinesses.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl bg-[#090D14] border border-[#1E293B] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{b.business_name}</div>
                        <div className="text-[#64748B]">Owner: {b.owner_name} ({b.contact_number})</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-emerald-400 font-bold">
                          {formatINR(b.subscription?.agreed_price_inr || 1999)}
                        </div>
                        <div className="text-[10px] text-[#64748B]">Status: {b.subscription?.status || 'Active'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 10: Production Onboarding */}
          {activeTab === 'onboarding' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Production Onboarding Gate</h2>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Exclusive platform developer action to launch live production access after checklist verification.
                </p>
              </div>

              <div className="space-y-4">
                {businesses.map((b) => (
                  <div
                    key={b.id}
                    className="p-6 rounded-2xl bg-[#0F172A] border border-[#1E293B] flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-white text-base">{b.business_name}</h3>
                        {b.onboarded_at ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            PROD LAUNCHED
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            AWAITING LAUNCH
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-1">
                        Tables: {b.tables_count} • Owner: {b.owner_name} • Contact: {b.contact_number}
                      </p>
                      {b.onboarded_at && (
                        <p className="text-[10px] text-emerald-400 mt-1">
                          Launched by {b.onboarded_by} on {new Date(b.onboarded_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedBizForLaunch(b);
                        setLaunchResult(null);
                        setLaunchError(null);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-900/30 transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      <span>{b.onboarded_at ? 'Re-Launch / View QRs' : 'Launch Production'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 11: Audit Logs */}
          {activeTab === 'audit' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Immutable Developer Audit Trail</h2>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Tamper-resistant audit log capturing all developer administrative and commercial adjustments.
                </p>
              </div>

              <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0A101D] text-[#64748B] font-semibold border-b border-[#1E293B]">
                      <tr>
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Developer</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Target Business</th>
                        <th className="p-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]">
                      {auditLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-[#1E293B]/20 transition-colors">
                          <td className="p-4 font-mono text-[#94A3B8]">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : 'Recent'}
                          </td>
                          <td className="p-4 font-semibold text-white">{log.developer_email}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1E293B] text-emerald-400">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-xs text-[#94A3B8]">
                            {log.target_business_id ? log.target_business_id.slice(0, 12) + '...' : 'Global'}
                          </td>
                          <td className="p-4 font-mono text-[11px] text-[#94A3B8] max-w-md truncate">
                            {JSON.stringify(log.details || {})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Section 12: System Health */}
          {activeTab === 'health' && (
            <div className="space-y-6 max-w-7xl">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">System Health & Diagnostic Telemetry</h2>
                <p className="text-sm text-[#94A3B8] mt-1">Real-time status of backend services and provider APIs.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Database & Core Service</h3>
                  
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-[#090D14] border border-[#1E293B]">
                      <span>Supabase PostgreSQL</span>
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Connected
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-[#090D14] border border-[#1E293B]">
                      <span>Database Ping Latency</span>
                      <span className="font-mono text-white font-bold">
                        {healthData?.database?.latencyMs ?? 0} ms
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-[#090D14] border border-[#1E293B]">
                      <span>Total Businesses in DB</span>
                      <span className="font-mono text-white font-bold">
                        {healthData?.database?.totalBusinesses ?? counts.total}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Third-Party Gateway Health</h3>
                  
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-[#090D14] border border-[#1E293B]">
                      <span>Meta WhatsApp Graph API</span>
                      <span className={`font-bold flex items-center gap-1 ${healthData?.integrations?.whatsapp?.configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {healthData?.integrations?.whatsapp?.configured ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {healthData?.integrations?.whatsapp?.configured ? 'Configured' : 'Missing Token'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-[#090D14] border border-[#1E293B]">
                      <span>Google Sheets Service Account</span>
                      <span className={`font-bold flex items-center gap-1 ${healthData?.integrations?.googleSheets?.configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {healthData?.integrations?.googleSheets?.configured ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {healthData?.integrations?.googleSheets?.configured ? 'Active' : 'Unconfigured'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-[#090D14] border border-[#1E293B]">
                      <span>Telegram Bot Service</span>
                      <span className={`font-bold flex items-center gap-1 ${healthData?.integrations?.telegram?.configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {healthData?.integrations?.telegram?.configured ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {healthData?.integrations?.telegram?.configured ? 'Connected' : 'Missing Token'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Modal: Edit Commercial Terms */}
      {selectedBizForPricing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedBizForPricing(null)}
              className="absolute right-4 top-4 text-[#94A3B8] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Configure Commercial Terms</h3>
            <p className="text-xs text-[#94A3B8] mb-6">
              Setting custom negotiated agreement for <strong>{selectedBizForPricing.business_name}</strong>
            </p>

            <form onSubmit={handleSaveCustomPricing} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1 uppercase tracking-wider">
                  Agreed Monthly Amount (₹ INR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={agreedPriceInr}
                  onChange={(e) => setAgreedPriceInr(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#090D14] border border-[#1E293B] text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-[#64748B] mt-1 block">
                  Example: 699 for ₹699/mo. Stored in minor currency units (paisa).
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1 uppercase tracking-wider">
                    Trial Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    required
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#090D14] border border-[#1E293B] text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[#94A3B8] font-semibold mb-1 uppercase tracking-wider">
                    Grace Period (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    required
                    value={graceDays}
                    onChange={(e) => setGraceDays(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#090D14] border border-[#1E293B] text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1 uppercase tracking-wider">
                  Billing Interval
                </label>
                <select
                  value={billingInterval}
                  onChange={(e) => setBillingInterval(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#090D14] border border-[#1E293B] text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="monthly">Monthly Recurring</option>
                  <option value="yearly">Yearly Recurring</option>
                </select>
              </div>

              <div>
                <label className="block text-[#94A3B8] font-semibold mb-1 uppercase tracking-wider">
                  Negotiation Notes
                </label>
                <textarea
                  rows={2}
                  value={pricingNotes}
                  onChange={(e) => setPricingNotes(e.target.value)}
                  placeholder="e.g. Special launch promotion discount agreed with club owner."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#090D14] border border-[#1E293B] text-white placeholder-[#64748B] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setSelectedBizForPricing(null)}
                  className="px-4 py-2 rounded-xl bg-[#1E293B] text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'saving_pricing'}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg"
                >
                  Save Commercial Terms
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Production Onboarding Launch Checklist */}
      {selectedBizForLaunch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedBizForLaunch(null)}
              className="absolute right-4 top-4 text-[#94A3B8] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center font-bold">
                <Rocket className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Production Onboarding Authorization</h3>
                <p className="text-xs text-[#94A3B8]">Target: {selectedBizForLaunch.business_name}</p>
              </div>
            </div>

            {launchError && (
              <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <div className="font-bold mb-1">Pre-Launch Validation Failed:</div>
                <p>{launchError}</p>
              </div>
            )}

            {launchResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  <div className="font-bold text-sm mb-1">Production Onboarding Successful!</div>
                  <p>{launchResult.message}</p>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">
                    Trial Active Until: {new Date(launchResult.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Authoritative Table QR Codes</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(launchResult.qrs || []).map((qr: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-[#090D14] border border-[#1E293B] text-center">
                        <img src={qr.dataUrl} alt={qr.tableName} className="w-24 h-24 mx-auto mb-2" />
                        <div className="text-xs font-bold text-white truncate">{qr.tableName}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-[#090D14] border border-[#1E293B] space-y-2">
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Pre-Launch Checklist</h4>
                  
                  <div className="flex items-center justify-between text-[#94A3B8]">
                    <span>1. Business Approval Status</span>
                    <span className="font-bold text-emerald-400 font-mono">{selectedBizForLaunch.status}</span>
                  </div>

                  <div className="flex items-center justify-between text-[#94A3B8]">
                    <span>2. Configured Tables</span>
                    <span className="font-bold text-white">{selectedBizForLaunch.tables_count} Tables</span>
                  </div>

                  <div className="flex items-center justify-between text-[#94A3B8]">
                    <span>3. Google Sheet Linked</span>
                    <span className="font-mono text-emerald-400">{selectedBizForLaunch.google_sheet_id.slice(0, 14)}...</span>
                  </div>

                  <div className="flex items-center justify-between text-[#94A3B8]">
                    <span>4. Commercial Terms</span>
                    <span className="font-mono text-emerald-400">
                      {selectedBizForLaunch.subscription?.agreed_price_inr
                        ? formatINR(selectedBizForLaunch.subscription.agreed_price_inr)
                        : 'Standard'}
                    </span>
                  </div>
                </div>

                <p className="text-[#94A3B8] leading-relaxed">
                  Launching production onboarding activates the business&apos;s trial period, provisions authoritative table QR codes, and authorizes owner dashboard access.
                </p>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#1E293B]">
                  <button
                    type="button"
                    onClick={() => setSelectedBizForLaunch(null)}
                    className="px-4 py-2 rounded-xl bg-[#1E293B] text-white font-semibold"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleLaunchProduction}
                    disabled={actionLoading === 'launching_production'}
                    className="px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-900/30 transition-all flex items-center gap-2"
                  >
                    <Rocket className="w-4 h-4" />
                    <span>Authorize & Launch Production</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
