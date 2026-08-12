-- Re-inviting somebody the family declined.
--
-- THE BUG. Declining an applicant keeps their `people` row and sets
-- membership_status = 'rejected' (20260807000000:1031, deliberately — people(id) is
-- referenced ON DELETE CASCADE from four tables). Three separate checks then asked only
-- whether a row EXISTS at that address, with no status test of any kind, so a declined
-- person was indistinguishable from a current member:
--
--   create_family_invitation  20260806000014:117-124  "That person is already in this family."
--   redeem_family_invitation  20260806000013:297-303  "You already belong to this family."
--   join_family_by_code       20260806000011:518-524  "You have already applied to join this family."
--
-- So a decline was permanent and silent: no invitation could be minted, and nothing
-- anywhere could reverse it (the Declined list rendered no controls). This migration
-- changes the first two. THE THIRD IS LEFT ALONE ON PURPOSE — see the end.
--
-- It also changes `peek_family_invitation`, which is not part of the bug but is part of
-- telling the truth about it: an invitation that will land somebody in the approvals queue
-- must not promise them immediate access on the way in. Three layers state one rule — the
-- create side predicts it, peek re-evaluates it on read, and redeem enforces it — and only
-- the last is load-bearing. See §3 and the note on `AND v_rows = 0` for why the other two
-- exist anyway.
--
-- THE POLICY, chosen by the product owner 2026-08-11: any approved member may ask a
-- declined person back, and re-entry ALWAYS returns them to the approvals queue. Not
-- "usually"; always. That single rule is what makes this change small and safe, because
-- it deletes the attack that killed the first draft of it:
--
--   A hostile review refuted an earlier version with this sequence. An administrator
--   mints a PRE-APPROVED invitation for e@x. e@x ignores it and joins by family code
--   instead, landing 'pending'. A second administrator works the queue, does not
--   recognise them, and declines. The original token — still inside its 14 days — is then
--   redeemed and flips 'rejected' straight to 'approved' with no human review, silently
--   reversing the decline and (in that draft) erasing the note recording it.
--
--   Pre-approval simply does not apply to a re-open here, so there is no version of that
--   sequence which admits anybody. The worst a stale token can now do is put its holder
--   back in the queue, in front of the administrators who declined them.
--
-- WHAT IS DELIBERATELY PRESERVED. The re-open UPDATE writes exactly two columns. It
-- leaves membership_note, membership_decided_at and membership_decided_by in place, so
-- "who declined them, when, and why" survives being asked back — which is what the
-- Declined list's own copy promises, and what an administrator seeing a familiar name
-- return to the queue needs. permission_template_id is untouched for the same reason:
-- set_membership_status assigns General only when it is NULL (20260807000000:1037-1043),
-- so a row that was templated before being declined keeps that template rather than
-- being silently reset, and a row that was never templated still gets one on approval.
--
-- MESSAGES ARE UNCHANGED, and that is a security property rather than laziness. A
-- reviewer demonstrated against a live database that differentiating the create-side
-- refusal ("that person has already asked to join") tells any signed-in caller — with no
-- approvals grant, who can see zero non-approved rows through RLS — whether an arbitrary
-- address is pending, disabled or a member. The public POST /rest/v1/rpc surface makes
-- that an enumeration oracle for any address somebody cares to type. One sentence covers
-- every in-family state, exactly as before.
--
-- FAIL CLOSED ON A FIFTH STATE. Both new tests are POSITIVE (`= 'rejected'`, and a count
-- of rejections equal to the count of rows) rather than negative (`<> 'approved'`), per
-- AGENTS.md. A membership_status this migration has never heard of is refused by both
-- bodies, at call time, without needing a CHECK-constraint assertion that a later
-- migration would outrun.
--
-- GRANTS: CREATE OR REPLACE preserves the existing ACL, so the EXECUTE grants from
-- 20260806000014:152 and 20260806000013:343 carry over untouched and are NOT restated
-- here. Do not "fix" that by re-granting — 20260806000015's assertion block fails the
-- push if a function ends up executable by a role not on its list.

BEGIN;

-- ── 1. The inviter is no longer refused ─────────────────────────────────────
--
-- Body-only change to 20260806000014's version: the status-blind EXISTS becomes two
-- counts and one positive allow condition. Everything else — the approved-caller lookup,
-- the family resolution, the pre-approval clamp, the revoke-then-insert — is reproduced
-- verbatim, because a CREATE OR REPLACE replaces the whole body and a partial copy would
-- silently drop whichever check got left out.
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
  v_rows    bigint;
  v_reject  bigint;
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

  -- HOW MANY MEMBERSHIPS THIS ADDRESS HAS HERE, AND HOW MANY OF THEM ARE REFUSALS.
  --
  -- This replaces a bare EXISTS that had no membership_status test, which is the whole
  -- bug: a declined applicant kept their row, so they read as "already in this family"
  -- for ever and no invitation could be minted for them again.
  --
  -- Counts rather than a status, for two reasons. They can never be NULL, so there is no
  -- three-valued-logic branch to get wrong; and they need no ORDER BY to pick a row if an
  -- address ever resolves to more than one membership (people_user_family_key makes that
  -- one row per user, but two auth accounts sharing an address is not this function's
  -- assumption to make).
  SELECT count(*), count(*) FILTER (WHERE p.membership_status = 'rejected')
    INTO v_rows, v_reject
    FROM public.people p
    JOIN auth.users u ON u.id = p.user_id
   WHERE p.family_code = v_family
     AND lower(u.email) = v_email;

  -- POSITIVE, so an unrecognised state refuses. Permitted: no membership at all, or every
  -- membership at this address is a refusal. 'approved' (they really are in the family),
  -- 'pending' (already in the queue — inviting them again would mint a second way in for
  -- somebody who has already asked) and 'disabled' (a deliberate exclusion made under a
  -- DIFFERENT grant, set_member_enabled under admin/users, which an invitation must not
  -- undo) all fall through to the refusal, as does any mixture.
  IF NOT (v_rows = 0 OR v_rows = v_reject) THEN
    -- ONE SENTENCE FOR EVERY STATE. See the header: differentiating this wording is an
    -- enumeration oracle over arbitrary addresses for any signed-in caller.
    RETURN QUERY SELECT false, NULL::text, v_email, v_family, v_name, false,
      'That person is already in this family.'; RETURN;
  END IF;

  -- PRE-APPROVAL: the first three conditions are unchanged from 20260806000014.
  -- auth_permission() answers for the ACTIVE family only, so honouring it against some
  -- other family would let an administrator of one pre-approve into another where they
  -- are nobody.
  --
  -- `AND v_rows = 0` IS NEW, AND IT IS HONESTY RATHER THAN ENFORCEMENT. Enforcement is
  -- redeem_family_invitation's `AND NOT v_reopen`, which ignores pre-approval on a
  -- re-open whatever this column says and is what actually holds the line. But the
  -- stored column is what the product then REPORTS: without this conjunct,
  -- InviteMemberDialog tells the administrator "they will be admitted the moment they
  -- accept — they will not appear in the approvals queue", and peek tells the invitee
  -- "you will have full access as soon as you accept". Both are false for a re-invitation,
  -- and the second is read by somebody who has no way to know better.
  --
  -- Positive form (`= 0`, not `> 0` negated) for the same reason as everything else here:
  -- at this point v_rows is either 0 or all-refusals, so `= 0` means "not a re-invitation"
  -- and any future third case falls to the cautious side.
  --
  -- It is a PREDICTION, not a guarantee — somebody with no membership when the invitation
  -- is minted may be declined before they redeem it. peek re-evaluates on read for exactly
  -- that case, and the redeem clamp catches it regardless. Three layers, one rule; only
  -- the clamp is load-bearing.
  v_pre := COALESCE(p_pre_approved, false)
           AND v_family = v_active
           AND public.auth_permission('admin/approvals', 'edit') = 'any'
           AND v_rows = 0;

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

-- ── 2. The declined person can accept, and lands back in the queue ──────────
--
-- Body-only change to 20260806000013's version. Two things move: the status-blind EXISTS
-- becomes a positive switch, and the insert becomes an insert-or-re-open.
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
  v_claims   jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role     text  := COALESCE(v_claims ->> 'role', '');
  p_user     uuid;
  v_inv      public.family_invitations;
  v_email    text;
  v_name     text;
  v_person   uuid;
  v_meta     jsonb;
  v_existing text;
  v_decided  timestamptz;
  v_reopen   boolean := false;
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

  -- THE EXISTING MEMBERSHIP, IF ANY, AND THE ONE STATE AN INVITATION MAY RE-OPEN.
  --
  -- Was a status-blind EXISTS, which refused a declined person their own invitation and
  -- so stranded them on a link that had just been emailed to them.
  --
  -- WRITTEN AS A POSITIVE SWITCH WITH A CATCH-ALL REFUSAL, so that deleting the permit
  -- closes the door rather than opening it: strike the `v_existing = 'rejected'` arm and
  -- every existing membership falls to the ELSE and is refused. An unrecognised
  -- membership_status does exactly that today.
  SELECT p.id, p.membership_status, p.membership_decided_at
    INTO v_person, v_existing, v_decided
    FROM public.people p
   WHERE p.user_id = p_user AND p.family_code = v_inv.family_code;

  IF v_person IS NOT NULL THEN
    IF v_existing = 'rejected'
       AND (v_decided IS NULL OR v_inv.created_at > v_decided) THEN
      -- Asked back AFTER the refusal it reverses. The timestamp test is what stops a
      -- token minted BEFORE a decline from undoing it — see the header's sequence. It is
      -- NULL-safe in the permissive direction on purpose: this application always stamps
      -- membership_decided_at when it declines (20260807000000:1033) and the stamp
      -- trigger never writes 'rejected', so a NULL here means a service-role write, and
      -- refusing it would brick that address against every future invitation with
      -- nothing on screen to explain why.
      v_reopen := true;
    ELSIF v_existing = 'rejected' THEN
      -- Superseded: minted before the decline. The catch-all "unusable invitation"
      -- message, which is true of it and discloses nothing about their status.
      RETURN QUERY SELECT false, NULL::text, NULL::text, false,
        'That invitation is no longer valid. Ask for a new one.'; RETURN;
    ELSE
      RETURN QUERY SELECT false, v_inv.family_code, NULL::text, false,
        'You already belong to this family.'; RETURN;
    END IF;
  END IF;

  SELECT f.family_name INTO v_name
    FROM public.families f WHERE f.family_code = v_inv.family_code;

  IF v_reopen THEN
    -- BACK IN THE QUEUE, NEVER STRAIGHT IN. Two columns, and the omissions are the point:
    -- membership_note, membership_decided_at and membership_decided_by all survive, so
    -- the record of the refusal being reversed is not erased by reversing it, and
    -- permission_template_id survives so a member who was templated before being
    -- declined is not silently reset to General on their way back.
    --
    -- people_user_family_key UNIQUE (user_id, family_code) is why this must be an UPDATE:
    -- the INSERT below would raise 23505 for a row that already exists, which the action
    -- would report as "Could not accept that invitation. Please try again."
    UPDATE public.people
       SET membership_status        = 'pending',
           membership_requested_at  = NOW()
     WHERE id = v_person;
  ELSE
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
  END IF;

  -- PRE-APPROVAL IS AN UPDATE, NOT AN INSERT VALUE, and it has to be: the BEFORE
  -- INSERT stamp trigger (20260806000011 §2) overrides whatever status the insert
  -- carried, deliberately, so that no caller can arrive pre-approved by supplying a
  -- column. Moving it afterwards is allowed here because people_guard_membership_status
  -- refuses only the 'authenticated' role, and this is SECURITY DEFINER — it runs as
  -- the owner. That is the same door set_membership_status() goes through, which is
  -- the point: pre-approval is an approval, granted in advance by someone who held
  -- admin/approvals:edit when the invitation was created.
  --
  -- `AND NOT v_reopen` IS THE WHOLE SECURITY ARGUMENT OF THIS MIGRATION. A re-open goes
  -- back to the queue whatever the invitation says, so no invitation — however it was
  -- minted, by whom, or when — can turn a refusal into a membership without a fresh
  -- human decision. Deleting this conjunct reintroduces the reversal the header
  -- describes; there is a test that fails when you do.
  IF v_inv.pre_approved AND NOT v_reopen THEN
    UPDATE public.people
       SET membership_status     = 'approved',
           membership_decided_at = NOW(),
           membership_decided_by = (SELECT p.user_id FROM public.people p WHERE p.id = v_inv.invited_by)
     WHERE id = v_person;
  END IF;

  UPDATE public.family_invitations
     SET accepted_at = NOW(), accepted_by = v_person
   WHERE id = v_inv.id;

  -- REPORTS WHAT HAPPENED, not what the invitation asked for. A re-open of a
  -- pre-approved invitation returns false here, so /invite/<token> and the dialog say
  -- "an administrator will review" rather than promising access that was not granted.
  RETURN QUERY SELECT true, v_inv.family_code, v_name,
    (v_inv.pre_approved AND NOT v_reopen), NULL::text;
END $$;

-- ── 3. And the invitation stops promising access it will not confer ─────────
--
-- CREATE OR REPLACE, not DROP/CREATE: the RETURNS TABLE is byte-identical, so the return
-- type is unchanged and the function's ACL survives — which matters more here than
-- anywhere else in this file, because peek is the ONE function `anon` may execute
-- (20260806000015 §5) and losing that grant shows "this invitation is not valid" for every
-- invitation that is. 20260810000000 had to DROP (it was adding a column) and re-grant;
-- this does not, and the verify block below checks the grant survived rather than assuming.
--
-- WHY peek AND NOT JUST THE CREATE SIDE. The stored column is decided when the invitation
-- is minted, and the sequence that motivated the whole re-open clamp is one where the
-- refusal lands AFTERWARDS: invited with no membership (so pre_approved is honestly true),
-- joins by family code, gets declined, then redeems. The create-side conjunct cannot see
-- that future; evaluated on read, this can.
--
-- WHAT IT DISCLOSES: nothing new, and the reason is worth writing down because it looks
-- like it should. The screen driven by this bit says either "you will have full access as
-- soon as you accept" or "an administrator will review your request once you accept" — and
-- the second is exactly what an ORDINARY, never-pre-approved invitation says. A token
-- holder cannot tell "not pre-approved" from "pre-approved, but you were declined here",
-- because they cannot see what the inviter asked for. The only party who knows both halves
-- is the inviter, who is the person that declined them. So this reveals nothing to anyone
-- who did not already have it, which is the test 20260810000000 set for this function.
CREATE OR REPLACE FUNCTION public.peek_family_invitation(p_token text)
RETURNS TABLE (
  valid        boolean,
  email        text,
  family_name  text,
  pre_approved boolean,
  has_account  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT true, i.email, f.family_name,
         -- The EFFECTIVE pre-approval: what redemption will actually do, not what the
         -- invitation asked for. Mirrors redeem_family_invitation's `AND NOT v_reopen`,
         -- and tests positively for the one state that re-opens.
         i.pre_approved AND NOT EXISTS (
           SELECT 1 FROM public.people p
             JOIN auth.users u ON u.id = p.user_id
            WHERE p.family_code = i.family_code
              AND lower(u.email) = i.email
              AND p.membership_status = 'rejected'),
         EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = i.email)
    FROM public.family_invitations i
    LEFT JOIN public.families f ON f.family_code = i.family_code
   WHERE i.token_hash = encode(extensions.digest(COALESCE(p_token, ''), 'sha256'), 'hex')
     AND i.accepted_at IS NULL
     AND i.revoked_at IS NULL
     AND i.expires_at > NOW()
   LIMIT 1;
$$;

-- ── 4. join_family_by_code is deliberately NOT changed ──────────────────────
--
-- Its status-blind refusal (20260806000011:518-524) means a declined person cannot
-- re-apply by typing the family code again, and that is the behaviour we want to keep.
-- A decline is the family's answer; the way back in is for a member to ask them back,
-- which is what this migration enables. Relaxing the code path as well would let anyone
-- who was turned away re-queue themselves at will, as often as they liked, and the
-- approvals queue is the screen that would absorb it.
--
-- The asymmetry is therefore intentional: the FAMILY re-opens a refusal, not the person
-- who was refused. Note this is also why the create-side check above cannot be dropped
-- as redundant — it is the only thing that mints the invitation which makes that
-- possible.
--
-- REVISED BY 20260811000002, which gives the refused person a way back after all — but a
-- purpose-built one that carries a written appeal and can be used only once per refusal,
-- rather than by relaxing the code path. `join_family_by_code` is still untouched, and the
-- objection recorded above (silent, repeatable self-re-queueing) is still the reason. Read
-- that migration's header before changing either.

-- ── verify ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_src text;
BEGIN
  -- Asserted unconditionally, because both need no fixture. A migration that applies is
  -- not a migration that works: plpgsql resolves names in a body only when it runs, so
  -- these bodies were created without complaint whatever they reference.
  -- EVERY PATTERN BELOW IS A WHOLE STATEMENT, NOT A FRAGMENT, and that is deliberate:
  -- prosrc contains the COMMENTS as well as the code, and each of these conjuncts is
  -- discussed by name in the prose above it. Matching `AND NOT v_reopen` would therefore
  -- pass for a body whose clamp had been deleted and whose comment explaining the clamp
  -- had been left behind — an assertion that holds while the thing it asserts is gone,
  -- which is the failure mode AGENTS.md records against 20260806000012.
  SELECT prosrc INTO v_src FROM pg_proc WHERE proname = 'redeem_family_invitation';
  IF v_src NOT LIKE '%IF v_inv.pre_approved AND NOT v_reopen THEN%' THEN
    RAISE EXCEPTION 'redeem_family_invitation lost the re-open pre-approval clamp';
  END IF;
  IF v_src NOT LIKE '%AND (v_decided IS NULL OR v_inv.created_at > v_decided) THEN%' THEN
    RAISE EXCEPTION 'redeem_family_invitation lost the superseded-invitation guard';
  END IF;
  IF v_src NOT LIKE '%IF v_email IS DISTINCT FROM v_inv.email THEN%' THEN
    RAISE EXCEPTION 'redeem_family_invitation lost the email narrowing conjunct';
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc WHERE proname = 'create_family_invitation';
  IF v_src NOT LIKE '%IF NOT (v_rows = 0 OR v_rows = v_reject) THEN%' THEN
    RAISE EXCEPTION 'create_family_invitation lost the declined-membership allowance';
  END IF;
  IF v_src NOT LIKE '%AND v_rows = 0;%' THEN
    RAISE EXCEPTION 'create_family_invitation no longer withholds pre-approval on a re-invite';
  END IF;
  IF v_src NOT LIKE '%auth_permission(''admin/approvals'', ''edit'') = ''any''%' THEN
    RAISE EXCEPTION 'create_family_invitation lost the pre-approval grant check';
  END IF;

  -- The ACL CREATE OR REPLACE is relied upon to preserve. Checked rather than assumed,
  -- because losing it breaks every invitation from the browser with "permission denied
  -- for function" and no other test here would notice.
  IF NOT has_function_privilege('authenticated',
        'public.create_family_invitation(text, boolean, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'create_family_invitation is no longer executable by authenticated';
  END IF;
  IF NOT has_function_privilege('authenticated',
        'public.redeem_family_invitation(text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'redeem_family_invitation is no longer executable by authenticated';
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc WHERE proname = 'peek_family_invitation';
  IF v_src NOT LIKE '%i.pre_approved AND NOT EXISTS%'
     OR v_src NOT LIKE '%AND p.membership_status = ''rejected'')%' THEN
    RAISE EXCEPTION 'peek_family_invitation is not reporting effective pre-approval';
  END IF;

  -- THE ONE GRANT IN THIS SCHEMA THAT anon HOLDS. CREATE OR REPLACE is supposed to
  -- preserve it and does, but losing it breaks every invitation link for exactly the
  -- people invitations exist for, and no other assertion here would notice — the same
  -- argument 20260810000000 makes for checking it after a DROP.
  IF NOT has_function_privilege('anon',
        'public.peek_family_invitation(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'peek_family_invitation is no longer executable by anon';
  END IF;

  RAISE NOTICE 'reinvite: three bodies replaced, clamps present, ACLs preserved';
END $$;

COMMIT;
