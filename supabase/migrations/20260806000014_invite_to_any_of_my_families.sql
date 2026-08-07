-- ============================================================================
-- Invite someone to any family you belong to, not only the one you are viewing.
--
-- WHY IT DID NOT WORK BEFORE
--   create_family_invitation() resolved everything from auth_family_code() — the family
--   currently being VIEWED. On /my-families that made the invite button meaningful only
--   on the active row, because an invitation created from any other row would silently
--   have been addressed to the wrong family. The button was hidden on those rows for
--   that reason, which is a workaround for a limitation rather than a design.
--
-- THE TRAP, AND WHY PRE-APPROVAL STAYS TIED TO THE ACTIVE FAMILY
--   auth_permission() is ALSO scoped to auth_family_code() — it resolves the caller's
--   groups, individual overrides and resource_visibility against the active family and
--   nothing else. So if a target family were simply passed in and the existing
--   pre-approval test left alone:
--
--       an administrator of family A, viewing A, could invite someone to family B
--       PRE-APPROVED, on the strength of their permissions in A — while being an
--       ordinary member of B.
--
--   That is a cross-family privilege escalation dressed as a convenience, and it would
--   have been invisible: both families are legitimately the caller's own, so nothing
--   about family isolation is violated and no policy objects.
--
--   Resolving permissions for an arbitrary family would mean a second copy of
--   auth_permission()'s precedence rules parameterised by family — group layer, then
--   individual override, then visibility default — which is the kind of duplication that
--   drifts and then disagrees with the database about who may do what (AGENTS.md §2).
--
--   So: pre-approval is granted ONLY when the target family IS the active family. This
--   costs nothing in practice. Member Approvals is always the family you are viewing,
--   and invitations from My Families are never pre-approved by design — the whole point
--   of that button is that the invitee goes through the queue. An out-of-family request
--   for pre-approval is downgraded silently, exactly as an unprivileged one already is.
--
-- WHAT ELSE HAD TO MOVE
--   invited_by must be the caller's people row IN THE TARGET FAMILY. auth_person_id()
--   only ever answers for the active family, so using it would have stamped invitations
--   with a person id belonging to a different family — a dangling reference that the
--   SELECT policy and the "Invited by" line on the approvals page both read.
--
--   The SELECT policy is widened for the same reason: an invitation you sent to a family
--   you are not currently viewing was invisible to you, since both of its branches were
--   active-family-scoped.
--
-- IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── 1. The function gains a target family ───────────────────────────────────
-- DROP first, deliberately. Adding a defaulted third parameter with CREATE OR REPLACE
-- would create an OVERLOAD rather than replace anything: the two-argument version would
-- survive alongside it, PostgREST would see an ambiguous name, and the old one — which
-- has none of the checks below — would still be callable by anyone.
DROP FUNCTION IF EXISTS public.create_family_invitation(text, boolean);

