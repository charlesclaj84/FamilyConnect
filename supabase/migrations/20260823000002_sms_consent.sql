-- ═══════════════════════════════════════════════════════════════════════════════════════
-- SMS CONSENT AND A VERIFIED SENDING NUMBER — the foundation under text messaging.
--
-- `/community/safety-check-ins` moved to `tier: 'premium'` on 2026-08-23 because the ask is
-- meant to arrive as a TEXT MESSAGE and the answer is meant to come back as one. This is the
-- part of that which gates everything else, and it is built first deliberately: **no provider
-- is wired by this migration and nothing here sends anything.**
--
-- FutureFeature.md §5 argues the whole design. What it says about this half is the reason this
-- file exists before any Twilio code:
--
--     *"US TCPA statutory damages are $500–$1,500 per message. A hundred and forty relatives is
--     not a number to be wrong about, and 'it was an emergency' is a narrower exemption than it
--     sounds."*
--
-- So permission comes before plumbing, and the plumbing has something real to ask.
--
-- ── WHY THE SENDING NUMBER IS NOT A COLUMN ON `people` ─────────────────────────────────
-- `people.phone` already exists and is the DIRECTORY number — what a relative dials. This adds
-- `person_sms.phone_e164`, the VERIFIED SENDING number. Two columns, two different facts, and
-- that is not the `is_minor` trap (§4b) because neither is derivable from the other:
--
--   `people.phone`          what somebody typed for humans to call. `normalizePhone` in
--                           lib/profile-columns.ts normalises a country code and, in its own
--                           words, "returns anything it does not recognise unchanged rather
--                           than guessing" — correct for a directory, and nowhere near enough
--                           to send to.
--   `person_sms.phone_e164` a number that answered a verification code. E.164, refused rather
--                           than passed through if it will not parse (`toE164`).
--
-- They can legitimately DIFFER — somebody lists a landline in the directory and verifies a
-- mobile — which is the clearest proof they are two facts rather than one stored twice.
--
-- AND KEEPING IT OFF `people` BUYS THREE THINGS. The `people` UPDATE policy admits a member's
-- write to their own row and a policy has no opinion about which column changed (§6b), so a
-- verified-number column there would need a guard trigger of its own. It would need adding to
-- `lib/profile-columns.ts`' allow-list, where every profile write would then have to be
-- re-reasoned about. And it would put a legally-sensitive column on the one table
-- `npm run audit:people` exists to police. A separate table costs one join and avoids all three.
--
-- ── THE CONSENT LOG IS APPEND-ONLY, AND THE STATUS IS DERIVED ─────────────────────────
-- This inverts this codebase's usual instinct on purpose. §4b's rule is that a STORED value
-- where a derivation belongs is a bug; here the derivation is the status and the stored thing is
-- the EVENT, because consent is something that happened at a time from a source. A boolean
-- column would answer "are they opted in" while losing the only thing anybody would ever be
-- asked to produce, which is *when did they agree, and how*. A single column cannot be a legal
-- record.
--
-- `consentStatus()` in lib/sms/consent.ts folds it, and the one asymmetry in that fold is
-- load-bearing: **after `stop_received`, only `start_received` moves it.** A carrier-level
-- opt-out is revoked by the handset, never by a checkbox on a website — so a `granted` row
-- written over a STOP is IGNORED by the folder as well as refused by the action. Two layers,
-- because the writer is the thing most likely to be wrong.
--
-- ── THE VERIFICATION CHALLENGE IS `family_removal_challenges` AGAIN ───────────────────
-- Same shape, same reasons, and deliberately not a new invention: a SHA-256 of the code and
-- never the code, 10 minutes, 5 attempts, single use, minted in TypeScript (the Node process has
-- to have the plaintext to send it) and judged in SQL (a five-branch read-modify-write races
-- itself from the app). `consume_phone_verification()` is `consume_family_removal_challenge()`
-- with the subject changed.
--
-- ── NO PERMISSION KEY, AND THAT IS THE DECISION RATHER THAN AN OMISSION ───────────────
-- These are a member's OWN records, edited on My Profile — which `20260806000006` deliberately
-- stripped of its `permission_resources` rows so it can never be restricted. A key here would
-- let a family switch off a relative's ability to manage their own consent, which is the one
-- thing about consent that must not be delegable.
--
-- So the SELECT policies are `person_id = auth_person_id()` and nothing else: no
-- `auth_permission`, no `permission_table_map` row, and the verify block asserts the absence in
-- both directions — a map row appearing later would compose an `auth_permission` factor onto
-- these tables with `view` defaulting to `'everyone'`, publishing every relative's mobile number
-- to the whole family.
--
-- WHOEVER EVENTUALLY SENDS reads the family's textable list on the ADMIN client, the way
-- `readRoster` already does in both `distributions.ts` and `safety-check-ins.ts`, and for the
-- same §3 reason: a list narrowed to what the sender may read would silently miss people.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ─────────────────────────────────────────────
--   a write policy added to any of the three
--     ERROR: person_sms has 1 write policy/policies — the actions are the boundary
--   `person_id = auth_person_id()` dropped from a SELECT policy
--     ERROR: person_sms' SELECT policy is not self-scoped — it would publish mobile numbers
--   a permission_table_map row added for any of the three
--     ERROR: person_sms has a permission_table_map row — see the header
--   the guard trigger on person_sms not created
--     ERROR: person_sms accepted a cross-family person
--   the one-row-per-person index not created
--     ERROR: person_sms accepted two rows for one person
--   `FOR UPDATE` removed from consume_phone_verification
--     not detectable here — a concurrency property a single-session migration cannot observe.
--     Asserted textually, as 20260817000007 and 20260822000025 both do.
--   the verified_at/phone_e164 CHECK relaxed
--     ERROR: person_sms accepted a verified_at with no number
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. THE VERIFIED SENDING NUMBER ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.person_sms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  text NOT NULL,
  person_id    uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  -- E.164, or NULL where the member has removed their number. `toE164` in lib/sms/consent.ts is
  -- what produces it and REFUSES what it cannot parse — the one normaliser in this codebase that
  -- refuses, because a sending number that is not quite a number is a text to somebody else.
  phone_e164   text,
  -- When the code came back. NULL means a number is on file and has NOT been confirmed, which is
  -- the state `smsBlockReason` reports as `unverified` and never sends to.
  verified_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- A CONFIRMATION IS ABOUT A NUMBER. Clearing the number must clear the confirmation, or a row
  -- would claim a verified nothing — and `smsBlockReason` reads the two independently, so the
  -- pair must never be able to disagree. Changing the number is what clears `verified_at`, and
  -- the action does that explicitly rather than relying on this.
  CONSTRAINT person_sms_verified_needs_number
    CHECK (verified_at IS NULL OR phone_e164 IS NOT NULL),
  CONSTRAINT person_sms_e164_shape
    CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

