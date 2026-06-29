-- Add active_discounts to businesses for Happy Hour features
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS active_discounts jsonb DEFAULT '{}'::jsonb;
