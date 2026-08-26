-- ═══════════════════════════════════════════════════════════════════════════════════════
-- WHICH LANGUAGE A MEMBER READS IN
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- The first of four Phase 2 migrations for localization. This one adds the preference; the
-- three after it deal with time.
--
-- ── IT IS ON `people`, BESIDE `time_zone`, AND THAT IS THE WHOLE DESIGN ───────────────
-- A member's language is a fact about the PERSON, not about the family they happen to be
-- looking at — so it belongs on the shared profile, and it must float across every family
-- they belong to exactly as their name and their timezone already do. Putting it on
-- `user_family_settings` would mean a member of two families setting their language twice
-- and being able to disagree with themselves.
--
-- **THAT IS NOT FREE, AND IT IS THE HALF THAT IS EASY TO MISS.** The propagation is a pair of
-- trigger functions whose column lists are written out BY HAND, inside migrations that have
-- already been applied — so a new synced column needs all three of these or it saves in one
-- family and reads blank in the next:
--
--   `sync_shared_person_profile()`     the UPDATE that pushes a change to sibling rows, AND
--                                     the IS DISTINCT FROM guard beside it, which is what
--                                     stops the nested pass — a column missing from the
--                                     guard makes the trigger a no-op for that column even
--                                     when it is in the SET list.
--   the trigger's `AFTER UPDATE OF`    a column absent here means the trigger never FIRES
--   list                              for a change to it. Silent, and the worst of the three.
--   `inherit_shared_person_profile()`  the other direction: a NEW membership picks the
--                                     profile up from the oldest existing row.
--
-- `20260810000001` (gender) and `20260813000006` (dropping is_minor) are the two worked
-- examples of this shape. Both are re-issued in full below rather than patched, because
-- there is no way to patch a function body.
--
-- ── THE CHECK CONSTRAINT IS DELIBERATE, AND SO IS ITS COST ───────────────────────────
-- `locale` is on `WRITABLE_PROFILE_COLUMNS`, so `saveProfileSection` will write whatever a
-- caller posts — and a server action is a public HTTP endpoint (§2). `pickProfileColumns`
-- decides which KEYS reach the row and says nothing about their contents, exactly as its own
-- header states about `gender`. So the CHECK is the layer a caller who never loads the form
-- cannot get past, and it is the same arrangement `people_gender_check` already has.
--
-- The cost is that the supported set now lives in two places — here, and
-- `lib/i18n/locales.ts` — which is the shape AGENTS.md warns about generally. It is accepted
-- here because both directions of disagreement are safe:
--
--   catalogue has it, CHECK refuses    the save FAILS, loudly, on the first attempt in
--                                     development. Caught immediately.
--   CHECK allows it, no catalogue      the resolver falls back to English. Degrades.
--
-- Adding a language is therefore a migration plus a catalogue file, which is honest: a
-- language is not a thing that should appear by accident.
--
-- ── NULL MEANS "HAS NOT SAID", AND MUST NOT BE BACKFILLED ────────────────────────────
-- Not `NOT NULL DEFAULT 'en'`. A stored 'en' on every existing row is indistinguishable from
-- a member who opened the control and chose English, so changing what an unset preference
-- resolves to later would change it for nobody. Same contract `person_notification_prefs`
-- states at length: absence resolves through the app's negotiation (the `Accept-Language`
-- hint, then English), and that resolution lives in one TypeScript module.
--
-- This is the OPPOSITE of the decision the three time-zone migrations after this one take,
-- and the difference is worth stating because the two arrive together: a stated zone
-- qualifies a time that already exists in the row, so a timed row with no zone is an
-- incomplete record worth backfilling. A language preference qualifies nothing — it is
-- purely a choice somebody has or has not made.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ── 1. The column ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS locale TEXT;

-- Dropped and re-added so a re-run widens the set rather than silently keeping the old one.
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_locale_check;
ALTER TABLE public.people
  ADD CONSTRAINT people_locale_check
  CHECK (locale IS NULL OR locale IN ('en', 'es', 'fr'));

