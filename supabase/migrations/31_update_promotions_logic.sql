-- Update the function to auto-expire and auto-activate promotions
CREATE OR REPLACE FUNCTION public.update_expired_promotions()
RETURNS void AS $$
BEGIN
  -- Activate scheduled promotions that have reached their start time
  UPDATE public.promotions
  SET status = 'Active'
  WHERE status = 'Scheduled' AND start_time <= timezone('utc'::text, now());

  -- Expire active promotions that have passed their end time
  UPDATE public.promotions
  SET status = 'Expired'
  WHERE status = 'Active' AND end_time <= timezone('utc'::text, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
