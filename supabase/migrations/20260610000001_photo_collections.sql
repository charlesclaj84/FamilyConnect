-- ============================================================
-- photo_collections: standalone or event-linked albums
-- ============================================================
CREATE TABLE IF NOT EXISTS photo_collections (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code    TEXT        NOT NULL,
  event_id       UUID        REFERENCES events(id) ON DELETE SET NULL,
  name           TEXT        NOT NULL,
  description    TEXT,
  cover_photo_id UUID,       -- FK wired below after photos table exists
  created_by     UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE photo_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view photo_collections"
  ON photo_collections FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "family can create photo_collections"
  ON photo_collections FOR INSERT TO authenticated
  WITH CHECK (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "creator or admin can update photo_collections"
  ON photo_collections FOR UPDATE TO authenticated
  USING (
    created_by IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE POLICY "creator or admin can delete photo_collections"
  ON photo_collections FOR DELETE TO authenticated
  USING (
    created_by IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE OR REPLACE FUNCTION update_photo_collections_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER photo_collections_updated_at
  BEFORE UPDATE ON photo_collections
  FOR EACH ROW EXECUTE FUNCTION update_photo_collections_updated_at();

-- ============================================================
-- photos: individual photos within a collection
-- ============================================================
CREATE TABLE IF NOT EXISTS photos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID        NOT NULL REFERENCES photo_collections(id) ON DELETE CASCADE,
  family_code   TEXT        NOT NULL,
  uploader_id   UUID        REFERENCES people(id) ON DELETE SET NULL,
  file_path     TEXT        NOT NULL,
  caption       TEXT,
  taken_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view photos"
  ON photos FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "family can upload photos"
  ON photos FOR INSERT TO authenticated
  WITH CHECK (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "uploader or admin can update photos"
  ON photos FOR UPDATE TO authenticated
  USING (
    uploader_id IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE POLICY "uploader or admin can delete photos"
  ON photos FOR DELETE TO authenticated
  USING (
    uploader_id IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

-- ============================================================
-- photo_tags: tag people present in a photo
-- ============================================================
CREATE TABLE IF NOT EXISTS photo_tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id   UUID        NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  person_id  UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  tagged_by  UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (photo_id, person_id)
);

ALTER TABLE photo_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view photo_tags"
  ON photo_tags FOR SELECT TO authenticated
  USING (
    photo_id IN (
      SELECT p.id FROM photos p
      WHERE p.family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE POLICY "family can create photo_tags"
  ON photo_tags FOR INSERT TO authenticated
  WITH CHECK (
    photo_id IN (
      SELECT p.id FROM photos p
      WHERE p.family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE POLICY "tagger or admin can delete photo_tags"
  ON photo_tags FOR DELETE TO authenticated
  USING (
    tagged_by IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

-- Wire the deferred FK for cover photo
ALTER TABLE photo_collections
  ADD CONSTRAINT photo_collections_cover_photo_fk
  FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL;

-- ============================================================
-- Storage bucket for photos (public, 10 MB limit)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated can upload to photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "public can view photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'photos');

CREATE POLICY "uploader can delete from photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
