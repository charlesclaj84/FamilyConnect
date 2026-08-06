CREATE TABLE IF NOT EXISTS families (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT        UNIQUE NOT NULL,
  family_name TEXT        NOT NULL,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view the family they belong to (matched via their stored metadata).
--
-- SUPERSEDED by 20260615000004, which replaces this policy because user_metadata is
-- writable by its owner and so cannot carry a security boundary. It is left here
-- rather than edited because a migration should say what it did at the time.
--
-- The guard is not decoration. Everything else in this file is idempotent
-- (CREATE TABLE IF NOT EXISTS, ALTER TABLE ... ENABLE ROW LEVEL SECURITY), and this
-- CREATE POLICY originally had neither a DROP nor IF NOT EXISTS — so replaying this
-- file against a live database recreated the spoofable policy ALONGSIDE its secure
-- replacement, which 20260618000001 had renamed out of the way. Permissive policies
-- are OR-ed, so the resurrected one silently won. That is a real incident, not a
-- hypothetical: see 20260806000009, which cleaned it up.
--
-- auth_family_code() exists from 20260615000004 onward, so its presence is a reliable
-- "this database is past the fix" test, and a replay becomes a no-op.
DO $$
BEGIN
  IF to_regprocedure('public.auth_family_code()') IS NOT NULL THEN
    RAISE NOTICE
      'skipping the legacy user_metadata policy: auth_family_code() exists, so 20260615000004 has already superseded it';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "members can view own family" ON families;
  CREATE POLICY "members can view own family"
    ON families FOR SELECT
    TO authenticated
    USING (
      family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    );
END $$;
