-- Migration 50: Financial Reports Pre-Aggregation RPC
-- Computes high-performance server-side aggregates directly in Postgres,
-- eliminating client-side row-by-row iteration and massive JSON payloads.

CREATE OR REPLACE FUNCTION public.get_financial_reports_aggregates(
  p_business_id uuid,
  p_start_iso timestamptz,
  p_end_iso timestamptz
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_total_revenue numeric := 0;
  v_total_base_cost numeric := 0;
  v_total_discounts numeric := 0;
  v_total_food_cost numeric := 0;
  v_completed_count int := 0;
  v_billed_collected_direct numeric := 0;
  v_cancelled_count int := 0;
  v_total_collections numeric := 0;
  v_total_refunds numeric := 0;
  v_outstanding_total numeric := 0;
  v_game_breakdown jsonb := '[]'::jsonb;
  v_payment_methods jsonb := '[]'::jsonb;
BEGIN
  -- 1. Completed Sessions Aggregate
  SELECT 
    COALESCE(SUM(cost), 0),
    COALESCE(SUM(base_cost), 0),
    COALESCE(SUM(discount_amount), 0),
    COALESCE(SUM(food_cost), 0),
    COUNT(*),
    COALESCE(SUM(amount_paid), 0)
  INTO
    v_total_revenue,
    v_total_base_cost,
    v_total_discounts,
    v_total_food_cost,
    v_completed_count,
    v_billed_collected_direct
  FROM public.sessions
  WHERE business_id = p_business_id
    AND status = 'COMPLETED'
    AND end_time >= p_start_iso
    AND end_time < p_end_iso;

  -- 2. Cancelled Sessions Count
  SELECT COUNT(*)
  INTO v_cancelled_count
  FROM public.sessions
  WHERE business_id = p_business_id
    AND status = 'CANCELLED'
    AND created_at >= p_start_iso
    AND created_at < p_end_iso;

  -- 3. Game Breakdown
  SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
  INTO v_game_breakdown
  FROM (
    SELECT 
      INITCAP(TRIM(COALESCE(game_type, 'Pool'))) as game,
      COUNT(*)::int as sessions,
      COALESCE(SUM(GREATEST(0, cost - food_cost)), 0)::numeric as revenue
    FROM public.sessions
    WHERE business_id = p_business_id
      AND status = 'COMPLETED'
      AND end_time >= p_start_iso
      AND end_time < p_end_iso
    GROUP BY INITCAP(TRIM(COALESCE(game_type, 'Pool')))
  ) sub;

  -- 4. Payments & Refunds Aggregates
  SELECT
    COALESCE(SUM(CASE WHEN status = 'Paid' AND (metadata->>'type' IS NULL OR metadata->>'type' != 'CHARGE') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'Refunded' OR metadata->>'type' = 'ORDER_VOID_REVERSAL' THEN amount ELSE 0 END), 0)
  INTO
    v_total_collections,
    v_total_refunds
  FROM public.payments
  WHERE business_id = p_business_id
    AND created_at >= p_start_iso
    AND created_at < p_end_iso;

  -- 5. Payment Methods Breakdown
  SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
  INTO v_payment_methods
  FROM (
    SELECT 
      CASE 
        WHEN payment_method ILIKE '%upi%' THEN 'UPI'
        WHEN payment_method ILIKE '%cash%' THEN 'Cash'
        WHEN payment_method ILIKE '%card%' THEN 'Card'
        ELSE 'Other'
      END as method,
      COALESCE(SUM(CASE WHEN status = 'Paid' AND (metadata->>'type' IS NULL OR metadata->>'type' != 'CHARGE') THEN amount ELSE 0 END), 0)::numeric as collected,
      COUNT(CASE WHEN status = 'Paid' AND (metadata->>'type' IS NULL OR metadata->>'type' != 'CHARGE') THEN 1 ELSE NULL END)::int as tx_count,
      COALESCE(SUM(CASE WHEN status = 'Refunded' OR metadata->>'type' = 'ORDER_VOID_REVERSAL' THEN amount ELSE 0 END), 0)::numeric as refunds
    FROM public.payments
    WHERE business_id = p_business_id
      AND created_at >= p_start_iso
      AND created_at < p_end_iso
    GROUP BY 1
  ) sub;

  -- 6. Customers Outstanding Balance Total
  SELECT COALESCE(SUM(outstanding_balance), 0)
  INTO v_outstanding_total
  FROM public.customers
  WHERE business_id = p_business_id
    AND outstanding_balance > 0;

  -- Build final JSON result
  v_result := jsonb_build_object(
    'total_revenue', v_total_revenue,
    'total_base_cost', v_total_base_cost,
    'total_discounts', v_total_discounts,
    'total_food_cost', v_total_food_cost,
    'completed_count', v_completed_count,
    'billed_collected_direct', v_billed_collected_direct,
    'cancelled_count', v_cancelled_count,
    'total_collections', v_total_collections,
    'total_refunds', v_total_refunds,
    'outstanding_total', v_outstanding_total,
    'game_breakdown', v_game_breakdown,
    'payment_methods', v_payment_methods
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
