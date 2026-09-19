-- Migration: Telegram Webhook Idempotency

CREATE TABLE IF NOT EXISTS public.telegram_updates (
    update_id bigint PRIMARY KEY,
    chat_id text,
    processed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.telegram_updates ENABLE ROW LEVEL SECURITY;

-- Add index on chat_id for analytics if needed later
CREATE INDEX IF NOT EXISTS idx_telegram_updates_chat_id ON public.telegram_updates(chat_id);
