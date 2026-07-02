CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  table_type TEXT, -- 'pool' | 'snooker' | 'all'
  rule_type TEXT,  -- 'time_of_day' | 'weekend' | 'holiday' | 'peak_hour'
  day_of_week INT[] NULL,     -- null = every day; else [0..6]
  start_time TIME,
  end_time TIME,
  rate_per_hour NUMERIC,
  priority INT DEFAULT 0,     -- higher wins on overlap
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for service role on pricing_rules" ON public.pricing_rules FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.sessions ADD COLUMN locked_rate NUMERIC;
ALTER TABLE public.sessions ADD COLUMN locked_rate_name TEXT;
