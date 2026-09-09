-- Performance optimization indexes
-- Improves query times for historical session fetches and dashboard loading

CREATE INDEX IF NOT EXISTS idx_sessions_business_id ON public.sessions (business_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions (date);
CREATE INDEX IF NOT EXISTS idx_sessions_table_id ON public.sessions (table_id);

CREATE INDEX IF NOT EXISTS idx_promotions_business_status ON public.promotions (business_id, status);
