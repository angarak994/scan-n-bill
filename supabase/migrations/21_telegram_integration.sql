-- Migration: Telegram Integration and Smart Reminders

-- 1. Add telegram_chat_id to businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- 2. Add smart_reminder_interval_minutes to business_settings
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS smart_reminder_interval_minutes INT DEFAULT 60;

-- 3. Add telegram tracking and last_checked_at to sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS telegram_message_id TEXT;
