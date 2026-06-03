-- Fix: infinite recursion in chat_participants RLS policy.
--
-- The original policies used subqueries on chat_participants inside its own
-- policy, causing Postgres to loop indefinitely. The standard fix is a
-- SECURITY DEFINER function that bypasses RLS when called from within a policy.

CREATE OR REPLACE FUNCTION auth_uid_is_room_participant(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE room_id = p_room_id
      AND user_id = auth.uid()
  );
$$;

-- ── Drop and recreate the three affected policies ─────────────────────────────

DROP POLICY IF EXISTS "participants can view rooms"       ON chat_rooms;
DROP POLICY IF EXISTS "participants can view room members" ON chat_participants;
DROP POLICY IF EXISTS "participants can read messages"    ON chat_messages;
DROP POLICY IF EXISTS "participants can send messages"    ON chat_messages;

-- chat_rooms: visible if the caller is a participant (non-recursive via fn)
CREATE POLICY "participants can view rooms"
  ON chat_rooms FOR SELECT TO authenticated
  USING (auth_uid_is_room_participant(id));

-- chat_participants: visible if the caller is in the same room (non-recursive)
CREATE POLICY "participants can view room members"
  ON chat_participants FOR SELECT TO authenticated
  USING (auth_uid_is_room_participant(room_id));

-- chat_messages: readable if the caller is a participant
CREATE POLICY "participants can read messages"
  ON chat_messages FOR SELECT TO authenticated
  USING (auth_uid_is_room_participant(room_id));

-- chat_messages: sendable if the caller is a participant and is the sender
CREATE POLICY "participants can send messages"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND auth_uid_is_room_participant(room_id)
  );
