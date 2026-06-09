-- Announcements: org-wide or chapter-scoped messages posted by admins

CREATE TABLE IF NOT EXISTS announcements (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  author_id    UUID        REFERENCES people(id) ON DELETE SET NULL,
  scope        TEXT        NOT NULL DEFAULT 'national' CHECK (scope IN ('national', 'regional', 'chapter')),
  scope_id     UUID,
  pinned       BOOLEAN     NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can insert announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
        AND is_admin = true
    )
  );

CREATE POLICY "admins can update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
        AND is_admin = true
    )
  );

CREATE POLICY "admins can delete announcements"
  ON announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
        AND is_admin = true
    )
  );

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
