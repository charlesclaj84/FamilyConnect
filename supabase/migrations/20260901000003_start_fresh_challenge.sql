-- ═══════════════════════════════════════════════════════════════════════════════════════
-- A THIRD PURPOSE FOR THE EMAILED CODE: LETTING WITHHELD DATA GO
--
-- Decided 2026-08-23 and required in those words: *"'START FRESH' DELETES IMMEDIATELY AND MUST
-- SAY SO IRREVERSIBLY … it needs the strongest confirmation in the product. The family-removal
-- pattern already exists and is the right precedent; a plain confirm dialog is not enough for a
-- button that destroys a family tree."*
--
-- ── WHY IT IS A CHALLENGE AND NOT A CONFIRM DIALOG ──────────────────────────────────
-- Everything else in the retention window is reversible until day 60. This is the one act that
-- brings the deletion forward to today, on purpose, at a person's request — and unlike the
-- clock, it has no reminders in front of it. A dialog is one careless click; a code emailed to
-- the address the administrator signs in with is a decision they had to leave the screen for.
--
-- ── AND WHY THE EXISTING TABLE RATHER THAN A NEW ONE ────────────────────────────────
-- `20260825000000`'s header settles this in advance: the table is `family_action_challenges`
-- rather than `family_removal_challenges` precisely so a third act can join it, and `purpose`
-- is part of the lookup key so one act's code can never be spent on another's. It also names
-- the four things a third purpose owes, and this file does all four:
--
--   1. `purpose` has NO DEFAULT, so a caller that forgets fails loudly. Untouched.
--   2. The CHECK widens — here.
--   3. `consume_family_action_challenge`'s HARDCODED list widens — here, and it is the half
--      that is easy to miss: adding the value to the CHECK alone admits the row and then
--      refuses to spend it, reporting "there is no code waiting" for a code that exists.
--      That migration's own comment warns about exactly this afternoon.
--   4. Minting goes through `lib/action-challenge.ts` and never by hand. The action does.
--
-- ── THE SUPERSEDE CONJUNCT IS ALREADY RIGHT, AND THAT IS WORTH CHECKING RATHER THAN
--    ASSUMING ──────────────────────────────────────────────────────────────────────
-- `20260825000000` states that without a `purpose` conjunct on the supersede, asking for one
-- kind of code silently spends a live code of the other kind. §2 below asserts the function
-- still resolves on all three columns, so a third purpose cannot reintroduce that.
--
-- IDEMPOTENT. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. THE CHECK ──────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.family_action_challenges'::regclass
       AND conname = 'family_action_challenges_purpose_check'
  ) THEN
    ALTER TABLE public.family_action_challenges
      DROP CONSTRAINT family_action_challenges_purpose_check;
  END IF;
  ALTER TABLE public.family_action_challenges
    ADD CONSTRAINT family_action_challenges_purpose_check
    CHECK (purpose IN ('family_removal', 'processor_disconnect', 'data_start_fresh'));
END $$;

-- ── §2. THE FUNCTION'S OWN LIST, COPIED VERBATIM WITH ONE VALUE ADDED ─────────────────
-- Character for character apart from the `v_purpose NOT IN (…)` list, and that is deliberate
-- rather than tidy. The first draft of this file RETYPED the body from a reading of it and
-- silently changed three things: two refusal messages ("Too many attempts" for "Too many wrong
-- codes"), and the success branch, which stopped incrementing `attempts` and started returning
-- a countdown instead of zero.
--
-- None of that would have failed a migration. The first would have broken every `expectRefusal`
-- in `tests/rls` that matches on message text — AGENTS.md's own note about a locale change doing
-- exactly that — and the third would have left a spent challenge claiming nobody ever answered
-- it.
--
-- **The rule: redefining an existing function means COPYING it, not describing it.** plpgsql
-- has no way to widen a literal list in place, so a full redefinition is unavoidable; retyping
-- one is not.
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
  IF v_purpose NOT IN ('family_removal', 'processor_disconnect', 'data_start_fresh') THEN
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

REVOKE ALL ON FUNCTION public.consume_family_action_challenge(text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

-- ── §3. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n INT;
BEGIN
  -- 1. All three purposes are admitted by the CHECK, and a fourth is not.
  FOR v_n IN SELECT 1 LOOP END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.family_action_challenges'::regclass
       AND conname = 'family_action_challenges_purpose_check'
       AND pg_get_constraintdef(oid) LIKE '%data_start_fresh%'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: the purpose CHECK does not admit data_start_fresh';
  END IF;

  -- 2. AND THE FUNCTION'S OWN LIST AGREES WITH IT. The half that is easy to miss, and the one
  --    `20260825000000` warns costs an afternoon: a CHECK that admits a row and a function
  --    that refuses to spend it reports "there is no code waiting" for a code that exists.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'consume_family_action_challenge'
       AND p.prosrc LIKE '%data_start_fresh%'
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: consume_family_action_challenge does not know data_start_fresh — the CHECK '
      'would admit the row and the function would refuse to spend it';
  END IF;

  -- 3. THE PURPOSE IS STILL PART OF THE LOOKUP. Without this conjunct, asking for one kind of
  --    code silently spends a live code of another kind — which with a DELETION in the set is
  --    considerably worse than it was with two.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'consume_family_action_challenge'
       AND p.prosrc LIKE '%c.purpose      = v_purpose%'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: the challenge is no longer resolved on its purpose';
  END IF;

  -- 4. STILL UNREACHABLE FROM A BROWSER. §2b: a function in `public` is a public endpoint.
  IF has_function_privilege('authenticated',
       'public.consume_family_action_challenge(text, uuid, text, text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'ROLLBACK: authenticated can execute consume_family_action_challenge';
  END IF;

  RAISE NOTICE 'data_start_fresh: the CHECK, the function''s list and the purpose conjunct all '
               'verified; the function is still unreachable from the browser';
END $mig$;

COMMIT;
