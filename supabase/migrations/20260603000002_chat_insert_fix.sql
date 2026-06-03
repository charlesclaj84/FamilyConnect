-- Fix: chat_rooms and chat_participants INSERT policies were checking family_code
-- against the JWT claim, which may not be present in every token. Replace with a
-- direct lookup against the people table, which is always authoritative.

DROP POLICY IF EXISTS "family members can create rooms"           ON chat_rooms;
DROP POLICY IF EXISTS "family members can be added as participants" ON chat_participants;

CREATE POLICY "family members can create rooms"
  ON chat_rooms FOR INSERT TO authenticated
  WITH CHECK (
    family_code IN (
      SELECT family_code FROM people WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "family members can be added as participants"
  ON chat_participants FOR INSERT TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT id FROM chat_rooms
      WHERE family_code IN (
        SELECT family_code FROM people WHERE user_id = auth.uid()
      )
    )
  );