-- ONE ROW PER PERSON. An index rather than a constraint, for `distribution_recipients`' reason:
-- a UNIQUE CONSTRAINT on a lone foreign-key column is one of the shapes PostgREST reads as a
-- join key, and this table has exactly one FK (to `people`). An index is not read by relationship
-- inference.
CREATE UNIQUE INDEX IF NOT EXISTS person_sms_one_per_person_idx
  ON public.person_sms (person_id);
CREATE INDEX IF NOT EXISTS person_sms_family_idx ON public.person_sms (family_code);
-- The eventual send's own query: who in this family is textable. Partial, because a row with no
-- confirmed number is never what that read wants.
CREATE INDEX IF NOT EXISTS person_sms_verified_idx
  ON public.person_sms (family_code) WHERE verified_at IS NOT NULL;

COMMENT ON TABLE public.person_sms IS
  'A member''s VERIFIED sending number, distinct from people.phone which is the directory '
  'number a human dials. The two may legitimately differ. Written only through '
  'app/actions/sms-consent.ts.';
COMMENT ON COLUMN public.person_sms.verified_at IS
  'When a verification code came back from this number. NULL means unconfirmed, and '
  'smsBlockReason() never sends to an unconfirmed number however consent stands.';

-- ── §2. THE CONSENT LOG, APPEND-ONLY ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sms_consent_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code text NOT NULL,
  person_id   uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  -- granted | withdrawn | stop_received | start_received. HELP is deliberately absent: it is
  -- carrier-mandated and must be answered, and it changes no consent — logging it here would
  -- make this a message archive and make the folder read rows that mean nothing to it.
  event       text NOT NULL,
  -- profile | sms_reply | admin | import. PART OF THE RECORD, never inferred from `event`: "they
  -- ticked a box on their profile" and "they texted STOP" are different evidence, and the second
  -- is the one that cannot be undone from the product.
  source      text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  -- Free text for the record — which screen, which inbound message id. Shown to nobody.
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sms_consent_events_event_check
    CHECK (event IN ('granted', 'withdrawn', 'stop_received', 'start_received')),
  CONSTRAINT sms_consent_events_source_check
    CHECK (source IN ('profile', 'sms_reply', 'admin', 'import'))
);

