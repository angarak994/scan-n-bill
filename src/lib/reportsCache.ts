import type { FinancialReportsSummary } from '@/lib/services/reportsService';

// Module-level client cache for instant (0ms) tab switching
export const clientSummaryCache = new Map<string, { data: FinancialReportsSummary; timestamp: number }>();
export const clientTransactionsCache = new Map<string, { transactions: any[]; totalCount: number; timestamp: number }>();

export const REPORTS_CACHE_INVALIDATED_EVENT = 'qcontrol:reports-cache-invalidated';

/**
 * Invalidates client-side reports cache and notifies any mounted Reports component.
 */
export function invalidateReportsCache() {
  clientSummaryCache.clear();
  clientTransactionsCache.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REPORTS_CACHE_INVALIDATED_EVENT));
  }
}
