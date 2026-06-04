-- Regions (custom groupings above chapters; "National" is the implicit default, not stored)
CREATE TABLE regions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_code, name)
);

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read regions"
  ON regions FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

-- Chapters now optionally belong to a region (NULL = National)
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL;
