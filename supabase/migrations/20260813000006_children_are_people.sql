-- ============================================================================
-- A child is a person. Drop `people.is_minor`.
-- ----------------------------------------------------------------------------
-- WHAT THIS UNDOES
--   `people.is_minor` split the roster into two kinds of record: members, and
--   children who were managed by a parent through /direct-lineage and then
--   "converted to adult" when they grew up. That second kind is gone. A child
--   joins the family the way every other relative without an email address does
--   — the family tree's "No email address" mode, which generates a placeholder
--   address and records a reason, and which has had "Too young for an account"
--   in its own placeholder text since it shipped.
--
-- WHY THE COLUMN CANNOT SIMPLY BE LEFT ALONE
--   Because it was never one fact. It was TWO, and they disagreed:
--
--     * the stored boolean, written `true` by addChild() and `false` by every
--       other insert in the codebase, and
--     * computeIsMinor(date_of_birth) in lib/age-utils.ts, which app/actions/
--       members.ts used at READ time and which returns false for a NULL birthday
--       — so a child added with no date of birth was stored as a minor and
--       reported as an adult on the very next screen.
--
--   A stored boolean about age is wrong the moment it is written: the row does
--   not change when the person has a birthday. Whatever still needs the word
--   derives it from `date_of_birth`, which is the only column that can answer
--   the question on the day it is asked.
--
--   In production the column is `false` on every row anyway — its one writer,
--   addChild(), sits behind a route registered `status: 'future'` in
--   lib/features.ts, which the edge gate answers with Coming Soon. So this drops
--   a distinction the database was recording and nothing was ever setting.
--
-- ── WHY THE FOUR FUNCTIONS BELOW ARE RE-ISSUED IN FULL ──────────────────────
--   plpgsql does not resolve names in a function body until the body runs, so a
--   function still naming a dropped column is created without complaint and
--   throws for its first caller — in production, if the local run never called
--   it. Three of these four are the registration path (create a family, join by
--   code, redeem an invitation): the first caller would be somebody signing up.
--
--   Each is VERBATIM apart from `is_minor`, the same way 20260810000001 re-issued
--   sync_shared_person_profile verbatim apart from `gender`. Every one of them
--   passed an explicit `false` that was already the column default, so the edit
--   is the removal of one column name and one literal and nothing else.
--
--   No GRANT is strictly required — CREATE OR REPLACE preserves the ACL a
--   function already carries — but the three callable ones restate theirs, so
--   this file says out loud who may execute what it redefines (AGENTS.md §2b).
--
-- ── THE TRIGGER IS THE TRAP ─────────────────────────────────────────────────
--   `people_sync_shared_profile` is AFTER UPDATE **OF** a column list, and that
--   list names `is_minor`. A trigger's OF-list is a catalogue dependency on the
--   column: `ALTER TABLE ... DROP COLUMN` refuses while it stands, and
--   DROP COLUMN ... CASCADE would "resolve" that by dropping THE WHOLE TRIGGER —
--   silently ending cross-family profile sync for every member with more than one
--   membership, with nothing in the output saying so.
--
--   So the trigger is recreated here, explicitly, before the column goes. Do not
--   replace this with a CASCADE. `pg_depend` says these two are the only
--   dependents (the other is the column's own DEFAULT, which goes with it) —
--   there is no view, index or constraint over `is_minor`.
-- ============================================================================

-- ── 1. Outbound profile sync ────────────────────────────────────────────────
-- Verbatim from 20260810000001 apart from `is_minor`, which appeared in three
-- places: the SET, and both halves of the IS DISTINCT FROM guard that stops the
-- nested pass. All three are gone; nothing else moved.
CREATE OR REPLACE FUNCTION public.sync_shared_person_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Unlinked people (no account) are family-local records; nothing to share.
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- The UPDATE below re-fires this trigger on the sibling rows. Bail out on the
  -- nested pass so propagation is a single hop and cannot recurse.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  UPDATE public.people AS t
  SET prefix          = NEW.prefix,
      first_name      = NEW.first_name,
      middle_name     = NEW.middle_name,
      last_name       = NEW.last_name,
      suffix          = NEW.suffix,
      nick_name       = NEW.nick_name,
      primary_email   = NEW.primary_email,
      primary_phone   = NEW.primary_phone,
      street_address  = NEW.street_address,
      apartment       = NEW.apartment,
      city            = NEW.city,
      state           = NEW.state,
      zip_code        = NEW.zip_code,
      country         = NEW.country,
      date_of_birth   = NEW.date_of_birth,
      sunset_date     = NEW.sunset_date,
      gender          = NEW.gender,
      tshirt_category = NEW.tshirt_category,
      tshirt_size     = NEW.tshirt_size,
      avatar_url      = NEW.avatar_url,
      time_zone       = NEW.time_zone,
      updated_at      = NOW()
  WHERE t.user_id = NEW.user_id
    AND t.id     <> NEW.id
    -- Skip rows already in sync so the nested pass changes nothing.
    AND (t.prefix, t.first_name, t.middle_name, t.last_name, t.suffix,
         t.nick_name, t.primary_email, t.primary_phone, t.street_address,
         t.apartment, t.city, t.state, t.zip_code, t.country, t.date_of_birth,
         t.sunset_date, t.gender, t.tshirt_category, t.tshirt_size, t.avatar_url,
         t.time_zone)
        IS DISTINCT FROM
        (NEW.prefix, NEW.first_name, NEW.middle_name, NEW.last_name, NEW.suffix,
         NEW.nick_name, NEW.primary_email, NEW.primary_phone, NEW.street_address,
         NEW.apartment, NEW.city, NEW.state, NEW.zip_code, NEW.country,
         NEW.date_of_birth, NEW.sunset_date, NEW.gender, NEW.tshirt_category,
         NEW.tshirt_size, NEW.avatar_url, NEW.time_zone);

  RETURN NEW;
END $$;

-- ── 2. Its trigger, minus the dropped column ────────────────────────────────
-- Recreated rather than left to CASCADE — see the header. The OF-list is
-- otherwise identical to 20260810000001's, checked against pg_get_triggerdef on
-- a live database rather than read off the migration.
DROP TRIGGER IF EXISTS people_sync_shared_profile ON public.people;
CREATE TRIGGER people_sync_shared_profile
  AFTER UPDATE OF
    prefix, first_name, middle_name, last_name, suffix, nick_name,
    primary_email, primary_phone, street_address, apartment, city, state,
    zip_code, country, date_of_birth, sunset_date, gender, tshirt_category,
    tshirt_size, avatar_url, time_zone
  ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shared_person_profile();

-- `inherit_shared_person_profile` is deliberately NOT re-issued: it never named
-- is_minor. Confirmed against pg_get_functiondef, not assumed from the migration
-- that happens to sit beside it.

-- ── 3. Create a family ──────────────────────────────────────────────────────
-- Verbatim from 20260806000012 apart from the two tokens in the people INSERT.
CREATE OR REPLACE FUNCTION public.create_family(p_family_name text)
RETURNS TABLE (ok boolean, family_code text, family_name text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user      uuid := (SELECT auth.uid());
  v_name      text := btrim(COALESCE(p_family_name, ''));
  v_email     text;
  v_confirmed timestamptz;
  v_meta      jsonb;
  v_code      text;
  v_tries     int := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Not authenticated'; RETURN;
  END IF;

  IF v_name = '' THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Enter a family name'; RETURN;
  END IF;

  IF length(v_name) > 100 THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text,
      'That family name is too long (100 characters maximum).'; RETURN;
  END IF;

  SELECT u.email, u.email_confirmed_at, u.raw_user_meta_data
    INTO v_email, v_confirmed, v_meta
    FROM auth.users u WHERE u.id = v_user;

  -- The same gate join_family_by_code() applies, for the same reason and then one
  -- more: a family's founder is its first administrator, so an unverified address
  -- here does not just get someone in, it hands them the permission model.
  IF v_confirmed IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text,
      'Confirm your email address before creating a family.'; RETURN;
  END IF;

  -- A courtesy that produces a clean message instead of a constraint violation; the
  -- guarantee is families.family_code UNIQUE, which also settles the race between this
  -- SELECT and the INSERT below.
  LOOP
    v_tries := v_tries + 1;
    v_code := public.gen_family_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.families f WHERE f.family_code = v_code);
    IF v_tries >= 5 THEN
      RETURN QUERY SELECT false, NULL::text, NULL::text,
        'Could not generate a unique family code. Please try again.'; RETURN;
    END IF;
  END LOOP;

  -- ORDER IS LOAD-BEARING — see 20260806000012. families first, so its trigger has
  -- seeded the groups by the time the people trigger goes looking for them.
  --
  -- created_by is auth.uid() and never a parameter: it is what makes this caller the
  -- founder, and therefore what tg_person_join_system_groups() reads to decide who
  -- lands in Administrators.
  INSERT INTO public.families (family_code, family_name, created_by)
  VALUES (v_code, v_name, v_user);

  -- first/last name are NOT NULL DEFAULT ''. The inherit trigger fills them (and the
  -- rest of the profile) from the caller's oldest membership, which is the whole of
  -- "creation uses their profile"; the metadata fallback covers an account with no
  -- other row, which cannot happen from /my-families but can from a direct call.
  INSERT INTO public.people (user_id, family_code, first_name, last_name,
                             primary_email, created_by)
  VALUES (v_user, v_code,
          COALESCE(v_meta ->> 'first_name', ''),
          COALESCE(v_meta ->> 'last_name', ''),
          lower(COALESCE(v_email, '')),
          v_user);

  RETURN QUERY SELECT true, v_code, v_name, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.create_family(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_family(text) TO authenticated;

-- ── 4. Join a family by code ────────────────────────────────────────────────
-- Verbatim from 20260806000011 apart from the two tokens in the people INSERT.
CREATE OR REPLACE FUNCTION public.join_family_by_code(p_code text)
RETURNS TABLE (ok boolean, family_code text, family_name text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user   uuid := (SELECT auth.uid());
  v_code   text := upper(btrim(COALESCE(p_code, '')));
  v_name   text;
  v_meta   jsonb;
  v_email  text;
  v_confirmed timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Not authenticated'; RETURN;
  END IF;

  IF v_code = '' THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Enter a family code'; RETURN;
  END IF;

  SELECT f.family_name INTO v_name
    FROM public.families f WHERE f.family_code = v_code;
  IF v_name IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text,
      'Family code not found. Check with your family and try again.'; RETURN;
  END IF;

  SELECT u.email, u.email_confirmed_at, u.raw_user_meta_data
    INTO v_email, v_confirmed, v_meta
    FROM auth.users u WHERE u.id = v_user;

  IF v_confirmed IS NULL THEN
    RETURN QUERY SELECT false, v_code, v_name,
      'Confirm your email address before joining a family.'; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.people p
     WHERE p.user_id = v_user AND p.family_code = v_code
  ) THEN
    RETURN QUERY SELECT false, v_code, v_name,
      'You have already applied to join this family.'; RETURN;
  END IF;

  -- first/last name are NOT NULL DEFAULT ''. 20260617000001's BEFORE INSERT
  -- trigger inherits them from the caller's oldest existing membership, which is
  -- the normal case; the metadata fallback covers an account with no other row.
  INSERT INTO public.people (user_id, family_code, first_name, last_name,
                             primary_email, created_by)
  VALUES (v_user, v_code,
          COALESCE(v_meta ->> 'first_name', ''),
          COALESCE(v_meta ->> 'last_name', ''),
          lower(COALESCE(v_email, '')),
          v_user);

  RETURN QUERY SELECT true, v_code, v_name, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.join_family_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_family_by_code(text) TO authenticated;

-- ── 5. Redeem an invitation ─────────────────────────────────────────────────
-- Verbatim from 20260813000004 apart from the two tokens in the people INSERT.
-- Every comment below is that file's; the reasoning about pre-approval, re-open
-- and adoption is unchanged and is not restated here.
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
    -- ADOPT the record the invitation names, if it is still claimable. Re-tested here
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
                                 primary_email, created_by)
      VALUES (p_user, v_inv.family_code, v_first, v_last, v_email, p_user)
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

REVOKE ALL ON FUNCTION public.redeem_family_invitation(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_family_invitation(text, uuid) TO authenticated;

-- ── 6. The column ───────────────────────────────────────────────────────────
-- No CASCADE, deliberately. If anything still depends on this column the drop
-- should FAIL and stop the deploy, not quietly delete whatever that was.
ALTER TABLE public.people DROP COLUMN IF EXISTS is_minor;

-- ── 7. Verify ───────────────────────────────────────────────────────────────
-- Nothing here needs a fixture, so nothing here can skip — the failure mode
-- AGENTS.md warns about in "A verify block that can skip must not be the only
-- check". The first assertion is the one that matters: it is a whole-catalogue
-- sweep, so a function this migration FORGOT to re-issue fails the push instead
-- of throwing for the first person who tries to sign up.
DO $mig$
DECLARE
  v_left    text;
  v_trigdef text;
BEGIN
  -- 7a. No function body anywhere in `public` still names the column.
  SELECT string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
                    ', ' ORDER BY p.proname)
    INTO v_left
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND pg_get_functiondef(p.oid) ILIKE '%is_minor%';

  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION
      'these functions still reference is_minor and will throw for their first caller: %',
      v_left;
  END IF;

  -- 7b. The column is actually gone.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'people' AND column_name = 'is_minor'
  ) THEN
    RAISE EXCEPTION 'people.is_minor still exists';
  END IF;

  -- 7c. The sync trigger SURVIVED, and still fires on the columns it is for.
  -- Recreating it is the whole reason §2 exists; a CASCADE would have left this
  -- query returning nothing, and cross-family profile sync would be off with no
  -- other symptom until two members of two families disagreed about a phone number.
  SELECT pg_get_triggerdef(t.oid) INTO v_trigdef
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.people'::regclass
     AND t.tgname  = 'people_sync_shared_profile'
     AND NOT t.tgisinternal;

  IF v_trigdef IS NULL THEN
    RAISE EXCEPTION
      'people_sync_shared_profile is gone — the column drop took it. Cross-family '
      'profile sync is off.';
  END IF;

  IF v_trigdef ILIKE '%is_minor%' THEN
    RAISE EXCEPTION 'people_sync_shared_profile still lists is_minor in its UPDATE OF clause';
  END IF;

  -- A spot check that the OF-list was reproduced rather than truncated: `gender`
  -- is the last column 20260810000001 added and `time_zone` is the last in the
  -- list, so a copy that stopped early loses one of them.
  IF v_trigdef NOT ILIKE '%gender%' OR v_trigdef NOT ILIKE '%time_zone%' THEN
    RAISE EXCEPTION
      'people_sync_shared_profile lost columns from its UPDATE OF clause: %', v_trigdef;
  END IF;

  RAISE NOTICE 'is_minor dropped; % triggers on people, sync intact',
    (SELECT count(*) FROM pg_trigger
      WHERE tgrelid = 'public.people'::regclass AND NOT tgisinternal);
END $mig$;
