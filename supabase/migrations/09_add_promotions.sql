-- Add promotions column to businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS active_promotion jsonb DEFAULT 'null'::jsonb;
