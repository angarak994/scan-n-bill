-- Migration 44: Production Performance Composite Indexes
-- Eliminates sequential table scans and in-memory sorting identified during the production audit.

-- 1. Accelerates dashboard recent notifications query:
--    Filter by business_id and order by created_at DESC with limit.
CREATE INDEX IF NOT EXISTS idx_notifications_business_created 
  ON public.notifications (business_id, created_at DESC);

-- 2. Eliminates full table scans on session_interventions during active session hydration:
--    Session interventions are queried using session_id IN (...). Foreign keys do not index automatically in Postgres.
CREATE INDEX IF NOT EXISTS idx_session_interventions_session_id 
  ON public.session_interventions (session_id);

-- 3. Composite index for completed sessions date-range queries:
--    Used extensively in dashboard KPI calculations, comparison ranges, and reports.
CREATE INDEX IF NOT EXISTS idx_sessions_business_status_date 
  ON public.sessions (business_id, status, date);

-- 4. Composite index for completed payments by date:
--    Used in reports transactions, summaries, and revenue aggregation.
CREATE INDEX IF NOT EXISTS idx_payments_business_status_created 
  ON public.payments (business_id, status, created_at);

-- 5. Accelerates active pricing rules lookup per business (column is 'active', not 'is_active'):
CREATE INDEX IF NOT EXISTS idx_pricing_rules_business_active 
  ON public.pricing_rules (business_id, active);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
