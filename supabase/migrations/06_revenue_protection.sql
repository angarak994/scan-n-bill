-- Add to existing sessions table
ALTER TABLE public.sessions ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.sessions ADD COLUMN closure_type TEXT DEFAULT 'normal';
ALTER TABLE public.sessions ADD COLUMN paused_at TIMESTAMPTZ NULL;
ALTER TABLE public.sessions ADD COLUMN paused_duration_seconds INT DEFAULT 0;
ALTER TABLE public.sessions ADD COLUMN transferred_from_table_id UUID NULL;

-- New table: audit trail for every manual override
CREATE TABLE IF NOT EXISTS public.session_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  intervention_type TEXT, -- 'force_close' | 'pause' | 'resume' | 'transfer' | 'idle_flagged'
  amount_recovered NUMERIC DEFAULT 0,
  performed_by TEXT, -- staff/owner id or system
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Config table for idle threshold
CREATE TABLE IF NOT EXISTS public.business_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  idle_threshold_minutes INT DEFAULT 20
);

-- Enable RLS
ALTER TABLE public.session_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Policies for service role
CREATE POLICY "Enable all actions for service role on session_interventions" ON public.session_interventions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all actions for service role on business_settings" ON public.business_settings FOR ALL USING (auth.role() = 'service_role');
