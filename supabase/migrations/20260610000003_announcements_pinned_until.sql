-- Allow pinned announcements to auto-expire on a given date/time
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS pinned_until TIMESTAMPTZ NULL;
