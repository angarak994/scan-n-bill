-- Migration 13: Booking Synchronization
-- Adds session linking and lifecycle fields to bookings

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS end_time TIME;

-- Re-create constraint on status to ensure it allows all valid lifecycle states, if there was a check constraint.
-- In 08_bookings.sql, status is just TEXT, so no check constraint to drop.

-- Ensure index on session_id for fast lookups when ending sessions
CREATE INDEX IF NOT EXISTS idx_bookings_session_id ON public.bookings(session_id);
