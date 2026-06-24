CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  owner_name text NOT NULL,
  contact_number text NOT NULL,
  address text,
  google_sheet_id text NOT NULL,
  business_type text,
  pricing_rules jsonb,
  tables jsonb,
  dashboard_pin text,
  status text DEFAULT 'ACTIVE',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- If table already exists, run these instead:
-- ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS pricing_rules jsonb;
-- ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS tables jsonb;
-- ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS dashboard_pin text;

-- Create policy to allow read/write from authenticated service role only
-- Or for public anon if you want the API routes to use anon key (but API routes can use service_role)
-- The API endpoints will use the service_role key to bypass RLS, so no specific policies needed for them.
