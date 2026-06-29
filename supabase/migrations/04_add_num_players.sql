-- Add num_players to sessions for per-person dynamic pricing (e.g., PlayStation)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS num_players integer DEFAULT 1;
