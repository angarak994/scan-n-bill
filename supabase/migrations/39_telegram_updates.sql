CREATE TABLE IF NOT EXISTS public.telegram_updates (
    update_id bigint PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.telegram_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for service role" ON public.telegram_updates
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
