-- ============================================================================
-- The family tree can record a person with no email address, an invitation can be
-- attached to the record it was sent about, and an invitation carries a name.
--
-- ── WHY ALL THREE ARE IN ONE FILE ───────────────────────────────────────────
-- Because all three change the same three functions, and every restatement of a plpgsql
-- body is a chance to revert somebody else's fix. 20260813000002's first draft did
-- exactly that: it recreated these functions from the 20260806000013 / 20260806000014 /
-- 20260810000000 versions, which were not the current ones — **20260811000001 had
-- rewritten all three** — and silently undid the declined-applicant work. Nothing failed;
-- `tests/rls` caught it through a positive control, on a case that migration had written
-- for the purpose.
--
-- So the functions are defined ONCE, here, derived from 20260811000001's bodies with two
-- additions layered on. Read that file beside this one; every check it introduced is
-- reproduced below and each is marked.
--
-- ── 1. PEOPLE WITH NO EMAIL ADDRESS ─────────────────────────────────────────
-- A family tree has to hold people the account model has no room for, and all three kinds
-- are ordinary rather than edge cases: the dead (a great-grandmother is the reason a
-- family builds a tree), elders with no address, and children.
--
-- `people.primary_email` is nullable, so nothing in the SCHEMA forced this. What forced it
-- is the product: the tree offers to invite a relative, so a record created that way has
-- an address by construction, and a record created WITHOUT one has to be visibly a
-- different kind of thing — otherwise "no email" and "we have not asked yet" are the same
-- state and nobody can tell which rows are waiting to be invited.
--
-- So such a record gets a GENERATED address — `{familycode}_{first}_{last}_{8 hex}@genorra.com`
-- — plus `email_is_placeholder` (the address is ours, never mail it) and
-- `no_email_reason` (why there is no real one, REQUIRED). The reason is required because
-- this path is the escape hatch from "every relative gets invited", and an escape hatch
-- with no friction becomes the default route: a family would end up with forty synthetic
-- addresses and no record of why any of them exists.
--
-- The address is generated in the APPLICATION (`lib/family-tree.ts`), not here: it is a
-- display convention rather than a database invariant. What the database guarantees is the
-- pairing — a placeholder address cannot exist without a reason.
--
-- ── 2. INVITATIONS GAIN A PERSON ────────────────────────────────────────────
-- Adding a relative by invitation has to put a card on the tree NOW; a tree that only
-- shows people who have already accepted is not one anybody can build. So the flow creates
-- the `people` row immediately and sends the invitation about it.
--
-- Without `invited_person_id`, redemption would then INSERT A SECOND ROW for the same
-- human, and the family would have Ada on the tree and Ada in the directory, unrelated.
-- So redemption ADOPTS. Three conditions guard it and all three are load-bearing:
--
--   same family      an id from another family would move a stranger's record onto this
--                    account — the AGENTS.md §4 shape, where the row being written is
--                    legitimately the caller's while the id it carries is not.
--   user_id IS NULL  an already-claimed row is somebody else's person, and re-pointing it
--                    is an account takeover.
--   still exists     it can be deleted in between; ON DELETE SET NULL turns that into an
--                    ordinary insert rather than an error.
--
-- If any fails, redemption falls back to inserting — the behaviour that shipped before
-- this file, so the failure mode of the whole feature is the previous behaviour.
--
-- ── 3. INVITATIONS CARRY A NAME ─────────────────────────────────────────────
-- Columns added by 20260813000002; this is where they are populated and read. Required,
-- and refused here rather than only in the dialog, because a `'use server'` export is a
-- public HTTP endpoint and the form is not in its request path.
--
-- ── WHICH FUNCTIONS MUST BE DROPPED ─────────────────────────────────────────
--   create_family_invitation  argument list changes  -> DROP (20260806000014 exists
--                             because a defaulted parameter added with CREATE OR REPLACE
--                             left an OVERLOAD behind, and an ambiguous name is refused by
--                             PostgREST for EVERY caller — it does not linger, it takes
--                             the feature down)
--   peek_family_invitation    RETURNS TABLE changes  -> DROP (Postgres refuses to change a
--                             return type in place)
--   redeem_family_invitation  neither changes        -> CREATE OR REPLACE
--
-- A DROP TAKES THE FUNCTION'S GRANTS WITH IT, and 20260806000015 §6 set default privileges
-- that REVOKE EXECUTE from anon and authenticated for anything created afterwards. The
-- re-grants below are load-bearing rather than tidying: without them nobody can invite
-- anyone, and /invite/<token> reports every valid invitation as invalid.
--
-- IDEMPOTENT.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See
--   AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. People without an email address ──────────────────────────────────────
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS email_is_placeholder BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_email_reason      TEXT;

