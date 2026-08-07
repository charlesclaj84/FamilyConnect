-- ============================================================================
-- Phase 3, the enforcement half: a member joins PENDING and reads nothing until
-- an administrator admits them.
--
-- THE PROBLEM THIS SOLVES
--   A pending row in `people` carries the family_code, so auth_family_code()
--   resolves it and every composed RLS policy in the app treats that person as a
--   full member. Hiding the dashboard does nothing about it: a server action is a
--   public HTTP endpoint, and the RSC payload is a network response. The gate has
--   to be in the database.
--
-- THE CRUX: ONE CONJUNCT, IN THE RIGHT FUNCTION
--   auth_person_id() gains `AND p.membership_status = 'approved'` (§4). That is
--   nearly all of it, because auth_permission() already fails closed at
--   `IF v_person IS NULL` (20260618000000:189) — so every one of the ~40 mapped
--   tables denies view/create/edit/delete to a pending member without a single
--   policy being rewritten, and the same conjunct nulls every own_expr and
--   self_expr written in terms of auth_person_id() at the same time.
--
--   auth_family_code() IS DELIBERATELY LEFT ALONE. Nulling it would hide the
--   pending member's own profile from themselves — `people` is family-scoped —
--   and would re-open the people-INSERT bootstrap branch, which fires precisely
--   when auth_family_code() returns NULL (20260618000000, and the policy text in
--   §5 below).
--
-- WHAT THE CRUX CANNOT REACH, AND SO §6 SWEEPS
--   Two populations of policy survive it, and both were found by reading the live
--   pg_policies rather than the migration files:
--
--   a) A mapped table whose self_expr is written in terms of `auth.uid()` instead
--      of auth_person_id(). The self branch is OR-ed OUTSIDE the permission check
--      by _perm_predicate(), so it stands on its own. Today: chat_participants,
--      event_rsvp, event_assignments, user_roles. `people` is the fifth and is
--      excluded BY NAME — it is the one table the split must preserve.
--
--   b) A table with no permission clause at all, scoped only by
--      auth_family_code(). These are invisible to a reading of the sweep, because
--      the sweep never touched them:
--        person_relationships    20260806000006 rebuilt its writes longhand and
--                                its SELECT is bare `family_code = auth_family_code()`
--                                — the whole family tree.
--        notifications           its INSERT check is `family_code = auth_family_code()
--                                AND true`, so any member may write a notification
--                                to any member. A pending applicant could put a link
--                                in every member's bell.
--        user_groups, user_group_members,
--        group_permissions, resource_visibility
--                                "readable in family" — the family's group structure
--                                and who is in which group.
--
--      NOT swept, deliberately: `families` (the name and code the applicant just
--      typed and confirmed — and getMyFamilies() reads it through the service role
--      anyway), `relationship_types` (a global lookup, `USING (true)`),
--      `user_family_settings` (own row only), `permission_resources` and
--      `permission_table_map` (product reference data, not family data).
--
-- STATE LIVES ON THE `people` ROW, DEFAULT 'approved'
--   So every existing member backfills with no behaviour change. Every gate added
--   here is a POSITIVE test on 'approved', never `<> 'pending'`, so NULL or an
--   unknown value fails closed.
--
-- WHY THE STAMP TRIGGER OVERRIDES WHATEVER THE CALLER SUPPLIED (§2)
--   Founder-or-joiner is the database's decision, not the caller's. register.ts
--   creates people rows with the SERVICE ROLE, which bypasses RLS entirely, so a
--   rule the action had to opt into would be one `?mode=join` could skip — the
--   complete, documented bypass this whole phase exists to prevent. The cost is
--   that a fixture wanting an approved member must UPDATE after inserting; see
--   tests/rls/seed.mjs, which does exactly that and says why.
--
-- IDEMPOTENT. Safe to re-run: §1 is IF NOT EXISTS, §4/§5/§7 are CREATE OR REPLACE
-- and a longhand policy rebuild, and §6 skips any policy already carrying the
-- conjunct. Safe on an empty database.
-- ============================================================================

BEGIN;

-- ── 1. State on the person row ──────────────────────────────────────────────
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS membership_status       TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS membership_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS membership_decided_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS membership_decided_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS membership_note         TEXT;

