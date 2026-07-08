-- Migration 16: Add Business Goals

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS goals jsonb DEFAULT '{"daily_revenue": 0, "weekly_revenue": 0, "monthly_revenue": 0, "daily_sessions": 0}'::jsonb;

-- Very important: Reload schema cache so API can access it
NOTIFY pgrst, 'reload schema';
