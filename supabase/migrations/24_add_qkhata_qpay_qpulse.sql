-- Migration 24: Add QKhata, QPay, and Qpulse

-- 1. Create Customers table (canonical ledger)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    total_billed NUMERIC DEFAULT 0,
    total_paid NUMERIC DEFAULT 0,
    outstanding_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for searching customers by name or phone within a business
CREATE INDEX IF NOT EXISTS idx_customers_business_phone ON public.customers(business_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_business_name ON public.customers(business_id, name);

-- 2. Create Payments table (transactions)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL, -- 'Cash', 'UPI', 'Card', 'Gateway', 'QKhata', 'Other'
    status TEXT NOT NULL DEFAULT 'Paid', -- 'Pending', 'Paid', 'Failed', 'Refunded'
    reference_id TEXT, -- For gateway transaction IDs
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_business_date ON public.payments(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_session ON public.payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);

-- 3. Update Businesses table for QPay and Qpulse configs
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS qpay_config JSONB DEFAULT '{"enabled": false, "provider": null, "secrets": null}'::jsonb,
ADD COLUMN IF NOT EXISTS qpulse_config JSONB DEFAULT '{"frequency": "Every 3 days", "last_shown_date": null}'::jsonb;

-- 4. Update Sessions table to track amount paid for partial payments
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;

-- Optional: Migrate existing completed sessions to have amount_paid = cost if payment_status = 'Paid'
UPDATE public.sessions
SET amount_paid = cost
WHERE status = 'COMPLETED' AND payment_status = 'Paid' AND amount_paid = 0 AND cost IS NOT NULL;

-- 5. Row Level Security Policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (Backend API bypasses RLS safely)
CREATE POLICY "Enable all actions for service role" ON public.customers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all actions for service role" ON public.payments FOR ALL USING (auth.role() = 'service_role');