DO $$ BEGIN
  ALTER TABLE public.people
    ADD CONSTRAINT people_membership_status_valid
    CHECK (membership_status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The approvals queue is "pending rows in my family" and nothing else, so a
-- partial index is both the smallest and the only one worth having.
CREATE INDEX IF NOT EXISTS people_pending_by_family_idx
  ON public.people (family_code)
  WHERE membership_status = 'pending';

COMMENT ON COLUMN public.people.membership_status IS
  'approved | pending | rejected. Gates auth_person_id(), so a non-approved row '
  'holds no permissions anywhere in the app. Set by the stamp trigger on insert '
  'and thereafter only by set_membership_status().';

-- ── 2. Joining pends; founding does not ─────────────────────────────────────
-- The test is "does this family already have an approved, user-linked member?".
-- Asked at INSERT time it needs no knowledge of which action is calling, so
-- register.ts create-mode, register.ts join-mode, join_family_by_code() and any
-- future path all get the right answer without a branch of their own.
--
-- A family with no approved member yet admits its next joiner, and that is
-- deliberate: it is the same anti-brick rule as 20260618000000's "promote the
-- oldest member if is_admin was never set" (line 506). A family whose every
-- member is pending has nobody who could ever approve anybody.
-- set_membership_status() refuses to let an administrator reject themselves, so
-- reaching that state requires deleting rows out of band.
--
-- Rows with user_id IS NULL are skipped: a child, an ancestor, a relative entered
-- by somebody else. They are family records, not memberships, hold no permissions
-- of their own, and must stay visible in the directory — which the 'approved'
-- column default gives them.
CREATE OR REPLACE FUNCTION public.tg_person_stamp_membership_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.people p
     WHERE p.family_code = NEW.family_code
       AND p.user_id IS NOT NULL
       AND p.id <> NEW.id
       AND p.membership_status = 'approved'
  ) THEN
    NEW.membership_status       := 'pending';
    NEW.membership_requested_at := NOW();
    NEW.membership_decided_at   := NULL;
    NEW.membership_decided_by   := NULL;
  ELSE
    NEW.membership_status       := 'approved';
    NEW.membership_requested_at := COALESCE(NEW.membership_requested_at, NOW());
    NEW.membership_decided_at   := NOW();
  END IF;

  RETURN NEW;
END $$;

-- Named to sort AFTER people_inherit_shared_profile (20260617000001): both are
-- BEFORE INSERT and Postgres fires them in name order. Neither touches a column
-- the other reads, so the order is not load-bearing — but a stable one is easier
-- to reason about than an accidental one.
DROP TRIGGER IF EXISTS people_stamp_membership_status ON public.people;
CREATE TRIGGER people_stamp_membership_status
  BEFORE INSERT ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.tg_person_stamp_membership_status();

-- NOTE ON THE OTHER DIRECTION: 20260617000001's people_sync_shared_profile
-- propagates a profile edit out to the user's other memberships, column by named
-- column. membership_status is NOT in that list and must never be added to it —
-- approval is per family by definition, and syncing it would let admission to one
-- family admit the same account to every other one it has applied to.

-- ── 2b. Only set_membership_status() may move the status ─────────────────────
-- THE HOLE THIS CLOSES, which is not hypothetical and was found while wiring the
-- pending screens.
--
-- The `people` UPDATE policy deliberately admits a member's write to their OWN row —
-- it has to, or nobody could edit their own profile. An RLS policy is a predicate over
-- the ROW, and it has no opinion about which of that row's columns changed. So every
-- column on `people` is writable by its owner, and this migration just added
-- membership_status to them. Posting
--
--     saveProfileSection({ membership_status: 'approved' })
--
-- to the profile endpoint — the one endpoint a pending member is deliberately allowed
-- to reach — was a self-approval, and the policies were all satisfied, because the row
-- really was theirs. app/actions/personal-info.ts now allow-lists the columns it
-- writes, and this is the half that does not depend on remembering to.
--
-- WHY THE TEST IS `current_user = 'authenticated'`
--   That is the role PostgREST assumes for a signed-in request, and it is the only
--   caller that must never move this column directly. The two legitimate writers both
--   present as something else:
--     * set_membership_status() is SECURITY DEFINER, so its UPDATE runs as the function
--       OWNER — the migration role, not 'authenticated'.
--     * the service-role client presents as 'service_role'. It bypasses RLS by
--       definition, so a trigger is not where it gets constrained; link-person.ts
--       carries the status across on that client on purpose, and tests/rls seeds
--       statuses the same way.
--
--   Hence SECURITY INVOKER — deliberately, and unusually for this codebase. A
--   SECURITY DEFINER trigger function would see current_user as its own owner for
--   every caller alike and could not tell the three apart. It needs no privileges of
--   its own: it reads OLD and NEW and nothing else.
CREATE OR REPLACE FUNCTION public.tg_person_guard_membership_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.membership_status IS DISTINCT FROM OLD.membership_status
     AND current_user = 'authenticated' THEN
    RAISE EXCEPTION
      'membership_status may only be changed through set_membership_status()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS people_guard_membership_status ON public.people;
