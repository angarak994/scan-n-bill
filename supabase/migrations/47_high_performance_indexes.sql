-- Migration 47: High-Performance Composite Indexes for QControl
-- Targets exact query predicates in dashboard-data, financial-overview, reportsService, and notifications

-- 1. Accelerates completed sessions date-range by end_time (used in financial reports & daily revenue)
CREATE INDEX IF NOT EXISTS idx_sessions_biz_status_endtime 
  ON public.sessions (business_id, status, end_time);

-- 2. Accelerates payments lookup by date without status restriction (used in financial overview & reports)
CREATE INDEX IF NOT EXISTS idx_payments_biz_created_desc 
  ON public.payments (business_id, created_at DESC);

-- 3. Accelerates order notifications query (type IN ('order_pending', 'order_accepted') with date sort)
CREATE INDEX IF NOT EXISTS idx_notifications_biz_type_created 
  ON public.notifications (business_id, type, created_at DESC);

-- 4. Accelerates membership plans lookup by active status
CREATE INDEX IF NOT EXISTS idx_membership_plans_biz_status 
  ON public.membership_plans (business_id, status);

-- 5. Accelerates session interventions lookup during session hydration and closure KPI calculation
CREATE INDEX IF NOT EXISTS idx_session_interventions_type_created 
  ON public.session_interventions (intervention_type, created_at DESC);

-- 6. Accelerates active customer balance search in QKhata
CREATE INDEX IF NOT EXISTS idx_customers_biz_balance_desc 
  ON public.customers (business_id, outstanding_balance DESC, created_at DESC);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
