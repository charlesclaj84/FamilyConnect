-- ============================================================================
-- What a geocoded address knows that six free-text boxes did not.
--
-- Asked for 2026-09-04, with Geoapify's Address Autocomplete on the profile: "add
-- additional records as needed to store missing fields like county".
--
-- ── WHAT THIS IS REALLY FIXING, BESIDES TYPING ──────────────────────────────
-- TODO.md's alert section records that `state` is not normalised — *"`TX`, `Texas` and
-- `texas` are three kinds of record and any state match silently misses two of them"* — and
-- names that as a reason state-level alert matching is not worth building.
-- `pickProfileColumns` normalises name case and phone country code and nothing else.
--
-- An autocompleted address fixes that at the source: `state` keeps the full name the way the
-- reader wrote it and `state_code` carries the short form, so a match has one thing to join
-- on. That is worth more than the keystrokes it saves.
--
-- ── THE COUNTY IS A NAME, NOT A FIPS, AND THAT IS THE WHOLE OF §2 ───────────
-- The intent was to store a county FIPS and prefer it over `zip_counties` for alert
-- matching, on the reasoning that a per-ADDRESS county is better data than a per-ZIP one and
-- would place the ZIPs HUD cannot.
--
-- **GEOAPIFY CANNOT SUPPLY IT.** Its data is OpenStreetMap-derived: the response carries
-- `county: "Pierce County"` and `state_code: "WA"`, and OSM does not carry US FIPS codes.
-- So the premise did not hold, and this migration stores what the API actually returns
-- rather than a column that would be empty or wrong.
--
-- `zip_counties` REMAINS THE ONE SOURCE FOR MATCHING. §2 below says so on the columns
-- themselves, because the failure mode is somebody a year from now joining
-- `people.county_code` to `zip_counties.county_fips` and getting nothing — silently, since a
-- join that matches nothing looks exactly like a family with no alerts.
--
-- ── AND `latitude`/`longitude` ARE THE HONEST ROUTE TO A PER-ADDRESS FIPS ───
-- Not stored speculatively. The free US Census geocoder turns a coordinate into a county
-- FIPS with no key at all, so a member whose ZIP HUD could not place is still placeable —
-- which is the one real gap in the crosswalk. That is a later job and these two columns are
-- what it will need; storing them now costs two numbers per member and saves re-geocoding
-- every address in the product.
--
-- ── NO GUARD TRIGGER, AND THE REASON IS WORTH STATING ──────────────────────
-- `people_guard_bloodline`, `people_guard_membership_status` and
-- `people_guard_permission_template` exist because each of those columns decides something a
-- member must not decide about themselves — money, membership, access. None of these does.
--
-- The one that comes closest is the county, because it could influence whether somebody is
-- suggested for a safety check-in. It is not a control worth guarding: a check-in is a
-- SUGGESTION a person then raises, and a member already controls `zip_code`, which is what
-- decides it today through the crosswalk. So these join `WRITABLE_PROFILE_COLUMNS` like the
-- six address fields beside them.
--
-- ── WORLDWIDE, WHICH IS WHY NOTHING HERE IS CONSTRAINED ────────────────────
-- Autocomplete is unrestricted by country (decided 2026-09-04), so:
--
--   * `state_code` is NOT two letters. It is an ISO 3166-2 subdivision suffix where one
--     exists, and OSM's own abbreviation where it does not.
--   * `county` may be NULL for most of the world, because most countries have no such
--     division. An empty column for a French member is correct, not missing data.
--   * NO CHECK CONSTRAINTS ON ANY OF THIS. A postcode is not five digits, a state is not two
--     letters, and a constraint written from the US shape would refuse a real address in
--     Cologne. `zip_code` is already unconstrained for that reason and these follow it.
-- ============================================================================

-- ── §1. THE COLUMNS ─────────────────────────────────────────────────────────
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS county        TEXT,
  ADD COLUMN IF NOT EXISTS county_code   TEXT,
  ADD COLUMN IF NOT EXISTS state_code    TEXT,
  ADD COLUMN IF NOT EXISTS country_code  TEXT,
  ADD COLUMN IF NOT EXISTS latitude      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude     DOUBLE PRECISION;

-- ── §2. WHAT EACH ONE IS, AND THE ONE THING NOT TO DO WITH county_code ─────
COMMENT ON COLUMN public.people.county IS
  'The county/district NAME as the geocoder gave it — "Pierce County", "Harris County". '
  'NULL for most of the world, which is correct rather than missing: most countries have no '
  'such division. Display only.';

COMMENT ON COLUMN public.people.county_code IS
  '**NOT A FIPS CODE, AND MUST NEVER BE JOINED TO zip_counties.county_fips.** Geoapify is '
  'OpenStreetMap-derived and OSM does not carry US FIPS codes; this is whatever subdivision '
  'code OSM held, often NULL. zip_counties is the ONE source for alert matching — see '
  '20260904000000. A join here would match nothing and look exactly like a family with no '
  'alerts.';

COMMENT ON COLUMN public.people.state_code IS
  'The short form of `state` — "WA", "NRW". NOT two characters: worldwide, this is an ISO '
  '3166-2 subdivision suffix where one exists. It is what makes a state match possible at '
  'all: `state` holds whatever the reader wrote, and TODO.md records TX/Texas/texas as three '
  'kinds of record.';

COMMENT ON COLUMN public.people.country_code IS
  'ISO 3166-1 alpha-2, lower case as the geocoder returns it. It is what says whether the '
  'other columns mean anything: county is a US/UK-shaped idea, and a postcode''s format is a '
  'fact about the country.';

COMMENT ON COLUMN public.people.latitude IS
  'From the geocoder, so an address is not re-geocoded to answer a question about it. The '
  'intended first consumer is a county FIPS: the free US Census geocoder turns a coordinate '
  'into one with no key, which would place the ZIPs HUD cannot. See 20260904000000.';

COMMENT ON COLUMN public.people.longitude IS
  'See public.people.latitude.';

-- ── §3. VERIFY ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_missing text;
BEGIN
  FOR v_missing IN
    SELECT c FROM unnest(ARRAY[
      'county', 'county_code', 'state_code', 'country_code', 'latitude', 'longitude'
    ]) AS c
     WHERE NOT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'people' AND column_name = c
     )
  LOOP
    RAISE EXCEPTION 'people.% was not added', v_missing;
  END LOOP;

  -- NOTHING IS NOT NULL AND NOTHING HAS A DEFAULT. Both would be a claim about an address
  -- nobody has entered yet, and every one of these is legitimately absent — for a member who
  -- typed their address by hand before this shipped, and for a country with no counties.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'people'
       AND column_name IN ('county', 'county_code', 'state_code', 'country_code',
                           'latitude', 'longitude')
       AND (is_nullable = 'NO' OR column_default IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'the geocoding columns must be nullable with no default';
  END IF;

  -- AND NO CHECK CONSTRAINT MENTIONS THEM. Worldwide means the US shape is not a rule; a
  -- constraint written from it would refuse a real address. Asserted rather than trusted,
  -- because the tempting one — `length(state_code) = 2` — reads as tidying up.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.people'::regclass
       AND contype = 'c'
       AND (pg_get_constraintdef(oid) LIKE '%state_code%'
         OR pg_get_constraintdef(oid) LIKE '%county_code%'
         OR pg_get_constraintdef(oid) LIKE '%country_code%')
  ) THEN
    RAISE EXCEPTION 'a CHECK constraint references a geocoding column; see 20260904000000 §0';
  END IF;

  -- THE MATCHING SOURCE IS UNCHANGED, and this is the assertion that carries §2's warning
  -- into the chain: `zip_counties` still exists and still holds the FIPS, so nothing about
  -- this migration moved where an alert match comes from.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'zip_counties'
       AND column_name = 'county_fips'
  ) THEN
    RAISE EXCEPTION 'zip_counties.county_fips is gone; alert matching has no source';
  END IF;

  RAISE NOTICE 'people gained six geocoding columns; zip_counties remains the FIPS source.';
