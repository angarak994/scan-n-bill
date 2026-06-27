-- This migration ensures that a single table can never have more than one 'ACTIVE' session at any given time.
-- This prevents race conditions where two simultaneous "Start Session" requests create duplicate sessions.

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_table_session 
ON sessions (table_id, business_id) 
WHERE status = 'ACTIVE';
