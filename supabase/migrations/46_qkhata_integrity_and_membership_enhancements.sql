-- Migration 46: QKhata Financial Integrity and Membership Plan Enhancements
-- 1. Explicit plan_id foreign key on memberships
-- 2. Flat hourly rate pricing support on membership_plans
-- 3. Idempotency prevention for session charge ledger records
-- 4. Fast lookup indexes for plan and expiration validation

-- 1. Add plan_id foreign key to memberships if not present
ALTER TABLE public.memberships
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.membership_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_plan_id ON public.memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_memberships_business_expiry ON public.memberships(business_id, expiry_date);

-- 2. Add flat_hourly_rate to membership_plans
ALTER TABLE public.membership_plans 
ADD COLUMN IF NOT EXISTS flat_hourly_rate NUMERIC NOT NULL DEFAULT 0;

-- 3. Update discount_type constraint to allow 'flat_rate'
DO $$
BEGIN
  -- Drop older constraint if it existed with only percentage and fixed
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_membership_plans_discount_type'
  ) THEN
    ALTER TABLE public.membership_plans DROP CONSTRAINT chk_membership_plans_discount_type;
  END IF;

  ALTER TABLE public.membership_plans 
  ADD CONSTRAINT chk_membership_plans_discount_type 
  CHECK (discount_type IN ('percentage', 'fixed', 'flat_rate'));
END $$;

-- 4. Financial Integrity: Unique partial index to prevent duplicate CHARGE ledger entries for the same session
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_session_charge_unique 
ON public.payments (session_id) 
WHERE (metadata->>'type' = 'CHARGE' AND session_id IS NOT NULL);

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
