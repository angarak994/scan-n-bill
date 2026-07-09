-- Migration 18: Add Loyalty Points to Memberships

ALTER TABLE public.memberships
ADD COLUMN IF NOT EXISTS total_spend NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;

-- Ensure default tier logic maps cleanly
ALTER TABLE public.memberships
ALTER COLUMN tier SET DEFAULT 'Standard';

-- Add a constraint for minimum points if needed (prevent negative points without business logic)
ALTER TABLE public.memberships
ADD CONSTRAINT check_loyalty_points_nonnegative CHECK (loyalty_points >= 0);
