-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_rooms (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT        NOT NULL CHECK (kind IN ('family', 'dm')),
  family_code  TEXT        NOT NULL,
  name         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_family_unique
  ON chat_rooms (family_code)
  WHERE kind = 'family';

CREATE TRIGGER chat_rooms_updated_at
  BEFORE UPDATE ON chat_rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS chat_participants (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_room_created
  ON chat_messages (room_id, created_at ASC);

CREATE TRIGGER chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- All tables are created above before any policy references them.

ALTER TABLE chat_rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages     ENABLE ROW LEVEL SECURITY;

-- chat_rooms
CREATE POLICY "participants can view rooms"
  ON chat_rooms FOR SELECT TO authenticated
  USING (
    id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "family members can create rooms"
  ON chat_rooms FOR INSERT TO authenticated
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
  );

-- chat_participants
CREATE POLICY "participants can view room members"
  ON chat_participants FOR SELECT TO authenticated
  USING (
    room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "family members can be added as participants"
  ON chat_participants FOR INSERT TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT id FROM chat_rooms
      WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

-- chat_messages
CREATE POLICY "participants can read messages"
  ON chat_messages FOR SELECT TO authenticated
  USING (
    room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "participants can send messages"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "senders can update own messages"
  ON chat_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "senders can delete own messages"
  ON chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- ── Enable Realtime ───────────────────────────────────────────────────────────
-- Run this line manually in the Supabase SQL editor after applying this migration:
--
--   ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
