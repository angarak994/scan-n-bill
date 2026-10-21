-- Migration 51: Atomic Operations & Composite Performance Indexes
-- Eliminates race conditions and N+1 query loops during session completion

-- 1. Atomic loyalty points and spend increment for memberships
CREATE OR REPLACE FUNCTION public.increment_member_loyalty(
  p_member_id uuid,
  p_spend numeric,
  p_points int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.memberships
  SET total_spend = COALESCE(total_spend, 0) + p_spend,
      loyalty_points = COALESCE(loyalty_points, 0) + p_points
  WHERE id = p_member_id;
END;
$$;

-- 2. Batch atomic promotion usage counter increment
CREATE OR REPLACE FUNCTION public.increment_promotion_usages(
  p_promo_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF array_length(p_promo_ids, 1) > 0 THEN
    UPDATE public.promotions
    SET usage_count = COALESCE(usage_count, 0) + 1
    WHERE id = ANY(p_promo_ids);
  END IF;
END;
$$;

-- 3. Composite index on payments for session transactions joining
CREATE INDEX IF NOT EXISTS idx_payments_biz_session 
  ON public.payments (business_id, session_id);

-- 4. Composite index on sessions for date & status filtering
CREATE INDEX IF NOT EXISTS idx_sessions_biz_date_status 
  ON public.sessions (business_id, date, status);

NOTIFY pgrst, 'reload schema';
