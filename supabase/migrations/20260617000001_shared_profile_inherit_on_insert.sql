-- ============================================================================
-- Fix the INSERT direction of the shared-profile sync.
--
-- BUG IN 20260617000000
--   people_sync_shared_profile fired on AFTER INSERT as well as AFTER UPDATE, and
--   it always pushes the *triggering* row's values OUT to the user's other rows.
--   That is right for an UPDATE, but backwards for an INSERT: adding a second
--   membership with a blank/partial row (which is what registration and an admin
--   "add to my family" both do) propagated those blanks outwards and wiped the
--   real profile in the family the user already belonged to.
--
--   first_name/last_name are NOT NULL DEFAULT '', so this failed silently — the
--   name simply became empty rather than raising.
--
-- FIX
--   Split the two directions:
--     BEFORE INSERT  → inherit missing shared values FROM the oldest existing
--                      membership (a new row joins the profile that already exists)
--     AFTER  UPDATE  → propagate changes OUT to the other memberships (unchanged;
--                      this direction was already correct)
--
--   Inheritance only fills values that are absent (NULL, or '' for text), so an
--   insert that genuinely carries data keeps it.
--
--   Booleans are deliberately not inherited: is_minor is NOT NULL DEFAULT false,
--   so "not supplied" and "supplied as false" are indistinguishable at INSERT
--   time. It stays in the UPDATE sync, so it converges on the next profile edit.
--
-- IDEMPOTENT: safe to run more than once.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260617000001_shared_profile_inherit_on_insert.sql
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.inherit_shared_person_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s public.people;
BEGIN
  -- Unlinked people (no account) are family-local records; nothing to inherit.
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO s
    FROM public.people
   WHERE user_id = NEW.user_id
   ORDER BY created_at ASC, id ASC
   LIMIT 1;

  -- First membership for this user — nothing to inherit from.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.prefix          := COALESCE(NULLIF(NEW.prefix, ''),          s.prefix);
  NEW.first_name      := COALESCE(NULLIF(NEW.first_name, ''),      s.first_name);
  NEW.middle_name     := COALESCE(NULLIF(NEW.middle_name, ''),     s.middle_name);
  NEW.last_name       := COALESCE(NULLIF(NEW.last_name, ''),       s.last_name);
  NEW.suffix          := COALESCE(NULLIF(NEW.suffix, ''),          s.suffix);
  NEW.nick_name       := COALESCE(NULLIF(NEW.nick_name, ''),       s.nick_name);
  NEW.primary_email   := COALESCE(NULLIF(NEW.primary_email, ''),   s.primary_email);
  NEW.primary_phone   := COALESCE(NULLIF(NEW.primary_phone, ''),   s.primary_phone);
  NEW.street_address  := COALESCE(NULLIF(NEW.street_address, ''),  s.street_address);
  NEW.apartment       := COALESCE(NULLIF(NEW.apartment, ''),       s.apartment);
  NEW.city            := COALESCE(NULLIF(NEW.city, ''),            s.city);
  NEW.state           := COALESCE(NULLIF(NEW.state, ''),           s.state);
  NEW.zip_code        := COALESCE(NULLIF(NEW.zip_code, ''),        s.zip_code);
  NEW.country         := COALESCE(NULLIF(NEW.country, ''),         s.country);
  NEW.tshirt_category := COALESCE(NULLIF(NEW.tshirt_category, ''), s.tshirt_category);
  NEW.tshirt_size     := COALESCE(NULLIF(NEW.tshirt_size, ''),     s.tshirt_size);
  NEW.avatar_url      := COALESCE(NULLIF(NEW.avatar_url, ''),      s.avatar_url);
  NEW.time_zone       := COALESCE(NULLIF(NEW.time_zone, ''),       s.time_zone);
  NEW.date_of_birth   := COALESCE(NEW.date_of_birth,               s.date_of_birth);
  NEW.sunset_date     := COALESCE(NEW.sunset_date,                 s.sunset_date);

  RETURN NEW;
END $$;

-- Re-scope the original trigger to UPDATE only, and add the inbound direction.
DROP TRIGGER IF EXISTS people_sync_shared_profile    ON public.people;
DROP TRIGGER IF EXISTS people_inherit_shared_profile ON public.people;

CREATE TRIGGER people_inherit_shared_profile
  BEFORE INSERT ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.inherit_shared_person_profile();

CREATE TRIGGER people_sync_shared_profile
  AFTER UPDATE OF
    prefix, first_name, middle_name, last_name, suffix, nick_name,
    primary_email, primary_phone, street_address, apartment, city, state,
    zip_code, country, date_of_birth, sunset_date, tshirt_category,
    tshirt_size, avatar_url, time_zone, is_minor
  ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shared_person_profile();

COMMIT;
