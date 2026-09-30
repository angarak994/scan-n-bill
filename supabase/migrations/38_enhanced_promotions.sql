-- Migration 38: Enhanced Promotions Table

ALTER TABLE public.promotions
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS promo_type TEXT DEFAULT 'percentage' CHECK (promo_type IN ('percentage', 'fixed_price', 'fixed_amount')),
ADD COLUMN IF NOT EXISTS fixed_price NUMERIC,
ADD COLUMN IF NOT EXISTS fixed_amount_discount NUMERIC,
ADD COLUMN IF NOT EXISTS applicable_game_types JSONB,
ADD COLUMN IF NOT EXISTS applicable_tables JSONB;
