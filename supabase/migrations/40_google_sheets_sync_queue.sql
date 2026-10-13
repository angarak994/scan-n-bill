-- Migration 40: Google Sheets Sync Queue & Observability
-- Provides durable transactional outbox queue for asynchronous Sheets synchronization.

CREATE TABLE IF NOT EXISTS public.sheets_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'SESSION' | 'BOOKING' | 'ORDER' | 'RECONCILE'
  entity_id TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'SYNCED', 'FAILED'
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sheets_sync_queue_status ON public.sheets_sync_queue(business_id, status);
CREATE INDEX IF NOT EXISTS idx_sheets_sync_queue_key ON public.sheets_sync_queue(idempotency_key);

ALTER TABLE public.sheets_sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for service role on sheets_sync_queue" ON public.sheets_sync_queue FOR ALL USING (auth.role() = 'service_role');
