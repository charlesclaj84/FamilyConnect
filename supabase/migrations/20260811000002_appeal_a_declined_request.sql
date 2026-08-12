-- A declined applicant may ask the family to look again, in writing, once.
--
-- WHAT THIS CHANGES ABOUT THE PREVIOUS MIGRATION. 20260811000001 §4 records a deliberate
-- asymmetry: the FAMILY could re-open a refusal (by inviting the person back) and the
-- refused person could not, because `join_family_by_code` still refuses a 'rejected' row.
-- The reason given there was anti-harassment — nobody should be able to re-queue themselves
-- at will, as often as they like, with the approvals queue absorbing it.
--
-- That reasoning survives; what changes is that it was answering the wrong question. The
-- objection is to SILENT, REPEATABLE self-re-queueing, not to a person who was turned away
-- saying "I think you have me confused with someone else" and asking once. So
-- `join_family_by_code` is STILL untouched — typing the family code again still does
-- nothing — and this migration adds a purpose-built path instead, with three properties the
-- code path could not have had:
--
--   IT CARRIES A MESSAGE.   The whole value to the administrator is the sentence explaining
--                           why they should reconsider. A silent re-application tells them
--                           nothing they did not already have when they said no.
--   IT IS SELF-LIMITING.    It requires the row to BE 'rejected', and its own success makes
--                           it 'pending' — so a second appeal is impossible until a human
--                           has declined them again. No counter, no rate-limit table, no
--                           cron: the state machine is the limit.
--   IT PRESERVES THE FIRST  membership_note, membership_decided_at and membership_decided_by
--   DECISION.               all survive, so the administrator reviewing the appeal can see
--                           who declined them, when, and why, next to what they have said
--                           about it. Reversing a decision must not erase it — the same rule
--                           20260811000001 established for the re-open path.
--
-- WHY A NEW COLUMN RATHER THAN REUSING membership_note. That column is the ADMINISTRATOR's
-- reason for refusing, shown to the applicant. Writing the applicant's reply into it would
-- destroy the refusal it is replying to, and would put text the applicant controls into a
-- field the queue renders as the family's own words. Two authors, two columns.
--
-- NOT AN IDENTITY PARAMETER (AGENTS.md §2b). The function takes a family code, never a
-- person or user id: it resolves the row from auth.uid() and the code only chooses WHICH of
-- the caller's own memberships is being appealed. A caller who names a family they have no
-- row in matches nothing and is refused. There is no argument here that can aim it at
-- somebody else's membership.

BEGIN;

-- The applicant's side of the conversation. Nullable, and null is the ordinary state:
-- almost every row will never have one.
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS membership_appeal      text,
  ADD COLUMN IF NOT EXISTS membership_appealed_at timestamptz;

COMMENT ON COLUMN public.people.membership_appeal IS
  'What a declined applicant said when asking the family to reconsider. Written by the '
  'applicant via appeal_membership_decision(); distinct from membership_note, which is the '
  'administrator''s reason for the refusal.';

-- NOT ADDED TO lib/profile-columns.ts, and that is the point of writing it down here:
-- `people` is the one table a non-approved caller can UPDATE (their own profile), so its
-- allow-list is what stops a member writing columns that are not theirs to write. This
-- column must never join that list — a caller who could set membership_appeal directly
-- could set it without going through the status transition below, and the queue would show
-- an appeal from somebody who is not asking for anything.

