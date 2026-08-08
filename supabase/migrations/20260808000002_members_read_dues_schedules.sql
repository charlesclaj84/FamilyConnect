-- ============================================================================
-- Members can read their family's dues schedules. Until now only administrators could,
-- and every ordinary member's My Summary was blank.
--
-- THE BUG
--   `dues_schedules` is mapped to `admin/account` in permission_table_map, which is
--   right for WRITES — a schedule is family-wide configuration and only an officer
--   should create or amend one. But the map governs SELECT as well, so 20260618000001
--   composed BOTH of the table's read policies to require
--
--       auth_permission('admin/account', 'view') = 'any'
--
--   and the General template ships with `admin/account` at scope 'none'. The result:
--
--     * getMyDuesSummary() reads dues_schedules through the USER client, got [],
--       and Upcoming Dues rendered empty for every non-administrator.
--     * getDonationProgress() reads the same table, so Donations went with it.
--     * getMyPaymentHistory() embeds dues_schedules(label, kind), so a member's own
--       payment rows came back with no label saying what they had paid for.
--
--   Nobody noticed because the person testing was an administrator in every family
--   they belonged to. It surfaced the first time a plain member signed in — an
--   invitee, whose account was working perfectly and who could see nothing.
--
--   Note the second policy is *named* "family can view dues schedules". The intent was
--   always that the family could read them; the sweep wrapped it in the write key,
--   because a single map row cannot say "everyone reads, officers write".
--
-- THE GRID AND THE DATABASE DISAGREED, which is the part that matters beyond this one
-- screen. permission_resources carries account-summary/dues, /donations and /history,
-- General holds view at scope 'own' on all three, and Members & Access renders them as
-- switches an administrator can set. Not one of those keys was consulted by any policy
-- on the table the panes are built from. The switch said yes and the data said no.
--
-- WHAT THIS DOES
--   Adds ONE permissive SELECT policy: an APPROVED member may read the schedules of
--   the family they are acting in. Nothing is removed — the admin/account policies
--   stay exactly as they are, and they are what still governs INSERT, UPDATE and
--   DELETE. Permissive policies are OR-ed, so this widens reads and touches nothing
--   else.
--
--   Approved, not merely present: auth_person_id() resolves only for
--   membership_status = 'approved' (20260806000011), so an applicant waiting in the
--   queue reads nothing here. That is the same conjunct every other own/self
--   expression in the schema is written in terms of, rather than a new rule.
--
-- WHY NOT `AND active`
--   The narrower version was the intent, and it is wrong by one case. A member's
--   payment history embeds this table for the label, so restricting them to active
--   rows means retiring a schedule silently blanks the description of every payment
--   ever made against it — "Cedar Point Trip" becomes an unlabelled row in the history
--   of everyone who paid for the trip. A one-off schedule being deactivated after the
--   event is the normal course of things, not an edge case.
--
--   Nothing is protected by hiding it, either. An inactive schedule is one this family
--   used to run; its label and amount were visible to these same members while it was
--   active, and a member who paid into it has more claim to see it than most. So the
--   policy is about WHOSE family, not about which rows.
--
-- WHY THE NAME CARRIES A `perm:` PREFIX IT DID NOT EARN
--   20260618000001's sweep rewrites every policy on a mapped table that is not already
--   prefixed — it wraps the expression in the resource check, recreates it as
--   `perm:<name>` and drops the original — and skips anything matching 'perm:%'. This
--   policy must NOT be wrapped in `admin/account`; that is the whole bug. The prefix is
--   what makes a future re-run leave it alone. It is a marker for that loop, not a
--   claim that the sweep composed this.
--
-- IDEMPOTENT.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "perm:members read their family's dues schedules"
  ON public.dues_schedules;

CREATE POLICY "perm:members read their family's dues schedules"
  ON public.dues_schedules FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_person_id() IS NOT NULL
  );

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Unconditional on purpose: this needs no auth.users row, no family and no fixture, so
-- it cannot skip. 20260806000012 shipped a verify block that returned early without a
-- fixture and reported success over a function that could not run; a check that can
-- quietly not happen is not a check (AGENTS.md).
DO $$
DECLARE
  v_qual text;
BEGIN
  SELECT qual INTO v_qual
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'dues_schedules'
     AND policyname = 'perm:members read their family''s dues schedules';

  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'dues_schedules member read policy was not created';
  END IF;

  -- The one thing that would silently reintroduce the bug is this policy picking up
  -- the admin/account conjunct — by being swept, or by being edited to match its
  -- neighbours. Then it would be indistinguishable from the two it exists to sit
  -- beside, and My Summary would go blank again with every policy looking correct.
  IF v_qual LIKE '%admin/account%' THEN
    RAISE EXCEPTION
      'dues_schedules member read policy is gated on admin/account — that is the bug '
      'this migration exists to fix; it must not depend on the write key';
  END IF;

  IF v_qual NOT LIKE '%auth_person_id%' THEN
    RAISE EXCEPTION
      'dues_schedules member read policy does not test auth_person_id() — a pending '
      'applicant would be able to read the family''s schedules';
  END IF;
END $$;

COMMIT;
