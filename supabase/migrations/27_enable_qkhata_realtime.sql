-- Migration 27: Enable Realtime for QKhata tables

-- Add customers and payments to the supabase_realtime publication
-- This enables realtime websocket broadcasts so the frontend dashboard updates automatically
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
