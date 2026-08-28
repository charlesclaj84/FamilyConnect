-- ════════════════════════════════════════════════════════════════════════════
-- ONE EMAILED-CODE MECHANISM, FOR MORE THAN ONE IRREVERSIBLE ACT
--
-- Disconnecting a family's Stripe account joins removing a family behind a
-- six-digit code emailed to the person doing it. That is the second use of a
-- mechanism built for one, so this migration GENERALISES what 20260817000006 and
-- 20260817000007 shipped rather than putting a second copy beside it.
--
-- ── WHY THE DISCONNECT EARNS THIS GATE ──────────────────────────────────────
-- `disconnectProcessor` cancels every member's recurring dues payment AT STRIPE
-- before it sets its flag, and a cancelled Stripe subscription cannot be
-- un-cancelled. So the reconnection is one click and the ENROLMENTS never come
-- back — every relative who was paying automatically has to set it up again. It
-- is the same shape as removing a family: reversible in the part people look at,
-- irreversible underneath, and worth two deliberate acts rather than one press.
--
-- ── WHY GENERALISE RATHER THAN COPY ─────────────────────────────────────────
-- `consume_family_removal_challenge` is a hundred lines of read-modify-write
-- under `FOR UPDATE`, with a five-attempt cap, an expiry that CLOSES the row it
-- refuses, a role test, and a hash that is only ever COMPARED and never used to
-- find a row. Every one of those is a decision, and a second copy is a second
-- place for one of them to be got wrong — the argument AGENTS.md makes about
-- `lib/chapter-propagation.ts` being a module rather than a second
-- implementation beside the screen that needed it.
--
-- ── THE RENAME IS THE HONEST HALF, AND IT IS NOT ADDITIVE ───────────────────
-- `family_removal_challenges` holding processor-disconnect rows would be a table
-- named for one of the two things in it, which is how the next reader comes to
-- believe a disconnect challenge is a removal. So it becomes
-- `family_action_challenges` and grows a `purpose`.
--
-- A RENAME BREAKS THE RUNNING CODE FOR ONE ALIAS WINDOW. Migrations reach hosted
-- before the build that needs them is aliased (AGENTS.md, "How migrations reach
-- the hosted project"), so for that window the OLD code asks PostgREST for a
-- table that no longer exists and gets 42P01 — every removal-code request fails.
-- It is admissible for exactly the reason 20260822000001's DROP COLUMN was: no
-- family is using this product yet. If that stops being true, the shape is two
-- deploys — add the new name as a view, move the code, drop the old.
--
-- ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
-- No RLS policy, on either the old table or the new name. It carries the hash of
-- a confirmation code and its mere EXISTENCE says somebody is midway through an
-- irreversible act; 20260817000006 argues that at length and nothing about a
-- second purpose changes it. RLS stays enabled with zero policies, so the browser
-- roles reach no row of it by any route (§2c).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. The table ────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.family_removal_challenges
  RENAME TO family_action_challenges;

-- WHICH IRREVERSIBLE ACT THIS CODE IS FOR. Part of the key a verification
-- resolves on, so a code minted to disconnect Stripe can never be spent to remove
-- the family — which is the whole reason this is a column and not a comment.
--
-- The DEFAULT exists only to fill the rows already there and is dropped
-- immediately below: every insert after this migration states its purpose, and a
-- default would let a caller that forgot silently mint a removal code.
ALTER TABLE public.family_action_challenges
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'family_removal';

ALTER TABLE public.family_action_challenges
  ALTER COLUMN purpose DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'family_action_challenges_purpose_check'
       AND conrelid = 'public.family_action_challenges'::regclass
  ) THEN
    -- NAMED VALUES, NOT FREE TEXT. The set is small, it is closed, and a typo in
    -- an action would otherwise mint a challenge under a purpose nothing ever
    -- verifies against — a code that arrives in somebody's inbox and can never
    -- be spent.
    ALTER TABLE public.family_action_challenges
      ADD CONSTRAINT family_action_challenges_purpose_check
      CHECK (purpose IN ('family_removal', 'processor_disconnect'));
  END IF;
END $$;

-- ── 2. The indexes follow the table and the new key ─────────────────────────
ALTER INDEX IF EXISTS public.family_removal_challenges_family_idx
  RENAME TO family_action_challenges_family_idx;

