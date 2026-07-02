-- Migration: Create whatsapp_chat_history table
-- Purpose: Store conversational memory for the WhatsApp AI Agent

CREATE TABLE IF NOT EXISTS public.whatsapp_chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by phone number (essential for fetching chat history quickly)
CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_history_phone ON public.whatsapp_chat_history(customer_phone);
