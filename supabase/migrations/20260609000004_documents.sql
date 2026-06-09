-- Family documents: meeting minutes, bylaws, forms, etc.

CREATE TABLE IF NOT EXISTS documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code     TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  description     TEXT,
  file_path       TEXT        NOT NULL,
  file_size_bytes INT,
  mime_type       TEXT,
  category        TEXT        NOT NULL DEFAULT 'other' CHECK (category IN ('minutes', 'bylaws', 'forms', 'photos', 'other')),
  scope           TEXT        NOT NULL DEFAULT 'national' CHECK (scope IN ('national', 'regional', 'chapter')),
  scope_id        UUID,
  uploaded_by     UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

CREATE POLICY "admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );
