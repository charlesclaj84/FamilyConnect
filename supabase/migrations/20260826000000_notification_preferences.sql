-- ═══════════════════════════════════════════════════════════════════════════════════════
-- WHAT A MEMBER WANTS TO BE TOLD ABOUT, AND DOWN WHICH CHANNEL
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- My Profile → Notifications is a GRID: a row per notification, a column per channel, and a
-- cell somebody can turn on or off. This is the table behind the cells.
--
-- ── IT REPLACES A SCREEN, NOT A TABLE ─────────────────────────────────────────────────
-- The section was called "Text Messages" and held a mobile number, a confirmation code and
-- one consent toggle. Nothing here drops any of that: `person_sms`, `sms_consent_events` and
-- `phone_verifications` are untouched, and `sms_consent_events` REMAINS the legal record of
-- SMS consent. What changed is where the member expresses the choice and how many things they
-- can express it about.
--
-- ── SO WHY IS THERE NO `sms` ROW IN THIS TABLE FOR SAFETY CHECK? THERE IS, AND IT IS ──
-- ── THE NARROWING RATHER THAN THE CONSENT ─────────────────────────────────────────────
-- Two facts, deliberately not merged:
--
--   `sms_consent_events`         may we text this person AT ALL. Append-only, sourced, timed;
--                                the thing a TCPA complaint would ask about. One per person.
--   `person_notification_prefs`  which of the things we may text them about they want. One per
--                                person per notification per channel.
--
-- Today there is exactly one SMS notification, so the two answer the same question and the app
-- writes both when the member presses one control — the consent event because it is the record,
-- and the pref row because it is what a second SMS notification will be narrowed by. Collapsing
-- them into one column would lose the evidence; collapsing them into one event log would make
-- the log a preferences table and make `consentStatus()` fold rows that mean nothing to it.
--
-- ── AND WHY A ROW-PER-CELL RATHER THAN A COLUMN PER CHANNEL ───────────────────────────
-- `(person, notification, channel) -> bool` is a grid, and a table shaped like the grid takes a
-- fourth channel or a tenth notification with no migration at all. The alternative — an
-- `email BOOLEAN, sms BOOLEAN, push BOOLEAN` triple — makes every new channel a schema change
-- and every new notification a row whose unused columns have to mean something.
--
-- ── ABSENCE IS NOT `false`, AND THAT IS THE WHOLE CONTRACT ────────────────────────────
-- A missing row means "has not said", which resolves to the catalogue's default in
-- `lib/notification-prefs.ts` — so a safety check-in reaches a member by email even though
-- they have never opened the screen. Reading absence as `false` would silently turn every
-- default-on notification off, and nothing would report it: a notification nobody receives
-- looks exactly like a notification nobody triggered.
--
-- **THEREFORE THIS TABLE IS NOT BACKFILLED, AND MUST NOT BE.** Writing a row per member per
-- cell would freeze today's defaults into every family's data, so changing a default later
-- would change it for nobody. The defaults live in one TypeScript module and are read at
-- decision time.
--
-- ── §2c: RLS IS THE WHOLE BOUNDARY ───────────────────────────────────────────────────
-- A table in `public` is born readable AND writable by `anon` and `authenticated`. So this
-- carries a SELECT policy narrowed to the caller's OWN person, and NO insert, update or delete
-- policy — which denies those to the browser outright. Every write goes through
-- `app/actions/notification-prefs.ts` on the service role, re-applying the family and person
-- conjuncts by hand (§3), with a guard trigger underneath for the cross-family id (§4).
--
-- The `GRANT SELECT` below is a STATEMENT of what the table is for. It records nothing: the
-- default ACL granted it before this file ran.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ── 1. The table ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.person_notification_prefs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code       text NOT NULL,
  person_id         uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  -- The catalogue key from `lib/notification-prefs.ts` — `safety_check` today. NOT a foreign
  -- key and not a CHECK against a list: the catalogue is TypeScript, and a CHECK here would be
  -- a second copy of it that a new notification has to remember to update, in a migration,
  -- before the screen can offer it. A key nothing recognises resolves to `unavailable` and is
  -- ignored, which is the safe direction.
  notification_key  text NOT NULL,
  -- email | sms | push. This one IS checked, because it is a closed set the sending code
  -- switches on rather than an open catalogue, and a typo would be a preference that silently
  -- governs nothing.
  channel           text NOT NULL,
  opted_in          boolean NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_notification_prefs_channel_check
    CHECK (channel IN ('email', 'sms', 'push'))
);

