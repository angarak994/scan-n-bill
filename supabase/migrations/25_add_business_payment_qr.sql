-- Migration 25: Add Business Payment QR and update Qpulse config

-- 1. Create a storage bucket for Business QRs if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('business_qrs', 'business_qrs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to business_qrs bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'business_qrs');

-- Allow authenticated users (or service role) to insert/update/delete
CREATE POLICY "Authenticated users can upload QRs" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'business_qrs');

CREATE POLICY "Authenticated users can update QRs" 
ON storage.objects FOR UPDATE 
WITH CHECK (bucket_id = 'business_qrs');

CREATE POLICY "Authenticated users can delete QRs" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'business_qrs');


-- 2. Add payment_qr_config to businesses
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS payment_qr_config JSONB DEFAULT '{"enabled": false, "qr_url": null}'::jsonb;

-- 3. Ensure qpulse_config has an explicit enabled flag in businesses
-- We will update existing qpulse_configs to have enabled: true if not set
UPDATE public.businesses
SET qpulse_config = jsonb_set(
    COALESCE(qpulse_config, '{"frequency": "Every 3 days", "last_shown_date": null}'::jsonb),
    '{enabled}',
    'true'::jsonb,
    true
)
WHERE qpulse_config IS NULL OR NOT (qpulse_config ? 'enabled');
