-- All Day flag and explicit start/end times on events
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_all_day  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time  TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time    TIME;
