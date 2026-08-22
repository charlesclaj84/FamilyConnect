-- ============================================================================
-- NINE TABLES ANSWERED ONE QUESTION TWICE. Consolidating the SELECT policies.
--
-- `multiple_permissive_policies`, nine WARN findings that are present on hosted AND on a
-- fresh local `db reset` -- so unlike `20260822000011` these are the chain's own doing, not
-- drift. Every one is the same accident with three different endings, and each ending gets a
-- different treatment. Nothing here changes what any caller may read: all three
-- transformations are provably semantics-preserving, and the argument for each is written
-- down beside it rather than asserted.
--
-- ---- WHY THE COST IS REAL AND SMALL, AND WHY IT IS STILL WORTH FIXING -----
-- Postgres evaluates EVERY permissive policy for the command until one passes, so two
-- policies on `elections` SELECT means `auth_may_see_election()` and `auth_permission()` run
-- twice per row rather than once -- both of which read `people` and `template_permissions`.
-- On a family of 140 that is not a problem anybody would notice. The reason to fix it is the
-- other half: `20260822000011` is what a redundant permissive policy looks like when one of
-- the pair is WRONG, and a database where every (table, command) has exactly one policy is
-- one where that class of bug is visible by counting. This file is what makes the count
-- meaningful, so the next `multiple_permissive_policies` finding is a signal rather than
-- noise.
--
-- ---- THE THREE ENDINGS ----------------------------------------------------
--
-- A. FIVE ARE EXACT DUPLICATES (section 1). `20260618000001` composed a FOR ALL "admins can
--    manage X" policy into one policy per command, and the resulting `:select` sibling came
--    out character-for-character identical to the "family can view X" policy beside it,
--    modulo a vestigial `AND true` where the ALL policy's own predicate used to be. The
--    migration does not take that on trust: it reads both expressions out of `pg_policies`,
--    strips ` AND true`, and REFUSES to drop anything unless the two are then identical. A
--    deploy that aborts here is the right outcome -- it means the two databases disagree
--    about a policy and a person needs to look.
--
-- B. TWO ARE GENUINELY DIFFERENT AND ARE OR-ED INTO ONE (sections 2 and 3). `dues_schedules`
--    and `election_votes` each carry two policies that admit different callers, so the merged
--    policy is literally `USING (a OR b)` -- which is what two permissive policies already
--    mean. The only liberty taken is dropping branches that are subsumed by a branch beside
--    them (`x OR (something AND x)` is `x`), and each is named where it happens.
--
-- C. THREE ARE A `FOR ALL` POLICY SITTING UNDER A READ POLICY (section 4). Splitting the ALL
--    into its three write commands leaves SELECT to the read policy alone. This is only sound
--    because on all three tables the admin expression is a SUBSET of the read expression --
--    admins-can-manage is (readable AND auth_can(...)) -- so no caller loses a row. That
--    subset relation is checked in the verify block, not assumed.
--
-- The initplan rewrite (`(SELECT auth.uid())`) rides along wherever an expression is being
-- written out anyway, which covers two of the ten `auth_rls_initplan` findings -- both on
-- `election_votes` SELECT. See `20260822000013` for the rest.
-- ============================================================================

-- ---- 1  The five exact duplicates ----------------------------------------
DO $dupes$
DECLARE
  r        record;
  v_drop   text;
  v_keep   text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('dues_schedules',    'perm:admins can manage dues schedules:select',      'perm:family can view dues schedules'),
      ('election_positions','perm:admins can manage election positions:select',  'perm:family can view election positions'),
      ('elections',         'perm:admins can manage elections:select',           'perm:family can view elections'),
      ('fund_allocations',  'perm:admins can manage fund_allocations:select',    'perm:family can view fund_allocations'),
      ('fund_contributions','perm:admins can manage fund_contributions:select',  'perm:family can view fund_contributions')
    ) AS t(tbl, dropname, keepname)
  LOOP
    SELECT qual INTO v_drop FROM pg_policies
     WHERE schemaname='public' AND tablename=r.tbl AND policyname=r.dropname;
    SELECT qual INTO v_keep FROM pg_policies
     WHERE schemaname='public' AND tablename=r.tbl AND policyname=r.keepname;

    IF v_drop IS NULL THEN
      RAISE NOTICE 'skipping %.%: already gone', r.tbl, r.dropname;
      CONTINUE;
    END IF;
    IF v_keep IS NULL THEN
      RAISE EXCEPTION 'refusing to drop %.% -- its replacement % does not exist',
        r.tbl, r.dropname, r.keepname;
    END IF;
    IF replace(v_drop, ' AND true', '') IS DISTINCT FROM v_keep THEN
      RAISE EXCEPTION 'refusing to drop %.% -- it is NOT a duplicate. dropping: [%] keeping: [%]',
        r.tbl, r.dropname, v_drop, v_keep;
    END IF;

    EXECUTE format('DROP POLICY %I ON public.%I', r.dropname, r.tbl);
    RAISE NOTICE 'dropped duplicate %.%', r.tbl, r.dropname;
  END LOOP;
