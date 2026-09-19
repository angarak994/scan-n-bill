ALTER TABLE promotions ADD COLUMN IF NOT EXISTS time_slot_start TIME;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS time_slot_end TIME;
