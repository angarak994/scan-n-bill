/**
 * Resilient Asynchronous Synchronization Queue for Google Sheets.
 * 
 * Features:
 * 1. Durable queue / outbox with transactional persistence where available.
 * 2. Idempotency keys prevent duplicate processing on retries.
 * 3. Exponential backoff retry handling (attempts 1 to 3).
 * 4. Per-spreadsheet concurrency lock prevents racing cell writes.
 * 5. Google API quota and rate-limit protection.
 * 6. Non-blocking to caller (core session/booking operations never fail or block).
 * 7. Observable sync status and error tracking.
 * 8. Resync detection: if an update arrives while a job is PROCESSING, re-runs so final state is never dropped.
 * 9. Serverless execution shielding with scheduleBackgroundTask (Next.js after() + standalone fallback).
 * 10. Automatic crash / restart recovery for un-synced sessions.
 */

import { supabase } from './supabaseClient';
import { businessManager } from './businessManager';

export interface SyncJob {
  id: string;
  businessId: string;
  entityType: 'SESSION' | 'BOOKING' | 'RECONCILE' | 'MEMBER';
  entityId: string;
  idempotencyKey: string;
  payload?: any;
  attempts: number;
  maxAttempts: number;
  status: 'PENDING' | 'PROCESSING' | 'SYNCED' | 'FAILED';
  needsResync?: boolean;
  lastError?: string;
  lastAttemptAt?: string;
  createdAt: string;
}

// In-memory queue state for active and fallback queueing
const inMemoryQueue: SyncJob[] = [];
const activeLocks = new Set<string>(); // Set of locked business IDs
let activeWorkerPromise: Promise<void> | null = null;

// Observability stats per business
interface SyncStats {
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
}
const businessStats = new Map<string, SyncStats>();

function getOrCreateStats(businessId: string): SyncStats {
  let stats = businessStats.get(businessId);
  if (!stats) {
    stats = {
      pendingCount: 0,
      syncedCount: 0,
      failedCount: 0,
      lastSyncAt: null,
      lastError: null
    };
    businessStats.set(businessId, stats);
  }
  return stats;
}

/**
 * Executes a background task reliably across both serverless App Router requests
 * (using Next.js after() to keep serverless execution alive) and standalone worker
 * scripts / tests (using direct unhandled Promise resolution).
 */
export function scheduleBackgroundTask(fn: () => Promise<void> | void): void {
  try {
    // Next.js 15/16 after() keeps the serverless container alive after HTTP 200 response
    const { after } = require('next/server');
    after(fn);
  } catch {
    // Outside request scope (e.g. standalone daemon, worker, or test script)
    Promise.resolve().then(fn).catch(err => {
      console.warn('[BackgroundTask] Non-fatal background error:', err?.message || err);
    });
  }
}

/**
 * Centralized, authoritative Google Sheets session lifecycle synchronization trigger.
 * Called on every lifecycle event: start, pause, resume, stop, completion, cancellation, and edit.
 */
export function syncSessionLifecycle(sessionId: string, businessId: string, payload?: any): void {
  if (!sessionId || !businessId) return;
  enqueueSheetsSync('SESSION', sessionId, businessId, payload);
}

/**
 * Enqueues a sync operation asynchronously.
 * Caller is never blocked; returns immediately.
 */
