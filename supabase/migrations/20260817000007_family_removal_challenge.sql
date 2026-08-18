-- ============================================================================
-- Spending the emailed removal code, in one statement.
--
-- 20260817000006 created `family_removal_challenges`, wrote the contract on the
-- table's comment, and deliberately left the RPCs out — "the functions themselves
-- arrive with the server actions that call them, because the code must be
-- generated, mailed and verified in one place and the mailing is not something
-- SQL does". This is the verifying half. The minting half is NOT here; see below.
--
-- ── WHY THE VERIFICATION IS SQL AND THE MINTING IS TYPESCRIPT ───────────────
-- They are not the same kind of operation, and splitting them is the decision
-- this file exists to record.
--
-- MINTING is an INSERT. `removeFamily`'s sibling action generates six digits with
-- `node:crypto`'s randomInt, hashes them, writes one row through the service role
-- and mails the plaintext. Nothing about that needs a function: the plaintext has
-- to exist in the Node process anyway, because that process is what composes the
-- email — and a SQL generator would have to RETURN the code through PostgREST to
-- get it there, putting the secret on a second wire and into a second set of logs
-- for no gain. `randomInt` is rejection-sampled over the platform CSPRNG (it is
-- the same generator `app/actions/register.ts` already uses for family codes),
-- which is what the table's contract asks for; `random()` is what it forbids.
--
-- VERIFYING is a READ-MODIFY-WRITE with five branches, and doing it from the app
-- races itself. Two tabs, or one impatient double click, and the read-then-write
-- version lets the SAME challenge be consumed twice — or, worse, lets a wrong
-- guess and a right guess interleave so the attempts counter records one of two
-- failures. The row has to be locked while it is judged, which is `FOR UPDATE`
-- inside one function, and there is no supabase-js shape that expresses it.
--
-- ── IT VERIFIES AND CONSUMES. IT DOES NOT REMOVE ────────────────────────────
-- The `families` UPDATE stays in the server action, through the service role, for
-- the reason 20260817000006 §2 gives: `families_guard_removal` refuses the
-- `authenticated` role, so the write has to be made by something speaking as
-- service_role, and the action already is. Folding the removal in here would give
-- this function a second job and would make `families.status` movable by two code
-- paths instead of one.
--
-- The cost is that the code is spent even when the UPDATE that follows fails, and
-- that is the contract rather than a wart: the table's comment says "single use,
-- stamped in consumed_at whether or not the removal succeeded". A code that
-- survives a failed removal is a code that can be replayed.
--
-- ── THE CHALLENGE IS RESOLVED, NEVER ADDRESSED ──────────────────────────────
-- `p_code_hash` is COMPARED. It is not what the row is found by, and neither is
-- an id — the lookup is (family_code, requested_by), which is the pair
-- 20260817000006 named on the table for exactly this. Addressing a challenge by
-- id or by hash would let a caller holding a guessed code spend another family's
-- challenge, and the app layer would then be the only thing between that and a
-- removal.
--
-- ── GRANTED TO NOBODY, AND IT REFUSES EVERY ROLE BUT service_role ───────────
-- AGENTS.md §2b twice over. The grant is the outer layer: default privileges
-- (20260806000015 §6) revoke EXECUTE from `anon` and `authenticated` for every
-- new function, and §3 below revokes again explicitly, so PostgREST publishes
-- nothing a browser may call. The inner layer is the role test at the top of the
-- body, because that section also says grants have twice been re-opened by
-- something outside the migration chain — `supabase/seed.sql` used to re-grant
-- every function after every reset, and the hosted project did the same.
--
-- `p_person_id` is an identity parameter, which §2b forbids "unless the function
-- distinguishes the caller itself". It distinguishes: the role comes from
-- PostgREST's VERIFIED JWT claims, exactly as `redeem_family_invitation` and
-- `staff_set_family_status` read it, and anything that is not service_role is
-- refused outright rather than having its argument validated. A browser cannot
-- set `request.jwt.claims`.
--
-- Refusing outright — rather than falling back to `auth.uid()` — is the narrower
-- choice and the right one here: this function has exactly one caller, an action
-- that reaches it through `createAdminClient()`, and a member calling it for
-- themselves could only ever burn their own challenge's attempts. There is no
-- legitimate authenticated use to preserve, so there is none to get wrong.
--
-- IDEMPOTENT. One CREATE OR REPLACE, one REVOKE, one COMMENT, and a verify block
-- that removes everything it creates. Safe on an empty database: §4 seeds its own
-- family, its own person and its own challenges.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand.
--   See AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The five branches, and the order they are asked in ───────────────────
-- Expired before exhausted before wrong, because each is a different sentence to
-- read and answering "that code is not right" to an expired one sends somebody
-- back to their inbox to retype a code that can never work.
--
-- THE ATTEMPT CAP IS IN HERE, not in the app. It is the only thing standing
-- between five guesses and a million-wide code space, and an app-layer cap is a
-- cap the app can forget — this function has to be safe on the assumption that
-- its caller has been rewritten by somebody who has not read this file.
--
-- `attempts_left` is returned so the UI can count down out loud. It is NOT a
-- disclosure: the caller has already been proved to hold `admin/family/remove`
-- in the family the challenge belongs to, so there is nobody to keep it from.
CREATE OR REPLACE FUNCTION public.consume_family_removal_challenge(
  p_family_code text,
  p_person_id   uuid,
  p_code_hash   text
)
RETURNS TABLE (ok boolean, message text, attempts_left int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- ALIASED AND QUALIFIED THROUGHOUT. `ok` and `message` are RETURNS TABLE names
  -- and therefore plpgsql variables in here, so an unqualified column reference
  -- is ambiguous and raises at CALL time rather than at CREATE time — the same
  -- warning `staff_set_family_status` and `create_family_invitation` carry.
  v_claims  jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role    text  := COALESCE(v_claims ->> 'role', '');
  -- Five, matching the number the table's contract states. One constant, so the
  -- refusal and the countdown cannot disagree about it.
  v_max     CONSTANT int := 5;
  v_code    text := upper(btrim(COALESCE(p_family_code, '')));
  v_row     public.family_removal_challenges;
  v_tries   int;
BEGIN
  IF v_role <> 'service_role' THEN
    RETURN QUERY SELECT false, 'Not authorized'::text, 0; RETURN;
  END IF;

  IF p_person_id IS NULL OR v_code = '' OR COALESCE(p_code_hash, '') = '' THEN
    RETURN QUERY SELECT false, 'Ask for a new code and try again.'::text, 0; RETURN;
  END IF;

  -- THE NEWEST UNSPENT CHALLENGE FOR THIS FAMILY AND THIS PERSON, locked while it
  -- is judged. `FOR UPDATE` is what makes the read-modify-write below atomic
  -- against a second call arriving in the same instant: the loser blocks here
  -- until the winner commits, and then sees `consumed_at` set.
  SELECT * INTO v_row
    FROM public.family_removal_challenges c
   WHERE c.family_code  = v_code
     AND c.requested_by = p_person_id
     AND c.consumed_at IS NULL
   ORDER BY c.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false,
      'That code has already been used, or there is no code waiting. Ask for a new one.'::text,
      0; RETURN;
  END IF;

  -- Expired codes are SPENT rather than left lying about. A challenge that can
  -- never succeed has no reason to stay open, and leaving it would let an expired
  -- row shadow the fresh one the caller asks for next (the lookup takes the
  -- newest, but only among rows nothing has consumed).
  IF v_row.expires_at <= NOW() THEN
    UPDATE public.family_removal_challenges c
       SET consumed_at = NOW() WHERE c.id = v_row.id;
    RETURN QUERY SELECT false, 'That code has expired. Ask for a new one.'::text, 0; RETURN;
  END IF;

  IF v_row.attempts >= v_max THEN
    UPDATE public.family_removal_challenges c
       SET consumed_at = NOW() WHERE c.id = v_row.id;
    RETURN QUERY SELECT false,
      'Too many wrong codes. Ask for a new one.'::text, 0; RETURN;
  END IF;

  -- A PLAIN COMPARISON, and the timing channel is knowingly accepted. The secret
  -- is six digits behind a five-attempt cap, so guessing is the attack and
  -- measuring is not; and a caller close enough to time this already holds
  -- `admin/family/remove` in the family whose code it is.
  IF v_row.code_hash <> p_code_hash THEN
    UPDATE public.family_removal_challenges c
       SET attempts = c.attempts + 1
     WHERE c.id = v_row.id
    RETURNING c.attempts INTO v_tries;

    -- The fifth wrong guess closes the challenge on the spot rather than leaving
    -- it to be refused by the branch above on a sixth call. Same outcome, one
    -- fewer round trip, and the row records that it was exhausted rather than
    -- abandoned.
    IF v_tries >= v_max THEN
      UPDATE public.family_removal_challenges c
         SET consumed_at = NOW() WHERE c.id = v_row.id;
      RETURN QUERY SELECT false,
        'Too many wrong codes. Ask for a new one.'::text, 0; RETURN;
    END IF;

    RETURN QUERY SELECT false, 'That code is not right.'::text, v_max - v_tries; RETURN;
  END IF;

  -- Right. Spent, and the attempt counted — a successful guess is still a guess,
  -- and a row that says `attempts = 0` after a removal would be describing a
  -- challenge nobody ever answered.
  UPDATE public.family_removal_challenges c
     SET consumed_at = NOW(), attempts = c.attempts + 1
   WHERE c.id = v_row.id;

  RETURN QUERY SELECT true, NULL::text, 0; RETURN;
END $$;

-- ── 2. Reachable by the service role and by nothing else ────────────────────
-- Default privileges since 20260806000015 §6 already withhold EXECUTE from the
-- two browser roles; this states it, so a future `GRANT ALL ON ALL FUNCTIONS`
-- swept in from outside the chain has to overwrite something explicit rather than
-- filling a blank. §1's role test is what holds if it does anyway.
REVOKE ALL ON FUNCTION public.consume_family_removal_challenge(text, uuid, text)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.consume_family_removal_challenge(text, uuid, text) IS
  'Verify and CONSUME the emailed six-digit removal code, atomically. The challenge is '
  'resolved from (family_code, requested_by) and the hash is COMPARED — never used to '
  'find the row — so a guessed code cannot spend another family''s challenge. Single use, '
  'stamped whether or not the removal that follows succeeds; at most 5 attempts; expired '
  'and exhausted challenges are closed rather than left open. Refuses every JWT role but '
  'service_role, and is granted to nobody. It does NOT touch families.status: that write '
  'stays in the server action, because families_guard_removal refuses the authenticated '
  'role and the action already speaks as the service role. Added 20260817000007.';

-- ── 3. Verify ───────────────────────────────────────────────────────────────
-- BEHAVIOURAL, and every branch is CALLED rather than asserted to exist. The
-- fixture is a throwaway family and one unclaimed person, both of which this block
-- creates and deletes — no `auth.users` row is needed anywhere, so nothing here
-- can skip itself into a false pass the way 20260806000012's block did.
--
-- MUTATION-CHECKED, 2026-08-18. Six copies of this file, each with one line of §1
-- changed, replayed against the local stack (`psql -f`, which is legitimate for a
-- throwaway probe and never for a deploy — see the note above). Every one of them
-- aborts, and these are the messages they actually printed rather than the ones
-- they were expected to:
--
--   * delete BOTH `attempts >= v_max` branches — the pre-check and the one after
--     the increment
--       -> 'ROLLBACK: five wrong guesses left attempts=5 consumed=f — the challenge
--           must be closed on the fifth'
--     Note WHICH assertion catches it: the closing check, not the sixth-guess one
--     below it. Without the cap the fifth guess leaves the row open, so the block
--     never reaches the question it was written to ask. Both assertions are kept —
--     one would have been enough here and the pair is what distinguishes "the cap
--     is gone" from "the cap fires and the row stays open".
--   * `v_row.expires_at <= NOW()` -> `<= NOW() - interval '1 day'`
--       -> 'ROLLBACK: an EXPIRED challenge was accepted (ok=t, message=<null>)'
--   * delete the `AND c.requested_by = p_person_id` conjunct
--       -> 'ROLLBACK: a challenge belonging to another person was spent'
--   * replace `WHERE c.family_code = v_code` with `WHERE true`
--       -> 'ROLLBACK: a challenge belonging to another family was spent'
--   * `IF v_role <> 'service_role'` -> `IF v_role = 'nobody'`
--       -> 'ROLLBACK: an authenticated caller reached the challenge (ok=t,
--           message=<null>)'
--   * delete `consumed_at = NOW()` from the success branch's UPDATE
--       -> 'ROLLBACK: the code was not spent — it can be replayed, and single use
--           is the whole of what the emailed code buys'
--
-- The unmutated file, run the same way, prints the NOTICE at the bottom of §3.
DO $mig$
DECLARE
  v_code     CONSTANT text := 'ZZCHALL';
  v_other    CONSTANT text := 'ZZCHAL2';
  v_right    CONSTANT text := '424242';
  v_wrong    CONSTANT text := '999999';
  v_person   uuid;
  v_stranger uuid;
  v_hit      uuid;
  v_ok       boolean;
  v_msg      text;
  v_left     int;
  v_spent    boolean;
  v_tries    int;
  i          int;
