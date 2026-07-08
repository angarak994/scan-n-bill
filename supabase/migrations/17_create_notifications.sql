-- Migration 17: Create Notifications Table

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read/write from authenticated service role only
CREATE POLICY "Enable all actions for service role" ON public.notifications FOR ALL USING (auth.role() = 'service_role');

-- Very important: Reload schema cache so API can access it
NOTIFY pgrst, 'reload schema';
