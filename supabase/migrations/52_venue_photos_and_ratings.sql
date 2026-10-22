-- Migration 52: Venue Photos & Google Ratings
-- Adds venue photo storage, Google Places ratings, and geo-coordinates for nearby discovery

-- 1. Create venue_photos table for business-isolated photo management
CREATE TABLE IF NOT EXISTS public.venue_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT,
  display_order INT DEFAULT 0,
  file_size_bytes INT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.venue_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for service role on venue_photos" ON public.venue_photos FOR ALL USING (auth.role() = 'service_role');

-- Indexes for fast lookup by business
CREATE INDEX IF NOT EXISTS idx_venue_photos_business ON public.venue_photos(business_id);
CREATE INDEX IF NOT EXISTS idx_venue_photos_order ON public.venue_photos(business_id, display_order);

-- 2. Add Google Places rating columns to businesses table
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS google_rating NUMERIC,
  ADD COLUMN IF NOT EXISTS google_review_count INT,
  ADD COLUMN IF NOT EXISTS google_rating_updated_at TIMESTAMPTZ;

-- 3. Ensure latitude/longitude columns exist on businesses (may already exist from businessManager interface)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- 4. Index for geo queries
CREATE INDEX IF NOT EXISTS idx_businesses_geo ON public.businesses(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
