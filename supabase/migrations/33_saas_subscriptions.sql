-- Create subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    monthly_price INTEGER NOT NULL DEFAULT 0,
    yearly_price INTEGER,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    stripe_plan_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed subscription plans (Starter, Growth, Pro, Enterprise)
INSERT INTO subscription_plans (name, monthly_price, features) VALUES
('Starter', 999, '{"max_tables": 5, "has_qkhata": true, "has_advanced_qkhata": false, "has_advanced_reports": false, "has_memberships": true, "has_promotions": false, "has_whatsapp": false, "has_telegram": true, "has_fnb": false, "has_booking": false, "has_loyalty": false, "has_ai": false, "has_api": false, "max_locations": 1}'),
('Growth', 1999, '{"max_tables": 15, "has_qkhata": true, "has_advanced_qkhata": true, "has_advanced_reports": true, "has_memberships": true, "has_promotions": true, "has_whatsapp": true, "has_telegram": true, "has_fnb": true, "has_booking": true, "has_loyalty": true, "has_ai": false, "has_api": false, "max_locations": 1}'),
('Pro', 3999, '{"max_tables": 999, "has_qkhata": true, "has_advanced_qkhata": true, "has_advanced_reports": true, "has_memberships": true, "has_promotions": true, "has_whatsapp": true, "has_telegram": true, "has_fnb": true, "has_booking": true, "has_loyalty": true, "has_ai": true, "has_api": true, "max_locations": 3}'),
('Enterprise', 9999, '{"max_tables": 999, "has_qkhata": true, "has_advanced_qkhata": true, "has_advanced_reports": true, "has_memberships": true, "has_promotions": true, "has_whatsapp": true, "has_telegram": true, "has_fnb": true, "has_booking": true, "has_loyalty": true, "has_ai": true, "has_api": true, "max_locations": 999}')
ON CONFLICT (name) DO UPDATE SET features = EXCLUDED.features, monthly_price = EXCLUDED.monthly_price;

-- Create business subscriptions
CREATE TABLE IF NOT EXISTS business_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status TEXT NOT NULL DEFAULT 'trialing', -- trialing, active, past_due, canceled, expired
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '14 days',
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    razorpay_subscription_id TEXT,
    razorpay_customer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (business_id)
);

-- Enable RLS for business_subscriptions
ALTER TABLE business_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all actions for service role on business_subscriptions"
    ON business_subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- Create payment logs
CREATE TABLE IF NOT EXISTS payment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES business_subscriptions(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL,
    gateway_payment_id TEXT,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for payment_logs
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all actions for service role on payment_logs"
    ON payment_logs FOR ALL
    USING (auth.role() = 'service_role');
