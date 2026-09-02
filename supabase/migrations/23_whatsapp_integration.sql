-- Migration 23: WhatsApp Integration

CREATE TABLE IF NOT EXISTS public.whatsapp_chat_state (
    customer_phone TEXT PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    current_step TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.whatsapp_processed_messages (
    message_id TEXT PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.whatsapp_chat_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Enable all actions for service role" ON public.whatsapp_chat_state FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all actions for service role" ON public.whatsapp_processed_messages FOR ALL USING (auth.role() = 'service_role');
