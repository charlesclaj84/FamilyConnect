-- Fix: INSERT policies on chat_rooms and chat_participants were still failing
-- because the subquery against `people` is itself gated by an RLS policy that
-- relies on JWT claims. A SECURITY DEFINER helper bypasses that chain entirely.

CREATE OR REPLACE FUNCTION get_my_family_code()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT family_code FROM people WHERE user_id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS "family members can create rooms"            ON chat_rooms;
DROP POLICY IF EXISTS "family members can be added as participants" ON chat_participants;

CREATE POLICY "family members can create rooms"
  ON chat_rooms FOR INSERT TO authenticated
  WITH CHECK (family_code = get_my_family_code());

CREATE POLICY "family members can be added as participants"
  ON chat_participants FOR INSERT TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT id FROM chat_rooms WHERE family_code = get_my_family_code()
    )
  );