BEGIN
  -- 3a. Structural, and cheap: the function exists with the shape §1 declares, and
  -- no browser role can execute it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'consume_family_removal_challenge'
       AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: consume_family_removal_challenge is missing or not SECURITY DEFINER';
  END IF;

  IF has_function_privilege('anon', 'public.consume_family_removal_challenge(text, uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.consume_family_removal_challenge(text, uuid, text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION
      'ROLLBACK: a browser role can execute consume_family_removal_challenge. Spending a '
      'removal code is the service role''s alone.';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.consume_family_removal_challenge(text, uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ROLLBACK: service_role cannot execute consume_family_removal_challenge';
  END IF;

  -- `search_path` pinned, per AGENTS.md: this body resolves nothing until it runs.
  --
  -- Matched with LIKE over `unnest(proconfig)` rather than by array containment,
  -- because the stored form is `search_path=""` — the empty string arrives QUOTED,
  -- and `@> ARRAY['search_path=']` therefore finds nothing and fails a function
  -- that does pin it. Established by running it, not by reading.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'consume_family_removal_challenge'
       AND cfg LIKE 'search_path=%'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: consume_family_removal_challenge does not pin search_path';
  END IF;

  -- 3b. Two throwaway families and two unclaimed people — one in each — so the
  -- resolution pair can be tested in BOTH directions. created_by is left NULL and
  -- no account is involved, which is what keeps this block unconditional.
  INSERT INTO public.families (family_code, family_name)
  VALUES (v_code, 'Challenge probe'), (v_other, 'Challenge probe 2');

  INSERT INTO public.people (family_code, first_name, last_name)
  VALUES (v_code, 'Challenge', 'Probe') RETURNING id INTO v_person;
  INSERT INTO public.people (family_code, first_name, last_name)
  VALUES (v_other, 'Challenge', 'Stranger') RETURNING id INTO v_stranger;

  -- Speaking as the service role for everything below except the one probe that
  -- deliberately does not.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- ── No challenge at all ───────────────────────────────────────────────────
  SELECT r.ok, r.message INTO v_ok, v_msg
    FROM public.consume_family_removal_challenge(
      v_code, v_person, encode(extensions.digest(v_right, 'sha256'), 'hex')) r;
  IF v_ok IS DISTINCT FROM false OR v_msg NOT LIKE '%no code waiting%' THEN
    RAISE EXCEPTION
      'ROLLBACK: a removal was confirmed against no challenge at all (ok=%, message=%)',
      v_ok, COALESCE(v_msg, '<null>');
  END IF;

  -- ── A wrong code counts, and does not spend ───────────────────────────────
  INSERT INTO public.family_removal_challenges (family_code, requested_by, code_hash, expires_at)
  VALUES (v_code, v_person, encode(extensions.digest(v_right, 'sha256'), 'hex'),
          NOW() + interval '15 minutes')
  RETURNING id INTO v_hit;

  SELECT r.ok, r.message, r.attempts_left INTO v_ok, v_msg, v_left
    FROM public.consume_family_removal_challenge(
      v_code, v_person, encode(extensions.digest(v_wrong, 'sha256'), 'hex')) r;
  IF v_ok IS DISTINCT FROM false OR v_msg IS DISTINCT FROM 'That code is not right.' THEN
    RAISE EXCEPTION 'ROLLBACK: a WRONG code was accepted (ok=%, message=%)',
      v_ok, COALESCE(v_msg, '<null>');
  END IF;
  IF v_left <> 4 THEN
    RAISE EXCEPTION 'ROLLBACK: after one wrong guess the countdown said %, expected 4', v_left;
  END IF;

  SELECT c.attempts, c.consumed_at IS NOT NULL INTO v_tries, v_spent
    FROM public.family_removal_challenges c WHERE c.id = v_hit;
  IF v_tries <> 1 OR v_spent THEN
    RAISE EXCEPTION
      'ROLLBACK: a wrong guess left attempts=% consumed=% — it must count and must not spend',
      v_tries, v_spent;
  END IF;

  -- ── Another family's challenge, and another person's ──────────────────────
  -- The pair the lookup resolves on, tested one conjunct at a time. Neither call
  -- may reach the row above, and neither may leave a mark on it.
  SELECT r.ok INTO v_ok
    FROM public.consume_family_removal_challenge(
      v_other, v_person, encode(extensions.digest(v_right, 'sha256'), 'hex')) r;
  IF v_ok IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'ROLLBACK: a challenge belonging to another family was spent';
  END IF;

  SELECT r.ok INTO v_ok
    FROM public.consume_family_removal_challenge(
      v_code, v_stranger, encode(extensions.digest(v_right, 'sha256'), 'hex')) r;
  IF v_ok IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'ROLLBACK: a challenge belonging to another person was spent';
  END IF;

  SELECT c.attempts, c.consumed_at IS NOT NULL INTO v_tries, v_spent
    FROM public.family_removal_challenges c WHERE c.id = v_hit;
  IF v_tries <> 1 OR v_spent THEN
    RAISE EXCEPTION
      'ROLLBACK: a call naming another family or another person still touched this '
      'challenge (attempts=%, consumed=%)', v_tries, v_spent;
  END IF;

  -- ── An authenticated caller who has found the endpoint ────────────────────
  PERFORM set_config('request.jwt.claims',
                     '{"role":"authenticated","sub":"00000000-0000-4000-8000-00000000f002"}', true);
  SELECT r.ok, r.message INTO v_ok, v_msg
    FROM public.consume_family_removal_challenge(
      v_code, v_person, encode(extensions.digest(v_right, 'sha256'), 'hex')) r;
  IF v_ok IS DISTINCT FROM false OR v_msg IS DISTINCT FROM 'Not authorized' THEN
    RAISE EXCEPTION
      'ROLLBACK: an authenticated caller reached the challenge (ok=%, message=%)',
      v_ok, COALESCE(v_msg, '<null>');
  END IF;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- ── Five guesses and the challenge is closed ──────────────────────────────
  -- One wrong guess is already recorded above, so four more reach the cap.
  FOR i IN 1..4 LOOP
    PERFORM public.consume_family_removal_challenge(
      v_code, v_person, encode(extensions.digest(v_wrong, 'sha256'), 'hex'));
  END LOOP;

  SELECT c.attempts, c.consumed_at IS NOT NULL INTO v_tries, v_spent
    FROM public.family_removal_challenges c WHERE c.id = v_hit;
  IF v_tries <> 5 OR NOT v_spent THEN
    RAISE EXCEPTION
      'ROLLBACK: five wrong guesses left attempts=% consumed=% — the challenge must be '
      'closed on the fifth', v_tries, v_spent;
  END IF;

  -- And the RIGHT code no longer works on it, which is what the cap is for.
  SELECT r.ok INTO v_ok
    FROM public.consume_family_removal_challenge(
      v_code, v_person, encode(extensions.digest(v_right, 'sha256'), 'hex')) r;
  IF v_ok IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'ROLLBACK: the sixth guess was not refused — the attempt cap is gone, and six digits '
      'behind unlimited attempts is not a secret';
  END IF;

  -- ── An expired challenge ──────────────────────────────────────────────────
  INSERT INTO public.family_removal_challenges (family_code, requested_by, code_hash, expires_at)
  VALUES (v_code, v_person, encode(extensions.digest(v_right, 'sha256'), 'hex'),
          NOW() - interval '1 minute')
  RETURNING id INTO v_hit;

  SELECT r.ok, r.message INTO v_ok, v_msg
    FROM public.consume_family_removal_challenge(
      v_code, v_person, encode(extensions.digest(v_right, 'sha256'), 'hex')) r;
  IF v_ok IS DISTINCT FROM false OR v_msg NOT LIKE '%expired%' THEN
    RAISE EXCEPTION 'ROLLBACK: an EXPIRED challenge was accepted (ok=%, message=%)',
      v_ok, COALESCE(v_msg, '<null>');
  END IF;

  SELECT c.consumed_at IS NOT NULL INTO v_spent
    FROM public.family_removal_challenges c WHERE c.id = v_hit;
  IF NOT v_spent THEN
    RAISE EXCEPTION
      'ROLLBACK: an expired challenge was left open, where it will shadow the next one';
  END IF;

  -- ── The success path, and the single use that follows it ──────────────────
  INSERT INTO public.family_removal_challenges (family_code, requested_by, code_hash, expires_at)
  VALUES (v_code, v_person, encode(extensions.digest(v_right, 'sha256'), 'hex'),
          NOW() + interval '15 minutes')
  RETURNING id INTO v_hit;

  SELECT r.ok, r.message INTO v_ok, v_msg
    FROM public.consume_family_removal_challenge(
      v_code, v_person, encode(extensions.digest(v_right, 'sha256'), 'hex')) r;
  IF v_ok IS DISTINCT FROM true OR v_msg IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: the RIGHT code was refused (ok=%, message=%). Nothing could then remove a '
      'family at all.', v_ok, COALESCE(v_msg, '<null>');
  END IF;

  SELECT c.consumed_at IS NOT NULL, c.attempts INTO v_spent, v_tries
    FROM public.family_removal_challenges c WHERE c.id = v_hit;
  IF NOT v_spent THEN
    RAISE EXCEPTION
      'ROLLBACK: the code was not spent — it can be replayed, and single use is the whole '
      'of what the emailed code buys';
  END IF;
  IF v_tries <> 1 THEN
    RAISE EXCEPTION
      'ROLLBACK: a successful confirmation recorded attempts=%, expected 1 — a challenge '
      'that says nobody answered it is not a record of anything', v_tries;
  END IF;

  SELECT r.ok INTO v_ok
    FROM public.consume_family_removal_challenge(
      v_code, v_person, encode(extensions.digest(v_right, 'sha256'), 'hex')) r;
  IF v_ok IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'ROLLBACK: the same code was accepted twice';
  END IF;

  PERFORM set_config('request.jwt.claims', '', true);

  -- 3c. Clean up. The `families` rows go FIRST, for 20260817000006 §8k's reason:
  -- families_seed_system_funds gave each probe a Donations fund, and
  -- funds_protect_system() releases a system fund for deletion on exactly one
  -- condition — that the `families` row is already gone.
  DELETE FROM public.family_removal_challenges WHERE family_code IN (v_code, v_other);
  DELETE FROM public.families                  WHERE family_code IN (v_code, v_other);
  DELETE FROM public.funds                     WHERE family_code IN (v_code, v_other);
  DELETE FROM public.people                    WHERE family_code IN (v_code, v_other);
  DELETE FROM public.template_permissions tp
   USING public.permission_templates t
   WHERE tp.template_id = t.id AND t.family_code IN (v_code, v_other);
  DELETE FROM public.permission_templates      WHERE family_code IN (v_code, v_other);
  DELETE FROM public.resource_visibility       WHERE family_code IN (v_code, v_other);

  RAISE NOTICE
    'family removal challenge verified: wrong counts without spending, five closes it, '
    'expired refused and closed, another family''s and another person''s challenge '
    'untouchable, authenticated refused, right code succeeds exactly once';
END $mig$;

COMMIT;
