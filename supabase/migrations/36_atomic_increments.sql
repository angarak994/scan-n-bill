CREATE OR REPLACE FUNCTION increment_food_cost(p_session_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    new_cost numeric;
BEGIN
    UPDATE public.sessions
    SET food_cost = COALESCE(food_cost, 0) + p_amount
    WHERE id = p_session_id
    RETURNING food_cost INTO new_cost;
    
    RETURN new_cost;
END;
$$;

CREATE OR REPLACE FUNCTION increment_customer_ledger(p_customer_id uuid, p_billed numeric, p_paid numeric)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.customers
    SET total_billed = COALESCE(total_billed, 0) + p_billed,
        total_paid = COALESCE(total_paid, 0) + p_paid,
        outstanding_balance = COALESCE(outstanding_balance, 0) + (p_billed - p_paid),
        updated_at = now()
    WHERE id = p_customer_id;
END;
$$;
