/**
 * QControl Telegram Bot - High-Precision Performance Instrumentation
 * 
 * Accurately measures:
 * 1. Webhook arrival -> Callback acknowledgement duration (Target: < 500 ms at p95)
 * 2. Webhook arrival -> Business operation completion duration (Target: < 1000 ms at p95)
 * 3. Database query latency
 * 4. External Telegram API latency
 * 5. Cold start occurrence and duration
 * 6. Error & timeout tracking
 */

export interface TelegramMetricRecord {
  updateId: number;
  type: 'callback_query' | 'message' | 'other';
  action?: string;
  isColdStart: boolean;
  receivedAt: number;
  ackLatencyMs?: number;
  businessOpLatencyMs?: number;
  dbLatencyMs: number;
  externalApiLatencyMs: number;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
  errorMessage?: string;
}

// Global process-level cold start tracker
let isFirstInvocation = true;
const processStartTime = Date.now();

// Circular buffer of recent metrics (last 500 operations)
const METRIC_HISTORY_LIMIT = 500;
const metricHistory: TelegramMetricRecord[] = [];

// Aggregate statistics
interface AggregatedStats {
  totalRequests: number;
  coldStarts: number;
  callbackQueries: number;
  messages: number;
  errors: number;
  p50AckMs: number;
  p95AckMs: number;
  p99AckMs: number;
  p50OpMs: number;
  p95OpMs: number;
  p99OpMs: number;
  avgDbMs: number;
  uptimeSeconds: number;
}

function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, Math.min(index, sorted.length - 1))]);
}

export class PerformanceTracker {
  private startTime: number;
  private updateId: number;
  private type: 'callback_query' | 'message' | 'other';
  private action?: string;
  private isColdStart: boolean;
  private ackTimestamp?: number;
  private dbTotalMs: number = 0;
  private externalApiTotalMs: number = 0;

  constructor(updateId: number, type: 'callback_query' | 'message' | 'other', action?: string) {
    this.startTime = performance.now();
    this.updateId = updateId;
    this.type = type;
    this.action = action;
    this.isColdStart = isFirstInvocation;
    if (isFirstInvocation) {
      isFirstInvocation = false;
    }
  }

  public recordDbDuration(durationMs: number): void {
    this.dbTotalMs += durationMs;
  }

  public recordExternalApiDuration(durationMs: number): void {
    this.externalApiTotalMs += durationMs;
  }

  public markAcknowledged(): number {
    this.ackTimestamp = performance.now();
    const ackDuration = Math.round(this.ackTimestamp - this.startTime);
    return ackDuration;
  }

  public finish(status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' = 'SUCCESS', errorMessage?: string): TelegramMetricRecord {
    const endTime = performance.now();
    const opDuration = Math.round(endTime - this.startTime);
    const ackDuration = this.ackTimestamp ? Math.round(this.ackTimestamp - this.startTime) : opDuration;

    const record: TelegramMetricRecord = {
      updateId: this.updateId,
      type: this.type,
      action: this.action,
      isColdStart: this.isColdStart,
      receivedAt: Date.now(),
      ackLatencyMs: ackDuration,
      businessOpLatencyMs: opDuration,
      dbLatencyMs: Math.round(this.dbTotalMs),
      externalApiLatencyMs: Math.round(this.externalApiTotalMs),
      status,
      errorMessage,
    };

    metricHistory.push(record);
    if (metricHistory.length > METRIC_HISTORY_LIMIT) {
      metricHistory.shift();
    }

    // Structured JSON log for log aggregators (Vercel, Datadog, etc.)
    console.log(`[QControl TG Perf] update=${this.updateId} type=${this.type} action=${this.action || 'none'} cold=${this.isColdStart} ack=${ackDuration}ms op=${opDuration}ms db=${record.dbLatencyMs}ms api=${record.externalApiLatencyMs}ms status=${status}`);

    return record;
  }
}

export function getBotMetrics(): AggregatedStats & { recentHistory: TelegramMetricRecord[] } {
  const ackTimes = metricHistory
    .filter(m => m.type === 'callback_query' && typeof m.ackLatencyMs === 'number')
    .map(m => m.ackLatencyMs!);

  const opTimes = metricHistory
    .filter(m => typeof m.businessOpLatencyMs === 'number')
    .map(m => m.businessOpLatencyMs!);

  const dbTimes = metricHistory.map(m => m.dbLatencyMs);
  const avgDb = dbTimes.length > 0 ? Math.round(dbTimes.reduce((a, b) => a + b, 0) / dbTimes.length) : 0;

  return {
    totalRequests: metricHistory.length,
    coldStarts: metricHistory.filter(m => m.isColdStart).length,
    callbackQueries: metricHistory.filter(m => m.type === 'callback_query').length,
    messages: metricHistory.filter(m => m.type === 'message').length,
    errors: metricHistory.filter(m => m.status === 'ERROR').length,
    p50AckMs: calculatePercentile(ackTimes, 50),
    p95AckMs: calculatePercentile(ackTimes, 95),
    p99AckMs: calculatePercentile(ackTimes, 99),
    p50OpMs: calculatePercentile(opTimes, 50),
    p95OpMs: calculatePercentile(opTimes, 95),
    p99OpMs: calculatePercentile(opTimes, 99),
    avgDbMs: avgDb,
    uptimeSeconds: Math.round((Date.now() - processStartTime) / 1000),
    recentHistory: metricHistory.slice(-20),
  };
}