COMMENT ON COLUMN public.people.locale IS
  'The language this member reads the product in: a two-character code, matching '
  'lib/i18n/locales.ts. NULL means they have not said, which resolves through the app''s '
  'negotiation rather than to a stored default — see this migration''s header. Part of the '
  'SHARED profile: it propagates across every family the user belongs to, so it is named in '
  'sync_shared_person_profile(), in that trigger''s UPDATE OF list, and in '
  'inherit_shared_person_profile(). Adding a language means widening people_locale_check as '
  'well as adding a catalogue file.';

-- ── 2. The outbound half of the shared-profile sync ───────────────────────────────────
-- Re-issued in full, with `locale` in the SET list AND in the IS DISTINCT FROM guard. The
-- guard is the half that is easy to forget: without it the trigger fires, computes that
-- nothing it recognises has changed, matches zero rows, and the change never leaves the row
-- it was made on. Identical to 20260813000006's body otherwise.

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
      locale          = NEW.locale,
      updated_at      = NOW()
  WHERE t.user_id = NEW.user_id
    AND t.id     <> NEW.id
    -- Skip rows already in sync so the nested pass changes nothing.
    AND (t.prefix, t.first_name, t.middle_name, t.last_name, t.suffix,
         t.nick_name, t.primary_email, t.primary_phone, t.street_address,
         t.apartment, t.city, t.state, t.zip_code, t.country, t.date_of_birth,
         t.sunset_date, t.gender, t.tshirt_category, t.tshirt_size, t.avatar_url,
         t.time_zone, t.locale)
        IS DISTINCT FROM
        (NEW.prefix, NEW.first_name, NEW.middle_name, NEW.last_name, NEW.suffix,
         NEW.nick_name, NEW.primary_email, NEW.primary_phone, NEW.street_address,
         NEW.apartment, NEW.city, NEW.state, NEW.zip_code, NEW.country,
         NEW.date_of_birth, NEW.sunset_date, NEW.gender, NEW.tshirt_category,
         NEW.tshirt_size, NEW.avatar_url, NEW.time_zone, NEW.locale);

  RETURN NEW;
END $$;

-- ── 3. Its trigger, with `locale` in the OF-list ──────────────────────────────────────
-- A column absent from `AFTER UPDATE OF` means the trigger does not fire at all for a change
-- to it, which is the silent half of this. The list is otherwise 20260813000006's, reproduced
-- in full because a trigger definition cannot be amended.

DROP TRIGGER IF EXISTS people_sync_shared_profile ON public.people;
CREATE TRIGGER people_sync_shared_profile
  AFTER UPDATE OF
    prefix, first_name, middle_name, last_name, suffix, nick_name,
    primary_email, primary_phone, street_address, apartment, city, state,
    zip_code, country, date_of_birth, sunset_date, gender, tshirt_category,
    tshirt_size, avatar_url, time_zone, locale
  ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shared_person_profile();

-- ── 4. The inbound half ───────────────────────────────────────────────────────────────
-- A NEW membership inherits the profile from the caller's oldest existing row. `locale` joins
-- the `NULLIF(…, '')` group rather than the plain `COALESCE` group, because it is TEXT and an
-- empty string is what a cleared `<select>` posts — the same treatment `time_zone` gets one
-- line above it.

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
  NEW.locale          := COALESCE(NULLIF(NEW.locale, ''),          s.locale);
  NEW.date_of_birth   := COALESCE(NEW.date_of_birth,               s.date_of_birth);
  NEW.sunset_date     := COALESCE(NEW.sunset_date,                 s.sunset_date);
  NEW.gender          := COALESCE(NEW.gender,                      s.gender);

  RETURN NEW;
END $$;

-- ── 5. Verify ─────────────────────────────────────────────────────────────────────────
-- Every assertion here runs with no fixture, so none of it can skip. `20260806000012`'s
-- lesson: a verify block that returns early without a fixture reports success over a function
-- that cannot run.

DO $mig$
DECLARE
  v_trigdef text;
  v_src     text;