-- The open-challenge lookup is now (family, person, PURPOSE), because that is
-- what the verification resolves on. Dropped and rebuilt rather than renamed: the
-- column list changed, and an index renamed into a name that describes a
-- different key is worse than no index at all.
DROP INDEX IF EXISTS public.family_removal_challenges_open_idx;
DROP INDEX IF EXISTS public.family_action_challenges_open_idx;
CREATE INDEX family_action_challenges_open_idx
  ON public.family_action_challenges (family_code, requested_by, purpose, created_at DESC)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE public.family_action_challenges IS
  'One row per emailed six-digit code confirming an irreversible act. `purpose` says which '
  'act, and is part of the key a verification resolves on, so a code minted for one can '
  'never be spent on another. The code itself is never stored — only its SHA-256. RLS is '
  'enabled with NO policy: the row names a family somebody is midway through acting on, and '
  'that is nobody''s business including the member who asked. Renamed from '
  'family_removal_challenges by 20260825000000, when disconnecting Stripe became the second '
  'act behind this gate.';

COMMENT ON COLUMN public.family_action_challenges.purpose IS
  'family_removal | processor_disconnect. No DEFAULT, deliberately: a caller that forgets to '
  'state it fails loudly rather than minting a removal code by accident.';

-- ── 3. The verification, generalised ────────────────────────────────────────
-- Every decision below is 20260817000007's, unchanged except that the challenge
-- is resolved on (family_code, requested_by, PURPOSE) rather than on the first
-- two alone. The comments are kept rather than trimmed, because each of them
-- records why a branch is the way it is and this is now the only copy.
CREATE OR REPLACE FUNCTION public.consume_family_action_challenge(
  p_family_code text,
  p_person_id   uuid,
  p_purpose     text,
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
  -- is ambiguous and raises at CALL time rather than at CREATE time.
  v_claims  jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role    text  := COALESCE(v_claims ->> 'role', '');
  -- Five, matching the number the table's contract states. One constant, so the
  -- refusal and the countdown cannot disagree about it.
  v_max     CONSTANT int := 5;
  v_code    text := upper(btrim(COALESCE(p_family_code, '')));
  v_purpose text := btrim(COALESCE(p_purpose, ''));
  v_row     public.family_action_challenges;
  v_tries   int;
BEGIN
  IF v_role <> 'service_role' THEN
    RETURN QUERY SELECT false, 'Not authorized'::text, 0; RETURN;
  END IF;

  -- THE PURPOSE IS VALIDATED, NOT TAKEN ON TRUST. It reaches this function from a
  -- server action rather than from a browser, but an unrecognised value would
  -- otherwise resolve against no row and be reported as "there is no code
  -- waiting" — a typo presenting as an expired code, which is the sort of thing
  -- somebody chases for an afternoon.
  IF v_purpose NOT IN ('family_removal', 'processor_disconnect') THEN
    RETURN QUERY SELECT false, 'Not authorized'::text, 0; RETURN;
  END IF;

  IF p_person_id IS NULL OR v_code = '' OR COALESCE(p_code_hash, '') = '' THEN
    RETURN QUERY SELECT false, 'Ask for a new code and try again.'::text, 0; RETURN;
  END IF;

  -- THE NEWEST UNSPENT CHALLENGE FOR THIS FAMILY, THIS PERSON AND THIS PURPOSE,
  -- locked while it is judged. `FOR UPDATE` is what makes the read-modify-write
  -- below atomic against a second call arriving in the same instant: the loser
  -- blocks here until the winner commits, and then sees `consumed_at` set.
  SELECT * INTO v_row
    FROM public.family_action_challenges c
   WHERE c.family_code  = v_code
     AND c.requested_by = p_person_id
     AND c.purpose      = v_purpose
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
  -- row shadow the fresh one the caller asks for next.
  IF v_row.expires_at <= NOW() THEN
    UPDATE public.family_action_challenges c
       SET consumed_at = NOW() WHERE c.id = v_row.id;
    RETURN QUERY SELECT false, 'That code has expired. Ask for a new one.'::text, 0; RETURN;
  END IF;

  IF v_row.attempts >= v_max THEN
    UPDATE public.family_action_challenges c
       SET consumed_at = NOW() WHERE c.id = v_row.id;
    RETURN QUERY SELECT false,
      'Too many wrong codes. Ask for a new one.'::text, 0; RETURN;
  END IF;

  -- A PLAIN COMPARISON, and the timing channel is knowingly accepted. The secret
  -- is six digits behind a five-attempt cap, so guessing is the attack and
  -- measuring is not; and a caller close enough to time this already holds the
  -- grant for the act whose code it is.
  IF v_row.code_hash <> p_code_hash THEN
    UPDATE public.family_action_challenges c
       SET attempts = c.attempts + 1
     WHERE c.id = v_row.id
    RETURNING c.attempts INTO v_tries;

    -- The fifth wrong guess closes the challenge on the spot rather than leaving
    -- it to be refused by the branch above on a sixth call.
    IF v_tries >= v_max THEN
      UPDATE public.family_action_challenges c
         SET consumed_at = NOW() WHERE c.id = v_row.id;
      RETURN QUERY SELECT false,
        'Too many wrong codes. Ask for a new one.'::text, 0; RETURN;
    END IF;

    RETURN QUERY SELECT false, 'That code is not right.'::text, v_max - v_tries; RETURN;
  END IF;

  -- Right. Spent, and the attempt counted — a successful guess is still a guess,
  -- and a row that says `attempts = 0` afterwards would be describing a challenge
  -- nobody ever answered.
  UPDATE public.family_action_challenges c
     SET consumed_at = NOW(), attempts = c.attempts + 1
   WHERE c.id = v_row.id;

  RETURN QUERY SELECT true, NULL::text, 0; RETURN;
END $$;

-- ── 4. Reachable by the service role and by nothing else ────────────────────
-- Default privileges since 20260806000015 §6 already withhold EXECUTE from the
-- two browser roles; this states it, so a future `GRANT ALL ON ALL FUNCTIONS`
-- swept in from outside the chain has to overwrite something explicit rather than
-- filling a blank. §1's role test is what holds if it does anyway.
REVOKE ALL ON FUNCTION public.consume_family_action_challenge(text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.consume_family_action_challenge(text, uuid, text, text) IS
  'Verify and CONSUME an emailed six-digit code, atomically. The challenge is resolved from '
  '(family_code, requested_by, purpose) and the hash is COMPARED — never used to find the '
  'row — so a guessed code cannot spend another family''s challenge and a code minted for '
  'one act cannot be spent on another. Single use, stamped whether or not the act that '
  'follows succeeds; at most 5 attempts; expired and exhausted challenges are closed rather '
  'than left open. Refuses every JWT role but service_role, and is granted to nobody. It '
  'performs NONE of the acts it authorises: those writes stay in their server actions. '
  'Generalised from consume_family_removal_challenge by 20260825000000.';

-- ── 5. The old function goes, rather than staying as a wrapper ──────────────
-- A wrapper would be a second name for one rule and the only caller it could
-- serve has been updated in the same commit. Leaving it would also leave a
-- three-argument entry point that cannot state a purpose, which is precisely the
-- thing the column exists to make impossible.
DROP FUNCTION IF EXISTS public.consume_family_removal_challenge(text, uuid, text);

-- ── 6. Verify ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count int;
BEGIN
  IF to_regclass('public.family_action_challenges') IS NULL THEN
    RAISE EXCEPTION 'family_action_challenges is missing — the rename did not apply';
  END IF;
  IF to_regclass('public.family_removal_challenges') IS NOT NULL THEN
    RAISE EXCEPTION 'family_removal_challenges still exists — two tables for one mechanism';
  END IF;

  -- RLS ON AND NO POLICY, asserted rather than assumed. This is the whole access
  -- model for this table (§2c): with a policy for any command the browser roles
  -- would reach rows naming families midway through an irreversible act.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
     WHERE oid = 'public.family_action_challenges'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'family_action_challenges lost RLS in the rename';
  END IF;
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'family_action_challenges';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'family_action_challenges has % policies and must have none', v_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'consume_family_removal_challenge'
  ) THEN
    RAISE EXCEPTION 'consume_family_removal_challenge survived — two answers to one rule';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'consume_family_action_challenge'
  ) THEN
    RAISE EXCEPTION 'consume_family_action_challenge is missing';
  END IF;

  -- GRANTED TO NOBODY. The role test inside the function is the boundary that
  -- holds if this is ever re-granted from outside the chain, but the grant is the
  -- outer layer and 20260806000015 asserts drift on it.
  IF has_function_privilege('authenticated',
       'public.consume_family_action_challenge(text, uuid, text, text)', 'EXECUTE')
     OR has_function_privilege('anon',
       'public.consume_family_action_challenge(text, uuid, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'consume_family_action_challenge is executable by a browser role';
  END IF;

  -- THE PURPOSE COLUMN HAS NO DEFAULT. Asserted because the ALTER above adds one
  -- and drops it two statements later, and an edit that removed the drop would
  -- leave every forgetful insert minting a removal code in silence.
  IF EXISTS (
    SELECT 1 FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
     WHERE d.adrelid = 'public.family_action_challenges'::regclass
       AND a.attname = 'purpose'
  ) THEN
    RAISE EXCEPTION 'family_action_challenges.purpose still has a DEFAULT';
  END IF;

  RAISE NOTICE 'action challenges: table renamed, purpose added, one verification function';
END $$;
