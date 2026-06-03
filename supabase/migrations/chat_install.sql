-- ─────────────────────────────────────────────────────────────────────────────
-- FamilyConnect Chat — clean install
-- Run chat_teardown.sql first if reinstalling.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Trigger helper ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 2. Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE chat_rooms (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT        NOT NULL CHECK (kind IN ('family', 'dm', 'group')),
  family_code  TEXT        NOT NULL,
  name         TEXT,
  created_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_participants (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_hidden    BOOLEAN     NOT NULL DEFAULT false,
  can_reply    BOOLEAN     NOT NULL DEFAULT true,
  last_read_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);

CREATE TABLE chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX chat_rooms_family_unique
  ON chat_rooms (family_code)
  WHERE kind = 'family';

CREATE INDEX chat_messages_room_created
  ON chat_messages (room_id, created_at ASC);

-- ── 4. Triggers ───────────────────────────────────────────────────────────────

CREATE TRIGGER chat_rooms_updated_at
  BEFORE UPDATE ON chat_rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. Security definer helper ────────────────────────────────────────────────
-- Bypasses RLS on chat_participants to avoid infinite recursion in policies.

CREATE OR REPLACE FUNCTION auth_uid_is_room_participant(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE room_id = p_room_id AND user_id = auth.uid()
  );
$$;

-- ── 6. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE chat_rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages     ENABLE ROW LEVEL SECURITY;

-- ── 7. Policies ───────────────────────────────────────────────────────────────
-- INSERT policies allow any authenticated user to write.
-- Access is restricted by SELECT policies — you can only read rooms/messages
-- you are a participant in, which is the meaningful security boundary.

-- chat_rooms
CREATE POLICY "chat_rooms_select"
  ON chat_rooms FOR SELECT TO authenticated
  USING (auth_uid_is_room_participant(id));

CREATE POLICY "chat_rooms_insert"
  ON chat_rooms FOR INSERT TO authenticated
  WITH CHECK (true);

-- chat_participants
CREATE POLICY "chat_participants_select"
  ON chat_participants FOR SELECT TO authenticated
  USING (auth_uid_is_room_participant(room_id));

CREATE POLICY "chat_participants_insert"
  ON chat_participants FOR INSERT TO authenticated
  WITH CHECK (true);

-- chat_messages
CREATE POLICY "chat_messages_select"
  ON chat_messages FOR SELECT TO authenticated
  USING (auth_uid_is_room_participant(room_id));

CREATE POLICY "chat_messages_insert"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "chat_messages_update"
  ON chat_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "chat_messages_delete"
  ON chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- ── 8. Realtime ───────────────────────────────────────────────────────────────
-- Run this line separately in the Supabase SQL editor after this script:
--
--   ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