BEGIN
  -- 5a. The column and its constraint exist.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'people' AND column_name = 'locale'
  ) THEN
    RAISE EXCEPTION 'people.locale was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.people'::regclass AND conname = 'people_locale_check'
  ) THEN
    RAISE EXCEPTION 'people_locale_check is missing — locale would accept any string';
  END IF;

  -- 5b. THE CHECK ACTUALLY REFUSES. Asserting the constraint EXISTS says nothing about what
  -- it admits, and this is the layer standing between a public endpoint and the column.
  BEGIN
    INSERT INTO public.people (family_code, first_name, last_name, primary_email, locale)
    VALUES ('ZZLOCL', 'Probe', 'Probe', 'locale-probe@example.invalid', 'klingon');
    RAISE EXCEPTION 'people_locale_check admitted an unsupported locale';
  EXCEPTION
    WHEN check_violation THEN
      NULL;  -- expected
    WHEN others THEN
      -- Any other failure (a NOT NULL column this probe does not fill, a guard trigger) means
      -- the probe could not reach the constraint. Say so rather than reporting a pass: an
      -- assertion that cannot fail is worse than no assertion.
      RAISE NOTICE 'locale CHECK probe could not run (%): the constraint is asserted to '
        'EXIST but not to REFUSE', SQLERRM;
  END;

  -- 5c. Both function bodies name the column. `pg_get_functiondef` reads what the database
  -- actually holds, not what this file says — which is the only version that matters after a
  -- hand-run `psql` has been anywhere near the chain.
  v_src := pg_get_functiondef('public.sync_shared_person_profile()'::regprocedure);
  IF v_src NOT LIKE '%locale%' THEN
    RAISE EXCEPTION 'sync_shared_person_profile() does not mention locale';
  END IF;
  -- IT MUST APPEAR TWICE: once in the SET list and once in the IS DISTINCT FROM guard. With
  -- only the first, the trigger fires, decides nothing it recognises changed, and propagates
  -- nothing — a no-op that looks exactly like a working trigger.
  IF (length(v_src) - length(replace(v_src, 'locale', ''))) / length('locale') < 3 THEN
    RAISE EXCEPTION
      'sync_shared_person_profile() names locale too few times — it belongs in the SET list '
      'and on BOTH sides of the IS DISTINCT FROM guard. Found: %',
      (length(v_src) - length(replace(v_src, 'locale', ''))) / length('locale');
  END IF;

  v_src := pg_get_functiondef('public.inherit_shared_person_profile()'::regprocedure);
  IF v_src NOT LIKE '%locale%' THEN
    RAISE EXCEPTION 'inherit_shared_person_profile() does not mention locale';
  END IF;

  -- 5d. The trigger exists and fires for this column. A column absent from the OF-list is
  -- the silent failure: the save works, the sibling rows never hear about it.
  SELECT pg_get_triggerdef(t.oid) INTO v_trigdef
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.people'::regclass
     AND t.tgname  = 'people_sync_shared_profile'
     AND NOT t.tgisinternal;

  IF v_trigdef IS NULL THEN
    RAISE EXCEPTION 'people_sync_shared_profile is gone — cross-family profile sync is off';
  END IF;
  IF v_trigdef NOT ILIKE '%locale%' THEN
    RAISE EXCEPTION 'people_sync_shared_profile does not list locale in its UPDATE OF clause';
  END IF;
  -- The same spot check 20260813000006 makes, for the same reason: a copied OF-list that
  -- stopped early loses whatever was last.
  IF v_trigdef NOT ILIKE '%gender%' OR v_trigdef NOT ILIKE '%time_zone%' THEN
    RAISE EXCEPTION 'people_sync_shared_profile lost columns from its UPDATE OF clause: %',
      v_trigdef;
  END IF;

  -- 5e. NOT backfilled. An existing row must still read NULL, or "has not said" and "chose
  -- English" have become the same value and the default can never be changed again.
  IF EXISTS (SELECT 1 FROM public.people WHERE locale IS NOT NULL) THEN
    RAISE EXCEPTION 'people.locale was backfilled — NULL must mean "has not said"';
  END IF;

  RAISE NOTICE 'people.locale added; sync and inherit both name it; % people rows, all NULL',
    (SELECT count(*) FROM public.people);
END $mig$;
