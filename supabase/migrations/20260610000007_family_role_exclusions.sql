-- Lets an admin choose which GLOBAL board positions their family uses.
-- A row here means "this global position is NOT used by this family".
-- No rows (the default) = every global position is available.

CREATE TABLE IF NOT EXISTS family_role_exclusions (
  family_code TEXT        NOT NULL,
  role_id     UUID        NOT NULL REFERENCES family_roles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (family_code, role_id)
);

ALTER TABLE family_role_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view role exclusions"
  ON family_role_exclusions FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can manage role exclusions"
  ON family_role_exclusions FOR ALL TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  )
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );
