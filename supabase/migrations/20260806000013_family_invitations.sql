-- ============================================================================
-- Invitations: ask someone to join, and — from Member Approvals only — admit them
-- without a second review.
--
-- THE PROBLEM THIS HAS TO AVOID
--   Phase 3 DELETED a feature that matched a registrant against `people.primary_email`
--   and handed them that record (see the comment in app/actions/register.ts). The
--   reason was not the matching, it was what the match PROVED: with email confirmation
--   off, anybody can sign up as anybody@example.com, so an email address is a claim
--   rather than an identity.
--
--   A pre-approving invitation keyed on email alone would reintroduce exactly that
--   hole, and with a bigger payoff — it skips the human review that is currently the
--   only real gate. `enable_confirmations` is on locally and STILL OFF ON HOSTED (a GO
--   LIVE item), so on the deployed project today an email address proves nothing at all.
--
--   So the gate is a TOKEN, not the address:
--     * 32 random bytes from pgcrypto, returned to the inviter exactly once.
--     * Only its SHA-256 is stored. A dump of this table cannot be used to redeem
--       anything, the same reason password reset tokens are stored hashed.
--     * The address is still recorded and still enforced — only that address may
--       redeem — so the two must be held together. That makes the email a NARROWING
--       condition on top of the secret, which is safe, rather than the secret itself,
--       which is not.
--
-- WHO MAY PRE-APPROVE
--   `p_pre_approved` is honoured only for a caller holding admin/approvals:edit at
--   scope 'any' — i.e. exactly the people who could approve the applicant a moment
--   later anyway. Everyone else's invitations are created with pre_approved = false,
--   silently rather than as an error: an ordinary member inviting a cousin should
--   succeed, and their invitee lands in the queue like any other applicant.
--
--   Note the layering. auth_permission() runs through the Phase 3 conjunct, so a
--   PENDING administrator cannot pre-approve anybody either, whatever grants they hold.
--
-- WRITES GO THROUGH THE FUNCTIONS BELOW AND NOWHERE ELSE
--   The table gets a SELECT policy and no others, so INSERT/UPDATE/DELETE are refused
--   for every authenticated caller. Everything that changes an invitation is SECURITY
--   DEFINER and re-applies its own checks. There is no "member edits their own
--   invitation" path to get wrong.
--
-- NOT REGISTERED IN permission_table_map, deliberately. The sweep in 20260618000001
-- already ran; a row added now would compose nothing. The policy below therefore names
-- admin/approvals by hand, which is the same key the sweep would have used.
--
-- NO EMAIL IS SENT. This codebase has no mail layer, and [auth.email.smtp] is
-- unconfigured on both sides. The action returns the token so the inviter can copy a
-- link and send it themselves — honest, and it works today, which a button that
-- claims to send mail that never arrives does not. See TODO.md.
--
-- IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── 1. The table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.family_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT NOT NULL,
  -- Stored lower-cased and trimmed; redemption compares the same way.
  email        TEXT NOT NULL,
  -- SHA-256 hex of the token. The token itself is never stored.
  token_hash   TEXT NOT NULL UNIQUE,
  pre_approved BOOLEAN NOT NULL DEFAULT false,
  invited_by   UUID REFERENCES public.people(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  accepted_at  TIMESTAMPTZ,
  accepted_by  UUID REFERENCES public.people(id) ON DELETE SET NULL,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS family_invitations_family_idx
  ON public.family_invitations (family_code);

-- One OPEN invitation per address per family. Re-inviting revokes and replaces rather
-- than piling up live tokens for the same person, each of which would be redeemable.
CREATE UNIQUE INDEX IF NOT EXISTS family_invitations_open_uniq
  ON public.family_invitations (family_code, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- Readable by whoever can work the approvals queue, plus the person who sent it.
--
-- Both branches are Phase 3-safe without needing the §6 sweep: auth_person_id() is NULL
-- for a pending member (so `invited_by = NULL` is NULL, not true) and auth_can() runs
-- through auth_permission(), which returns 'none' for them. An applicant therefore
-- cannot read the invitation list of the family they are waiting on — which matters,
-- because it is a list of email addresses.
DROP POLICY IF EXISTS "invitations readable by approvers and sender" ON public.family_invitations;
CREATE POLICY "invitations readable by approvers and sender"
  ON public.family_invitations FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND (
      invited_by = public.auth_person_id()
      OR public.auth_can('admin/approvals', 'view')
    )
  );

-- ── 2. Create an invitation ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_family_invitation(
  p_email        text,
  p_pre_approved boolean DEFAULT false
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
  v_person  uuid := public.auth_person_id();
  v_family  text := public.auth_family_code();
  v_email   text := lower(btrim(COALESCE(p_email, '')));
  v_name    text;
  v_token   text;
  v_pre     boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, false,
      'Not authenticated'; RETURN;
  END IF;

  -- auth_person_id() is NULL for a pending or rejected membership, so this one test
  -- also refuses an applicant trying to invite their way into a family.
  IF v_person IS NULL OR v_family IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, false,
      'Only an approved member can invite someone'; RETURN;
  END IF;

  IF v_email = '' OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, false,
      'Enter a valid email address'; RETURN;
  END IF;

  SELECT f.family_name INTO v_name
    FROM public.families f WHERE f.family_code = v_family;

  -- Already in this family — including as an applicant, whose invitation would do
  -- nothing except confuse whoever is looking at the queue.
  IF EXISTS (
    SELECT 1 FROM public.people p
     JOIN auth.users u ON u.id = p.user_id
    WHERE p.family_code = v_family AND lower(u.email) = v_email
  ) THEN
    RETURN QUERY SELECT false, NULL::text, v_email, v_family, v_name, false,
      'That person is already in this family.'; RETURN;
  END IF;

  -- Pre-approval is a grant, not a preference. Anyone may invite; only someone who
  -- could approve the resulting applicant may skip the approval.
  v_pre := COALESCE(p_pre_approved, false)
           AND public.auth_permission('admin/approvals', 'edit') = 'any';

  -- Replace any open invitation for the same address rather than adding a second live
  -- token. Revoking keeps the row, so who invited whom stays on the record.
  --
  -- ALIASED, and every column qualified. This function's RETURNS TABLE names —
  -- `family_code`, `email`, `token`, `pre_approved` — are plpgsql VARIABLES inside the
  -- body, so an unqualified `WHERE family_code = …` is ambiguous and raises at call
  -- time rather than at CREATE time. Worth watching for in every function here that
  -- returns a table whose column names match the table it touches.
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

  -- The only time the plaintext token exists outside the inviter's browser.
  RETURN QUERY SELECT true, v_token, v_email, v_family, v_name, v_pre, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.create_family_invitation(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_family_invitation(text, boolean) TO authenticated;

-- ── 3. Look at an invitation without spending it ────────────────────────────
-- So /invite/<token> can say "you have been invited to the Okonkwo Family" before the
-- visitor has an account. Granted to anon on purpose: the token IS the credential, and
-- requiring a session first would mean signing in before learning what for.
--
-- Returns only the family name and the address it was sent to. Both are already known
-- to whoever holds the link, so this discloses nothing the link did not.
CREATE OR REPLACE FUNCTION public.peek_family_invitation(p_token text)
RETURNS TABLE (valid boolean, email text, family_name text, pre_approved boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT true, i.email, f.family_name, i.pre_approved
    FROM public.family_invitations i
    LEFT JOIN public.families f ON f.family_code = i.family_code
   WHERE i.token_hash = encode(extensions.digest(COALESCE(p_token, ''), 'sha256'), 'hex')
     AND i.accepted_at IS NULL
     AND i.revoked_at IS NULL
     AND i.expires_at > NOW()
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.peek_family_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_family_invitation(text) TO authenticated, anon;

-- ── 4. Redemption ───────────────────────────────────────────────────────────
-- ONE function, and it decides for itself who is redeeming. There is deliberately no
-- variant that accepts a user id from an ordinary caller.
--
-- WHY THAT MATTERS MORE HERE THAN IT LOOKS: **REVOKE DOES NOT HOLD IN THIS PROJECT.**
-- supabase/seed.sql runs AFTER every migration and issues
--
--     GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
--
-- mirroring the hosted project, where the same is true — verified by calling a function
-- that 20260806000008 had REVOKEd from PUBLIC, with the ANON key, against hosted: it
-- ran. So `REVOKE ALL … FROM PUBLIC` in a migration is documentation, not enforcement,
-- and every function in this schema must assume it is reachable by an anonymous caller.
--
-- The first draft of this file had a second function taking (token, user_id), granted
-- only to service_role, with a verify block asserting `authenticated` could not execute
-- it. The assertion passed at migration time and was false ten seconds later, once
-- seed.sql ran. Anyone holding a token could then have redeemed it onto another
-- account. Hence: one function, and the user id is established from the JWT.
--
-- p_user_id EXISTS BUT IS INERT unless the caller presents the service-role key.
-- Registration needs it: with email confirmation on, signUp() returns no session at
-- all, so the new account cannot speak for itself yet, and register.ts calls this with
-- the admin client. The role comes from PostgREST's verified JWT claims, which a
-- browser cannot forge — for any other caller the argument is ignored outright rather
-- than validated, so there is nothing to get wrong.
CREATE OR REPLACE FUNCTION public.redeem_family_invitation(
  p_token   text,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (ok boolean, family_code text, family_name text, pre_approved boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claims jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role   text  := COALESCE(v_claims ->> 'role', '');
  p_user   uuid;
  v_inv    public.family_invitations;
  v_email  text;
  v_name   text;
  v_person uuid;
  v_meta   jsonb;
BEGIN
  IF v_role = 'service_role' THEN
    p_user := p_user_id;
  ELSE
    -- Not the service role: whoever you are, you are redeeming for YOURSELF.
    p_user := (SELECT auth.uid());
  END IF;

  IF p_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, false, 'Not authenticated'; RETURN;
  END IF;

  SELECT * INTO v_inv
    FROM public.family_invitations
   WHERE token_hash = encode(extensions.digest(COALESCE(p_token, ''), 'sha256'), 'hex');

  -- One message for every way an invitation can be unusable. Distinguishing "expired"
  -- from "already used" from "never existed" tells a holder of a guessed token which
  -- guesses are close, and helps nobody legitimate.
  IF NOT FOUND
     OR v_inv.accepted_at IS NOT NULL
     OR v_inv.revoked_at IS NOT NULL
     OR v_inv.expires_at <= NOW() THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, false,
      'That invitation is no longer valid. Ask for a new one.'; RETURN;
  END IF;

  SELECT lower(u.email), u.raw_user_meta_data INTO v_email, v_meta
    FROM auth.users u WHERE u.id = p_user;

  -- The address is a NARROWING condition on the token, not a substitute for it: a
  -- forwarded link is useless to anyone but the person it was addressed to.
  IF v_email IS DISTINCT FROM v_inv.email THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, false,
      'This invitation was sent to a different email address.'; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.people p
     WHERE p.user_id = p_user AND p.family_code = v_inv.family_code
  ) THEN
    RETURN QUERY SELECT false, v_inv.family_code, NULL::text, false,
      'You already belong to this family.'; RETURN;
  END IF;

  SELECT f.family_name INTO v_name
    FROM public.families f WHERE f.family_code = v_inv.family_code;

  -- Same insert join_family_by_code() makes, and it leans on the same triggers:
  -- the profile is inherited from the caller's oldest membership, the stamp trigger
  -- pends them, and they land in General.
  INSERT INTO public.people (user_id, family_code, first_name, last_name,
                             primary_email, created_by, is_minor)
  VALUES (p_user, v_inv.family_code,
          COALESCE(v_meta ->> 'first_name', ''),
          COALESCE(v_meta ->> 'last_name', ''),
          v_email, p_user, false)
  RETURNING id INTO v_person;

  -- PRE-APPROVAL IS AN UPDATE, NOT AN INSERT VALUE, and it has to be: the BEFORE
  -- INSERT stamp trigger (20260806000011 §2) overrides whatever status the insert
  -- carried, deliberately, so that no caller can arrive pre-approved by supplying a
  -- column. Moving it afterwards is allowed here because people_guard_membership_status
  -- refuses only the 'authenticated' role, and this is SECURITY DEFINER — it runs as
  -- the owner. That is the same door set_membership_status() goes through, which is
  -- the point: pre-approval is an approval, granted in advance by someone who held
  -- admin/approvals:edit when the invitation was created.
  IF v_inv.pre_approved THEN
    UPDATE public.people
       SET membership_status     = 'approved',
           membership_decided_at = NOW(),
           membership_decided_by = (SELECT p.user_id FROM public.people p WHERE p.id = v_inv.invited_by)
     WHERE id = v_person;
  END IF;

  UPDATE public.family_invitations
     SET accepted_at = NOW(), accepted_by = v_person
   WHERE id = v_inv.id;

  RETURN QUERY SELECT true, v_inv.family_code, v_name, v_inv.pre_approved, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.redeem_family_invitation(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_family_invitation(text, uuid) TO authenticated, service_role;
-- Stated for the record, and correct on a database whose seed does not over-grant. It
-- is NOT what protects this function — see the header above. The role branch is.

-- ── 5. Revoke ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_family_invitation(p_id uuid)
RETURNS TABLE (ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_person uuid := public.auth_person_id();
  v_family text := public.auth_family_code();
  v_inv    public.family_invitations;
BEGIN
  IF v_person IS NULL OR v_family IS NULL THEN
    RETURN QUERY SELECT false, 'Not authorized'; RETURN;
  END IF;

  SELECT * INTO v_inv FROM public.family_invitations WHERE id = p_id;
  -- Family-scoped before anything else: an id from a client says nothing about which
  -- family it belongs to.
  IF NOT FOUND OR v_inv.family_code IS DISTINCT FROM v_family THEN
    RETURN QUERY SELECT false, 'Invitation not found'; RETURN;
  END IF;

  IF v_inv.invited_by IS DISTINCT FROM v_person
     AND public.auth_permission('admin/approvals', 'edit') <> 'any' THEN
    RETURN QUERY SELECT false, 'Not authorized'; RETURN;
  END IF;

  UPDATE public.family_invitations
     SET revoked_at = COALESCE(revoked_at, NOW())
   WHERE id = p_id;

  RETURN QUERY SELECT true, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.revoke_family_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_family_invitation(uuid) TO authenticated;

-- ── 6. Verify ───────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_probe text;
  v_n     int;
BEGIN
  -- pgcrypto lives in `extensions`, and plpgsql resolves nothing until the body runs,
  -- so a mis-qualified call would apply cleanly and fail for the first caller. Checked
  -- here for 20260806000012's reason, and needing no fixture, it cannot be skipped.
  v_probe := encode(extensions.digest('probe', 'sha256'), 'hex');
  IF v_probe IS NULL OR length(v_probe) <> 64 THEN
    RAISE EXCEPTION 'ROLLBACK: digest() did not produce a sha256 hex string';
  END IF;
  IF length(encode(extensions.gen_random_bytes(32), 'hex')) <> 64 THEN
    RAISE EXCEPTION 'ROLLBACK: gen_random_bytes() did not produce 32 bytes';
  END IF;

  -- Exactly one policy, and it is a SELECT. An INSERT or UPDATE policy appearing here
  -- would mean an authenticated caller could write invitations directly, bypassing
  -- every check in the functions above — including who may pre-approve.
  SELECT COUNT(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'family_invitations';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: family_invitations has % policies, expected exactly 1 (SELECT)', v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename='family_invitations' AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'ROLLBACK: family_invitations has a write policy';
  END IF;

  -- THERE IS DELIBERATELY NO ASSERTION HERE ABOUT WHO MAY EXECUTE THESE FUNCTIONS.
  --
  -- An earlier draft asserted `NOT has_function_privilege('authenticated',
  -- 'admin_redeem_family_invitation(text,uuid)', 'EXECUTE')`. It PASSED, and it was
  -- worthless: supabase/seed.sql runs after every migration and issues GRANT ALL ON ALL
  -- FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role — as does the
  -- hosted project. The assertion was true for the few seconds between COMMIT and the
  -- seed, and false forever after. A check that can only pass is worse than no check,
  -- because it reads like protection.
  --
  -- What replaced it is structural: redeem_family_invitation() derives the acting user
  -- from the verified JWT and ignores p_user_id for anyone but the service role, so it
  -- is safe to call even from anon. Assert that the branch is still there.
  IF (SELECT prosrc FROM pg_proc
       WHERE proname = 'redeem_family_invitation' AND pronamespace = 'public'::regnamespace)
     NOT LIKE '%service_role%' THEN
    RAISE EXCEPTION
      'ROLLBACK: redeem_family_invitation() no longer distinguishes the service role, so '
      'p_user_id would be honoured for any caller — and REVOKE does not hold here';
  END IF;
END $mig$;

COMMIT;