CREATE OR REPLACE FUNCTION public.appeal_membership_decision(
  p_family_code text,
  p_note        text
)
RETURNS TABLE (ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user   uuid := (SELECT auth.uid());
  v_family text := btrim(upper(COALESCE(p_family_code, '')));
  v_note   text := btrim(COALESCE(p_note, ''));
  v_person uuid;
  v_status text;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'; RETURN;
  END IF;

  IF v_family = '' THEN
    RETURN QUERY SELECT false, 'No family selected'; RETURN;
  END IF;

  -- A message is the entire point; an empty one would put a row back in the queue with
  -- nothing for the administrator to reconsider on.
  IF v_note = '' THEN
    RETURN QUERY SELECT false, 'Add a short note for the administrators.'; RETURN;
  END IF;

  -- Bounded, because it is rendered in the approvals queue and arrives from a browser.
  -- 2000 characters is several paragraphs; anything beyond it is not a note.
  IF length(v_note) > 2000 THEN
    RETURN QUERY SELECT false, 'Please keep it under 2000 characters.'; RETURN;
  END IF;

  -- THE CALLER'S OWN ROW, resolved from auth.uid(). Not auth_person_id(), which answers
  -- only for the ACTIVE family and resolves to nothing for a non-approved membership
  -- anyway — which is every caller this function exists for.
  SELECT p.id, p.membership_status INTO v_person, v_status
    FROM public.people p
   WHERE p.user_id = v_user AND p.family_code = v_family;

  IF v_person IS NULL THEN
    -- One message whether the family does not exist or the caller has no row in it, for
    -- the same reason create_family_invitation gives: the alternative is a membership
    -- oracle for arbitrary family codes.
    RETURN QUERY SELECT false, 'You have no request with that family.'; RETURN;
  END IF;

  -- POSITIVE, and the only permitted state. 'pending' is already in the queue, 'approved'
  -- is already in, and 'disabled' is an exclusion made under a different grant that an
  -- appeal must not undo — the same reasoning as the re-open path in 20260811000001. An
  -- unrecognised fifth state falls here too, which is the safe direction.
  IF v_status <> 'rejected' THEN
    RETURN QUERY SELECT false, CASE
      WHEN v_status = 'pending'  THEN 'Your request is already with the administrators.'
      WHEN v_status = 'approved' THEN 'You are already a member of this family.'
      ELSE 'Your access was switched off. Ask an administrator to turn it back on.'
    END; RETURN;
  END IF;

  -- Back in the queue. membership_decided_at / _by / _note are deliberately NOT cleared:
  -- the administrator reviewing this needs the refusal it answers, and the re-open path in
  -- 20260811000001 preserves them for the same reason. membership_requested_at is
  -- refreshed because the queue is ordered by it and this is a fresh request for attention.
  UPDATE public.people
     SET membership_status       = 'pending',
         membership_requested_at = NOW(),
         membership_appeal       = v_note,
         membership_appealed_at  = NOW()
   WHERE id = v_person;

  RETURN QUERY SELECT true, NULL::text;
END $$;

-- Called from the browser by a NON-APPROVED member — the whole point — so `authenticated`
-- is exactly the right grant. Default privileges since 20260806000015 revoke EXECUTE from
-- anon and authenticated for anything new, so without this line the button does nothing.
REVOKE ALL ON FUNCTION public.appeal_membership_decision(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.appeal_membership_decision(text, text) TO authenticated;

-- ── verify ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_src text;
BEGIN
  -- Unconditional: needs no fixture, so it cannot silently skip. 20260806000012 shipped a
  -- body that referenced a function in the wrong schema, applied cleanly, and threw for its
  -- first caller — plpgsql resolves names only when the body runs.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'people'
       AND column_name IN ('membership_appeal', 'membership_appealed_at')
    HAVING count(*) = 2
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: people is missing the appeal columns';
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc
   WHERE proname = 'appeal_membership_decision' AND pronamespace = 'public'::regnamespace;

  -- Whole statements, not fragments: prosrc carries the comments too, and both of these
  -- conjuncts are discussed by name in the prose above. See 20260811000001's verify block.
  IF v_src NOT LIKE '%IF v_status <> ''rejected'' THEN%' THEN
    RAISE EXCEPTION 'ROLLBACK: appeal_membership_decision does not require a declined row';
  END IF;
  IF v_src NOT LIKE '%WHERE p.user_id = v_user AND p.family_code = v_family;%' THEN
    RAISE EXCEPTION 'ROLLBACK: appeal_membership_decision is not scoped to the caller''s own row';
  END IF;

  IF NOT has_function_privilege('authenticated',
        'public.appeal_membership_decision(text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ROLLBACK: appeal_membership_decision is not executable by authenticated';
  END IF;

  -- And nothing else gained a grant it should not have. anon must NOT hold this: an
  -- unauthenticated caller has no auth.uid() and would be refused anyway, but a function
  -- reachable without a session is one more thing to reason about for no benefit.
  IF has_function_privilege('anon',
        'public.appeal_membership_decision(text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ROLLBACK: appeal_membership_decision must not be executable by anon';
  END IF;

  RAISE NOTICE 'appeal: columns added, guard present, grants correct';
END $$;

COMMIT;