-- `(person_id, occurred_at)` because the fold reads a person's whole history in order. The `id`
-- tie-break `consentStatus()` applies is in TypeScript rather than here, deliberately: it is a
-- property of the FOLD (two events in one instant must resolve the same way twice) and not of
-- the storage.
CREATE INDEX IF NOT EXISTS sms_consent_events_person_idx
  ON public.sms_consent_events (person_id, occurred_at);
CREATE INDEX IF NOT EXISTS sms_consent_events_family_idx
  ON public.sms_consent_events (family_code);

COMMENT ON TABLE public.sms_consent_events IS
  'Append-only consent log. The current status is DERIVED by consentStatus() in '
  'lib/sms/consent.ts and is deliberately not stored — a boolean column cannot be a legal '
  'record of when somebody agreed and how. Never UPDATE or DELETE a row here.';

-- ── §3. THE VERIFICATION CHALLENGE ─────────────────────────────────────────────────────
-- 20260817000006's `family_removal_challenges` with the subject changed. Every decision there
-- applies here and is not restated; the two that are worth repeating are that the code itself is
-- NEVER stored (a dump of this table must not be usable to verify a number) and that `code_hash`
-- is deliberately NOT unique, because six digits is a space of a million and two people holding
-- the same live code is ordinary.

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code text NOT NULL,
  person_id   uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  -- The number the code was sent TO, snapshotted. A member who edits the box while a code is in
  -- flight must not be able to confirm the new number with the old code — so the consume
  -- function matches on this as well as on the person.
  phone_e164  text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phone_verifications_e164_shape
    CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE INDEX IF NOT EXISTS phone_verifications_open_idx
  ON public.phone_verifications (person_id, created_at DESC) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS phone_verifications_family_idx
  ON public.phone_verifications (family_code);

COMMENT ON TABLE public.phone_verifications IS
  'Six-digit challenges for confirming a sending number. SHA-256 only, never the code. '
  'Judged by consume_phone_verification() in one statement under FOR UPDATE.';

-- ── §4. RLS: SELF-SCOPED READS, AND NO WRITE POLICY ANYWHERE ───────────────────────────
--
-- No `auth_permission` on any of the three, and no `permission_table_map` row — see the header.
-- These are the member's own records and a permission key over them would be a control a family
-- could use to stop a relative managing their own consent.
--
-- `phone_verifications` GETS NO SELECT POLICY AT ALL, which is the one asymmetry here. There is
-- nothing in it a member needs to read: the code is a hash, and whether one is outstanding is
-- reported by the action from the admin client. §2c means no policy for a command denies it, so
-- this table is unreadable from the browser entirely — which is the right answer for a table of
-- credential hashes.

ALTER TABLE public.person_sms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_consent_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "person_sms_select_own" ON public.person_sms;
CREATE POLICY "person_sms_select_own"
  ON public.person_sms FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND person_id = public.auth_person_id()
  );

DROP POLICY IF EXISTS "sms_consent_events_select_own" ON public.sms_consent_events;
CREATE POLICY "sms_consent_events_select_own"
  ON public.sms_consent_events FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND person_id = public.auth_person_id()
  );

-- §2c: a statement of what these are for, not what makes them safe. `phone_verifications` is
-- deliberately absent — it has no SELECT policy, so `authenticated` can read no row of it.
GRANT SELECT ON public.person_sms         TO authenticated;
GRANT SELECT ON public.sms_consent_events TO authenticated;

-- ── §5. THE GUARDS (§4) ────────────────────────────────────────────────────────────────
-- The service role ignores RLS and does not ignore triggers. One function, three triggers: all
-- three tables carry exactly the same shape — a `person_id` that must be in the row's own family.

CREATE OR REPLACE FUNCTION public.tg_sms_person_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_other text;
BEGIN
  SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.person_id;
  IF v_other IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION '%: person % is not in family %',
      TG_TABLE_NAME, NEW.person_id, NEW.family_code USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS person_sms_same_family ON public.person_sms;
CREATE TRIGGER person_sms_same_family BEFORE INSERT OR UPDATE ON public.person_sms
  FOR EACH ROW EXECUTE FUNCTION public.tg_sms_person_same_family();

DROP TRIGGER IF EXISTS sms_consent_events_same_family ON public.sms_consent_events;
CREATE TRIGGER sms_consent_events_same_family
  BEFORE INSERT OR UPDATE ON public.sms_consent_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_sms_person_same_family();