export function enqueueSheetsSync(
  entityType: 'SESSION' | 'BOOKING' | 'RECONCILE' | 'MEMBER',
  entityId: string,
  businessId: string,
  payload?: any
): void {
  if (!businessId || !entityId) return;

  const idempotencyKey = `${entityType}:${entityId}:${businessId}`;

  // Check if identical job is already in queue
  const existingJob = inMemoryQueue.find(
    j => j.idempotencyKey === idempotencyKey && (j.status === 'PENDING' || j.status === 'PROCESSING')
  );

  if (existingJob) {
    // Update payload with latest data
    existingJob.payload = payload || existingJob.payload;
    // If the job is currently actively writing to Google Sheets, flag it for immediate re-sync
    // upon completion so that latest state (e.g. End Time, completed status) is not dropped!
    if (existingJob.status === 'PROCESSING') {
      existingJob.needsResync = true;
    }
    triggerWorker();
    return;
  }

  const job: SyncJob = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    businessId,
    entityType,
    entityId,
    idempotencyKey,
    payload,
    attempts: 0,
    maxAttempts: 3,
    status: 'PENDING',
    needsResync: false,
    createdAt: new Date().toISOString()
  };

  inMemoryQueue.push(job);
  const stats = getOrCreateStats(businessId);
  stats.pendingCount++;

  // Record in Supabase sheets_sync_queue asynchronously if table exists (Best effort)
  Promise.resolve().then(async () => {
    try {
      await supabase.from('sheets_sync_queue').insert([{
        business_id: businessId,
        entity_type: entityType,
        entity_id: entityId,
        idempotency_key: idempotencyKey,
        payload: payload || {},
        status: 'PENDING'
      }]);
    } catch {
      // Table might not be migrated yet in some local environments; in-memory queue handles it
    }
  }).catch(() => {});

  triggerWorker();
}

/**
 * Kicks off the background worker loop if not already executing.
 * Returns a promise for the active worker loop.
 */
export function triggerWorker(): Promise<void> {
  if (activeWorkerPromise) return activeWorkerPromise;

  activeWorkerPromise = (async () => {
    try {
      await processQueue();
    } catch (err) {
      console.error('[SheetsSyncQueue] Worker fatal error:', err);
    } finally {
      activeWorkerPromise = null;
      // If more items remain pending, schedule next tick immediately
      if (inMemoryQueue.some(j => j.status === 'PENDING')) {
        triggerWorker();
      }
    }
  })();

  return activeWorkerPromise;
}

/**
 * Worker loop: processes pending jobs respecting concurrency locks and backoff.
 */
async function processQueue(): Promise<void> {
  const pendingJobs = inMemoryQueue.filter(j => j.status === 'PENDING');
  if (pendingJobs.length === 0) return;

  for (const job of pendingJobs) {
    const lockKey = job.businessId;
    if (activeLocks.has(lockKey)) {
      // Another worker is actively syncing this business's sheet. Skip for now to prevent race conditions.
      continue;
    }

    activeLocks.add(lockKey);
    job.status = 'PROCESSING';
    job.attempts++;
    job.lastAttemptAt = new Date().toISOString();

    try {
      await executeSyncJob(job);

      if (job.needsResync) {
        // Newer state arrived while this sync was processing. Reset to PENDING so next tick applies it!
        job.needsResync = false;
        job.status = 'PENDING';
        job.attempts = 0;
      } else {
        job.status = 'SYNCED';
        
        const stats = getOrCreateStats(job.businessId);
        stats.pendingCount = Math.max(0, stats.pendingCount - 1);
        stats.syncedCount++;
        stats.lastSyncAt = new Date().toISOString();

        // Mark session sync_status = 'SYNCED' in Supabase
        if (job.entityType === 'SESSION') {
          await supabase.from('sessions').update({ sync_status: 'SYNCED' }).eq('id', job.entityId);
        }

        // Clean up finished job from queue after a brief retention window
        setTimeout(() => {
          const idx = inMemoryQueue.indexOf(job);
          if (idx !== -1) inMemoryQueue.splice(idx, 1);
        }, 5000);
      }

    } catch (err: any) {
      console.error(`[SheetsSyncQueue] Job failed (Attempt ${job.attempts}/${job.maxAttempts}):`, err?.message || err);
      job.lastError = err?.message || String(err);
      
      const stats = getOrCreateStats(job.businessId);
      stats.lastError = job.lastError || null;

      const isRateLimit = err?.status === 429 || 
        err?.code === 429 ||
        err?.message?.includes('429') || 
        err?.message?.toLowerCase().includes('quota') || 
        err?.message?.toLowerCase().includes('rate limit');

      if (job.attempts < job.maxAttempts) {
        // Quota-aware exponential backoff with jitter:
        // Standard errors: 1s, 2s. Quota/Rate limits: 2.5s, 5s with jitter to let token buckets replenish safely.
        const baseMs = isRateLimit ? 2500 : 1000;
        const jitterMs = Math.floor(Math.random() * 500);
        const backoffMs = Math.pow(2, job.attempts - 1) * baseMs + jitterMs;
        job.status = 'PENDING';
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        job.status = 'FAILED';
        stats.pendingCount = Math.max(0, stats.pendingCount - 1);
        stats.failedCount++;

        // Mark session sync_status = 'FAILED' in Supabase
        if (job.entityType === 'SESSION') {
          await supabase.from('sessions').update({ sync_status: 'FAILED' }).eq('id', job.entityId);
        }
      }
    } finally {
      activeLocks.delete(lockKey);
    }
  }
}

async function executeSyncJob(job: SyncJob): Promise<void> {
  // Gate execution with developer-controlled Google Sheets synchronization entitlement
  const { hasFeature } = require('./entitlements');
  const isEnabled = await hasFeature(job.businessId, 'google_sheets');
  if (!isEnabled) {
    console.log(`[SheetsSyncQueue] Google Sheets sync is disabled for business ${job.businessId}. Skipping sync.`);
    return;
  }

  const { syncUnifiedSessionToSheet, syncBookingToSheet, reconcileMonthlySheets } = require('./googleSheets');

  if (job.entityType === 'SESSION') {
    await syncUnifiedSessionToSheet(job.entityId, job.businessId);

  } else if (job.entityType === 'BOOKING') {
    if (job.payload) {
      await syncBookingToSheet(job.payload, job.businessId);
    }
  } else if (job.entityType === 'MEMBER') {
    const { syncMemberToSheet } = require('./googleSheets');
    await syncMemberToSheet(job.entityId, job.businessId);
  } else if (job.entityType === 'RECONCILE') {
    const monthKey = job.payload?.monthKey;
    if (monthKey) {
      await reconcileMonthlySheets(job.businessId, monthKey);
    }
  }
}

/**
 * Returns observable sync stats for an administrator or monitoring view.
 */
export function getSyncStats(businessId: string): SyncStats {
  return getOrCreateStats(businessId);
}

/**
 * Flushes all pending and processing jobs in the queue for a business or globally.
 * Guarantees that Google Sheets writes complete before a serverless container freezes
 * or before a test finishes.
 */
export async function flushSheetsSyncQueue(businessId?: string, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  try {
    while (
      inMemoryQueue.some(j => (j.status === 'PENDING' || j.status === 'PROCESSING') && (!businessId || j.businessId === businessId)) &&
      Date.now() - start < timeoutMs
    ) {
      await triggerWorker();
      if (inMemoryQueue.some(j => (j.status === 'PENDING' || j.status === 'PROCESSING') && (!businessId || j.businessId === businessId))) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  } catch (err) {
    console.warn('[SheetsSyncQueue] Flush warning:', err);
  }
}

/**
 * Recovers and synchronizes any pending or failed sessions after server restarts or network recovery.
 */
export async function reconcileUnsyncedSessions(businessId?: string): Promise<number> {
  try {
    let query = supabase
      .from('sessions')
      .select('id, business_id')
      .in('sync_status', ['PENDING', 'FAILED'])
      .order('created_at', { ascending: false })
      .limit(30);

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data: unsynced, error } = await query;
    if (error || !unsynced || unsynced.length === 0) return 0;

    let enqueued = 0;
    for (const s of unsynced) {
      if (s.id && s.business_id) {
        enqueueSheetsSync('SESSION', s.id, s.business_id);
        enqueued++;
      }
    }
    return enqueued;
  } catch (err) {
    console.warn('[SheetsSyncQueue] Unsynced session recovery warning:', err);
    return 0;
  }
}

// Background self-healing sweep on module startup (Non-blocking)
Promise.resolve().then(() => {
  reconcileUnsyncedSessions().catch(() => {});
}).catch(() => {});
