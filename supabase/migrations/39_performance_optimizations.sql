-- Migration 39: Performance Optimizations
-- Drops real-time blocking triggers and adds critical indexes for Telegram authentication and cleanup.

-- 1. Drop the self-destructing cleanup trigger that runs on every insert
DROP TRIGGER IF EXISTS cleanup_syncs ON public.dashboard_syncs;

-- 2. Add an index to dashboard_syncs for future scheduled cleanups
CREATE INDEX IF NOT EXISTS idx_dashboard_syncs_created_at ON public.dashboard_syncs (created_at);

-- 3. Add a GIN index on businesses.pricing_rules to prevent full-table scans during Telegram Auth (.contains queries)
CREATE INDEX IF NOT EXISTS idx_businesses_pricing_rules_gin ON public.businesses USING GIN (pricing_rules);
