-- Add group messaging and DM soft-delete support.

-- Allow 'group' as a room kind
ALTER TABLE chat_rooms DROP CONSTRAINT chat_rooms_kind_check;
ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_kind_check
  CHECK (kind IN ('family', 'dm', 'group'));

-- Track who created the room (needed for group permission checks)
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Per-user flags on each room:
--   is_hidden  = user soft-deleted this room (no longer sees it)
--   can_reply  = user is allowed to send messages (false when DM partner deletes)
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS is_hidden  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS can_reply  BOOLEAN NOT NULL DEFAULT true;