CREATE TRIGGER people_guard_membership_status
  BEFORE UPDATE OF membership_status ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.tg_person_guard_membership_status();

-- ── 3. "Is the caller an approved member of the family they are viewing?" ────
-- A separate function from auth_person_id() because §6 needs the answer where the
-- policy has no person id in hand — a bare `family_code = auth_family_code()`
-- predicate. STABLE + SECURITY DEFINER to match its siblings, so it is usable
-- inside a policy and costs one cached call per statement.
CREATE OR REPLACE FUNCTION public.auth_membership_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.people p
     WHERE p.user_id = (SELECT auth.uid())
       AND p.family_code = public.auth_family_code()
       AND p.membership_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.auth_membership_approved() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_membership_approved() TO authenticated;

-- ── 4. THE CRUX ─────────────────────────────────────────────────────────────
-- One conjunct. Reproduced verbatim from 20260618000000:153-165 with the single
-- line added, so a diff of the two shows exactly what changed.
CREATE OR REPLACE FUNCTION public.auth_person_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id
  FROM public.people p
  WHERE p.user_id = (SELECT auth.uid())
    AND p.family_code = public.auth_family_code()
    -- Phase 3: a pending or rejected membership resolves to NO person, so
    -- auth_permission() returns 'none' for every resource and every action, and
    -- every own/self expression written in terms of this function is NULL.
    AND p.membership_status = 'approved'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_person_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_person_id() TO authenticated;

-- ── 5. `people` SELECT: the one table that must stay split ───────────────────
-- Three populations, three answers:
--   the caller's own row      always visible, pending or not, or a pending member
--                             could not see or complete their own profile
--   an approved member's row  visible to whoever holds members:view, as before
--   a pending/rejected row    visible ONLY to a caller who can view Member
--                             Approvals — otherwise joining a family publishes the
--                             applicant's name, email, phone, address and date of
--                             birth to every member of it through the directory
--
-- That last clause is why 20260806000010 has to be applied first: an unregistered
-- resource key resolves to view 'any', which would make this branch a tautology.
--
-- Rebuilt longhand rather than textually patched, because the SHAPE changes — a
-- new conjunct nests inside the permission disjunct rather than being AND-ed onto
-- the whole predicate. The base expression (`family_code = auth_family_code()`)
-- and the permission disjunct are reproduced from the swept policy verbatim.
--
-- Every SELECT policy on the table is dropped first, not just the known name:
-- permissive policies are OR-ed, so one left behind would decide every read on its
-- own — which is exactly how the resurrected user_metadata policy of
-- 20260806000009 came to govern `families` in production.
DO $mig$
DECLARE p record; v_dropped int := 0;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'people' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.people', p.policyname);
    v_dropped := v_dropped + 1;
  END LOOP;
  RAISE NOTICE 'people: dropped % SELECT policy(ies)', v_dropped;
END $mig$;

CREATE POLICY "perm:family can view people"
  ON public.people FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND (
      -- your own row, unconditionally
      user_id = (SELECT auth.uid())
      OR (
        (
          public.auth_permission('members', 'view') = 'any'
          OR (public.auth_permission('members', 'view') = 'own'
              AND user_id = (SELECT auth.uid()))
        )
        AND (
          membership_status = 'approved'
          OR public.auth_can('admin/approvals', 'view')
        )
      )
    )
  );

-- ── 6. The sweep: policies the crux cannot reach ─────────────────────────────
-- Appends `AND public.auth_membership_approved()` to every policy on the tables
-- listed in the header, rebuilding each under its own name, command and roles —
-- the text-surgery pattern of 20260805000006 §4.
--
-- AND can only narrow: for an approved member the conjunct is `true` and the
-- policy is unchanged, so no table comes out of this more permissive than it went
-- in, whatever the membership data says.
--
-- The list is computed, not hard-coded, for the (a) population — permission_table_map
-- is the authority on which tables have an auth.uid()-based self branch, and a
-- future map row gets swept by re-running this file rather than by being remembered.
DO $mig$
DECLARE
  v_tables text[];
  v_table  text;
  p        record;
  v_roles  text;
  v_qual   text;
  v_check  text;
  v_count  int := 0;
