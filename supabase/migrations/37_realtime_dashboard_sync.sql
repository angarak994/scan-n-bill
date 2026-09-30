-- Create a non-sensitive table to act as a secure realtime event bus
CREATE TABLE IF NOT EXISTS public.dashboard_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  triggered_by text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS but allow anyone to read it (contains no PII or financials)
ALTER TABLE public.dashboard_syncs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon can read syncs" ON public.dashboard_syncs;
CREATE POLICY "Anon can read syncs" ON public.dashboard_syncs FOR SELECT USING (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_syncs;

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.broadcast_dashboard_sync()
RETURNS trigger AS $$
DECLARE
  biz_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    biz_id := OLD.business_id;
  ELSE
    biz_id := NEW.business_id;
  END IF;

  IF biz_id IS NOT NULL THEN
    INSERT INTO public.dashboard_syncs (business_id, triggered_by)
    VALUES (biz_id, TG_TABLE_NAME);
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to all relevant tables
DROP TRIGGER IF EXISTS sync_sessions ON public.sessions;
CREATE TRIGGER sync_sessions AFTER INSERT OR UPDATE OR DELETE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.broadcast_dashboard_sync();

DROP TRIGGER IF EXISTS sync_bookings ON public.bookings;
CREATE TRIGGER sync_bookings AFTER INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.broadcast_dashboard_sync();

DROP TRIGGER IF EXISTS sync_notifications ON public.notifications;
CREATE TRIGGER sync_notifications AFTER INSERT OR UPDATE OR DELETE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.broadcast_dashboard_sync();

DROP TRIGGER IF EXISTS sync_customers ON public.customers;
CREATE TRIGGER sync_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.broadcast_dashboard_sync();

DROP TRIGGER IF EXISTS sync_payments ON public.payments;
CREATE TRIGGER sync_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.broadcast_dashboard_sync();

DROP TRIGGER IF EXISTS sync_promotions ON public.promotions;
CREATE TRIGGER sync_promotions AFTER INSERT OR UPDATE OR DELETE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.broadcast_dashboard_sync();

DROP TRIGGER IF EXISTS sync_memberships ON public.memberships;
CREATE TRIGGER sync_memberships AFTER INSERT OR UPDATE OR DELETE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.broadcast_dashboard_sync();

-- Automatically cleanup old sync events to prevent table bloat (keep last 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_syncs()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.dashboard_syncs WHERE created_at < NOW() - INTERVAL '1 day';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS cleanup_syncs ON public.dashboard_syncs;
CREATE TRIGGER cleanup_syncs AFTER INSERT ON public.dashboard_syncs EXECUTE FUNCTION public.cleanup_old_syncs();
