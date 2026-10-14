-- Migration 43: Member Verification Audit & Manual Approval Support

-- 1. Add verification and audit columns to memberships table
ALTER TABLE public.memberships 
ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'OTP_VERIFIED',
ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS verified_by TEXT,
ADD COLUMN IF NOT EXISTS audit_info JSONB DEFAULT '{}'::jsonb;

-- 2. Mark existing records with baseline audit info (backwards compatibility)
UPDATE public.memberships 
SET verification_method = 'OTP_VERIFIED', is_phone_verified = TRUE 
WHERE verification_method IS NULL OR verification_method = '';

-- 3. Prevent duplicate mobile memberships within the same business
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_biz_mobile_unique 
ON public.memberships(business_id, mobile);

-- 4. Index for searching members by verification method
CREATE INDEX IF NOT EXISTS idx_memberships_verification_method 
ON public.memberships(business_id, verification_method);

-- 5. Add audit columns to otp_verifications for replay prevention
ALTER TABLE public.otp_verifications 
ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_token_hash TEXT;

-- 6. Index for fast verification lookup
CREATE INDEX IF NOT EXISTS idx_otp_verifications_token_hash 
ON public.otp_verifications(verification_token_hash);