BEGIN
  -- (b) the tables with no permission clause at all. See the header for why each,
  -- and for the four deliberately absent.
  v_tables := ARRAY[
    'person_relationships',
    'notifications',
    'user_groups', 'user_group_members', 'group_permissions', 'resource_visibility'
  ];

  -- (a) mapped tables whose self branch is OR-ed outside the permission check and
  -- written in terms of auth.uid(). `people` excluded by name: §5 owns that table.
  SELECT v_tables || COALESCE(array_agg(m.table_name), ARRAY[]::text[])
    INTO v_tables
    FROM public.permission_table_map m
   WHERE m.table_name <> 'people'
     AND m.self_expr LIKE '%auth.uid()%';

  FOREACH v_table IN ARRAY v_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = v_table
    ) THEN
      RAISE NOTICE 'skip %: table not present', v_table;
      CONTINUE;
    END IF;

    FOR p IN
      SELECT policyname, cmd, qual, with_check, roles
        FROM pg_policies
       WHERE schemaname = 'public' AND tablename = v_table
         -- Re-runnable: a policy already carrying the conjunct is left alone.
         AND COALESCE(qual, '')       NOT LIKE '%auth_membership_approved%'
         AND COALESCE(with_check, '') NOT LIKE '%auth_membership_approved%'
    LOOP
      v_roles := array_to_string(p.roles, ', ');
      -- A NULL clause is meaningful (absent, not empty), so each is wrapped only
      -- if it exists and each command is rebuilt with only the clauses it had.
      v_qual  := CASE WHEN p.qual       IS NULL THEN NULL
                      ELSE '(' || p.qual || ') AND public.auth_membership_approved()' END;
      v_check := CASE WHEN p.with_check IS NULL THEN NULL
                      ELSE '(' || p.with_check || ') AND public.auth_membership_approved()' END;

      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, v_table);

      IF p.cmd = 'SELECT' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO %s USING (%s)',
                       p.policyname, v_table, v_roles, v_qual);

      ELSIF p.cmd = 'INSERT' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK (%s)',
                       p.policyname, v_table, v_roles, v_check);

      ELSIF p.cmd = 'UPDATE' THEN
        IF v_check IS NULL THEN
          EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s)',
                         p.policyname, v_table, v_roles, v_qual);
        ELSE
          EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
                         p.policyname, v_table, v_roles, v_qual, v_check);
        END IF;

      ELSIF p.cmd = 'DELETE' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO %s USING (%s)',
                       p.policyname, v_table, v_roles, v_qual);

      ELSE  -- ALL
        IF v_check IS NULL THEN
          EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO %s USING (%s)',
                         p.policyname, v_table, v_roles, v_qual);
        ELSE
          EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO %s USING (%s) WITH CHECK (%s)',
                         p.policyname, v_table, v_roles, v_qual, v_check);
        END IF;
      END IF;

      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'membership sweep narrowed % policies across % tables',
               v_count, array_length(v_tables, 1);
END $mig$;

-- ── 7. The three RPCs the feature calls ─────────────────────────────────────
-- All SECURITY DEFINER, and all three genuinely need to be: each one has to reach
-- a row the caller's own policies keep them away from. Which means each one owes,
-- by hand, exactly what RLS would have done — AGENTS.md §3.

