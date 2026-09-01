ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS game_type TEXT DEFAULT 'pool';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS num_players INT DEFAULT 1;

NOTIFY pgrst, 'reload schema';
