-- ============================================================================
-- Multi-family membership: one email may belong to more than one family.
--
-- BACKGROUND
--   people.user_id was UNIQUE, so an auth user could belong to exactly one
--   family. Every family-scoped RLS policy in this schema derives the caller's
--   family from public.auth_family_code(), which was:
--       SELECT family_code FROM people WHERE user_id = auth.uid() LIMIT 1;
--   With more than one people row that LIMIT 1 returns an ARBITRARY family, so
--   simply dropping the UNIQUE constraint would silently break every policy.
--   This migration makes the resolver deterministic and membership-validated.
--
-- MODEL
--   * people          — one row per (user, family). This stays the family-scoped
--                       actor, so all 28 FKs pointing at people(id) and every
--                       existing RLS policy keep working untouched.
--   * shared profile  — identity columns (name, contact, address, DOB, shirt)
--                       are kept identical across a user's rows by a trigger, so
--                       details are entered once and shared. Per-family columns
--                       (family_code, chapter_id, is_admin, can_approve) are not
--                       synced.
--   * active/default  — user_family_settings holds which family the user is
--                       currently viewing and which one to open on login.
--
-- SECURITY
--   auth_family_code() only ever selects from the caller's OWN people rows, so a
--   stale or forged "active family" value can never grant access to a family the
--   user is not a member of — it just falls through to the next candidate.
--   Writes to user_family_settings have no RLS policy at all: they are only
--   possible via the SECURITY DEFINER RPCs below (which re-check membership) or
--   the service-role key.
--
-- IDEMPOTENT: safe to run more than once.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260617000000_multi_family_membership.sql
--
-- ROLLBACK (only valid while every user still has a single people row):
--   DROP TRIGGER  IF EXISTS people_sync_shared_profile ON public.people;
--   DROP FUNCTION IF EXISTS public.sync_shared_person_profile();
--   DROP FUNCTION IF EXISTS public.set_active_family(text);
--   DROP FUNCTION IF EXISTS public.set_default_family(text);
--   DROP FUNCTION IF EXISTS public.my_families();
--   DROP TABLE    IF EXISTS public.user_family_settings;
--   ALTER TABLE   public.people DROP CONSTRAINT IF EXISTS people_user_family_key;
--   ALTER TABLE   public.people ADD  CONSTRAINT people_user_id_key UNIQUE (user_id);
--   -- then restore auth_family_code()/get_my_family_code() to their LIMIT 1 form.
-- ============================================================================

BEGIN;

-- ── 1. Allow one user to hold a people row in several families ───────────────
-- The original constraint was declared inline, so its name is generated. Look it
-- up rather than assuming people_user_id_key.
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  WHERE c.conrelid = 'public.people'::regclass
    AND c.contype  = 'u'
    AND array_length(c.conkey, 1) = 1
    AND c.conkey[1] = (
      SELECT a.attnum FROM pg_attribute a
      WHERE a.attrelid = 'public.people'::regclass AND a.attname = 'user_id'
    );

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.people DROP CONSTRAINT %I', v_conname);
    RAISE NOTICE 'dropped single-family constraint %', v_conname;
  ELSE
    RAISE NOTICE 'no UNIQUE(user_id) constraint on people — already migrated';
  END IF;
END $$;

-- One membership per (user, family).
--
-- Declared as a table CONSTRAINT rather than a partial unique index on purpose:
-- PostgREST upserts target it by name via onConflict='user_id,family_code' (see
-- app/actions/personal-info.ts), and ON CONFLICT cannot infer a *partial* index
-- without repeating its WHERE clause, which PostgREST has no way to send.
--
-- Unlinked people (user_id IS NULL) are unaffected: NULLs compare as distinct in
-- a unique constraint, so any number of them can share a family_code.
DO $$
BEGIN
  ALTER TABLE public.people
    ADD CONSTRAINT people_user_family_key UNIQUE (user_id, family_code);
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    RAISE NOTICE 'people_user_family_key already exists';
END $$;

