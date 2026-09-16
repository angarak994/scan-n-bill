-- Migration 28: Add Membership Plans and OTP Verifications

CREATE TABLE IF NOT EXISTS public.membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    duration_months INT NOT NULL DEFAULT 1,
    discount_percent INT DEFAULT 0,
    benefits TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    mobile TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INT DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for quick lookups on mobile verification
CREATE INDEX IF NOT EXISTS idx_otp_verifications_mobile ON public.otp_verifications(business_id, mobile, created_at DESC);

-- Enable RLS
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Service role policies (bypasses RLS anyway but good practice)
CREATE POLICY "Enable all access for service role on membership_plans" ON public.membership_plans FOR ALL USING (true);
CREATE POLICY "Enable all access for service role on otp_verifications" ON public.otp_verifications FOR ALL USING (true);
