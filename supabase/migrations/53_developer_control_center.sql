-- Migration 53: Developer Control Center, Approval Workflow, Feature Entitlements & Custom Pricing
-- Author: QControl Platform Team

-- 1. Create Developer Audit Logs table
CREATE TABLE IF NOT EXISTS public.developer_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_audit_logs_biz ON public.developer_audit_logs(target_business_id);
CREATE INDEX IF NOT EXISTS idx_dev_audit_logs_created ON public.developer_audit_logs(created_at DESC);

ALTER TABLE public.developer_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for service role on developer_audit_logs"
    ON public.developer_audit_logs FOR ALL
    USING (auth.role() = 'service_role');

-- 2. Create Payment Webhook Events table for strict idempotency & replay defense
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'razorpay',
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PROCESSED',
    processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_id ON public.payment_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_biz ON public.payment_webhook_events(business_id);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for service role on payment_webhook_events"
    ON public.payment_webhook_events FOR ALL
    USING (auth.role() = 'service_role');

-- 3. Extend businesses table with lifecycle approval, entitlements & production onboarding fields
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS approval_notes TEXT,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_by TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS feature_entitlements JSONB DEFAULT '{
        "whatsapp_ai": false,
        "google_sheets": false,
        "qr_sessions": false,
        "telegram_bot": false,
        "manual_booking": true,
        "online_booking": false,
        "memberships": false,
        "reports_analytics": false,
        "advanced_billing": false,
        "payment_automation": false,
        "fnb_inventory": false
    }'::jsonb,
    ADD COLUMN IF NOT EXISTS custom_pricing JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS onboarded_by TEXT;

-- For existing businesses that have status 'ACTIVE', migrate them seamlessly to 'APPROVED' or preserve 'ACTIVE' compatibility
UPDATE public.businesses
SET feature_entitlements = '{
    "whatsapp_ai": true,
    "google_sheets": true,
    "qr_sessions": true,
    "telegram_bot": true,
    "manual_booking": true,
    "online_booking": true,
    "memberships": true,
    "reports_analytics": true,
    "advanced_billing": true,
    "payment_automation": true,
    "fnb_inventory": true
}'::jsonb
WHERE status = 'ACTIVE' AND (feature_entitlements IS NULL OR feature_entitlements = '{}'::jsonb);

-- 4. Extend business_subscriptions table with custom negotiated pricing & trial governance
ALTER TABLE public.business_subscriptions
    ADD COLUMN IF NOT EXISTS agreed_price_paisa INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS billing_currency TEXT DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly',
    ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trial_duration_days INTEGER DEFAULT 15,
    ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 3,
    ADD COLUMN IF NOT EXISTS custom_pricing_notes TEXT,
    ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS mandate_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS last_payment_status TEXT,
    ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS outstanding_amount_paisa INTEGER DEFAULT 0;

-- Create fast indexes for subscription status and trial expiration queries
CREATE INDEX IF NOT EXISTS idx_biz_subs_status ON public.business_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_biz_subs_period_end ON public.business_subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON public.businesses(status);