-- Dropped and re-added rather than IF NOT EXISTS, so re-running this file with a different
-- rule actually installs the new one — the same pattern as people_gender_check.
--
-- ONE DIRECTION ONLY. A placeholder address demands a reason; a reason without a
-- placeholder is allowed, because a family may well record "moved abroad, does not read
-- email" against somebody whose real address they still hold.
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_no_email_reason_check;
ALTER TABLE public.people ADD CONSTRAINT people_no_email_reason_check
  CHECK (
    email_is_placeholder IS FALSE
    OR (no_email_reason IS NOT NULL AND btrim(no_email_reason) <> '')
  );

COMMENT ON COLUMN public.people.email_is_placeholder IS
  'The primary_email is one WE generated so the record could exist — never mail it. Set '
  'only by the family tree''s "record without an email" path. Requires no_email_reason.';

-- NEITHER COLUMN GOES IN lib/profile-columns.ts. That file is the allow-list of columns a
-- member may write to their OWN people row through saveProfileSection, which is a public
-- endpoint — so adding these would let anybody mark their own address a placeholder, and
-- `email_is_placeholder` is what decides whether the app will mail them.

-- ── 2. An invitation can be about an existing record ────────────────────────
-- ON DELETE SET NULL, not CASCADE: deleting the tree card must not delete the invitation,
-- which is a record of somebody having been asked.
ALTER TABLE public.family_invitations
  ADD COLUMN IF NOT EXISTS invited_person_id UUID REFERENCES public.people(id) ON DELETE SET NULL;

-- ── 3. Creating an invitation ───────────────────────────────────────────────
-- Derived from 20260811000001 §1. Two additions: the required name, and the optional
-- person record. Everything else is reproduced verbatim, including the two-count
-- declined-applicant test and the `AND v_rows = 0` pre-approval honesty clause.
DROP FUNCTION IF EXISTS public.create_family_invitation(text, boolean, text);
DROP FUNCTION IF EXISTS public.create_family_invitation(text, text, text, boolean, text);

