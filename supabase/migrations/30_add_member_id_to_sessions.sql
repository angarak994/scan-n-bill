-- Migration: Add member_id to sessions table
-- This allows the system to permanently link active sessions to registered members, enabling the QKhata Telegram integration.

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL;

-- Also create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_member_id ON public.sessions(member_id);