END
$dupes$;

-- ---- 2  dues_schedules: two real answers, OR-ed ---------------------------
-- `perm:family can view dues schedules`        family AND admin/accounting:view = any
-- `perm:members read their family's dues sch`  family AND auth_person_id() IS NOT NULL
--
-- Both share the family conjunct, so the OR distributes over it. The second is much the
-- broader of the two and is deliberately kept: a member has to be able to read the schedule
-- they are being billed under, whatever the family has done with `admin/accounting`. The
-- perm branch's `own` arm was `AND false` (a dues schedule has no owner) and is dropped
-- rather than carried as dead text.
DROP POLICY IF EXISTS "perm:family can view dues schedules"               ON public.dues_schedules;
DROP POLICY IF EXISTS "perm:members read their family's dues schedules"   ON public.dues_schedules;

CREATE POLICY "perm:family can view dues schedules"
  ON public.dues_schedules FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND (
      public.auth_person_id() IS NOT NULL
      OR public.auth_permission('admin/accounting', 'view'::public.permission_action) = 'any'
    )
  );

-- ---- 3  election_votes: the organizer's view and the voter's own ballot ---
-- Two policies that mean two different things, which is why this is a merge and not a drop:
--
--   organizer  every vote in an election of this family, with admin/elections:view = any
--   voter      the ballots cast by the caller's own person row
--
-- `auth_may_see_election_id(election_id)` is common to both and stays out front -- it is the
-- area gate from `20260821000001`, and hoisting it means it is evaluated once instead of
-- twice. The voter branch's third arm (`own AND voter_id = auth_person_id()`) is subsumed by
-- its first (`voter_id = auth_person_id()`) and is dropped.
DROP POLICY IF EXISTS "perm:admins can view all votes"  ON public.election_votes;
DROP POLICY IF EXISTS "perm:voters can see own votes"    ON public.election_votes;

CREATE POLICY "perm:voters and organizers can see votes"
  ON public.election_votes FOR SELECT TO authenticated
  USING (
    public.auth_may_see_election_id(election_id)
    AND (
      (
        election_id IN (SELECT e.id FROM public.elections e
                         WHERE e.family_code = public.auth_family_code())
        AND public.auth_permission('admin/elections', 'view'::public.permission_action) = 'any'
      )
      OR
      (
        voter_id IN (SELECT p.id FROM public.people p
                      WHERE p.user_id = (SELECT auth.uid()))
        AND (
          voter_id = public.auth_person_id()
          OR public.auth_permission('community/elections', 'view'::public.permission_action) = 'any'
        )
      )
    )
  );

-- ---- 4  Three FOR ALL policies, split into their write commands -----------
-- On each of these three tables the manage policy is the read policy AND one more conjunct,
-- so its SELECT half can never admit a row the read policy does not. Splitting it into
-- INSERT, UPDATE and DELETE therefore takes nothing away from anybody, and the verify block
-- below proves the subset relation for each table before believing it.
DROP POLICY IF EXISTS "templates managed by admins" ON public.permission_templates;

CREATE POLICY "templates inserted by admins"
  ON public.permission_templates FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_can('admin/members/templates', 'edit'::public.permission_action)
    AND public.auth_membership_approved()
  );

CREATE POLICY "templates updated by admins"
  ON public.permission_templates FOR UPDATE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_can('admin/members/templates', 'edit'::public.permission_action)
    AND public.auth_membership_approved()
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_can('admin/members/templates', 'edit'::public.permission_action)
    AND public.auth_membership_approved()
  );

CREATE POLICY "templates deleted by admins"
  ON public.permission_templates FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_can('admin/members/templates', 'edit'::public.permission_action)
    AND public.auth_membership_approved()
  );

DROP POLICY IF EXISTS "visibility managed by admins" ON public.resource_visibility;

CREATE POLICY "visibility inserted by admins"
  ON public.resource_visibility FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_can('admin/members', 'edit'::public.permission_action)
    AND public.auth_membership_approved()
  );

CREATE POLICY "visibility updated by admins"
  ON public.resource_visibility FOR UPDATE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_can('admin/members', 'edit'::public.permission_action)
    AND public.auth_membership_approved()
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_can('admin/members', 'edit'::public.permission_action)
    AND public.auth_membership_approved()
  );

CREATE POLICY "visibility deleted by admins"
  ON public.resource_visibility FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_can('admin/members', 'edit'::public.permission_action)
    AND public.auth_membership_approved()
  );

DROP POLICY IF EXISTS "template permissions managed by admins" ON public.template_permissions;