CREATE FUNCTION public.create_family_invitation(
  p_email        text,
  p_first_name   text    DEFAULT NULL,
  p_last_name    text    DEFAULT NULL,
  p_pre_approved boolean DEFAULT false,
  p_family_code  text    DEFAULT NULL,
  p_person_id    uuid    DEFAULT NULL
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
  v_first   text := btrim(COALESCE(p_first_name, ''));
  v_last    text := btrim(COALESCE(p_last_name, ''));
  v_person  uuid;
  v_target  uuid;
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
  -- target family is an argument, this is also the family-isolation check: a code naming a
  -- family the caller does not belong to finds no row and is refused. (20260806000014)
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

  -- NEW: both names required. One message for both, so the caller is not walked through
  -- two round trips.
  IF v_first = '' OR v_last = '' THEN
    RETURN QUERY SELECT false, NULL::text, v_email, v_family, NULL::text, false,
      'Enter the first and last name of the person you are inviting'; RETURN;
  END IF;

  SELECT f.family_name INTO v_name
    FROM public.families f WHERE f.family_code = v_family;

  -- HOW MANY MEMBERSHIPS THIS ADDRESS HAS HERE, AND HOW MANY ARE REFUSALS.
  -- 20260811000001's fix, reproduced: a bare status-blind EXISTS made a declined applicant
  -- read as "already in this family" for ever, so no invitation could be minted for them
  -- again. Counts rather than a status, because they can never be NULL (no three-valued
  -- branch to get wrong) and they need no ORDER BY if an address ever resolves to more
  -- than one membership.
  SELECT count(*), count(*) FILTER (WHERE p.membership_status = 'rejected')
    INTO v_rows, v_reject
    FROM public.people p
    JOIN auth.users u ON u.id = p.user_id
   WHERE p.family_code = v_family
     AND lower(u.email) = v_email;

  -- POSITIVE, so an unrecognised state refuses. Permitted: no membership at all, or every
  -- membership at this address is a refusal. 'approved', 'pending' and 'disabled' — and
  -- any mixture — fall through to the refusal.
  IF NOT (v_rows = 0 OR v_rows = v_reject) THEN
    -- ONE SENTENCE FOR EVERY STATE. Differentiating this wording is an enumeration oracle
    -- over arbitrary addresses for any signed-in caller.
    RETURN QUERY SELECT false, NULL::text, v_email, v_family, v_name, false,
      'That person is already in this family.'; RETURN;
  END IF;

  -- NEW: the person record, CHECKED rather than taken on trust. `p_person_id` arrives from
  -- a caller and this function is reachable by any authenticated request with any argument
  -- it likes (AGENTS.md §2b), so it is confirmed to be a row in the TARGET family with no
  -- account attached. Anything else is silently dropped rather than refused: the invitation
  -- is still worth sending, and falling back to a plain one is what redemption does when
  -- the link cannot be honoured.
  IF p_person_id IS NOT NULL THEN
    SELECT p.id INTO v_target
      FROM public.people p
     WHERE p.id = p_person_id
       AND p.family_code = v_family
       AND p.user_id IS NULL;
  END IF;

  -- PRE-APPROVAL. The first three conditions are 20260806000014's; `AND v_rows = 0` is
  -- 20260811000001's and is HONESTY rather than enforcement — enforcement is redemption's
  -- `AND NOT v_reopen` below. Without it, InviteMemberDialog promises "they will not appear
  -- in the approvals queue" for a re-invitation that certainly will.
  v_pre := COALESCE(p_pre_approved, false)
           AND v_family = v_active
           AND public.auth_permission('admin/approvals', 'edit') = 'any'
           AND v_rows = 0;

  -- Replace any open invitation for the same address rather than adding a second live
  -- token. ALIASED, and every column qualified: this function's RETURNS TABLE names are
  -- plpgsql variables inside the body, so an unqualified `WHERE family_code = …` is
  -- ambiguous and raises at call time rather than at CREATE time.
  UPDATE public.family_invitations AS fi
     SET revoked_at = NOW()
   WHERE fi.family_code = v_family
     AND fi.email = v_email
     AND fi.accepted_at IS NULL
     AND fi.revoked_at IS NULL;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.family_invitations
    (family_code, email, first_name, last_name, token_hash, pre_approved, invited_by,
     invited_person_id)
  VALUES
    (v_family, v_email, v_first, v_last,
     encode(extensions.digest(v_token, 'sha256'), 'hex'), v_pre, v_person, v_target);

  -- The only time the plaintext token exists outside the inviter's browser.
  RETURN QUERY SELECT true, v_token, v_email, v_family, v_name, v_pre, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.create_family_invitation(text, text, text, boolean, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_family_invitation(text, text, text, boolean, text, uuid) TO authenticated;

-- ── 4. Peek, returning the name ─────────────────────────────────────────────
-- Derived from 20260811000001 §3, which added the EFFECTIVE pre-approval — the value
-- redemption will actually honour, not what the invitation asked for. That subquery is
-- reproduced exactly; dropping it would put /invite/<token> back to promising a declined
-- person full access.
--
-- The name is disclosed to whoever holds the token, which is the invitee or somebody they
-- forwarded it to. It is the label the INVITER typed about the person they addressed the
-- link to — already known to the holder in the ordinary case, and useless to anyone else,
-- for the same reason the address is (20260810000000, "What is disclosed").
DROP FUNCTION IF EXISTS public.peek_family_invitation(text);

CREATE FUNCTION public.peek_family_invitation(p_token text)
RETURNS TABLE (
  valid        boolean,
  email        text,
  family_name  text,
  pre_approved boolean,
  has_account  boolean,
  first_name   text,
  last_name    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT true, i.email, f.family_name,
         i.pre_approved AND NOT EXISTS (
           SELECT 1 FROM public.people p
             JOIN auth.users u ON u.id = p.user_id
            WHERE p.family_code = i.family_code
              AND lower(u.email) = i.email
              AND p.membership_status = 'rejected'),
         EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = i.email),
         i.first_name, i.last_name
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

-- ── 5. Redemption: re-open, adopt, or insert ────────────────────────────────
-- Derived from 20260811000001 §2. Its re-open switch and its `AND NOT v_reopen` clamp are
-- reproduced exactly; the ADOPT branch is new and sits between them.
--
-- THE THREE OUTCOMES, in the order they are tested:
--   re-open   an existing REJECTED membership for this account, asked back after the
--             refusal. Goes to 'pending', never straight in.
--   adopt     no membership, and the invitation names an unclaimed record in this family.
--             The account attaches to that record, so the tree edges around it survive.
--   insert    everything else — the original behaviour.
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
  v_first    text;
  v_last     text;
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

  -- One message for every way an invitation can be unusable. Distinguishing them tells a
  -- holder of a guessed token which guesses are close.
  IF NOT FOUND
     OR v_inv.accepted_at IS NOT NULL
     OR v_inv.revoked_at IS NOT NULL
     OR v_inv.expires_at <= NOW() THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, false,
      'That invitation is no longer valid. Ask for a new one.'; RETURN;
  END IF;

  SELECT lower(u.email), u.raw_user_meta_data INTO v_email, v_meta
    FROM auth.users u WHERE u.id = p_user;

  -- The address is a NARROWING condition on the token, not a substitute for it.
  IF v_email IS DISTINCT FROM v_inv.email THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, false,
      'This invitation was sent to a different email address.'; RETURN;
  END IF;

  -- THE EXISTING MEMBERSHIP, AND THE ONE STATE AN INVITATION MAY RE-OPEN (20260811000001).
  -- A positive switch with a catch-all refusal, so deleting the permit closes the door
  -- rather than opening it.
  SELECT p.id, p.membership_status, p.membership_decided_at
    INTO v_person, v_existing, v_decided
    FROM public.people p
   WHERE p.user_id = p_user AND p.family_code = v_inv.family_code;

  IF v_person IS NOT NULL THEN
    IF v_existing = 'rejected'
       AND (v_decided IS NULL OR v_inv.created_at > v_decided) THEN
      -- Asked back AFTER the refusal it reverses. NULL-safe in the permissive direction on
      -- purpose: this application always stamps membership_decided_at when it declines and
      -- the stamp trigger never writes 'rejected', so NULL means a service-role write.
      v_reopen := true;
    ELSIF v_existing = 'rejected' THEN
      -- Superseded: minted before the decline. The catch-all message, true of it and
      -- disclosing nothing about their status.
      RETURN QUERY SELECT false, NULL::text, NULL::text, false,
        'That invitation is no longer valid. Ask for a new one.'; RETURN;
    ELSE
      RETURN QUERY SELECT false, v_inv.family_code, NULL::text, false,
        'You already belong to this family.'; RETURN;
    END IF;
  END IF;

  SELECT f.family_name INTO v_name
    FROM public.families f WHERE f.family_code = v_inv.family_code;

  -- NULLIF, not COALESCE alone: `raw_user_meta_data ->> 'first_name'` is the EMPTY STRING
  -- rather than NULL for an account registered without one, and COALESCE would happily
  -- choose it over the invitation's name. The ACCOUNT still wins where it has one — its
  -- owner is a better authority on their own name than whoever invited them.
  v_first := COALESCE(NULLIF(btrim(COALESCE(v_meta ->> 'first_name', '')), ''), v_inv.first_name, '');
  v_last  := COALESCE(NULLIF(btrim(COALESCE(v_meta ->> 'last_name',  '')), ''), v_inv.last_name,  '');

  IF v_reopen THEN
    -- BACK IN THE QUEUE, NEVER STRAIGHT IN. The omissions are the point: membership_note,
    -- membership_decided_at, membership_decided_by and permission_template_id all survive,
    -- so reversing a refusal does not erase the record of it and a member templated before
    -- being declined is not silently reset to General.
    UPDATE public.people
       SET membership_status       = 'pending',
           membership_requested_at = NOW()
     WHERE id = v_person;
  ELSE
    -- NEW: ADOPT the record the invitation names, if it is still claimable. Re-tested here
    -- rather than trusted from creation time, because `user_id` can be claimed in between.
    -- A no-match leaves v_person NULL and falls through to the insert, which is exactly the
    -- behaviour that shipped before this branch existed.
    IF v_inv.invited_person_id IS NOT NULL THEN
      UPDATE public.people p
         SET user_id              = p_user,
             first_name           = v_first,
             last_name            = v_last,
             primary_email        = v_email,
             -- The generated address is replaced by the real one, so the flags describing
             -- it go with it — otherwise the app would refuse to mail an account that now
             -- has a genuine mailbox.
             email_is_placeholder = false,
             no_email_reason      = NULL
       WHERE p.id = v_inv.invited_person_id
         AND p.family_code = v_inv.family_code
         AND p.user_id IS NULL
      RETURNING p.id INTO v_person;
    END IF;

    IF v_person IS NULL THEN
      -- Same insert join_family_by_code() makes, leaning on the same triggers: the profile
      -- is inherited from the caller's oldest membership, the stamp trigger pends them,
      -- and they land in General.
      INSERT INTO public.people (user_id, family_code, first_name, last_name,
                                 primary_email, created_by, is_minor)
      VALUES (p_user, v_inv.family_code, v_first, v_last, v_email, p_user, false)
      RETURNING id INTO v_person;
    END IF;
  END IF;

  -- PRE-APPROVAL IS AN UPDATE, NOT AN INSERT VALUE: the BEFORE INSERT stamp trigger
  -- (20260806000011 §2) overrides whatever status the insert carried, deliberately, so no
  -- caller can arrive pre-approved by supplying a column. Allowed here because
  -- people_guard_membership_status refuses only the 'authenticated' role and this is
  -- SECURITY DEFINER.
  --
  -- IT ALSO COVERS THE ADOPTED ROW, which is why it is outside the branch: an adopted
  -- record is UPDATEd rather than inserted, so the stamp trigger never saw it and it holds
  -- whatever status it was created with — 'pending' from the trigger that fired when the
  -- tree created it. Leaving it there is correct for an ordinary invitation and wrong for
  -- a pre-approved one, and this is the line that decides.
  --
  -- `AND NOT v_reopen` IS THE WHOLE SECURITY ARGUMENT OF 20260811000001. A re-open goes
  -- back to the queue whatever the invitation says, so no invitation can turn a refusal
  -- into a membership without a fresh human decision. Deleting this conjunct reintroduces
  -- that reversal; there is a test that fails when you do.
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

  -- REPORTS WHAT HAPPENED, not what the invitation asked for. A re-open of a pre-approved
  -- invitation returns false here, so /invite/<token> and the dialog say "an administrator
  -- will review" rather than promising access that was not granted.
  RETURN QUERY SELECT true, v_inv.family_code, v_name,
    (v_inv.pre_approved AND NOT v_reopen), NULL::text;
END $$;

-- ── 6. Verify ───────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n   int;
  s     text;
  v_src text;
  bad   text[] := '{}';
BEGIN
  FOREACH s IN ARRAY ARRAY['email_is_placeholder', 'no_email_reason'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='people' AND column_name = s
    ) THEN
      bad := bad || ('people is missing ' || s);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='family_invitations'
       AND column_name='invited_person_id'
  ) THEN
    bad := bad || 'family_invitations is missing invited_person_id';
  END IF;

  -- EXACTLY ONE OF EACH. 20260806000014 exists because a defaulted parameter added with
  -- CREATE OR REPLACE left a second, unchecked version callable — and an ambiguous name is
  -- refused by PostgREST for every caller, which takes the feature down entirely.
  FOREACH s IN ARRAY ARRAY['create_family_invitation', 'peek_family_invitation',
                           'redeem_family_invitation'] LOOP
    SELECT COUNT(*) INTO v_n FROM pg_proc
     WHERE proname = s AND pronamespace = 'public'::regnamespace;
    IF v_n <> 1 THEN
      bad := bad || format('%s overloads of %s, expected 1', v_n, s);
    END IF;
  END LOOP;

  -- The parameter names PostgREST binds by. A rename is a silent 404-shaped failure at the
  -- call site rather than a compile error.
  FOREACH s IN ARRAY ARRAY['p_email','p_first_name','p_last_name','p_pre_approved',
                           'p_family_code','p_person_id'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p, unnest(p.proargnames) AS n
       WHERE p.proname = 'create_family_invitation'
         AND p.pronamespace = 'public'::regnamespace
         AND n = s
    ) THEN
      bad := bad || ('create_family_invitation() has no parameter ' || s);
    END IF;
  END LOOP;

  FOREACH s IN ARRAY ARRAY['first_name','last_name','has_account'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p, unnest(p.proargnames) AS n
       WHERE p.proname = 'peek_family_invitation'
         AND p.pronamespace = 'public'::regnamespace
         AND n = s
    ) THEN
      bad := bad || ('peek_family_invitation() does not return ' || s);
    END IF;
  END LOOP;

  -- ── 20260811000001's CHECKS, RE-ASSERTED AGAINST THE NEW BODIES ──────────
  -- This is the assertion that would have caught the revert this file exists to correct.
  -- Copied from that migration's own verify block on purpose: a body-level check is the
  -- only thing that can tell a faithful restatement from a partial one, and the failure it
  -- guards against is silent everywhere else.
  SELECT prosrc INTO v_src FROM pg_proc
   WHERE proname = 'create_family_invitation' AND pronamespace = 'public'::regnamespace;
  IF v_src NOT LIKE '%IF NOT (v_rows = 0 OR v_rows = v_reject) THEN%' THEN
    bad := bad || 'create_family_invitation lost the declined-applicant count test (20260811000001)';
  END IF;
  IF v_src NOT LIKE '%AND v_rows = 0;%' THEN
    bad := bad || 'create_family_invitation lost the `AND v_rows = 0` pre-approval clamp (20260811000001)';
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc
   WHERE proname = 'redeem_family_invitation' AND pronamespace = 'public'::regnamespace;
  IF v_src NOT LIKE '%AND NOT v_reopen%' THEN
    bad := bad || 'redeem_family_invitation lost the `AND NOT v_reopen` clamp (20260811000001)';
  END IF;
  IF v_src NOT LIKE '%v_reopen   boolean := false%' THEN
    bad := bad || 'redeem_family_invitation lost the re-open switch (20260811000001)';
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc
   WHERE proname = 'peek_family_invitation' AND pronamespace = 'public'::regnamespace;
  IF v_src NOT LIKE '%AND p.membership_status = ''rejected'')%' THEN
    bad := bad || 'peek_family_invitation lost the effective-pre-approval subquery (20260811000001)';
  END IF;

  -- The grants both DROPs took away. Default privileges since 20260806000015 §6 revoke
  -- EXECUTE from anon and authenticated for anything created afterwards, so these are the
  -- difference between a working feature and a dead one.
  IF NOT has_function_privilege('authenticated',
       'public.create_family_invitation(text, text, text, boolean, text, uuid)'::regprocedure,
       'EXECUTE') THEN
    bad := bad || 'authenticated LOST create_family_invitation — nobody can invite anyone';
  END IF;
  IF NOT has_function_privilege('anon',
       'public.peek_family_invitation(text)'::regprocedure, 'EXECUTE') THEN
    bad := bad || 'anon LOST peek_family_invitation — /invite/<token> is dead without a session';
  END IF;
  IF NOT has_function_privilege('authenticated',
       'public.peek_family_invitation(text)'::regprocedure, 'EXECUTE') THEN
    bad := bad || 'authenticated LOST peek_family_invitation';
  END IF;

  -- peek is STILL the only anon-executable function in the schema. Both DROP/CREATEs ran
  -- under default privileges this file did not set, so this catches them having drifted.
  FOR s IN SELECT p.oid::regprocedure::text FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace
              AND has_function_privilege('anon', p.oid, 'EXECUTE')
              AND p.oid <> 'public.peek_family_invitation(text)'::regprocedure::oid
  LOOP bad := bad || ('anon STILL HAS ' || s); END LOOP;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: family tree records migration is wrong:%',
      E'\n  ' || array_to_string(bad, E'\n  ');
  END IF;

  RAISE NOTICE 'invitations carry names and a person; 20260811000001 checks intact';
END $mig$;

-- The CHECK constraint, exercised rather than asserted — a constraint that admits the row
-- it exists to refuse is the failure worth catching, and this needs no fixture.
DO $mig$
DECLARE v_code text := 'TREEPROBE';
BEGIN
  -- `created_by` left NULL on purpose: nothing here needs a founder, and requiring an
  -- `auth.users` row is what let 20260806000012's verify block skip itself into a false
  -- pass on an empty database.
  INSERT INTO public.families (family_code, family_name) VALUES (v_code, 'Tree probe');

  BEGIN
    INSERT INTO public.people (family_code, first_name, last_name, email_is_placeholder)
    VALUES (v_code, 'No', 'Reason', true);
    RAISE EXCEPTION 'ROLLBACK: a placeholder address was accepted with no reason';
  EXCEPTION WHEN check_violation THEN
    NULL;  -- expected
  END;

  INSERT INTO public.people (family_code, first_name, last_name,
                             email_is_placeholder, no_email_reason)
  VALUES (v_code, 'With', 'Reason', true, 'passed away in 1998');

  -- ORDER IS LOAD-BEARING, and it is 20260812000000's rather than a fresh guess: inserting
  -- a family fires families_seed_permission_templates and families_seed_system_funds, and
  -- funds_protect_system() releases a system fund for deletion on exactly one condition —
  -- that the `families` row is already gone. People go first because a template cannot be
  -- dropped while somebody is assigned to it.
  DELETE FROM public.people               WHERE family_code = v_code;
  DELETE FROM public.families             WHERE family_code = v_code;
  DELETE FROM public.funds                WHERE family_code = v_code;
  DELETE FROM public.template_permissions tp
   USING public.permission_templates t
   WHERE tp.template_id = t.id AND t.family_code = v_code;
  DELETE FROM public.permission_templates WHERE family_code = v_code;
  DELETE FROM public.resource_visibility  WHERE family_code = v_code;

  RAISE NOTICE 'people.email_is_placeholder requires no_email_reason';
END $mig$;

-- PostgREST caches each function's argument list and return shape. Without this the API
-- keeps serving the previous signatures and every call 404s.
NOTIFY pgrst, 'reload schema';

COMMIT;