END $$;

-- ── §4. AN ADDRESS IS A SHARED PROFILE FACT, SO THE SYNC HAS TO CARRY IT ────
-- `people_sync_shared_profile` propagates a member's own profile columns to their rows in
-- every OTHER family they belong to, and its `UPDATE OF` clause already lists all six
-- address columns and `time_zone`. The six added above are not in it.
--
-- **LEFT ALONE, A MEMBER IN TWO FAMILIES WOULD HAVE A COUNTY IN ONE AND NOT THE OTHER** —
-- and worse, a stale one in the second after they moved, because a change to `county` alone
-- would not even fire the trigger. Two stored facts about one person that disagree is the
-- `is_minor` trap (§4b) arriving through a trigger's column list.
--
-- ── THE FUNCTION IS COPIED, NOT DESCRIBED ──────────────────────────────────
-- AGENTS.md is explicit about this and names the incident: `20260901000003`'s first draft
-- retyped `consume_family_action_challenge` from a reading and silently changed two refusal
-- messages and the success branch. So the body below is `pg_get_functiondef`'s output with
-- six columns added in the three places they belong, and nothing else touched:
--
--   the SET list, and the two tuples of the IS DISTINCT FROM guard.
--
-- THE GUARD'S TWO TUPLES MUST STAY THE SAME LENGTH AND ORDER. It is what stops the nested
-- pass writing anything, so a column in the SET list and missing from the tuples would make
-- every propagation a second UPDATE that changes nothing — visible only as write volume.
CREATE OR REPLACE FUNCTION public.sync_shared_person_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
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
      county          = NEW.county,
      county_code     = NEW.county_code,
      state_code      = NEW.state_code,
      country_code    = NEW.country_code,
      latitude        = NEW.latitude,
      longitude       = NEW.longitude,
      date_of_birth   = NEW.date_of_birth,
      sunset_date     = NEW.sunset_date,
      gender          = NEW.gender,
      tshirt_category = NEW.tshirt_category,
      tshirt_size     = NEW.tshirt_size,
      avatar_url      = NEW.avatar_url,
      time_zone       = NEW.time_zone,
      locale          = NEW.locale,
      updated_at      = NOW()
  WHERE t.user_id = NEW.user_id
    AND t.id     <> NEW.id
    -- Skip rows already in sync so the nested pass changes nothing.
    AND (t.prefix, t.first_name, t.middle_name, t.last_name, t.suffix,
         t.nick_name, t.primary_email, t.primary_phone, t.street_address,
         t.apartment, t.city, t.state, t.zip_code, t.country,
         t.county, t.county_code, t.state_code, t.country_code,
         t.latitude, t.longitude, t.date_of_birth,
         t.sunset_date, t.gender, t.tshirt_category, t.tshirt_size, t.avatar_url,
         t.time_zone, t.locale)
        IS DISTINCT FROM
        (NEW.prefix, NEW.first_name, NEW.middle_name, NEW.last_name, NEW.suffix,
         NEW.nick_name, NEW.primary_email, NEW.primary_phone, NEW.street_address,
         NEW.apartment, NEW.city, NEW.state, NEW.zip_code, NEW.country,
         NEW.county, NEW.county_code, NEW.state_code, NEW.country_code,
         NEW.latitude, NEW.longitude,
         NEW.date_of_birth, NEW.sunset_date, NEW.gender, NEW.tshirt_category,
         NEW.tshirt_size, NEW.avatar_url, NEW.time_zone, NEW.locale);

  RETURN NEW;
END $fn$;