COMMENT ON TABLE public.person_notification_prefs IS
  'One member''s answer for one notification down one channel. ABSENCE IS NOT FALSE — a missing '
  'row means the catalogue default in lib/notification-prefs.ts, which is on for email and off '
  'for SMS. Never backfilled: a row per member per cell would freeze today''s defaults into '
  'every family''s data. Not the SMS consent record — that is sms_consent_events, and this '
  'narrows it rather than replacing it.';

COMMENT ON COLUMN public.person_notification_prefs.notification_key IS
  'The catalogue key from lib/notification-prefs.ts. Deliberately unconstrained: the catalogue '
  'is TypeScript, and a CHECK here would be a second copy of it that every new notification '
  'has to update in a migration first. An unrecognised key resolves to unavailable.';

-- ONE ANSWER PER CELL. Without this a member could hold two contradictory rows for the same
-- cell and `prefEnabled` would return whichever the database happened to list first — a
-- preference that changes between two reads of the same screen. The action upserts on it.
CREATE UNIQUE INDEX IF NOT EXISTS person_notification_prefs_cell_uniq
  ON public.person_notification_prefs (person_id, notification_key, channel);

-- The one read the screen makes: this person's whole grid.
CREATE INDEX IF NOT EXISTS person_notification_prefs_person_idx
  ON public.person_notification_prefs (family_code, person_id);

DROP TRIGGER IF EXISTS person_notification_prefs_updated_at ON public.person_notification_prefs;
CREATE TRIGGER person_notification_prefs_updated_at
  BEFORE UPDATE ON public.person_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. §4: the person must be in the family the row claims ────────────────────────────
--
-- The service role ignores RLS and does NOT ignore triggers. `setMyNotificationPref` takes no
-- person id — it comes from the guard — so this is unreachable through the product; it is here
-- because the row carries a `family_code` beside a `person_id` and nothing else in the database
-- would notice if the two disagreed. INVOKER, so `current_user` is the caller and the check
-- applies to the service role too.

CREATE OR REPLACE FUNCTION public.tg_notification_pref_guard_family()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.people
     WHERE id = NEW.person_id AND family_code = NEW.family_code
  ) THEN
    RAISE EXCEPTION
      'person % is not in family % (notification preference)', NEW.person_id, NEW.family_code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_notification_pref_guard_family() IS
  'AGENTS.md §4: RLS checks the row, not the ids the row references. Refuses a preference '
  'filed under a family the named person is not in. A trigger function needs no EXECUTE grant '
  '— that is checked at CREATE TRIGGER time, not at fire time.';

DROP TRIGGER IF EXISTS person_notification_prefs_guard_family
  ON public.person_notification_prefs;
CREATE TRIGGER person_notification_prefs_guard_family
  BEFORE INSERT OR UPDATE ON public.person_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.tg_notification_pref_guard_family();

-- ── 3. RLS ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.person_notification_prefs ENABLE ROW LEVEL SECURITY;

