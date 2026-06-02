CREATE TABLE IF NOT EXISTS families (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT        UNIQUE NOT NULL,
  family_name TEXT        NOT NULL,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view the family they belong to (matched via their stored metadata).
CREATE POLICY "members can view own family"
  ON families FOR SELECT
  TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
  );