DROP TRIGGER IF EXISTS phone_verifications_same_family ON public.phone_verifications;
CREATE TRIGGER phone_verifications_same_family
  BEFORE INSERT OR UPDATE ON public.phone_verifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_sms_person_same_family();

DROP TRIGGER IF EXISTS person_sms_updated_at ON public.person_sms;
CREATE TRIGGER person_sms_updated_at BEFORE UPDATE ON public.person_sms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── §5b. THE CONSENT LOG IS APPEND-ONLY, AND A TRIGGER IS WHAT MAKES THAT TRUE ─────────
-- §2c already denies the browser UPDATE and DELETE (no policy for either). This refuses them for
-- EVERY role including `service_role`, which is `meeting_votes_are_final`'s shape and the same
-- argument: a log a later writer can quietly rewrite is not a record. What it protects is the
-- one thing this whole file is for — being able to say when somebody agreed, and how.
--
-- DELETE IS ALLOWED ONLY INSIDE A CASCADE, measured the way 20260822000019 measured it: a direct
-- delete reports `pg_trigger_depth() = 1` and a cascade from `people` reports 2. So removing a
-- person still removes their consent history, and nothing else can.
CREATE OR REPLACE FUNCTION public.sms_consent_events_are_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'sms_consent_events is append-only — record a new event instead'
      USING ERRCODE = '42501';
  END IF;
  IF pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'sms_consent_events rows are removed only with the person they belong to'
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS sms_consent_events_final ON public.sms_consent_events;
CREATE TRIGGER sms_consent_events_final
  BEFORE UPDATE OR DELETE ON public.sms_consent_events
  FOR EACH ROW EXECUTE FUNCTION public.sms_consent_events_are_final();

