-- Create Global Customers Table
CREATE TABLE IF NOT EXISTS public.global_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  global_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on global_customers
ALTER TABLE public.global_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for service role on global_customers" ON public.global_customers FOR ALL USING (auth.role() = 'service_role');

-- Extend existing customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS global_customer_id UUID REFERENCES public.global_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loyalty_points NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spend NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sessions INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT true;

-- Create Waitlists Table
CREATE TABLE IF NOT EXISTS public.waitlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT,
  game_type TEXT,
  party_size INT DEFAULT 1,
  status TEXT DEFAULT 'waiting', -- waiting, notified, seated, cancelled, no_show
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on waitlists
ALTER TABLE public.waitlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for service role on waitlists" ON public.waitlists FOR ALL USING (auth.role() = 'service_role');

-- Extend existing bookings table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS global_customer_id UUID REFERENCES public.global_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qpoints_earned NUMERIC DEFAULT 0;
