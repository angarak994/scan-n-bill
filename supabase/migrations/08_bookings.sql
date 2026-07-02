CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT,
  table_id TEXT,
  booking_date DATE,
  start_time TIME,
  duration_minutes INT,
  status TEXT DEFAULT 'confirmed', -- 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  source TEXT DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all actions for service role on bookings" ON public.bookings FOR ALL USING (auth.role() = 'service_role');
