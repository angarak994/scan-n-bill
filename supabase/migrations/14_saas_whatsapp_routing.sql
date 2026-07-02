-- Migration 14: SaaS WhatsApp Routing

-- Add a unique WhatsApp number field to map Twilio's incoming 'To' number to a specific business.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Create an index to quickly resolve the business for incoming webhook messages
CREATE INDEX IF NOT EXISTS idx_businesses_whatsapp_number ON public.businesses(whatsapp_number);
