-- Add menu_items to businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS menu_items jsonb;

-- Add food_cost to sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS food_cost numeric DEFAULT 0;
