-- Migration: 34_performance_scalability.sql
-- Add compound indexes for the most heavily queried filters
CREATE INDEX IF NOT EXISTS idx_sessions_business_status ON sessions(business_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_business_date ON sessions(business_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_business_date ON bookings(business_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_payments_business_created ON payments(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customers_business_balance ON customers(business_id, outstanding_balance);

-- Create a type for the dashboard KPIs
DROP TYPE IF EXISTS dashboard_kpis CASCADE;
CREATE TYPE dashboard_kpis AS (
    total_revenue numeric,
    total_sessions bigint,
    avg_duration_minutes numeric
);

-- RPC for aggregating Dashboard KPIs in the database (Fast!)
CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_business_id UUID, p_start_date TEXT, p_end_date TEXT)
RETURNS SETOF dashboard_kpis
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN payment_status = 'Paid' THEN COALESCE(NULLIF(amount_paid, 0), cost, 0)
                ELSE COALESCE(NULLIF(amount_paid, 0), 0)
            END
        ), 0) as total_revenue,
        COUNT(*) as total_sessions,
        COALESCE(AVG(
            EXTRACT(EPOCH FROM (
                CAST(date || ' ' || end_time AS TIMESTAMP) - 
                CAST(date || ' ' || start_time AS TIMESTAMP)
            ))/60
        ), 0) as avg_duration_minutes
    FROM sessions
    WHERE business_id = p_business_id
      AND status = 'COMPLETED'
      AND date >= p_start_date
      AND date <= p_end_date;
END;
$$;
