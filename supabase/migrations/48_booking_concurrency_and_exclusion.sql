-- Migration 48: Production Booking Concurrency, Exclusion Constraint, and Multi-Business Isolation

-- 1. Enable btree_gist extension for PostgreSQL multi-column range exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Clean up any legacy overlapping test bookings before applying constraint
-- (Cancels any duplicate pending/confirmed test bookings created prior to current timestamp)
UPDATE public.bookings
SET status = 'cancelled'
WHERE id IN (
  SELECT b1.id
  FROM public.bookings b1
  JOIN public.bookings b2 ON b1.business_id = b2.business_id
    AND b1.table_id = b2.table_id
    AND b1.booking_date = b2.booking_date
    AND b1.id <> b2.id
    AND b1.status IN ('confirmed', 'pending', 'active')
    AND b2.status IN ('confirmed', 'pending', 'active')
    AND b1.created_at > b2.created_at
    AND (b1.start_time, COALESCE(b1.end_time, (b1.start_time + interval '1 hour')::time)) 
        OVERLAPS (b2.start_time, COALESCE(b2.end_time, (b2.start_time + interval '1 hour')::time))
);

-- 3. Extend bookings table with customer reference, notification tracking, and idempotency key
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notification_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- 4. Ensure index on idempotency_key per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_business_idempotency 
ON public.bookings(business_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 5. Add time_range column for GiST exclusion constraint (IST Timezone)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS time_range tstzrange GENERATED ALWAYS AS (
  tstzrange(
    (booking_date + start_time) AT TIME ZONE 'Asia/Kolkata',
    (booking_date + COALESCE(end_time, (start_time + (duration_minutes || ' minutes')::interval)::time)) AT TIME ZONE 'Asia/Kolkata',
    '[)'
  )
) STORED;

-- 6. Add exclusion constraint preventing overlapping active/confirmed/pending bookings for the same table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prevent_overlapping_confirmed_bookings'
  ) THEN
    ALTER TABLE public.bookings 
    ADD CONSTRAINT prevent_overlapping_confirmed_bookings 
    EXCLUDE USING gist (
      business_id WITH =,
      table_id WITH =,
      time_range WITH &&
    )
    WHERE (status IN ('confirmed', 'active', 'pending'));
  END IF;
END $$;

-- 7. Extend businesses table with public contact number and slug for deep links
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS public_contact_number TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate default slug from business_name for existing clubs
UPDATE public.businesses
SET slug = LOWER(REGEXP_REPLACE(business_name, '[^a-zA-Z0-9]+', '_', 'g'))
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_slug ON public.businesses(slug) WHERE slug IS NOT NULL;

-- 8. Extend whatsapp_chat_state with active_business_id, conversation_mode, and TTL expires_at
ALTER TABLE public.whatsapp_chat_state
  ADD COLUMN IF NOT EXISTS active_business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_mode TEXT DEFAULT 'CLUB',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + interval '30 minutes');

CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_state_expires ON public.whatsapp_chat_state(expires_at);

-- 9. Create server-authoritative Atomic Booking Function
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_business_id UUID,
  p_table_id TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_duration_minutes INT,
  p_game_type TEXT,
  p_num_players INT,
  p_source TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_booking RECORD;
  v_new_booking RECORD;
  v_slot_overlap RECORD;
  v_active_session RECORD;
  v_customer_id UUID;
  v_clean_phone TEXT;
BEGIN
  -- 1. Idempotency Check: if idempotency key was already processed, return existing booking
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_booking 
    FROM public.bookings 
    WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'booking', row_to_json(v_existing_booking), 'duplicate', true);
    END IF;
  END IF;

  -- 2. Lock active bookings for this table to prevent concurrent interleaving
  PERFORM id FROM public.bookings 
  WHERE business_id = p_business_id AND table_id = p_table_id AND booking_date = p_booking_date 
  FOR UPDATE;

  -- 3. Check for overlapping reservations
  SELECT id, start_time, end_time INTO v_slot_overlap
  FROM public.bookings
  WHERE business_id = p_business_id
    AND table_id = p_table_id
    AND booking_date = p_booking_date
    AND status IN ('confirmed', 'active', 'pending')
    AND (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'Table slot is already reserved between ' || v_slot_overlap.start_time || ' and ' || v_slot_overlap.end_time
    );
  END IF;

  -- 4. Check if slot overlaps current time and an active session exists
  IF p_booking_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE THEN
    IF (p_start_time, p_end_time) OVERLAPS ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::TIME, ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata') + interval '1 minute')::TIME) THEN
      SELECT id INTO v_active_session 
      FROM public.sessions 
      WHERE business_id = p_business_id AND table_id = p_table_id AND status = 'ACTIVE'
      LIMIT 1;

      IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Table is currently occupied by an active playing session.');
      END IF;
    END IF;
  END IF;

  -- 5. Link or create customer record in customers table
  v_clean_phone := regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g');
  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_customer_id 
    FROM public.customers 
    WHERE business_id = p_business_id AND phone = v_clean_phone 
    LIMIT 1;

    IF NOT FOUND THEN
      INSERT INTO public.customers (business_id, name, phone, outstanding_balance)
      VALUES (p_business_id, COALESCE(p_customer_name, 'Customer'), v_clean_phone, 0)
      RETURNING id INTO v_customer_id;
    END IF;
  END IF;

  -- 6. Insert new booking atomically
  INSERT INTO public.bookings (
    business_id,
    customer_id,
    table_id,
    customer_name,
    customer_phone,
    booking_date,
    start_time,
    end_time,
    duration_minutes,
    game_type,
    num_players,
    status,
    source,
    idempotency_key
  ) VALUES (
    p_business_id,
    v_customer_id,
    p_table_id,
    COALESCE(p_customer_name, 'Guest'),
    v_clean_phone,
    p_booking_date,
    p_start_time,
    p_end_time,
    p_duration_minutes,
    p_game_type,
    p_num_players,
    'confirmed',
    p_source,
    p_idempotency_key
  )
  RETURNING * INTO v_new_booking;

  RETURN jsonb_build_object('success', true, 'booking', row_to_json(v_new_booking));
EXCEPTION
  WHEN exclusion_violation THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Table was just reserved by another customer a moment ago.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'reason', SQLERRM);
END;
$$;