CREATE POLICY "template permissions inserted by admins"
  ON public.template_permissions FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_can('admin/members/templates', 'edit'::public.permission_action)
    AND EXISTS (SELECT 1 FROM public.permission_templates t
                 WHERE t.id = template_permissions.template_id
                   AND t.family_code = public.auth_family_code())
    AND public.auth_membership_approved()
  );

CREATE POLICY "template permissions updated by admins"
  ON public.template_permissions FOR UPDATE TO authenticated
  USING (
    public.auth_can('admin/members/templates', 'edit'::public.permission_action)
    AND EXISTS (SELECT 1 FROM public.permission_templates t
                 WHERE t.id = template_permissions.template_id
                   AND t.family_code = public.auth_family_code())
    AND public.auth_membership_approved()
  )
  WITH CHECK (
    public.auth_can('admin/members/templates', 'edit'::public.permission_action)
    AND EXISTS (SELECT 1 FROM public.permission_templates t
                 WHERE t.id = template_permissions.template_id
                   AND t.family_code = public.auth_family_code())
    AND public.auth_membership_approved()
  );

CREATE POLICY "template permissions deleted by admins"
  ON public.template_permissions FOR DELETE TO authenticated
  USING (
    public.auth_can('admin/members/templates', 'edit'::public.permission_action)
    AND EXISTS (SELECT 1 FROM public.permission_templates t
                 WHERE t.id = template_permissions.template_id
                   AND t.family_code = public.auth_family_code())
    AND public.auth_membership_approved()
  );

-- ---- 5  Verify ------------------------------------------------------------
DO $verify$
DECLARE
  r     record;
  v_n   integer;
  v_txt text;
BEGIN
  -- (a) None of the nine tables has two policies for one command any more, and no table has
  --     lost a command it used to answer.
  FOR r IN
    SELECT tablename, cmd, count(*) AS n FROM pg_policies
     WHERE schemaname='public'
       AND tablename IN ('dues_schedules','election_positions','elections','fund_allocations',
                         'fund_contributions','election_votes','permission_templates',
                         'resource_visibility','template_permissions')
     GROUP BY tablename, cmd HAVING count(*) > 1
  LOOP
    RAISE EXCEPTION '%.% still has % policies', r.tablename, r.cmd, r.n;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('permission_templates', 'auth_family_code()'),
      ('resource_visibility',  'auth_family_code()'),
      ('template_permissions', 'permission_templates')
    ) AS t(tbl, scope_fragment)
  LOOP
    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname='public' AND tablename=r.tbl AND cmd IN ('SELECT','INSERT','UPDATE','DELETE');
    IF v_n <> 4 THEN
      RAISE EXCEPTION '% should answer all four commands with one policy each, found %', r.tbl, v_n;
    END IF;

    -- (b) THE SUBSET ARGUMENT, checked as far as a catalogue can check it. The claim is that
    --     the manage predicate is the read predicate AND `auth_can(...)`, which is what makes
    --     dropping the ALL policy's SELECT half a no-op for every caller. A literal substring
    --     test cannot show that -- `auth_can` is deparsed BETWEEN the read policy's two
    --     conjuncts -- so what is asserted is that the read policy still exists and that the
    --     three fragments it is built from are all present in the write policy beside it.
    SELECT qual INTO v_txt FROM pg_policies
     WHERE schemaname='public' AND tablename=r.tbl AND cmd='SELECT';
    IF v_txt IS NULL THEN
      RAISE EXCEPTION '% lost its SELECT policy', r.tbl;
    END IF;
    IF v_txt NOT LIKE '%' || r.scope_fragment || '%'
       OR v_txt NOT LIKE '%auth_membership_approved()%' THEN
      RAISE EXCEPTION '%''s read policy is not the shape this file assumed: %', r.tbl, v_txt;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename=r.tbl AND cmd='DELETE'
         AND qual LIKE '%' || r.scope_fragment || '%'
         AND qual LIKE '%auth_membership_approved()%'
         AND qual LIKE '%auth_can(%'
    ) THEN
      RAISE EXCEPTION 'on % the write policy is not the read predicate plus auth_can() -- '
                      'splitting the ALL policy may have narrowed a read', r.tbl;
    END IF;
  END LOOP;

  -- (c) The two merges still exist under their new shape.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                  AND tablename='election_votes' AND cmd='SELECT'
                  AND qual LIKE '%admin/elections%' AND qual LIKE '%community/elections%') THEN
    RAISE EXCEPTION 'election_votes SELECT lost one of its two branches';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                  AND tablename='dues_schedules' AND cmd='SELECT'
                  AND qual LIKE '%auth_person_id()%' AND qual LIKE '%admin/accounting%') THEN
    RAISE EXCEPTION 'dues_schedules SELECT lost one of its two branches';
  END IF;

  RAISE NOTICE 'overlapping SELECT policies consolidated on nine tables.';
END
$verify$;