-- 7a. Look up a code and return the family's NAME, for the confirmation step.
--
-- This is an enumeration oracle by construction and was accepted as one: the family
-- code is public and meant to be shared, and the payoff for walking the space is a
-- family name. Two things narrow it anyway — a caller must be signed in, and
-- app/actions/my-families.ts rate-limits the lookup per user.
CREATE OR REPLACE FUNCTION public.validate_family_code(p_code text)
RETURNS TABLE (family_code text, family_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT f.family_code, f.family_name
    FROM public.families f
   WHERE f.family_code = upper(btrim(COALESCE(p_code, '')))
     AND (SELECT auth.uid()) IS NOT NULL
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validate_family_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_family_code(text) TO authenticated;

-- 7b. Create the membership. Pending, by the trigger in §2 — this function does
-- not set the status and must not: that decision belongs to one place.
--
-- SECURITY DEFINER is unavoidable here. The people INSERT policy requires
-- `family_code = auth_family_code()`, which for anyone who already belongs to a
-- family is their EXISTING family — so a second membership cannot be inserted
-- through it at all. The bootstrap branch beside it fires only when
-- auth_family_code() IS NULL, i.e. during first registration.
--
-- What it therefore re-applies by hand:
--   * user_id is auth.uid(), never a parameter. There is no way to ask this
--     function to enrol somebody else.
--   * the family must exist (a code that does not is not an insert).
--   * the caller must not already have a row in it — UNIQUE(user_id, family_code)
--     would catch it, but a clean message is better than a constraint violation.
--   * email must be confirmed.
--
-- ON THE EMAIL CHECK: it shipped inert and is now live. It was written while
-- config.toml had enable_confirmations = false, where GoTrue stamps
-- email_confirmed_at at signup and this passes trivially; the flag was turned on in
-- the same change, together with app/auth/confirm/route.ts and the email template
-- that links to it. Verified against a local stack: an account that has not clicked
-- its link is refused here.
--
-- The flag is per PROJECT, not per migration, so a database that has this function
-- says nothing about whether the check bites. If it ever goes back to false, this
-- returns to being decoration and admin approval is the only human gate again.
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
                             primary_email, created_by, is_minor)
  VALUES (v_user, v_code,
          COALESCE(v_meta ->> 'first_name', ''),
          COALESCE(v_meta ->> 'last_name', ''),
          lower(COALESCE(v_email, '')),
          v_user, false);

  RETURN QUERY SELECT true, v_code, v_name, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.join_family_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_family_by_code(text) TO authenticated;

