-- Migration 45: Add Numerical Discount Configuration to Membership Plans
-- Supports both Percentage-based (%) and Fixed Rupee-amount (₹) discounts.

ALTER TABLE public.membership_plans 
ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'percentage';

ALTER TABLE public.membership_plans 
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;

-- Ensure discount_type is either 'percentage' or 'fixed'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_membership_plans_discount_type'
  ) THEN
    ALTER TABLE public.membership_plans 
    ADD CONSTRAINT chk_membership_plans_discount_type 
    CHECK (discount_type IN ('percentage', 'fixed'));
  END IF;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
