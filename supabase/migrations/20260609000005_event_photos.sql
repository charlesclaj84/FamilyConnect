-- Event photo galleries

CREATE TABLE IF NOT EXISTS event_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  family_code  TEXT        NOT NULL,
  uploader_id  UUID        REFERENCES people(id) ON DELETE SET NULL,
  file_path    TEXT        NOT NULL,
  caption      TEXT,
  taken_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view event photos"
  ON event_photos FOR SELECT
  TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "family can upload event photos"
  ON event_photos FOR INSERT
  TO authenticated
  WITH CHECK (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "uploaders and admins can delete event photos"
  ON event_photos FOR DELETE
  TO authenticated
  USING (
    uploader_id IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );
