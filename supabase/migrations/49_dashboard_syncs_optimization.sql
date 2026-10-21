-- Migration 49: Dashboard Syncs Optimization & Maintenance
-- 1. Adds composite index on (business_id, created_at DESC) for lightning-fast realtime bus filtering and lookups
-- 2. Ensures the legacy self-triggering per-insert cleanup is cleanly dropped
-- 3. Provides a dedicated safe maintenance procedure for pruning old events

CREATE INDEX IF NOT EXISTS idx_dashboard_syncs_business_created ON public.dashboard_syncs (business_id, created_at DESC);

-- Ensure legacy cleanup trigger is dropped so it never blocks inserts
DROP TRIGGER IF EXISTS cleanup_syncs ON public.dashboard_syncs;

-- Safe purge routine for scheduled maintenance / cron jobs
CREATE OR REPLACE FUNCTION public.purge_old_dashboard_syncs(retention_hours int DEFAULT 24)
RETURNS int AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.dashboard_syncs
  WHERE created_at < NOW() - (retention_hours || ' hours')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
