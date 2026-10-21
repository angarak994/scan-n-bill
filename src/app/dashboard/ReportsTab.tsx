'use client';

import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  RefreshCw,
  Info,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  FileSpreadsheet,
  SlidersHorizontal,
  Layers,
  ArrowRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ReportPreset, formatINR } from '@/lib/services/reportsDateUtils';
import type { FinancialReportsSummary } from '@/lib/services/reportsService';
import { clientSummaryCache, clientTransactionsCache, invalidateReportsCache, REPORTS_CACHE_INVALIDATED_EVENT } from '@/lib/reportsCache';

export { invalidateReportsCache };

interface ReportsTabProps {
  onToggleLegacy?: () => void;
  isPrivacyMode?: boolean;
}

export default function ReportsTab({ onToggleLegacy, isPrivacyMode = false }: ReportsTabProps) {
  // Preset and Range State
  const [period, setPeriod] = useState<ReportPreset>('thisMonth');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showCustomRangePicker, setShowCustomRangePicker] = useState<boolean>(false);
  const [compare, setCompare] = useState<boolean>(true);

  // Check module cache for initial state
  const cacheKey = `${period}:${compare}:${customStart || ''}:${customEnd || ''}`;
  const cachedInitial = clientSummaryCache.get(cacheKey);
  const isInitialValid = Boolean(cachedInitial && (Date.now() - cachedInitial.timestamp < 60000));

  // Data State
  const [summary, setSummary] = useState<FinancialReportsSummary | null>(isInitialValid && cachedInitial ? cachedInitial.data : null);
  const [isLoading, setIsLoading] = useState<boolean>(!isInitialValid);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Chart interactivity state
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [showChartTable, setShowChartTable] = useState<boolean>(false);

  // Drilldown drawer state
  const [drilldownMetric, setDrilldownMetric] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<any | null>(null);
  const [isDrilldownLoading, setIsDrilldownLoading] = useState<boolean>(false);

  // Reconciliation modal state
  const [showReconciliationModal, setShowReconciliationModal] = useState<boolean>(false);

  // Transactions table state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txTotalCount, setTxTotalCount] = useState<number>(0);
  const [txPage, setTxPage] = useState<number>(1);
  const [txPageSize] = useState<number>(10);
  const [txSearch, setTxSearch] = useState<string>('');
  const [txMethodFilter, setTxMethodFilter] = useState<string>('all');
  const [txStatusFilter, setTxStatusFilter] = useState<string>('all');
  const [isTxLoading, setIsTxLoading] = useState<boolean>(false);
  const [selectedRecordTrail, setSelectedRecordTrail] = useState<any | null>(null);

  // Fetch Summary Data (with 60s client cache for instant tab navigation)
  const fetchSummary = useCallback(async (isManualRefresh = false) => {
    const key = `${period}:${compare}:${customStart || ''}:${customEnd || ''}`;
    const cached = clientSummaryCache.get(key);
    const isValid = !isManualRefresh && Boolean(cached && (Date.now() - cached.timestamp < 60000));

    if (isValid && cached) {
      setSummary(cached.data);
      setIsLoading(false);
      return;
    }

    if (isManualRefresh) setIsRefreshing(true);
    else if (!cached) setIsLoading(true);
    setError(null);

    try {
      let url = `/api/reports/summary?period=${period}&compare=${compare}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }

      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }
      const data = await res.json();
      clientSummaryCache.set(key, { data, timestamp: Date.now() });
      setSummary(data);
    } catch (err: any) {
      console.error('[ReportsTab] Fetch error:', err);
      setError(err.message || 'Failed to load financial reports');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [period, customStart, customEnd, compare]);

  // Fetch Transactions Data (with 60s client cache)
  const fetchTransactions = useCallback(async (isManualRefresh = false) => {
    const txKey = `${period}:${customStart || ''}:${customEnd || ''}:${txPage}:${txPageSize}:${txMethodFilter}:${txStatusFilter}:${txSearch}`;
    const cached = clientTransactionsCache.get(txKey);
    const isValid = !isManualRefresh && Boolean(cached && (Date.now() - cached.timestamp < 60000));

    if (isValid && cached) {
      setTransactions(cached.transactions);
      setTxTotalCount(cached.totalCount);
      setIsTxLoading(false);
      return;
    }

    setIsTxLoading(true);
    try {
      let url = `/api/reports/transactions?period=${period}&page=${txPage}&pageSize=${txPageSize}&method=${txMethodFilter}&status=${txStatusFilter}`;
      if (txSearch) url += `&search=${encodeURIComponent(txSearch)}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }

      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const txList = json.transactions || [];
        const total = json.pagination?.totalCount || 0;
        clientTransactionsCache.set(txKey, { transactions: txList, totalCount: total, timestamp: Date.now() });
        setTransactions(txList);
        setTxTotalCount(total);
      }
    } catch (err) {
      console.error('[ReportsTab] Transactions fetch error:', err);
    } finally {
      setIsTxLoading(false);
    }
  }, [period, customStart, customEnd, txPage, txPageSize, txSearch, txMethodFilter, txStatusFilter]);

  // Fetch Drilldown details
  const openDrilldown = useCallback(async (metric: string) => {
    setDrilldownMetric(metric);
    setIsDrilldownLoading(true);
    setDrilldownData(null);
    try {
      let url = `/api/reports/drilldown?period=${period}&metric=${metric}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setDrilldownData(json);
      }
    } catch (err) {
      console.error('[ReportsTab] Drilldown fetch error:', err);
    } finally {
      setIsDrilldownLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Realtime Cache Invalidation Listener: Automatically refetches if sessions/payments change
  useEffect(() => {
    const handleInvalidation = () => {
      fetchSummary(true);
      fetchTransactions(true);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(REPORTS_CACHE_INVALIDATED_EVENT, handleInvalidation);
      return () => {
        window.removeEventListener(REPORTS_CACHE_INVALIDATED_EVENT, handleInvalidation);
      };
    }
  }, [fetchSummary, fetchTransactions]);

  // CSV Export
  const handleExportCSV = useCallback(async () => {
    try {
      toast.loading('Preparing safe CSV export...', { id: 'csv-export' });
      let url = `/api/reports/export?period=${period}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export request failed');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `revenue_report_${period}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Report downloaded cleanly!', { id: 'csv-export' });
    } catch (e: any) {
      toast.error(e.message || 'CSV Export failed', { id: 'csv-export' });
    }
  }, [period, customStart, customEnd]);

  // Helper for Privacy Mask
  const formatMoney = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '—';
    if (isPrivacyMode) return '••••••';
    return formatINR(amount);
  };

  const presetsList: Array<{ id: ReportPreset; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last7', label: 'Last 7 days' },
    { id: 'last30', label: 'Last 30 days' },
    { id: 'thisMonth', label: 'This month' },
    { id: 'previousMonth', label: 'Previous month' },
    { id: 'custom', label: 'Custom range' },
    { id: 'allTime', label: 'All time' }
  ];

  return (
    <div className="flex flex-col gap-6 text-text-primary pb-16">
      {/* ---------------------------------------------------------------- */}
      {/* 1. TOP HEADER & STICKY FILTER BAR                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="sticky top-0 z-30 bg-bg-primary/95 backdrop-blur-md pt-2 pb-4 border-b border-border-theme transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-text-secondary uppercase">
              {summary?.businessName || 'QCONTROL'}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">Reports & KPIs</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-bg-surface border border-border-theme-theme text-text-secondary font-mono">
                {summary ? `Data as of ${summary.asOf}` : 'Loading...'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onToggleLegacy && (
              <button
                onClick={onToggleLegacy}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border-theme bg-bg-surface text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors"
              >
                Classic Report
              </button>
            )}

            <button
              onClick={() => fetchSummary(true)}
              disabled={isLoading || isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-theme bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-accent' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent text-black hover:bg-accent/90 transition-colors shadow-sm"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Presets Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mt-4 pt-3 border-t border-border-light">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {presetsList.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setPeriod(p.id);
                  setTxPage(1);
                  if (p.id === 'custom') {
                    setShowCustomRangePicker(true);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  period === p.id
                    ? 'bg-accent/15 text-accent border border-accent/30 font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Comparison Checkbox */}
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            {period !== 'allTime' && (
              <label className="flex items-center gap-2 cursor-pointer select-none hover:text-text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={compare}
                  onChange={e => setCompare(e.target.checked)}
                  className="rounded border-border-theme accent-accent cursor-pointer"
                />
                <span>Compare to previous period</span>
              </label>
            )}
          </div>
        </div>

        {/* Custom Range Popover */}
        {showCustomRangePicker && period === 'custom' && (
          <div className="mt-3 p-4 bg-bg-card border border-border-theme rounded-xl shadow-lg flex flex-wrap items-center gap-3 animate-entrance">
            <span className="text-xs font-medium text-text-secondary">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-border-theme bg-bg-surface text-xs font-mono text-text-primary outline-none focus:border-accent"
            />
            <span className="text-xs font-medium text-text-secondary">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-border-theme bg-bg-surface text-xs font-mono text-text-primary outline-none focus:border-accent"
            />
            <button
              onClick={() => {
                if (!customStart || !customEnd) {
                  toast.error('Please select both start and end date');
                  return;
                }
                setShowCustomRangePicker(false);
                fetchSummary();
                fetchTransactions();
              }}
              className="px-3 py-1.5 bg-accent text-black font-semibold text-xs rounded-lg hover:bg-accent/90 transition-colors"
            >
              Apply Filter
            </button>
            <button
              onClick={() => setShowCustomRangePicker(false)}
              className="p-1.5 text-text-secondary hover:text-text-primary"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Dimmed Loading Transition Wrapper */}
      <div className={`transition-opacity duration-200 ${isLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        
        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchSummary()}
              className="px-3 py-1 rounded-md bg-danger text-white text-xs font-bold hover:bg-danger/90"
            >
              Retry
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* 2. PRIMARY KPI ROW (4 BIG TILES)                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Tile 1: REVENUE */}
          <div
            onClick={() => openDrilldown('revenue')}
            className="group relative bg-bg-card border border-border-theme p-5 rounded-2xl hover:border-accent/40 transition-all cursor-pointer shadow-sm hover-lift"
          >
            <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Revenue</span>
              <div title={summary?.primary.revenue.tooltip} className="text-text-disabled group-hover:text-text-secondary">
                <Info size={14} />
              </div>
            </div>

            <div className="text-3xl font-extrabold font-mono tracking-tight text-text-primary">
              {formatMoney(summary?.primary.revenue.value)}
            </div>

            <div className="flex items-center justify-between mt-3 text-xs">
              {summary?.primary.revenue.deltaFormatted !== '—' && summary?.hasComparison ? (
                <div
                  className={`flex items-center gap-1 font-semibold ${
                    summary.primary.revenue.isPositive ? 'text-accent' : 'text-danger'
                  }`}
                >
                  {summary.primary.revenue.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span>{summary.primary.revenue.deltaFormatted}</span>
                  <span className="text-text-secondary font-normal font-sans ml-1 text-[11px]">
                    {summary.comparisonLabel}
                  </span>
                </div>
              ) : (
                <span className="text-text-secondary text-[11px]">{summary?.primary.revenue.subtext}</span>
              )}

              {/* Sparkline Inline SVG */}
              {summary?.primary.revenue.sparkline && summary.primary.revenue.sparkline.length > 1 && (
                <svg className="w-16 h-6 overflow-visible" viewBox="0 0 60 24">
                  {(() => {
                    const data = summary.primary.revenue.sparkline;
                    const max = Math.max(...data, 1);
                    const min = Math.min(...data, 0);
                    const rangeVal = max - min || 1;
                    const points = data
                      .map((val, idx) => {
                        const x = (idx / (data.length - 1)) * 60;
                        const y = 24 - ((val - min) / rangeVal) * 20 - 2;
                        return `${x},${y}`;
                      })
                      .join(' ');
                    return (
                      <polyline
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                      />
                    );
                  })()}
                </svg>
              )}
            </div>
            <div className="text-[11px] text-text-secondary mt-1">{summary?.primary.revenue.subtext}</div>
          </div>

          {/* Tile 2: COLLECTED */}
          <div
            onClick={() => openDrilldown('collected')}
            className="group relative bg-bg-card border border-border-theme p-5 rounded-2xl hover:border-accent/40 transition-all cursor-pointer shadow-sm hover-lift"
          >
            <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Collected</span>
              <div title={summary?.primary.collected.tooltip} className="text-text-disabled group-hover:text-text-secondary">
                <Info size={14} />
              </div>
            </div>

            <div className="text-3xl font-extrabold font-mono tracking-tight text-text-primary">
              {formatMoney(summary?.primary.collected.value)}
            </div>

            <div className="flex items-center justify-between mt-3 text-xs">
              {summary?.primary.collected.deltaFormatted !== '—' && summary?.hasComparison ? (
                <div
                  className={`flex items-center gap-1 font-semibold ${
                    summary.primary.collected.isPositive ? 'text-accent' : 'text-danger'
                  }`}
                >
                  {summary.primary.collected.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span>{summary.primary.collected.deltaFormatted}</span>
                  <span className="text-text-secondary font-normal font-sans ml-1 text-[11px]">
                    {summary.comparisonLabel}
                  </span>
                </div>
              ) : (
                <span className="text-text-secondary text-[11px]">{summary?.primary.collected.subtext}</span>
              )}

              {/* Sparkline Inline SVG */}
              {summary?.primary.collected.sparkline && summary.primary.collected.sparkline.length > 1 && (
                <svg className="w-16 h-6 overflow-visible" viewBox="0 0 60 24">
                  {(() => {
                    const data = summary.primary.collected.sparkline;
                    const max = Math.max(...data, 1);
                    const min = Math.min(...data, 0);
                    const rangeVal = max - min || 1;
                    const points = data
                      .map((val, idx) => {
                        const x = (idx / (data.length - 1)) * 60;
                        const y = 24 - ((val - min) / rangeVal) * 20 - 2;
                        return `${x},${y}`;
                      })
                      .join(' ');
                    return (
                      <polyline
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                      />
                    );
                  })()}
                </svg>
              )}
            </div>
            <div className="text-[11px] text-text-secondary mt-1">{summary?.primary.collected.subtext}</div>
          </div>

          {/* Tile 3: PENDING DUES */}
          <div
            onClick={() => openDrilldown('pendingDues')}
            className="group relative bg-bg-card border border-border-theme p-5 rounded-2xl hover:border-warning/40 transition-all cursor-pointer shadow-sm hover-lift"
          >
            <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Pending Dues</span>
              <div title={summary?.primary.pendingDues.tooltip} className="text-text-disabled group-hover:text-text-secondary">
                <Info size={14} />
              </div>
            </div>

            <div className="text-3xl font-extrabold font-mono tracking-tight text-warning">
              {formatMoney(summary?.primary.pendingDues.value)}
            </div>

            <div className="flex items-center justify-between mt-3 text-xs">
              {summary?.primary.pendingDues.deltaFormatted !== '—' && summary?.hasComparison ? (
                <div
                  className={`flex items-center gap-1 font-semibold ${
                    summary.primary.pendingDues.isPositive ? 'text-accent' : 'text-warning'
                  }`}
                >
                  {summary.primary.pendingDues.isPositive ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  <span>{summary.primary.pendingDues.deltaFormatted}</span>
                  <span className="text-text-secondary font-normal font-sans ml-1 text-[11px]">
                    {summary.comparisonLabel}
                  </span>
                </div>
              ) : (
                <span className="text-text-secondary text-[11px]">{summary?.primary.pendingDues.subtext}</span>
              )}

              {/* Sparkline Inline SVG */}
              {summary?.primary.pendingDues.sparkline && summary.primary.pendingDues.sparkline.length > 1 && (
                <svg className="w-16 h-6 overflow-visible" viewBox="0 0 60 24">
                  {(() => {
                    const data = summary.primary.pendingDues.sparkline;
                    const max = Math.max(...data, 1);
                    const min = Math.min(...data, 0);
                    const rangeVal = max - min || 1;
                    const points = data
                      .map((val, idx) => {
                        const x = (idx / (data.length - 1)) * 60;
                        const y = 24 - ((val - min) / rangeVal) * 20 - 2;
                        return `${x},${y}`;
                      })
                      .join(' ');
                    return (
                      <polyline
                        fill="none"
                        stroke="var(--warning)"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                      />
                    );
                  })()}
                </svg>
              )}
            </div>
            <div className="text-[11px] text-text-secondary mt-1">{summary?.primary.pendingDues.subtext}</div>
          </div>

          {/* Tile 4: NET CASH FLOW */}
          <div
            onClick={() => openDrilldown('collected')}
            className="group relative bg-bg-card border border-border-theme p-5 rounded-2xl hover:border-accent/40 transition-all cursor-pointer shadow-sm hover-lift"
          >
            <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Net Cash Flow</span>
              <div title={summary?.primary.netCashFlow.tooltip} className="text-text-disabled group-hover:text-text-secondary">
                <Info size={14} />
              </div>
            </div>

            <div className="text-3xl font-extrabold font-mono tracking-tight text-text-primary">
              {formatMoney(summary?.primary.netCashFlow.value)}
            </div>

            <div className="flex items-center justify-between mt-3 text-xs">
              {summary?.primary.netCashFlow.deltaFormatted !== '—' && summary?.hasComparison ? (
                <div
                  className={`flex items-center gap-1 font-semibold ${
                    summary.primary.netCashFlow.isPositive ? 'text-accent' : 'text-danger'
                  }`}
                >
                  {summary.primary.netCashFlow.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span>{summary.primary.netCashFlow.deltaFormatted}</span>
                  <span className="text-text-secondary font-normal font-sans ml-1 text-[11px]">
                    {summary.comparisonLabel}
                  </span>
                </div>
              ) : (
                <span className="text-text-secondary text-[11px]">{summary?.primary.netCashFlow.subtext}</span>
              )}

              {/* Sparkline Inline SVG */}
              {summary?.primary.netCashFlow.sparkline && summary.primary.netCashFlow.sparkline.length > 1 && (
                <svg className="w-16 h-6 overflow-visible" viewBox="0 0 60 24">
                  {(() => {
                    const data = summary.primary.netCashFlow.sparkline;
                    const max = Math.max(...data, 1);
                    const min = Math.min(...data, 0);
                    const rangeVal = max - min || 1;
                    const points = data
                      .map((val, idx) => {
                        const x = (idx / (data.length - 1)) * 60;
                        const y = 24 - ((val - min) / rangeVal) * 20 - 2;
                        return `${x},${y}`;
                      })
                      .join(' ');
                    return (
                      <polyline
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                      />
                    );
                  })()}
                </svg>
              )}
            </div>
            <div className="text-[11px] text-text-secondary mt-1">{summary?.primary.netCashFlow.subtext}</div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 3. SECONDARY ROW (COMPACT 6 TILES)                               */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          
          {/* Discounts */}
          <div
            onClick={() => openDrilldown('discounts')}
            className="p-3.5 rounded-xl bg-bg-card border border-border-theme hover:border-accent/30 cursor-pointer transition-colors shadow-sm"
          >
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Discounts</div>
            <div className="text-xl font-bold font-mono text-text-primary">
              {formatMoney(summary?.secondary.discounts.value)}
            </div>
          </div>

          {/* Refunds */}
          <div
            onClick={() => openDrilldown('refunds')}
            className="p-3.5 rounded-xl bg-bg-card border border-border-theme hover:border-danger/30 cursor-pointer transition-colors shadow-sm"
          >
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Refunds</div>
            <div className="text-xl font-bold font-mono text-danger">
              {formatMoney(summary?.secondary.refunds.value)}
            </div>
          </div>

          {/* Expenses (Honesty State: Not tracked) */}
          <div className="p-3.5 rounded-xl bg-bg-card border border-border-theme shadow-sm">
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Expenses</div>
            <div className="text-sm font-semibold text-text-disabled mt-1">Not tracked</div>
            <div className="text-[10px] text-text-disabled mt-0.5 truncate">{summary?.secondary.expenses.reason}</div>
          </div>

          {/* Sessions */}
          <div
            onClick={() => openDrilldown('sessions')}
            className="p-3.5 rounded-xl bg-bg-card border border-border-theme hover:border-accent/30 cursor-pointer transition-colors shadow-sm"
          >
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Sessions</div>
            <div className="text-xl font-bold font-mono text-text-primary">
              {summary?.secondary.sessions.total || 0}
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5 truncate">{summary?.secondary.sessions.subtext}</div>
          </div>

          {/* Avg Per Session */}
          <div className="p-3.5 rounded-xl bg-bg-card border border-border-theme shadow-sm">
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Avg per session</div>
            <div className="text-xl font-bold font-mono text-text-primary">
              {formatMoney(summary?.secondary.avgPerSession.value)}
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5">{summary?.secondary.avgPerSession.subtext}</div>
          </div>

          {/* F&B Revenue */}
          <div
            onClick={() => openDrilldown('fb')}
            className="p-3.5 rounded-xl bg-bg-card border border-border-theme hover:border-accent/30 cursor-pointer transition-colors shadow-sm"
          >
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">F&B Revenue</div>
            <div className="text-xl font-bold font-mono text-text-primary">
              {formatMoney(summary?.secondary.fbRevenue.value)}
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5">{summary?.secondary.fbRevenue.subtext}</div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 4. "HOW THE MONEY MOVES" STRIP                                   */}
        {/* ---------------------------------------------------------------- */}
        {summary?.moneyMovement && summary.moneyMovement.isProvable && (
          <div className="p-4 rounded-xl bg-bg-card border border-border-theme mt-4 shadow-sm">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-text-primary uppercase tracking-wider text-[11px]">
                How the money moves
              </span>
              <span className="font-mono text-text-secondary">
                {summary.moneyMovement.header}
              </span>
            </div>

            {/* Split Progress Bar */}
            <div className="w-full h-8 bg-bg-surface rounded-lg overflow-hidden flex p-1 border border-border-light gap-1">
              <div
                style={{ width: `${Math.max(5, summary.moneyMovement.collectedPct)}%` }}
                className="h-full bg-accent/80 hover:bg-accent rounded-md flex items-center px-3 text-black text-xs font-bold transition-all truncate"
              >
                Collected {formatMoney(summary.moneyMovement.collected)} · {summary.moneyMovement.collectedPct}%
              </div>
              {summary.moneyMovement.pendingPct > 0 && (
                <div
                  style={{ width: `${Math.max(5, summary.moneyMovement.pendingPct)}%` }}
                  className="h-full bg-warning/80 hover:bg-warning rounded-md flex items-center justify-end px-3 text-black text-xs font-bold transition-all truncate"
                >
                  {summary.moneyMovement.pendingPct}%
                </div>
              )}
            </div>

            <div className="text-[11px] text-text-secondary mt-2">
              {summary.moneyMovement.footer}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* 5. TRENDS (REVENUE VS COLLECTIONS) & PAYMENT METHODS             */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          
          {/* Revenue vs Collections Line Chart (7 cols) */}
          <div className="lg:col-span-7 p-5 rounded-2xl bg-bg-card border border-border-theme shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                    Revenue vs Collections
                  </h3>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    Operational accrual vs cash basis received over time
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-accent rounded-full"></span>
                    <span className="text-text-secondary">Revenue</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-secondary rounded-full"></span>
                    <span className="text-text-secondary">Collected</span>
                  </div>
                  {summary?.hasComparison && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 border-t border-dashed border-text-disabled"></span>
                      <span className="text-text-disabled">Previous</span>
                    </div>
                  )}
                  <button
                    onClick={() => setShowChartTable(!showChartTable)}
                    className="text-[11px] text-text-disabled hover:text-text-primary underline ml-2"
                  >
                    {showChartTable ? 'Show Chart' : 'View as Table'}
                  </button>
                </div>
              </div>

              {/* Chart Rendering / Accessible Table Toggle */}
              {showChartTable ? (
                <div className="max-h-64 overflow-y-auto mt-2 border border-border-light rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-bg-surface text-text-secondary border-b border-border-light sticky top-0">
                      <tr>
                        <th className="p-2">Period</th>
                        <th className="p-2 text-right">Revenue</th>
                        <th className="p-2 text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light font-mono">
                      {summary?.trends.points.map((pt, i) => (
                        <tr key={i} className="hover:bg-bg-surface">
                          <td className="p-2 font-sans">{pt.label}</td>
                          <td className="p-2 text-right text-accent">{formatMoney(pt.revenue)}</td>
                          <td className="p-2 text-right text-secondary">{formatMoney(pt.collected)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="relative h-56 w-full mt-4">
                  {(() => {
                    const pts = summary?.trends.points || [];
                    if (pts.length === 0) {
                      return (
                        <div className="h-full flex items-center justify-center text-xs text-text-disabled">
                          No session activity in this interval
                        </div>
                      );
                    }

                    const maxRev = Math.max(...pts.map(p => p.revenue), 1);
                    const maxColl = Math.max(...pts.map(p => p.collected), 1);
                    const overallMax = Math.max(maxRev, maxColl, 100);

                    // Y ticks
                    const yTicks = [0, Math.round(overallMax * 0.33), Math.round(overallMax * 0.66), overallMax];

                    // Width & Height
                    const svgW = 600;
                    const svgH = 180;
                    const padL = 40;
                    const padR = 20;
                    const padT = 10;
                    const padB = 25;
                    const plotW = svgW - padL - padR;
                    const plotH = svgH - padT - padB;

                    const getX = (idx: number) => padL + (idx / Math.max(1, pts.length - 1)) * plotW;
                    const getY = (val: number) => padT + plotH - (val / overallMax) * plotH;

                    const revPoints = pts.map((p, i) => `${getX(i)},${getY(p.revenue)}`).join(' ');
                    const collPoints = pts.map((p, i) => `${getX(i)},${getY(p.collected)}`).join(' ');

                    return (
                      <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${svgW} ${svgH}`}>
                        {/* Grid lines */}
                        {yTicks.map((tick, i) => {
                          const y = getY(tick);
                          return (
                            <g key={i}>
                              <line
                                x1={padL}
                                y1={y}
                                x2={svgW - padR}
                                y2={y}
                                stroke="var(--border)"
                                strokeWidth="1"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={padL - 6}
                                y={y + 3}
                                textAnchor="end"
                                fontSize="10"
                                fill="var(--text-disabled)"
                                fontFamily="monospace"
                              >
                                {tick >= 1000 ? `₹${Math.round(tick / 1000)}k` : `₹${tick}`}
                              </text>
                            </g>
                          );
                        })}

                        {/* Revenue line */}
                        <polyline
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={revPoints}
                        />

                        {/* Collected line */}
                        <polyline
                          fill="none"
                          stroke="var(--secondary)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={collPoints}
                        />

                        {/* Interactive Data points */}
                        {pts.map((pt, i) => (
                          <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredTrendIndex(i)}>
                            <circle
                              cx={getX(i)}
                              cy={getY(pt.revenue)}
                              r={hoveredTrendIndex === i ? 5 : 3}
                              fill="var(--bg-card)"
                              stroke="var(--accent)"
                              strokeWidth="2"
                            />
                            <circle
                              cx={getX(i)}
                              cy={getY(pt.collected)}
                              r={hoveredTrendIndex === i ? 5 : 3}
                              fill="var(--bg-card)"
                              stroke="var(--secondary)"
                              strokeWidth="2"
                            />
                            {/* X-axis labels (show subset to avoid overlap) */}
                            {(i === 0 || i === Math.floor(pts.length / 2) || i === pts.length - 1) && (
                              <text
                                x={getX(i)}
                                y={svgH - 4}
                                textAnchor="middle"
                                fontSize="10"
                                fill="var(--text-secondary)"
                              >
                                {pt.label}
                              </text>
                            )}
                          </g>
                        ))}
                      </svg>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Hover Tooltip display */}
            {hoveredTrendIndex !== null && summary?.trends.points[hoveredTrendIndex] && (
              <div className="mt-3 p-2 bg-bg-surface border border-border-theme rounded-lg text-xs flex items-center justify-between font-mono animate-entrance">
                <span className="font-sans font-medium text-text-primary">
                  {summary.trends.points[hoveredTrendIndex].label}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-accent">
                    Revenue: {formatMoney(summary.trends.points[hoveredTrendIndex].revenue)}
                  </span>
                  <span className="text-secondary">
                    Collected: {formatMoney(summary.trends.points[hoveredTrendIndex].collected)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Methods Breakdown (5 cols) */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-bg-card border border-border-theme shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Payment Methods · Collected
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-theme">
                    <tr>
                      <th className="py-2">Method</th>
                      <th className="py-2 text-right">Collected</th>
                      <th className="py-2 text-right">Txns</th>
                      <th className="py-2 text-right">Share</th>
                      <th className="py-2 text-right">Refunds</th>
                      <th className="py-2 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light font-mono">
                    {summary?.paymentMethods.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-bg-surface/50">
                        <td className="py-2.5 font-sans font-medium text-text-primary flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                row.method === 'UPI'
                                  ? 'var(--secondary)'
                                  : row.method === 'Cash'
                                  ? 'var(--accent)'
                                  : row.method === 'Card'
                                  ? 'var(--warning)'
                                  : 'var(--text-disabled)'
                            }}
                          />
                          <span>{row.method}</span>
                        </td>
                        <td className="py-2.5 text-right font-bold text-text-primary">
                          {formatMoney(row.collected)}
                        </td>
                        <td className="py-2.5 text-right text-text-secondary">{row.txnCount}</td>
                        <td className="py-2.5 text-right text-text-secondary">{row.sharePct}%</td>
                        <td className="py-2.5 text-right text-danger">
                          {row.refunds > 0 ? `-${formatMoney(row.refunds)}` : '—'}
                        </td>
                        <td className="py-2.5 text-right font-bold text-text-primary">
                          {formatMoney(row.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Total Row */}
                  <tfoot className="border-t-2 border-border-theme font-mono font-bold text-xs bg-bg-surface/30">
                    <tr>
                      <td className="py-2.5 font-sans">Total</td>
                      <td className="py-2.5 text-right text-accent">
                        {formatMoney(summary?.paymentMethods.totalRow.collected)}
                      </td>
                      <td className="py-2.5 text-right text-text-primary">
                        {summary?.paymentMethods.totalRow.txnCount}
                      </td>
                      <td className="py-2.5 text-right text-text-primary">100%</td>
                      <td className="py-2.5 text-right text-danger">
                        {summary?.paymentMethods.totalRow.refunds && summary.paymentMethods.totalRow.refunds < 0
                          ? formatMoney(summary.paymentMethods.totalRow.refunds)
                          : '—'}
                      </td>
                      <td className="py-2.5 text-right text-text-primary">
                        {formatMoney(summary?.paymentMethods.totalRow.net)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="text-[11px] text-accent flex items-center gap-1.5 mt-3 pt-2 border-t border-border-light">
              <CheckCircle2 size={13} />
              <span>{summary?.paymentMethods.note}</span>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 6. PERFORMANCE BY GAME & DUES / QKHATA                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          
          {/* Performance By Game (6 cols) */}
          <div className="lg:col-span-6 p-5 rounded-2xl bg-bg-card border border-border-theme shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Performance by Game
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-theme">
                    <tr>
                      <th className="py-2">Game</th>
                      <th className="py-2 text-right">Sessions</th>
                      <th className="py-2 text-right">Revenue</th>
                      <th className="py-2 text-right">Avg</th>
                      <th className="py-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light font-mono">
                    {summary?.gamePerformance.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-bg-surface/50">
                        <td className="py-2.5 font-sans font-medium text-text-primary">{row.game}</td>
                        <td className="py-2.5 text-right text-text-secondary">{row.sessionsCount}</td>
                        <td className="py-2.5 text-right font-bold text-text-primary">
                          {formatMoney(row.revenue)}
                        </td>
                        <td className="py-2.5 text-right text-text-secondary">
                          {formatMoney(row.avgPerSession)}
                        </td>
                        <td className="py-2.5 text-right font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <span>{row.sharePct}%</span>
                            <div className="w-12 h-1.5 bg-bg-surface rounded-full overflow-hidden">
                              <div
                                style={{ width: `${row.sharePct}%` }}
                                className="h-full bg-accent rounded-full"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-[11px] text-text-secondary mt-3 pt-2 border-t border-border-light">
              {summary?.gamePerformance.note}
            </div>
          </div>

          {/* Dues & QKhata (6 cols) */}
          <div className="lg:col-span-6 p-5 rounded-2xl bg-bg-card border border-border-theme shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                    Dues & QKhata
                  </h3>
                  <div className="text-xs text-text-secondary mt-0.5">Top customer outstanding balances</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold font-mono text-warning">
                    {formatMoney(summary?.duesAndQKhata.outstandingTotal)}
                  </div>
                  <div className="text-[10px] text-text-secondary">Total Outstanding</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-theme">
                    <tr>
                      <th className="py-2">Customer</th>
                      <th className="py-2 text-right">Balance</th>
                      <th className="py-2 text-right">Oldest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light font-mono">
                    {summary?.duesAndQKhata.topDebtors.map((deb, i) => (
                      <tr key={i} className="hover:bg-bg-surface/50">
                        <td className="py-2.5 font-sans font-medium text-text-primary">
                          {deb.customerName}
                          {deb.phone && <span className="text-[10px] text-text-secondary ml-1">({deb.phone})</span>}
                        </td>
                        <td className="py-2.5 text-right font-bold text-warning">
                          {formatMoney(deb.balance)}
                        </td>
                        <td className="py-2.5 text-right text-text-secondary font-sans text-[11px]">
                          {deb.oldestDays} days
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-[11px] text-text-secondary font-mono mt-3 pt-2 border-t border-border-light">
              {summary?.duesAndQKhata.rollForward.equationLabel}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 7. TRANSACTIONS TABLE & RECORD TRAIL DRAWER                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="p-5 rounded-2xl bg-bg-card border border-border-theme shadow-sm mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">Transactions</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Every session completion, cash receipt, and refund in this range
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-text-disabled" />
                <input
                  type="text"
                  placeholder="Search customer or reference..."
                  value={txSearch}
                  onChange={e => {
                    setTxSearch(e.target.value);
                    setTxPage(1);
                  }}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-border-theme bg-bg-surface text-xs text-text-primary outline-none focus:border-accent w-48 sm:w-60"
                />
              </div>

              {/* Method filter */}
              <select
                value={txMethodFilter}
                onChange={e => {
                  setTxMethodFilter(e.target.value);
                  setTxPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-border-theme bg-bg-surface text-xs text-text-primary outline-none cursor-pointer"
              >
                <option value="all">Method: All</option>
                <option value="UPI">Method: UPI</option>
                <option value="Cash">Method: Cash</option>
                <option value="Card">Method: Card</option>
                <option value="QKhata">Method: QKhata</option>
              </select>

              {/* Status filter */}
              <select
                value={txStatusFilter}
                onChange={e => {
                  setTxStatusFilter(e.target.value);
                  setTxPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-border-theme bg-bg-surface text-xs text-text-primary outline-none cursor-pointer"
              >
                <option value="all">Status: All</option>
                <option value="Paid">Status: Paid</option>
                <option value="Due">Status: Due</option>
                <option value="Refunded">Status: Refunded</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-theme bg-bg-surface/40">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Ref</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Method</th>
                  <th className="p-3 text-right">Gross</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Net</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light font-mono">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-text-secondary font-sans">
                      {isTxLoading ? 'Loading records...' : 'No transactions match the selected filter.'}
                    </td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedRecordTrail(tx)}
                      className="hover:bg-bg-surface/70 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-sans text-text-secondary whitespace-nowrap">{tx.time}</td>
                      <td className="p-3 font-sans font-medium text-text-primary whitespace-nowrap">{tx.customer}</td>
                      <td className="p-3 text-text-secondary">{tx.ref}</td>
                      <td className="p-3 font-sans text-text-secondary">{tx.type}</td>
                      <td className="p-3 font-sans text-text-primary">{tx.method}</td>
                      <td className="p-3 text-right text-text-secondary">{formatMoney(tx.gross)}</td>
                      <td className="p-3 text-right text-danger">
                        {tx.discount > 0 ? `-${formatMoney(tx.discount)}` : '—'}
                      </td>
                      <td className="p-3 text-right font-bold text-text-primary">{formatMoney(tx.net)}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                            tx.status === 'Paid'
                              ? 'bg-accent/10 text-accent border border-accent/20'
                              : tx.status === 'Due'
                              ? 'bg-warning/10 text-warning border border-warning/20'
                              : 'bg-danger/10 text-danger border border-danger/20'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer & Keyset Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-border-light text-xs text-text-secondary">
            <div>Click any row to open its full record trail (session, bill, payments).</div>
            <div className="flex items-center gap-3">
              <span>
                Page {txPage} of {Math.max(1, Math.ceil(txTotalCount / txPageSize))} ({txTotalCount} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={txPage <= 1}
                  onClick={() => setTxPage(p => Math.max(1, p - 1))}
                  className="p-1 rounded-md border border-border-theme bg-bg-surface hover:text-text-primary disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={txPage >= Math.ceil(txTotalCount / txPageSize)}
                  onClick={() => setTxPage(p => p + 1)}
                  className="p-1 rounded-md border border-border-theme bg-bg-surface hover:text-text-primary disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 8. RECONCILIATION FOOTER STATUS STRIP                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-bg-card border border-border-theme mt-6 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-accent" />
            <span className="font-semibold text-text-primary">
              {summary?.reconciliation.checksPassed} of {summary?.reconciliation.totalChecks} reconciliation checks passed
            </span>
          </div>
          <button
            onClick={() => setShowReconciliationModal(true)}
            className="text-xs text-accent hover:underline font-medium"
          >
            View Verification Proofs
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 9. SIDE DRAWER: FULL RECORD TRAIL                                */}
      {/* ---------------------------------------------------------------- */}
      {selectedRecordTrail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-bg-surface h-full border-l border-border-theme p-6 overflow-y-auto flex flex-col justify-between shadow-2xl animate-entrance">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border-theme">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-text-secondary">Record Trail</div>
                  <h3 className="text-lg font-bold text-text-primary">{selectedRecordTrail.ref}</h3>
                </div>
                <button
                  onClick={() => setSelectedRecordTrail(null)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="py-4 space-y-4 text-xs font-sans">
                <div className="grid grid-cols-2 gap-3 p-3 bg-bg-card rounded-xl border border-border-theme">
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Customer</span>
                    <p className="font-bold text-text-primary text-sm mt-0.5">{selectedRecordTrail.customer}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Status</span>
                    <p className="font-bold text-accent text-sm mt-0.5">{selectedRecordTrail.status}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Type</span>
                    <p className="font-medium text-text-primary mt-0.5">{selectedRecordTrail.type}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Date & Time</span>
                    <p className="font-medium text-text-primary mt-0.5">{selectedRecordTrail.time}, {selectedRecordTrail.date}</p>
                  </div>
                </div>

                {/* Financial Ledger Breakdown */}
                <div className="p-4 bg-bg-card rounded-xl border border-border-theme space-y-2 font-mono">
                  <div className="text-[10px] font-sans font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Financial Summary
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary font-sans">Gross Billed</span>
                    <span>{formatMoney(selectedRecordTrail.gross)}</span>
                  </div>
                  {selectedRecordTrail.discount > 0 && (
                    <div className="flex justify-between text-danger">
                      <span className="font-sans">Discount Deducted</span>
                      <span>-{formatMoney(selectedRecordTrail.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-border-light text-text-primary">
                    <span className="font-sans">Net Total</span>
                    <span>{formatMoney(selectedRecordTrail.net)}</span>
                  </div>
                </div>

                {/* Payments allocated */}
                {selectedRecordTrail.recordTrail?.payments && selectedRecordTrail.recordTrail.payments.length > 0 && (
                  <div className="p-4 bg-bg-card rounded-xl border border-border-theme space-y-2">
                    <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">
                      Payments Recorded
                    </div>
                    {selectedRecordTrail.recordTrail.payments.map((p: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-border-light last:border-none">
                        <div>
                          <span className="font-semibold text-text-primary">{p.payment_method}</span>
                          <span className="text-[10px] text-text-secondary ml-1.5 font-mono">
                            {p.metadata?.split ? '(Split portion)' : ''}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-accent">{formatMoney(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedRecordTrail(null)}
              className="w-full py-2.5 bg-bg-card border border-border-theme hover:bg-bg-surface text-text-primary rounded-xl font-semibold text-xs transition-colors"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 10. DRILL-DOWN MODAL                                             */}
      {/* ---------------------------------------------------------------- */}
      {drilldownMetric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl bg-bg-surface border border-border-theme rounded-2xl p-6 shadow-2xl max-h-[85vh] flex flex-col justify-between animate-entrance">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border-theme">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-text-secondary">Metric Drill-Down</div>
                  <h3 className="text-xl font-bold capitalize text-text-primary">{drilldownMetric} Breakdown</h3>
                </div>
                <button
                  onClick={() => setDrilldownMetric(null)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card"
                >
                  <X size={18} />
                </button>
              </div>

              {isDrilldownLoading ? (
                <div className="py-12 text-center text-xs text-text-secondary">Loading constituent records...</div>
              ) : (
                <div className="py-4 overflow-y-auto max-h-[50vh]">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] font-bold text-text-secondary uppercase border-b border-border-theme sticky top-0 bg-bg-surface">
                      <tr>
                        <th className="py-2">Item</th>
                        <th className="py-2">Details</th>
                        <th className="py-2">Date/Time</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light font-mono">
                      {drilldownData?.rows?.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-bg-card">
                          <td className="py-2.5 font-sans font-medium text-text-primary">{row.name}</td>
                          <td className="py-2.5 font-sans text-text-secondary">{row.details}</td>
                          <td className="py-2.5 font-sans text-text-secondary">{row.date} {row.time}</td>
                          <td className="py-2.5 text-right font-bold text-text-primary">
                            {formatMoney(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border-theme font-mono font-bold bg-bg-card">
                      <tr>
                        <td colSpan={3} className="py-2.5 font-sans">Total</td>
                        <td className="py-2.5 text-right text-accent">
                          {formatMoney(drilldownData?.totalValue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <button
              onClick={() => setDrilldownMetric(null)}
              className="mt-4 w-full py-2.5 bg-bg-card border border-border-theme text-text-primary rounded-xl font-semibold text-xs hover:bg-bg-surface transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 11. RECONCILIATION PROOFS MODAL                                  */}
      {/* ---------------------------------------------------------------- */}
      {showReconciliationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-xl bg-bg-surface border border-border-theme rounded-2xl p-6 shadow-2xl max-h-[85vh] flex flex-col justify-between animate-entrance">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border-theme">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-accent" />
                  <h3 className="text-lg font-bold text-text-primary">Financial Reconciliation Proofs</h3>
                </div>
                <button
                  onClick={() => setShowReconciliationModal(false)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="py-4 space-y-3 overflow-y-auto max-h-[50vh]">
                {summary?.reconciliation.details.map((check, idx) => (
                  <div key={idx} className="p-3 bg-bg-card rounded-xl border border-border-theme text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-text-primary">{check.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent">
                        PASSED
                      </span>
                    </div>
                    <p className="text-text-secondary text-[11px]">{check.explanation}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowReconciliationModal(false)}
              className="w-full py-2.5 bg-accent text-black rounded-xl font-bold text-xs hover:bg-accent/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
