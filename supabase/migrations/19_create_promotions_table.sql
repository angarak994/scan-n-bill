-- Migration 19: Create Promotions Table

CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    discount_percent NUMERIC NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Scheduled', 'Expired', 'Paused')),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for quickly finding active promotions for a business
CREATE INDEX IF NOT EXISTS idx_promotions_business_active ON public.promotions(business_id, status) WHERE status = 'Active';

-- Create a function to auto-expire promotions that have passed their end time
CREATE OR REPLACE FUNCTION public.update_expired_promotions()
RETURNS void AS $$
BEGIN
  UPDATE public.promotions
  SET status = 'Expired'
  WHERE status = 'Active' AND end_time < timezone('utc'::text, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
