-- Schema redesign: replace adults/kids/family_ancestors with a unified
-- people table plus relationship_types and person_relationships.

-- Drop old tables (CASCADE removes any dependent FKs/triggers automatically)
DROP TABLE IF EXISTS family_ancestors   CASCADE;
DROP TABLE IF EXISTS kids               CASCADE;
DROP TABLE IF EXISTS adults             CASCADE;

-- Ensure the trigger function exists (created in migration 001; repeated
-- here so this migration is safe to run on a fresh schema).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── People ─────────────────────────────────────────────────────────────────────
-- Every family member — whether they have a Family Connect account or not.
-- is_minor=true   → child
-- is_minor=false  → adult
-- user_id         → set only when the person has registered an account

CREATE TABLE IF NOT EXISTS people (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  family_code      TEXT        NOT NULL,
  is_minor         BOOLEAN     NOT NULL DEFAULT false,
  prefix           TEXT,
  first_name       TEXT        NOT NULL DEFAULT '',
  middle_name      TEXT,
  last_name        TEXT        NOT NULL DEFAULT '',
  suffix           TEXT,
  primary_email    TEXT,
  primary_phone    TEXT,
  street_address   TEXT,
  apartment        TEXT,
  city             TEXT,
  state            TEXT,
  zip_code         TEXT,
  country          TEXT,
  date_of_birth    DATE,
  sunset_date      DATE,
  tshirt_category  TEXT,
  tshirt_size      TEXT,
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;

-- All family members can view everyone in their family
CREATE POLICY "family can view people"
  ON people FOR SELECT
  TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

-- Family members can add new people
CREATE POLICY "family can insert people"
  ON people FOR INSERT
  TO authenticated
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND (created_by = auth.uid() OR user_id = auth.uid())
  );

-- Users can update their own record or any record they added
CREATE POLICY "users can update own or created people"
  ON people FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

-- Users can delete records they added, but only if that person has no account
CREATE POLICY "users can delete people they created without accounts"
  ON people FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() AND user_id IS NULL);

CREATE TRIGGER people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── Relationship Types ─────────────────────────────────────────────────────────
-- Global read-only lookup. Pre-seeded — users cannot add/remove types.

CREATE TABLE IF NOT EXISTS relationship_types (
  id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT  UNIQUE NOT NULL
);

ALTER TABLE relationship_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read relationship types"
  ON relationship_types FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO relationship_types (name) VALUES
  ('Father'),
  ('Mother'),
  ('Paternal Grandfather'),
  ('Paternal Grandmother'),
  ('Maternal Grandfather'),
  ('Maternal Grandmother'),
  ('Son'),
  ('Daughter'),
  ('Grandson'),
  ('Granddaughter'),
  ('Brother'),
  ('Sister'),
  ('Uncle'),
  ('Aunt'),
  ('Nephew'),
  ('Niece'),
  ('Cousin'),
  ('Husband'),
  ('Wife'),
  ('Partner')
ON CONFLICT (name) DO NOTHING;


-- ── Person Relationships ───────────────────────────────────────────────────────
-- Connects two people with a typed, optionally step relationship.
-- Reading: "person_id HAS relationship_type TO related_person_id"
-- e.g. Me → Father → Dad's people record
-- is_step = true turns "Son" into "Step-Son", "Father" into "Step-Father", etc.

CREATE TABLE IF NOT EXISTS person_relationships (
  id                   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id            UUID     NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  related_person_id    UUID     NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type_id UUID     NOT NULL REFERENCES relationship_types(id) ON DELETE RESTRICT,
  is_step              BOOLEAN  NOT NULL DEFAULT false,
  family_code          TEXT     NOT NULL,
  created_by           UUID     REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, related_person_id, relationship_type_id)
);

ALTER TABLE person_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view relationships"
  ON person_relationships FOR SELECT
  TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "family can insert relationships"
  ON person_relationships FOR INSERT
  TO authenticated
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND created_by = auth.uid()
  );

CREATE POLICY "users can update own relationships"
  ON person_relationships FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "users can delete own relationships"
  ON person_relationships FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

CREATE TRIGGER person_relationships_updated_at
  BEFORE UPDATE ON person_relationships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
