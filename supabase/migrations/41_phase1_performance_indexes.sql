-- Migration 41: Phase 1 Performance Indexes (PERF-05)
-- Optimized composite indexes to eliminate sequential table scans on high-traffic queries.

-- 1. Index for pricing rule resolution per business
CREATE INDEX IF NOT EXISTS idx_pricing_rules_business_id ON public.pricing_rules (business_id);

-- 2. Index for customer ledger and payment history queries
CREATE INDEX IF NOT EXISTS idx_payments_business_customer ON public.payments (business_id, customer_id);

-- 3. Index for historical session range queries and session completion filtering
CREATE INDEX IF NOT EXISTS idx_sessions_business_endtime ON public.sessions (business_id, end_time);
