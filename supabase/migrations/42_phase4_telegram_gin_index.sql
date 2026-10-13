-- Migration 42: Phase 4 GIN Index for Telegram Webhook JSONB Queries
-- Accelerates .contains('pricing_rules', { globalSettings: { authorized_telegram_owners: [...] } })
-- and jsonb queries across business settings.

CREATE INDEX IF NOT EXISTS idx_businesses_pricing_rules_gin
ON public.businesses USING GIN (pricing_rules jsonb_path_ops);