-- ── THE TRIGGER IS RECREATED, BECAUSE `UPDATE OF` IS PART OF THE TRIGGER ───
-- Redefining the function alone changes nothing about WHEN it fires: the column list lives
-- on the trigger, so a change to `county` would still not wake it. Dropped and recreated
-- rather than altered, because `ALTER TRIGGER` cannot change the column list.
DROP TRIGGER IF EXISTS people_sync_shared_profile ON public.people;
CREATE TRIGGER people_sync_shared_profile
  AFTER UPDATE OF
    prefix, first_name, middle_name, last_name, suffix, nick_name,
    primary_email, primary_phone,
    street_address, apartment, city, state, zip_code, country,
    county, county_code, state_code, country_code, latitude, longitude,
    date_of_birth, sunset_date, gender, tshirt_category, tshirt_size,
    avatar_url, time_zone, locale
  ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.sync_shared_person_profile();

-- ── §5. VERIFY THE SYNC ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_def text;
  v_col text;
BEGIN
  SELECT pg_get_triggerdef(oid) INTO v_def
    FROM pg_trigger WHERE tgname = 'people_sync_shared_profile' AND NOT tgisinternal;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'people_sync_shared_profile is gone — cross-family profile sync is off';
  END IF;

  -- BOTH DIRECTIONS, the way 20260826000002 does it. The new six must be listed, AND
  -- nothing that was listed before may have been dropped on the way past — a recreated
  -- trigger is the one edit that can silently lose a column.
  FOR v_col IN
    SELECT c FROM unnest(ARRAY[
      'prefix', 'first_name', 'middle_name', 'last_name', 'suffix', 'nick_name',
      'primary_email', 'primary_phone',
      'street_address', 'apartment', 'city', 'state', 'zip_code', 'country',
      'county', 'county_code', 'state_code', 'country_code', 'latitude', 'longitude',
      'date_of_birth', 'sunset_date', 'gender', 'tshirt_category', 'tshirt_size',
      'avatar_url', 'time_zone', 'locale'
    ]) AS c
  LOOP
    IF position(v_col IN v_def) = 0 THEN
      RAISE EXCEPTION 'people_sync_shared_profile does not list % in its UPDATE OF clause', v_col;
    END IF;
  END LOOP;

  -- And the FUNCTION copies them, which the trigger's column list says nothing about. A
  -- column that wakes the trigger and is not in the SET list is the worse half of this bug:
  -- the sync fires, writes the other columns, and leaves the one that changed behind.
  SELECT pg_get_functiondef('public.sync_shared_person_profile()'::regprocedure) INTO v_def;
  FOR v_col IN
    SELECT c FROM unnest(ARRAY[
      'county', 'county_code', 'state_code', 'country_code', 'latitude', 'longitude'
    ]) AS c
  LOOP
    -- A REGEX, not a `position` over hand-counted whitespace. The first version of this
    -- built the expected string with `rpad` and failed on its own correct function, which is
    -- an assertion testing the formatting of the SQL rather than its meaning.
    --
    -- `\W|$` after the column name is what keeps `county` from being satisfied by
    -- `county_code`: without it, five of these six checks would pass on a function that
    -- copied only the longest name of each pair.
    IF v_def !~ ('(^|\W)' || v_col || '\s*=\s*NEW\.' || v_col || '(\W|$)') THEN
      RAISE EXCEPTION 'sync_shared_person_profile does not copy %', v_col;
    END IF;
    -- In the guard too, on BOTH sides, or every propagation becomes an UPDATE that changes
    -- nothing — invisible except as write volume.
    IF v_def !~ ('t\.' || v_col || '(\W|$)')
       OR v_def !~ ('NEW\.' || v_col || '(\W|$)') THEN
      RAISE EXCEPTION 'sync_shared_person_profile omits % from its IS DISTINCT FROM guard', v_col;
    END IF;
  END LOOP;

  RAISE NOTICE 'shared-profile sync carries the six geocoding columns.';
END $$;