-- ── 2. Which family is the user viewing, and which opens on login ────────────
CREATE TABLE IF NOT EXISTS public.user_family_settings (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_family_code  TEXT,
  default_family_code TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_family_settings ENABLE ROW LEVEL SECURITY;

-- Read-only to the owner. There is deliberately NO insert/update policy: the
-- RPCs below are SECURITY DEFINER and re-validate membership, so they are the
-- only supported write path for an end user.
DROP POLICY IF EXISTS "own family settings are readable" ON public.user_family_settings;
CREATE POLICY "own family settings are readable"
  ON public.user_family_settings FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── 3. Deterministic, membership-validated family resolver ──────────────────
-- Preference order: the active selection, then the login default, then the
-- oldest membership. Because the candidate set is the caller's own people rows,
-- an active/default value naming a family they do not belong to simply never
-- matches — it cannot widen access.
CREATE OR REPLACE FUNCTION public.auth_family_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.family_code
  FROM public.people p
  LEFT JOIN public.user_family_settings s ON s.user_id = p.user_id
  WHERE p.user_id = (SELECT auth.uid())
  ORDER BY
    (p.family_code = s.active_family_code)  DESC NULLS LAST,
    (p.family_code = s.default_family_code) DESC NULLS LAST,
    p.created_at ASC,
    p.id ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_family_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_family_code() TO authenticated;

-- The chat schema shipped its own copy of the same idea (also LIMIT 1). Fold it
-- into the resolver above so chat cannot disagree with the rest of the app.
CREATE OR REPLACE FUNCTION public.get_my_family_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.auth_family_code();
$$;

REVOKE ALL ON FUNCTION public.get_my_family_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_family_code() TO authenticated;

-- ── 4. Switching families / choosing the login default ──────────────────────
CREATE OR REPLACE FUNCTION public.set_active_family(p_family_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.people
    WHERE user_id = v_uid AND family_code = p_family_code
  ) THEN
    RAISE EXCEPTION 'not a member of family %', p_family_code;
  END IF;

  INSERT INTO public.user_family_settings (user_id, active_family_code, updated_at)
  VALUES (v_uid, p_family_code, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET active_family_code = EXCLUDED.active_family_code,
        updated_at         = NOW();

  RETURN p_family_code;
END $$;

CREATE OR REPLACE FUNCTION public.set_default_family(p_family_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.people
    WHERE user_id = v_uid AND family_code = p_family_code
  ) THEN
    RAISE EXCEPTION 'not a member of family %', p_family_code;
  END IF;

  INSERT INTO public.user_family_settings (user_id, default_family_code, updated_at)
  VALUES (v_uid, p_family_code, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET default_family_code = EXCLUDED.default_family_code,
        updated_at          = NOW();

  RETURN p_family_code;
END $$;

REVOKE ALL ON FUNCTION public.set_active_family(text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_default_family(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_family(text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_family(text) TO authenticated;

-- ── 5. One shared profile across a user's memberships ───────────────────────
-- Identity columns describe the human, not the membership, so a change in one
-- family propagates to the others. Per-family columns are intentionally absent
-- from this list.
CREATE OR REPLACE FUNCTION public.sync_shared_person_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Unlinked people (no account) are family-local records; nothing to share.
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- The UPDATE below re-fires this trigger on the sibling rows. Bail out on the
  -- nested pass so propagation is a single hop and cannot recurse.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  UPDATE public.people AS t
  SET prefix          = NEW.prefix,
      first_name      = NEW.first_name,
      middle_name     = NEW.middle_name,
      last_name       = NEW.last_name,
      suffix          = NEW.suffix,
      nick_name       = NEW.nick_name,
      primary_email   = NEW.primary_email,
      primary_phone   = NEW.primary_phone,
      street_address  = NEW.street_address,
      apartment       = NEW.apartment,
      city            = NEW.city,
      state           = NEW.state,
      zip_code        = NEW.zip_code,
      country         = NEW.country,
      date_of_birth   = NEW.date_of_birth,
      sunset_date     = NEW.sunset_date,
      tshirt_category = NEW.tshirt_category,
      tshirt_size     = NEW.tshirt_size,
      avatar_url      = NEW.avatar_url,
      time_zone       = NEW.time_zone,
      is_minor        = NEW.is_minor,
      updated_at      = NOW()
  WHERE t.user_id = NEW.user_id
    AND t.id     <> NEW.id
    -- Skip rows already in sync so the nested pass changes nothing.
    AND (t.prefix, t.first_name, t.middle_name, t.last_name, t.suffix,
         t.nick_name, t.primary_email, t.primary_phone, t.street_address,
         t.apartment, t.city, t.state, t.zip_code, t.country, t.date_of_birth,
         t.sunset_date, t.tshirt_category, t.tshirt_size, t.avatar_url,
         t.time_zone, t.is_minor)
        IS DISTINCT FROM
        (NEW.prefix, NEW.first_name, NEW.middle_name, NEW.last_name, NEW.suffix,
         NEW.nick_name, NEW.primary_email, NEW.primary_phone, NEW.street_address,
         NEW.apartment, NEW.city, NEW.state, NEW.zip_code, NEW.country,
         NEW.date_of_birth, NEW.sunset_date, NEW.tshirt_category,
         NEW.tshirt_size, NEW.avatar_url, NEW.time_zone, NEW.is_minor);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS people_sync_shared_profile ON public.people;
CREATE TRIGGER people_sync_shared_profile
  AFTER INSERT OR UPDATE OF
    prefix, first_name, middle_name, last_name, suffix, nick_name,
    primary_email, primary_phone, street_address, apartment, city, state,
    zip_code, country, date_of_birth, sunset_date, tshirt_category,
    tshirt_size, avatar_url, time_zone, is_minor
  ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shared_person_profile();

-- ── 6. Convenience: the caller's memberships, newest-relevant first ──────────
-- Returns one row per family the caller belongs to, with the family's display
-- name and which one is active / the login default.
CREATE OR REPLACE FUNCTION public.my_families()
RETURNS TABLE (
  family_code  text,
  family_name  text,
  person_id    uuid,
  is_active    boolean,
  is_default   boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.family_code,
         COALESCE(f.family_name, p.family_code) AS family_name,
         p.id                                   AS person_id,
         p.family_code = public.auth_family_code() AS is_active,
         COALESCE(p.family_code = s.default_family_code, false) AS is_default
  FROM public.people p
  LEFT JOIN public.families f            ON f.family_code = p.family_code
  LEFT JOIN public.user_family_settings s ON s.user_id     = p.user_id
  WHERE p.user_id = (SELECT auth.uid())
  ORDER BY family_name ASC;
$$;

REVOKE ALL ON FUNCTION public.my_families() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_families() TO authenticated;

-- ── 7. Preserve today's login behaviour for existing users ──────────────────
-- Everyone currently has exactly one family; make it their explicit default so
-- adding a second membership later cannot change which family they land in.
INSERT INTO public.user_family_settings (user_id, default_family_code, active_family_code, updated_at)
SELECT p.user_id, MIN(p.family_code), MIN(p.family_code), NOW()
FROM public.people p
WHERE p.user_id IS NOT NULL
  AND p.family_code IS NOT NULL
  AND p.family_code <> ''
GROUP BY p.user_id
HAVING COUNT(*) = 1
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