CREATE OR REPLACE FUNCTION public.create_family_invitation(
  p_email        text,
  p_pre_approved boolean DEFAULT false,
  p_family_code  text    DEFAULT NULL
)
RETURNS TABLE (
  ok boolean, token text, email text, family_code text,
  family_name text, pre_approved boolean, message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user    uuid := (SELECT auth.uid());
  v_active  text := public.auth_family_code();
  v_family  text := COALESCE(NULLIF(btrim(upper(COALESCE(p_family_code, ''))), ''), v_active);
  v_email   text := lower(btrim(COALESCE(p_email, '')));
  v_person  uuid;
  v_name    text;
  v_token   text;
  v_pre     boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, false,
      'Not authenticated'; RETURN;
  END IF;

  IF v_family IS NULL OR v_family = '' THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, false,
      'No family selected'; RETURN;
  END IF;

  -- The caller's APPROVED people row in the TARGET family. Not auth_person_id(), which
  -- answers only for the active family — and the membership_status test is what stops an
  -- applicant inviting others into a family that has not admitted them yet. Because the
  -- target family is now an argument, this is also the family-isolation check: a code
  -- naming a family the caller does not belong to finds no row and is refused.
  SELECT p.id INTO v_person
    FROM public.people p
   WHERE p.user_id = v_user
     AND p.family_code = v_family
     AND p.membership_status = 'approved';

  IF v_person IS NULL THEN
    -- One message whether the family does not exist or the caller is simply not in it.
    -- Distinguishing them would turn this into a membership oracle for arbitrary codes.
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, false,
      'You are not an approved member of that family'; RETURN;
  END IF;

  IF v_email = '' OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, false,
      'Enter a valid email address'; RETURN;
  END IF;

  SELECT f.family_name INTO v_name
    FROM public.families f WHERE f.family_code = v_family;

  IF EXISTS (
    SELECT 1 FROM public.people p
     JOIN auth.users u ON u.id = p.user_id
    WHERE p.family_code = v_family AND lower(u.email) = v_email
  ) THEN
    RETURN QUERY SELECT false, NULL::text, v_email, v_family, v_name, false,
      'That person is already in this family.'; RETURN;
  END IF;

  -- PRE-APPROVAL: three conditions, and the middle one is the point of this migration.
  -- auth_permission() answers for the ACTIVE family only, so honouring it against some
  -- other family would let an administrator of one pre-approve into another where they
  -- are nobody. See the header.
  v_pre := COALESCE(p_pre_approved, false)
           AND v_family = v_active
           AND public.auth_permission('admin/approvals', 'edit') = 'any';

  UPDATE public.family_invitations AS fi
     SET revoked_at = NOW()
   WHERE fi.family_code = v_family
     AND fi.email = v_email
     AND fi.accepted_at IS NULL
     AND fi.revoked_at IS NULL;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.family_invitations
    (family_code, email, token_hash, pre_approved, invited_by)
  VALUES
    (v_family, v_email, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_pre, v_person);

  RETURN QUERY SELECT true, v_token, v_email, v_family, v_name, v_pre, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.create_family_invitation(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_family_invitation(text, boolean, text) TO authenticated;

-- ── 2. You can see the invitations you sent, wherever you sent them ─────────
-- Both branches of the old policy were active-family-scoped, so an invitation sent to
-- another of your families became invisible the moment it was created.
--
-- The approver branch stays scoped to the active family on purpose: admin/approvals is a
-- per-family grant, and auth_can() can only answer for the family being viewed. The
-- sender branch is the one that widens, and it re-derives approved membership in the
-- invitation's OWN family rather than trusting the active one.
DROP POLICY IF EXISTS "invitations readable by approvers and sender" ON public.family_invitations;
CREATE POLICY "invitations readable by approvers and sender"
  ON public.family_invitations FOR SELECT TO authenticated
  USING (
    -- an approver, in the family they are currently viewing
    (
      family_code = public.auth_family_code()
      AND public.auth_can('admin/approvals', 'view')
    )
    -- or the person who sent it, in any family they are an approved member of
    OR EXISTS (
      SELECT 1 FROM public.people p
       WHERE p.user_id = (SELECT auth.uid())
         AND p.family_code = family_invitations.family_code
         AND p.membership_status = 'approved'
         AND p.id = family_invitations.invited_by
    )
  );

-- ── 3. Verify ───────────────────────────────────────────────────────────────
DO $mig$
DECLARE v_n int;
BEGIN
  -- Exactly one create_family_invitation. Two would mean the DROP missed and the old,
  -- unguarded two-argument version is still callable.
  SELECT COUNT(*) INTO v_n FROM pg_proc
   WHERE proname = 'create_family_invitation' AND pronamespace = 'public'::regnamespace;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: % overloads of create_family_invitation, expected 1', v_n;
  END IF;

  -- The escalation guard. Without `v_family = v_active` an administrator of one family
  -- can pre-approve into another, so its absence is the whole bug this file avoids.
  IF (SELECT prosrc FROM pg_proc
       WHERE proname = 'create_family_invitation' AND pronamespace = 'public'::regnamespace)
     NOT LIKE '%v_family = v_active%' THEN
    RAISE EXCEPTION
      'ROLLBACK: create_family_invitation() no longer ties pre-approval to the active '
      'family — auth_permission() answers for that family only, so pre-approval would be '
      'granted on the strength of permissions in a different one';
  END IF;

  -- Still exactly one policy, still SELECT-only: writes go through the functions.
  SELECT COUNT(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'family_invitations';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: family_invitations has % policies, expected exactly 1', v_n;
  END IF;
END $mig$;

COMMIT;
