CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  date text NOT NULL,
  customer_name text NOT NULL,
  table_id text NOT NULL,
  game_type text NOT NULL,
  start_time text NOT NULL,
  end_time text,
  duration text,
  applied_pricing text,
  cost numeric,
  status text DEFAULT 'ACTIVE',
  google_sheet_row_id text,
  sync_status text DEFAULT 'PENDING',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read/write from authenticated service role only
-- (Since the API endpoints use service_role to bypass RLS, this ensures backend isolation)
CREATE POLICY "Enable all actions for service role" ON public.sessions FOR ALL USING (auth.role() = 'service_role');
