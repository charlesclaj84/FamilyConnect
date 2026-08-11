-- ============================================================================
-- Gender on a person's profile.
--
-- WHY THE CHECK CONSTRAINT AND NOT JUST A <select>
--   `saveProfileSection` and `updateUserProfile` are `'use server'` exports, which
--   makes them public HTTP endpoints taking a JSON object. `lib/profile-columns.ts`
--   decides which KEYS reach the row; it has no opinion about what those keys
--   contain, and by design — it is an allow-list of columns, not a validator. So
--   adding 'gender' to it makes `gender: <anything at all>` a writable string.
--
--   The two values the product offers are therefore stated here, at the layer a
--   caller who never loads the form cannot talk past. A third value later is a
--   migration, which is the correct amount of friction for changing what the column
--   is allowed to mean.
--
-- WHY IT IS A SHARED PROFILE COLUMN
--   `people` holds one row per family a user belongs to, and 20260617000000 splits
--   the columns into two kinds: those describing the HUMAN, which propagate across
--   a user's memberships, and those describing the MEMBERSHIP, which do not. Gender
--   is the first kind, so it joins prefix/name/date_of_birth in both directions of
--   that sync — outward on UPDATE, inherited on INSERT.
--
--   All three parts have to move together or the column half-syncs:
--     * the SET list and the "already in sync" tuple in sync_shared_person_profile()
--     * the UPDATE OF column list on the trigger — a column absent from THAT never
--       fires the function at all, so the function's SET list would be dead code
--     * the COALESCE list in inherit_shared_person_profile()
--
-- IDEMPOTENT: safe to run more than once.
-- ============================================================================

BEGIN;

ALTER TABLE public.people ADD COLUMN IF NOT EXISTS gender TEXT;

-- Dropped and re-added rather than IF NOT EXISTS, so re-running this file with a
-- different value list actually installs the new one.
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_gender_check;
ALTER TABLE public.people ADD CONSTRAINT people_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female'));

COMMENT ON COLUMN public.people.gender IS
  'male | female | NULL (not stated). Shared across the user''s memberships.';

-- ── Outbound: an edit in one family propagates to the others ────────────────
-- Verbatim from 20260617000000 apart from `gender`, which appears in three places:
-- the SET, and both halves of the IS DISTINCT FROM guard that stops the nested pass.
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
      gender          = NEW.gender,
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
         t.sunset_date, t.gender, t.tshirt_category, t.tshirt_size, t.avatar_url,
         t.time_zone, t.is_minor)
        IS DISTINCT FROM
        (NEW.prefix, NEW.first_name, NEW.middle_name, NEW.last_name, NEW.suffix,
         NEW.nick_name, NEW.primary_email, NEW.primary_phone, NEW.street_address,
         NEW.apartment, NEW.city, NEW.state, NEW.zip_code, NEW.country,
         NEW.date_of_birth, NEW.sunset_date, NEW.gender, NEW.tshirt_category,
         NEW.tshirt_size, NEW.avatar_url, NEW.time_zone, NEW.is_minor);

  RETURN NEW;
END $$;

-- ── Inbound: a new membership joins the profile that already exists ─────────
-- Verbatim from 20260617000001 apart from `gender`. It sits with date_of_birth
-- and sunset_date rather than with the text columns above them: those use
-- NULLIF(x, '') because they are NOT NULL DEFAULT '' or routinely blank, whereas
-- gender is either one of two words or NULL — '' is not a value it can hold, so a
-- plain COALESCE is both sufficient and honest about that.
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
  NEW.gender          := COALESCE(NEW.gender,                      s.gender);

  RETURN NEW;
END $$;

-- The trigger has to be recreated, not just the function: `UPDATE OF <cols>` is a
-- property of the TRIGGER, and a write that touches only `gender` does not match
-- the old list, so the function above would never run for the one column this
-- migration exists to sync.
DROP TRIGGER IF EXISTS people_sync_shared_profile ON public.people;
CREATE TRIGGER people_sync_shared_profile
  AFTER UPDATE OF
    prefix, first_name, middle_name, last_name, suffix, nick_name,
    primary_email, primary_phone, street_address, apartment, city, state,
    zip_code, country, date_of_birth, sunset_date, gender, tshirt_category,
    tshirt_size, avatar_url, time_zone, is_minor
  ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shared_person_profile();

-- No GRANT for either function: EXECUTE on a trigger function is checked at
-- CREATE TRIGGER time, not at fire time, and CREATE OR REPLACE preserves the ACL
-- these two already carry. See AGENTS.md §2b.

-- ── Verify ─────────────────────────────────────────────────────────────────
-- Everything below needs no fixture, so none of it can skip. plpgsql does not
-- resolve names in a function body until the body runs, so a typo'd column in
-- either function above would have been created without complaint and thrown for
-- the first caller — hence checking the definitions, not just that they exist.
DO $$
DECLARE
  v_attnum smallint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'people' AND column_name = 'gender'
  ) THEN
    RAISE EXCEPTION 'people.gender was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.people'::regclass AND conname = 'people_gender_check'
  ) THEN
    RAISE EXCEPTION 'people_gender_check is missing — gender would accept any string';
  END IF;

  IF pg_get_functiondef('public.sync_shared_person_profile()'::regprocedure) NOT LIKE '%gender%' THEN
    RAISE EXCEPTION 'sync_shared_person_profile() does not mention gender';
  END IF;

  IF pg_get_functiondef('public.inherit_shared_person_profile()'::regprocedure) NOT LIKE '%gender%' THEN
    RAISE EXCEPTION 'inherit_shared_person_profile() does not mention gender';
  END IF;

  -- The trigger's UPDATE OF list, which is the half that is easy to forget.
  SELECT attnum INTO v_attnum
    FROM pg_attribute
   WHERE attrelid = 'public.people'::regclass AND attname = 'gender';

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.people'::regclass
      AND tgname  = 'people_sync_shared_profile'
      AND v_attnum = ANY (tgattr)
  ) THEN
    RAISE EXCEPTION 'people_sync_shared_profile does not fire on gender';
  END IF;
END $$;

COMMIT;