-- READ YOUR OWN, AND NOBODY ELSE'S. Not merely family-scoped: what somebody has agreed to be
-- contacted about is theirs. There is no screen anywhere that shows a relative's grid, and this
-- policy is what makes that a fact rather than a convention.
--
-- `auth_membership_approved()` is deliberately NOT a conjunct, unlike `person_sms`. An applicant
-- may edit their own profile (AGENTS.md §2's one exception to `requireMember`), and a safety
-- check-in is exactly the thing somebody should be able to opt out of before their membership is
-- decided. `person_id = auth_person_id()` is already stricter than the family boundary, and
-- `auth_person_id()` gates on membership itself for every own/self expression — so a pending
-- caller reads their own row and nobody else's either way.
DROP POLICY IF EXISTS "person_notification_prefs_select_own" ON public.person_notification_prefs;
CREATE POLICY "person_notification_prefs_select_own"
  ON public.person_notification_prefs FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND person_id = public.auth_person_id()
  );

-- §2c: a statement of what the table is for, not what makes it safe. NO insert, update or
-- delete policy, so the browser is refused all three: the action is the only writer.
GRANT SELECT ON public.person_notification_prefs TO authenticated;

-- ── 4. Verify ─────────────────────────────────────────────────────────────────────────
--
-- Asserted rather than promised, and both directions where a direction exists. The guard
-- trigger is probed with a real cross-family row, because a §4 guard that has never refused
-- anything is a guard nobody has seen work.

DO $$
DECLARE
  v_code   text;
  v_other  text;
  v_person uuid;
  v_n      int;
BEGIN
  -- 4a. The unique index exists and is on the three columns that make a cell.
  SELECT count(*) INTO v_n
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename  = 'person_notification_prefs'
     AND indexname  = 'person_notification_prefs_cell_uniq'
     AND indexdef LIKE '%UNIQUE%'
     AND indexdef LIKE '%person_id%'
     AND indexdef LIKE '%notification_key%'
     AND indexdef LIKE '%channel%';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'the one-answer-per-cell unique index is missing or has moved';
  END IF;

  -- 4b. Exactly one policy, and it is a SELECT. A write policy appearing here would hand the
  -- browser a way to write its own preferences past the action, which is where the family and
  -- person conjuncts are applied by hand.
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'person_notification_prefs';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'person_notification_prefs should carry exactly 1 policy, found %', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'person_notification_prefs'
     AND cmd = 'SELECT'
     AND qual LIKE '%auth_person_id()%'
     AND qual LIKE '%auth_family_code()%';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'the SELECT policy must narrow to the caller''s own person AND family';
  END IF;

  -- 4c. RLS is actually on. A policy on a table with RLS off is decoration.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
     WHERE oid = 'public.person_notification_prefs'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'row level security is not enabled on person_notification_prefs';
  END IF;

  -- 4d. The guard trigger refuses a cross-family row, and admits a correct one.
  SELECT family_code, id INTO v_code, v_person
    FROM public.people ORDER BY created_at LIMIT 1;
  SELECT family_code INTO v_other
    FROM public.people WHERE family_code <> v_code ORDER BY created_at LIMIT 1;

  IF v_person IS NULL THEN
    -- A SKIP MUST BE VISIBLE, never silent (AGENTS.md, "a verify block that can skip must not
    -- be the only check"). Everything above ran unconditionally; only the row probe needs a
    -- fixture, and a fresh database legitimately has no people.
    RAISE NOTICE 'no people rows: the guard-trigger probe was skipped, the rest was asserted';
  ELSE
    INSERT INTO public.person_notification_prefs
      (family_code, person_id, notification_key, channel, opted_in)
    VALUES (v_code, v_person, '__probe__', 'email', true);

    IF v_other IS NOT NULL THEN
      BEGIN
        UPDATE public.person_notification_prefs
           SET family_code = v_other
         WHERE person_id = v_person AND notification_key = '__probe__';
        RAISE EXCEPTION 'the family guard admitted a cross-family preference row';
      EXCEPTION
        WHEN check_violation THEN NULL;   -- what the guard raises
      END;
    ELSE
      RAISE NOTICE 'only one family present: the cross-family half of the probe was skipped';
    END IF;

    DELETE FROM public.person_notification_prefs WHERE notification_key = '__probe__';
  END IF;

  RAISE NOTICE 'person_notification_prefs: asserted';
END $$;
