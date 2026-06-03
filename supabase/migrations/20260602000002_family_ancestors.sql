-- Family ancestor relationships (up to grandparents)
-- Each user can have one record per relationship type.
CREATE TABLE IF NOT EXISTS family_ancestors (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_code     TEXT        NOT NULL,
  relationship    TEXT        NOT NULL,  -- e.g. 'father', 'paternal_grandfather'
  first_name      TEXT,
  last_name       TEXT,
  primary_email   TEXT,
  date_of_birth   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, relationship)
);

ALTER TABLE family_ancestors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own ancestors"
  ON family_ancestors FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Reuse the set_updated_at function created in the previous migration.
CREATE TRIGGER family_ancestors_updated_at
  BEFORE UPDATE ON family_ancestors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
