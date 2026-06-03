-- Track when each user last read each room, used for unread indicators.
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;