-- 7c. Approve or reject an applicant.
--
-- CALL THIS WITH THE USER CLIENT — createClient(), never createAdminClient().
-- The authorization below is auth.uid()-derived, and the service role has no
-- auth.uid(): called with the admin client every check here would evaluate against
-- NULL. That is not left to a comment. The `v_user IS NULL` branch refuses
-- outright, so a service-role call FAILS rather than sailing past the checks and
-- leaving the TypeScript guard as the only thing standing.
--
-- SECURITY DEFINER because the approver must UPDATE a `people` row that is not
-- theirs, and because a rejected row has to stay writable after its own status
-- takes it out of the SELECT policy's reach.
--
-- Re-applied by hand, since none of the caller's policies apply inside here:
--   * the caller holds admin/approvals:edit at scope 'any' — and auth_permission()
--     now runs through the §4 conjunct, so a PENDING administrator cannot approve
--     anyone either, whatever grants they hold.
--   * the target lives in the caller's own family (auth_family_code()), never the
--     family implied by the id.
--   * the caller is not deciding their own membership. Self-approval is the obvious
--     abuse; self-REJECTION is the subtler one, since a family with no approved
--     member left admits its next joiner unreviewed (§2).
CREATE OR REPLACE FUNCTION public.set_membership_status(
  p_person_id uuid,
  p_status    text,
  p_note      text DEFAULT NULL
)
RETURNS TABLE (ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user   uuid := (SELECT auth.uid());
  v_family text;
  v_target public.people;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'; RETURN;
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('approved', 'rejected') THEN
    RETURN QUERY SELECT false, 'Unknown membership status'; RETURN;
  END IF;

  IF public.auth_permission('admin/approvals', 'edit') <> 'any' THEN
    RETURN QUERY SELECT false, 'Not authorized'; RETURN;
  END IF;

  v_family := public.auth_family_code();
  IF v_family IS NULL THEN
    RETURN QUERY SELECT false, 'Not authorized'; RETURN;
  END IF;

  SELECT * INTO v_target FROM public.people WHERE id = p_person_id;
  IF NOT FOUND OR v_target.family_code IS DISTINCT FROM v_family THEN
    -- Same message either way: whether an id names a row in another family is not
    -- something this endpoint should confirm.
    RETURN QUERY SELECT false, 'Applicant not found'; RETURN;
  END IF;

  IF v_target.user_id = v_user THEN
    RETURN QUERY SELECT false, 'You cannot decide your own membership'; RETURN;
  END IF;

  IF v_target.membership_status = p_status THEN
    RETURN QUERY SELECT true, NULL::text; RETURN;
  END IF;

  UPDATE public.people
     SET membership_status     = p_status,
         membership_decided_at = NOW(),
         membership_decided_by = v_user,
         membership_note       = p_note
   WHERE id = p_person_id;

  -- Belt and braces since 20260806000008: the people triggers already put a
  -- user-linked person into General the moment they are inserted, so this is
  -- normally a no-op. Kept because falling back to bare defaults instead of the
  -- policy the family configured is a silent, hard-to-spot wrong answer — and it
  -- leaks nothing in the meantime, because §4 denies a pending member regardless of
  -- which groups they are in.
  IF p_status = 'approved' THEN
    INSERT INTO public.user_group_members (group_id, person_id)
    SELECT g.id, p_person_id
      FROM public.user_groups g
     WHERE g.family_code = v_family AND g.name = 'General'
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.set_membership_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_membership_status(uuid, text, text) TO authenticated;

-- ── 8. Verify ───────────────────────────────────────────────────────────────
-- Reading a policy is not the same as running it, and every expression above was
-- assembled at migration time out of pg_policies. These assertions are the only
-- thing that can tell the difference between "the sweep ran" and "the sweep
-- matched nothing".
DO $mig$
DECLARE
  v_bad     int;
  v_tables  text[];
  v_missing text;
BEGIN
  -- The crux.
  IF (SELECT prosrc FROM pg_proc
       WHERE proname = 'auth_person_id' AND pronamespace = 'public'::regnamespace)
     NOT LIKE '%membership_status = ''approved''%' THEN
    RAISE EXCEPTION 'ROLLBACK: auth_person_id() does not gate on membership_status';
  END IF;

  -- Exactly one SELECT policy on people, and it consults the approvals key. Two
  -- would be OR-ed and the weaker one would decide.
  SELECT COUNT(*) INTO v_bad
    FROM pg_policies WHERE schemaname='public' AND tablename='people' AND cmd='SELECT';
  IF v_bad <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: people has % SELECT policies, expected exactly 1', v_bad;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='people' AND cmd='SELECT'
       AND qual LIKE '%admin/approvals%'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: the people SELECT policy does not hide non-approved rows';
  END IF;

  -- The registered resource that policy depends on. Without the row, the clause is
  -- a tautology and every member reads every applicant's PII.
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key='admin/approvals') THEN
    RAISE EXCEPTION 'ROLLBACK: admin/approvals is not registered — apply 20260806000010 first';
  END IF;

  -- people must NOT have been swept: its own-row branch is the split §5 preserves.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='people'
       AND (COALESCE(qual,'') LIKE '%auth_membership_approved%'
         OR COALESCE(with_check,'') LIKE '%auth_membership_approved%')
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: a people policy was swept — a pending member can no longer see their own profile';
  END IF;

  -- Every table §6 was asked to narrow carries the conjunct on every policy.
  v_tables := ARRAY['person_relationships', 'notifications',
                    'user_groups', 'user_group_members',
                    'group_permissions', 'resource_visibility'];
  SELECT v_tables || COALESCE(array_agg(m.table_name), ARRAY[]::text[])
    INTO v_tables
    FROM public.permission_table_map m
   WHERE m.table_name <> 'people' AND m.self_expr LIKE '%auth.uid()%';

  SELECT string_agg(DISTINCT pol.tablename || '.' || pol.policyname, ', ')
    INTO v_missing
    FROM pg_policies pol
   WHERE pol.schemaname = 'public'
     AND pol.tablename = ANY (v_tables)
     AND COALESCE(pol.qual, '')       NOT LIKE '%auth_membership_approved%'
     AND COALESCE(pol.with_check, '') NOT LIKE '%auth_membership_approved%';
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: these policies still admit a pending member: %', v_missing;
  END IF;

  -- The guard of §2b. Without it a member can approve themselves through the profile
  -- endpoint, so its absence is not a lesser failure than a missing policy.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.people'::regclass
       AND tgname = 'people_guard_membership_status'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: people_guard_membership_status is missing';
  END IF;

  IF (SELECT prosecdef FROM pg_proc
       WHERE proname = 'tg_person_guard_membership_status'
         AND pronamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION
      'ROLLBACK: tg_person_guard_membership_status is SECURITY DEFINER — it cannot then '
      'tell an authenticated caller from set_membership_status(), and admits both';
  END IF;

  -- The three RPCs.
  FOREACH v_missing IN ARRAY ARRAY['validate_family_code','join_family_by_code','set_membership_status'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc
                    WHERE proname = v_missing AND pronamespace='public'::regnamespace) THEN
      RAISE EXCEPTION 'ROLLBACK: %() was not created', v_missing;
    END IF;
  END LOOP;

  -- Nobody was pended by the deploy itself. The column default plus the
  -- INSERT-only trigger should leave every existing row exactly as it was.
  SELECT COUNT(*) INTO v_bad FROM public.people WHERE membership_status <> 'approved';
  IF v_bad > 0 THEN
    RAISE NOTICE 'note: % existing people row(s) are not approved', v_bad;
  END IF;
END $mig$;

COMMIT;
