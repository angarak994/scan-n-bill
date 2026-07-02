-- Migration 15: Completed Sessions Detailed Billing Fields

ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS base_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Paid',
ADD COLUMN IF NOT EXISTS completed_by TEXT DEFAULT 'System';

-- Optional: Update existing completed sessions to have some default values to avoid NULLs
UPDATE public.sessions
SET base_cost = cost,
    payment_status = 'Paid',
    completed_by = 'System'
WHERE status = 'COMPLETED' AND base_cost = 0;