-- ── §6. JUDGING A CODE, IN ONE STATEMENT ───────────────────────────────────────────────
-- `consume_family_removal_challenge` with the subject changed, and its header carries every
-- argument. `FOR UPDATE` is what makes the five-branch read-modify-write atomic against a second
-- call in the same instant.
--
-- IT MATCHES ON THE NUMBER AS WELL AS THE PERSON. A member who edits the box while a code is in
-- flight must not be able to confirm the NEW number with the code sent to the OLD one — which
-- would verify a number nobody ever proved.
CREATE OR REPLACE FUNCTION public.consume_phone_verification(
  p_family_code text,
  p_person_id   uuid,
  p_phone_e164  text,
  p_code_hash   text
)
RETURNS TABLE (ok boolean, message text, attempts_left int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- ALIASED AND QUALIFIED THROUGHOUT. `ok` and `message` are RETURNS TABLE names and therefore
  -- plpgsql variables in here, so an unqualified column reference is ambiguous and raises at
  -- CALL time rather than at CREATE time — the warning `consume_family_removal_challenge` and
  -- `staff_set_family_status` both carry.
  v_claims jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role   text  := COALESCE(v_claims ->> 'role', '');
  v_max    CONSTANT int := 5;
  v_row    public.phone_verifications;
  v_tries  int;
BEGIN
  IF v_role <> 'service_role' THEN
    RETURN QUERY SELECT false, 'Not authorized'::text, 0; RETURN;
  END IF;

  IF p_person_id IS NULL OR COALESCE(p_code_hash, '') = ''
     OR COALESCE(p_phone_e164, '') = '' OR COALESCE(p_family_code, '') = '' THEN
    RETURN QUERY SELECT false, 'Ask for a new code and try again.'::text, 0; RETURN;
  END IF;

  SELECT * INTO v_row
    FROM public.phone_verifications v
   WHERE v.family_code = p_family_code
     AND v.person_id   = p_person_id
     AND v.phone_e164  = p_phone_e164
     AND v.consumed_at IS NULL
   ORDER BY v.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false,
      'That code has already been used, or there is no code waiting for that number. '
      || 'Ask for a new one.', 0; RETURN;
  END IF;

  -- Expired codes are SPENT rather than left lying about, for the reason 20260817000007 gives:
  -- a challenge that can never succeed has no reason to stay open, and leaving it would let an
  -- expired row shadow the fresh one the caller asks for next.
  IF v_row.expires_at <= NOW() THEN
    UPDATE public.phone_verifications v SET consumed_at = NOW() WHERE v.id = v_row.id;
    RETURN QUERY SELECT false, 'That code has expired. Ask for a new one.'::text, 0; RETURN;
  END IF;

  IF v_row.attempts >= v_max THEN
    UPDATE public.phone_verifications v SET consumed_at = NOW() WHERE v.id = v_row.id;
    RETURN QUERY SELECT false, 'Too many wrong codes. Ask for a new one.'::text, 0; RETURN;
  END IF;

  -- A plain comparison. The timing channel is knowingly accepted for
  -- `consume_family_removal_challenge`'s reason: six digits behind a five-attempt cap means
  -- guessing is the attack and measuring is not.
  IF v_row.code_hash <> p_code_hash THEN
    UPDATE public.phone_verifications v
       SET attempts = v.attempts + 1
     WHERE v.id = v_row.id
    RETURNING v.attempts INTO v_tries;
    RETURN QUERY SELECT false,
      'That code is not right. Check it and try again.'::text, GREATEST(v_max - v_tries, 0);
    RETURN;
  END IF;

  UPDATE public.phone_verifications v SET consumed_at = NOW() WHERE v.id = v_row.id;
  RETURN QUERY SELECT true, 'Confirmed'::text, 0;
END $$;

-- §2b RULE 1: NO GRANT. `service_role` keeps EXECUTE by default and nothing in the browser calls
-- this. Default privileges (20260806000015) already revoke it from `anon` and `authenticated`;
-- the verify block asserts that rather than assuming it.
REVOKE ALL ON FUNCTION public.consume_phone_verification(text, uuid, text, text) FROM PUBLIC;

COMMENT ON FUNCTION public.consume_phone_verification(text, uuid, text, text) IS
  'Judge a six-digit phone verification in one statement under FOR UPDATE. Matches on the '
  'NUMBER as well as the person, so a code sent to one number cannot confirm another. Service '
  'role only — no grant to authenticated, deliberately.';

-- ── §7. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n    int;
  v_bad  text;
  v_src  text;
  v_fam  text := 'ZZSMS001';
  v_fam2 text := 'ZZSMS002';
  v_p1   uuid;
  v_p2   uuid;
  v_ok   boolean;
BEGIN
  -- 1. No write policy anywhere; self-scoped reads; and NO permission key.
  FOR v_bad IN SELECT unnest(ARRAY['person_sms', 'sms_consent_events', 'phone_verifications'])
  LOOP
    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = v_bad AND cmd <> 'SELECT';
    IF v_n > 0 THEN
      RAISE EXCEPTION '% has % write policy/policies — the actions are the boundary', v_bad, v_n;
    END IF;
    -- A `permission_table_map` row would compose an `auth_permission` factor onto these tables
    -- with `view` defaulting to 'everyone', publishing every relative's mobile number to the
    -- whole family. Asserted in both directions, the way 20260819000008 does for family-tree.
    IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE table_name = v_bad) THEN
      RAISE EXCEPTION '% has a permission_table_map row — see the migration header', v_bad;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = v_bad
         AND COALESCE(qual, '') LIKE '%auth_permission%'
    ) THEN
      RAISE EXCEPTION '%''s policy evaluates auth_permission — consent must not be delegable',
        v_bad;
    END IF;
  END LOOP;

  -- The two readable tables are self-scoped. `phone_verifications` has NO select policy, which
  -- is stronger, and is asserted as such rather than looped over.
  FOR v_bad IN SELECT unnest(ARRAY['person_sms', 'sms_consent_events']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = v_bad AND cmd = 'SELECT'
         AND COALESCE(qual, '') LIKE '%(person_id = auth_person_id())%'
    ) THEN
      RAISE EXCEPTION '%''s SELECT policy is not self-scoped — it would publish mobile numbers',
        v_bad;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'phone_verifications') THEN
    RAISE EXCEPTION 'phone_verifications has a policy — a table of code hashes should be '
      'unreadable from the browser entirely';
  END IF;

  -- 2. The consume function is reachable by nobody in the browser, and keeps its lock.
  IF has_function_privilege('authenticated',
       'public.consume_phone_verification(text, uuid, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'consume_phone_verification is executable by authenticated';
  END IF;
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'consume_phone_verification';
  IF v_src IS NULL OR v_src NOT LIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'consume_phone_verification has lost FOR UPDATE — two concurrent '
      'confirmations can now race';
  END IF;
  -- It must match on the NUMBER. Without that conjunct a code sent to one number confirms
  -- another, which verifies a number nobody proved.
  IF v_src NOT LIKE '%phone_e164%' THEN
    RAISE EXCEPTION 'consume_phone_verification no longer matches on the number';
  END IF;

  -- 3. The guards, the CHECKs, the index and the append-only trigger, exercised.
  BEGIN
    INSERT INTO public.families (family_code, family_name) VALUES (v_fam,  'sms probe 1');
    INSERT INTO public.families (family_code, family_name) VALUES (v_fam2, 'sms probe 2');
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
      VALUES (v_fam, 'Probe', 'One', 'zzsms1@example.invalid') RETURNING id INTO v_p1;
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
      VALUES (v_fam2, 'Probe', 'Two', 'zzsms2@example.invalid') RETURNING id INTO v_p2;

    -- 3a. A person from another family.
    v_ok := false;
    BEGIN
      INSERT INTO public.person_sms (family_code, person_id, phone_e164)
        VALUES (v_fam, v_p2, '+15125550134');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'person_sms accepted a cross-family person'; END IF;

    -- 3b. The positive control.
    INSERT INTO public.person_sms (family_code, person_id, phone_e164)
      VALUES (v_fam, v_p1, '+15125550134');

    -- 3c. Two rows for one person.
    v_ok := false;
    BEGIN
      INSERT INTO public.person_sms (family_code, person_id, phone_e164)
        VALUES (v_fam, v_p1, '+15125550199');
    EXCEPTION WHEN unique_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'person_sms accepted two rows for one person'; END IF;

    -- 3d. A confirmation with no number, and a malformed number.
    v_ok := false;
    BEGIN
      UPDATE public.person_sms SET phone_e164 = NULL, verified_at = NOW() WHERE person_id = v_p1;
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'person_sms accepted a verified_at with no number'; END IF;
    v_ok := false;
    BEGIN
      UPDATE public.person_sms SET phone_e164 = '5125550134' WHERE person_id = v_p1;
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'person_sms accepted a number that is not E.164'; END IF;

    -- 3e. THE CONSENT LOG IS APPEND-ONLY, for the service role too.
    INSERT INTO public.sms_consent_events (family_code, person_id, event, source)
      VALUES (v_fam, v_p1, 'granted', 'profile');
    v_ok := false;
    BEGIN
      UPDATE public.sms_consent_events SET event = 'withdrawn' WHERE person_id = v_p1;
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'sms_consent_events accepted an UPDATE'; END IF;
    v_ok := false;
    BEGIN
      DELETE FROM public.sms_consent_events WHERE person_id = v_p1;
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'sms_consent_events accepted a direct DELETE'; END IF;

    -- 3f. AND THE CASCADE STILL WORKS, which is the other direction of 3e and the one a
    --     too-strict trigger breaks. Removing a person must remove their consent history.
    DECLARE v_p3 uuid; v_left int;
    BEGIN
      INSERT INTO public.people (family_code, first_name, last_name, primary_email)
        VALUES (v_fam, 'Probe', 'Three', 'zzsms3@example.invalid') RETURNING id INTO v_p3;
      INSERT INTO public.sms_consent_events (family_code, person_id, event, source)
        VALUES (v_fam, v_p3, 'granted', 'profile');
      DELETE FROM public.people WHERE id = v_p3;
      SELECT count(*) INTO v_left FROM public.sms_consent_events WHERE person_id = v_p3;
      IF v_left <> 0 THEN
        RAISE EXCEPTION 'sms_consent_events survived the cascade from people — the '
          'append-only trigger is refusing a delete it must allow';
      END IF;
    END;

    -- 3g. The consume function refuses a non-service caller shape and judges a real code.
    INSERT INTO public.phone_verifications
      (family_code, person_id, phone_e164, code_hash, expires_at)
      VALUES (v_fam, v_p1, '+15125550134',
              encode(extensions.digest('123456', 'sha256'), 'hex'), NOW() + interval '10 min');
    -- No JWT claims in a migration, so `v_role` is '' and the function must refuse. That is the
    -- §2b rule-3 assertion: written as if reachable, and refusing anyone who is not the service
    -- role even though nothing is granted EXECUTE.
    IF (SELECT ok FROM public.consume_phone_verification(
          v_fam, v_p1, '+15125550134',
          encode(extensions.digest('123456', 'sha256'), 'hex'))) THEN
      RAISE EXCEPTION 'consume_phone_verification served a caller with no service role';
    END IF;

    RAISE EXCEPTION 'unwind-sms-probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'unwind-sms-probe' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'sms consent: three tables, no write policy, no permission key, append-only log';
END $mig$;

COMMIT;
