-- ============================================================================
-- The Journal: notes that belong to an OFFICE, not to the person holding it.
--
-- ── THE ONE SENTENCE THE WHOLE SCHEMA IS BUILT ON ───────────────────────────
--
--     "The notes follow the position, not the member."
--
-- So an entry hangs off `family_roles.id` and NOT off `people.id`. A treasurer writes down
-- how the bank reconciliation actually works; three years later a different treasurer opens
-- the Journal and it is there. That is the feature, and it is the reason every design
-- decision below goes the way it does:
--
--   * `role_id` is the parent. `author_id` is PROVENANCE — who wrote it — and is
--     ON DELETE SET NULL, so a member leaving the family does not take the office's notes
--     with them. An `author_id` that cascaded would delete the handover the moment the person
--     who wrote it was removed, which is exactly backwards.
--   * There is no `person_id`, no "my journal", and no way to address an entry to a member.
--     A note to yourself is a note; this is the office's record.
--   * WHO MAY READ IT IS A FACT ABOUT `user_roles`, not a permission scope. Whoever holds the
--     office today reads everything the office has ever recorded.
--
-- ── WHY NO SCOPE ON THE POLICY WIDENS IT, NOT EVEN AN ADMINISTRATOR'S ───────
-- `journal:view` at 'any' does NOT let somebody read an office they do not hold. That is
-- unusual here and it is deliberate: these are working notes — half-finished reconciliations,
-- what went wrong at the last reunion, who to call about the hall — and a family that could
-- read every officer's notebook would get officers who keep their notebook somewhere else.
--
-- The KEY still does real work, and §2c is what says what: it gates the SCREEN (`requireView`
-- on the page, and whether the rail item appears at all), so a family can switch the Journal
-- off entirely. It does NOT gate the rows — the policies below do, on `auth_holds_family_role`
-- — and this file writes NO `permission_table_map` row precisely so no future policy sweep
-- composes an `auth_permission('journal', …)` factor onto this table and quietly widens it.
-- §9 asserts that absence in both directions, the way 20260819000008 does for `family-tree`.
--
-- ── EDITING AND DELETING ARE THE AUTHOR'S, WHICH IS NOT A CONTRADICTION ─────
-- Any holder may READ everything and ADD. Only the author may EDIT or DELETE what they wrote.
-- That looks like it fights "the notes follow the position" and does not: the office owns the
-- RECORD, and a record a successor can quietly rewrite is not one. A successor who disagrees
-- with a predecessor's note adds a new entry — the same argument `reopenGatheringTask` is
-- written on ("a denial is never an edit of the refused submission"), and the same one behind
-- `election_nomination_supporters` refusing to let anybody retract somebody else's nomination.
--
-- An author who has LEFT the office keeps neither: `auth_holds_family_role` is a conjunct of
-- every policy here, so a former treasurer cannot edit the treasurer's journal from outside.
-- Their entries stay, which is the point.
--
-- ── A NEW `permission_resources` CATEGORY, AND WHY THAT IS SAFE ─────────────
-- `journal`. AGENTS.md warns that `permission_resources.category` is load-bearing in SQL and
-- not merely a grouping — but the load it bears is ONE comparison: `auth_permission()` reads
-- `category = 'admin'` to decide whether an unregistered-visibility key fails closed. A new
-- NON-admin category changes no resolution anywhere, and 20260817000004's invariant
-- (`(category = 'admin') IS DISTINCT FROM (key LIKE 'admin/%')` finds nothing) holds in both
-- directions for a `journal` key at category `journal`. §9 re-asserts it.
--
-- It gets its own category rather than joining `community` so the permission grid's heading
-- matches the rail's — "an administrator matching a switch to the thing it switches off
-- should not have to translate". `components/admin/resource-groups.ts` gains the label and
-- the order in the same commit.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
-- §9's assertions read the CATALOGUE and §10 runs the guard against real rows, and neither
-- can say a policy refuses the right caller — a migration executes as the table owner and RLS
-- does not apply to the owner. That is `tests/rls`' job, and all four policies were checked by
-- deleting one conjunct at a time and re-running the suite:
--
--   the SELECT policy's `auth_holds_family_role`
--     `journal.getJournalEntries (an office they do not hold)` goes red — and the
--     cross-family case beside it stays GREEN, which is the pair working: one asserts the
--     office conjunct and one the family conjunct, and a policy could lose either alone.
--   the UPDATE policy's `author_id = auth_person_id()`
--     `journal.updateJournalEntry (an entry somebody else wrote)` goes red, attack and told
--   the DELETE policy's `author_id = auth_person_id()`
--     `journal.deleteJournalEntry (an entry somebody else wrote)` goes red
--   the INSERT policy's `auth_holds_family_role`
--     `journal.addJournalEntry (an office they do not hold)` goes red
--
-- THE ATTACKER ON THREE OF THE FOUR IS INSIDE THE FAMILY, which is why no cross-family case
-- could have found any of this. `alphaAdmin` holds `journal:view` at scope 'any' and does not
-- hold the office; `alphaOther` holds the office and did not write the entry. Those two are
-- the whole design, and a suite built only on the usual BRAVO attacker would report all four
-- mutations as green.
--
-- §10 was checked the same way — dropping the guard trigger makes it report
-- "the guard allowed an entry on another family's office".
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. Does the caller hold this office, in the family they are viewing? ────
-- The whole access model, in one function, so the four policies below cannot drift from each
-- other. SECURITY DEFINER with an empty search_path: it reads `user_roles`, which has its own
-- policies, and the answer must not depend on whether the caller can see the row.
--
-- IT IS GRANTED TO `authenticated`, and it must be: a function named in an RLS policy is
-- evaluated as the QUERYING role (AGENTS.md §2b rule 2), so without the grant every query
-- against this table dies with "permission denied for function" rather than being refused.
--
-- THE FAMILY IS RESOLVED HERE, NOT PASSED IN. `auth_family_code()` answers the family the
-- caller is currently viewing, so an office id from another family cannot match — which is
-- what makes the policies' own `family_code` conjunct a second layer rather than the only one.
CREATE OR REPLACE FUNCTION public.auth_holds_family_role(p_role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
     WHERE ur.role_id = p_role_id
       AND ur.user_id = (SELECT auth.uid())
       AND ur.family_code = public.auth_family_code()
  );
$$;

REVOKE ALL ON FUNCTION public.auth_holds_family_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_holds_family_role(uuid) TO authenticated;

-- ── 2. The table ────────────────────────────────────────────────────────────
-- `family_code` is carried even though `role_id` implies it, for the reason every other table
-- here carries one: it is what the policies scope on, and a join to `family_roles` inside four
-- predicates is a join per row. `tg_journal_entry_same_family` keeps the copy honest (§4).
CREATE TABLE IF NOT EXISTS public.position_journal_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code text        NOT NULL,
  -- THE PARENT. ON DELETE CASCADE: an office the family has retired takes its notes with it,
  -- which is the honest reading of "the notes follow the position" — there is no position left
  -- for them to follow.
  role_id     uuid        NOT NULL REFERENCES public.family_roles(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text        NOT NULL DEFAULT '',
  -- PROVENANCE, and ON DELETE SET NULL deliberately: a member leaving the family must not take
  -- the office's handover notes with them. Nullable for that reason, and the screens print
  -- "a former officer" where it is null rather than "Unknown".
  author_id   uuid        REFERENCES public.people(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT position_journal_entries_title_not_blank CHECK (btrim(title) <> '')
);

-- The one read this table exists for: every entry on one office, newest first.
CREATE INDEX IF NOT EXISTS position_journal_entries_role_idx
  ON public.position_journal_entries (role_id, created_at DESC);

ALTER TABLE public.position_journal_entries ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS position_journal_entries_updated_at ON public.position_journal_entries;
CREATE TRIGGER position_journal_entries_updated_at
  BEFORE UPDATE ON public.position_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. The guard trigger — AGENTS.md §4 in the database ─────────────────────
-- Two client-suppliable ids land on a row whose own `family_code` is the caller's, which is
-- exactly the shape §4 is about: every policy is satisfied and the ids point elsewhere.
--
--   `role_id`     an office in another family. The INSERT policy tests
--                 `auth_holds_family_role`, which resolves the family itself, so a browser
--                 cannot get this wrong — but the SERVICE ROLE ignores RLS and does not ignore
--                 triggers, and this is what stands under any admin-client write.
--   `author_id`   a person in another family. Provenance is printed on screen; a name from
--                 another family on an office's notes is a leak wearing a byline.
CREATE OR REPLACE FUNCTION public.tg_journal_entry_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role_family   text;
  v_author_family text;
BEGIN
  SELECT r.family_code INTO v_role_family
    FROM public.family_roles r WHERE r.id = NEW.role_id;
  IF v_role_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'position_journal_entries: role % belongs to family %, not %',
      NEW.role_id, COALESCE(v_role_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  IF NEW.author_id IS NOT NULL THEN
    SELECT p.family_code INTO v_author_family
      FROM public.people p WHERE p.id = NEW.author_id;
    IF v_author_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'position_journal_entries: author % belongs to family %, not %',
        NEW.author_id, COALESCE(v_author_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_journal_entry_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS position_journal_entries_same_family ON public.position_journal_entries;
CREATE TRIGGER position_journal_entries_same_family
  BEFORE INSERT OR UPDATE ON public.position_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_journal_entry_same_family();

-- ── 4. The four policies ────────────────────────────────────────────────────
-- Every one carries the same three conjuncts — the family, an approved membership, and
-- holding the office — and the two write policies add the author test. No
-- `auth_permission(...)` appears anywhere on this table, and that is the design (see the
-- header): the KEY gates the screen, these gate the rows.

-- 4a. READ: everything this office has ever recorded, to whoever holds it today. That IS the
--     feature — a successor opening a predecessor's notes.
DROP POLICY IF EXISTS "perm:officeholders can read the journal"
  ON public.position_journal_entries;
CREATE POLICY "perm:officeholders can read the journal"
  ON public.position_journal_entries FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_family_role(role_id)
  );

-- 4b. WRITE: a holder may add, and only under their own name. `author_id = auth_person_id()`
--     is a conjunct rather than an alternative, so nobody can file an entry under somebody
--     else's byline — the same shape `election_nomination_supporters`' INSERT policy uses, and
--     for the same reason (§2b: never take an identity as a parameter).
DROP POLICY IF EXISTS "perm:officeholders can add to the journal"
  ON public.position_journal_entries;
CREATE POLICY "perm:officeholders can add to the journal"
  ON public.position_journal_entries FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_family_role(role_id)
    AND author_id = public.auth_person_id()
  );

-- 4c. EDIT: the author's own entry, and only while they still hold the office. Both halves
--     matter — a successor may not rewrite a handover note, and a former officer may not edit
--     the office's journal from outside.
--
--     THE `WITH CHECK` IS NOT OPTIONAL. Without it an author could UPDATE `role_id` and move
--     their entry into an office they do not hold, or rewrite `author_id` and hand it to
--     somebody else — the USING clause only decides which rows may be touched, never what they
--     may become. Same trap as the storage policy that let an owner rename an object into
--     another folder (AGENTS.md, on `20260820000002`).
DROP POLICY IF EXISTS "perm:authors can edit their own journal entries"
  ON public.position_journal_entries;
CREATE POLICY "perm:authors can edit their own journal entries"
  ON public.position_journal_entries FOR UPDATE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_family_role(role_id)
    AND author_id = public.auth_person_id()
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_family_role(role_id)
    AND author_id = public.auth_person_id()
  );

-- 4d. DELETE: the same rule. A successor who disagrees with a predecessor adds an entry.
DROP POLICY IF EXISTS "perm:authors can delete their own journal entries"
  ON public.position_journal_entries;
CREATE POLICY "perm:authors can delete their own journal entries"
  ON public.position_journal_entries FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_family_role(role_id)
    AND author_id = public.auth_person_id()
  );

-- ── 4e. Table grants, stated ────────────────────────────────────────────────
-- Per §2c these record what the table is FOR and are not what makes it safe: Supabase's
-- default ACL on `public` hands both browser roles everything before this file runs. RLS above
-- is the entire boundary.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_journal_entries TO authenticated;
GRANT ALL                           ON public.position_journal_entries TO service_role;

-- ── 5. The resource, so a family can switch the Journal off ─────────────────
-- §6: a new permissioned surface needs a row, or it can never be restricted — a silent default
-- nobody can fix from the UI. Its own CATEGORY so the grid's heading matches the rail's; see
-- the header for why a new non-admin category changes no resolution anywhere.
--
-- `view` ALONE. `create`, `edit` and `delete` are NOT declared, and that is the rule AGENTS.md
-- states as "declare only the actions something reads": no policy on this table evaluates
-- `auth_permission`, so a write switch here would be a control nothing consults. Whether you
-- may write in the Journal is decided by whether you hold the office.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES ('journal', 'Journal', 'journal', NULL, 10,
        ARRAY['view']::public.permission_action[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 6. Every existing template gets the row, and every family a visibility row ──
-- §6 again, and this is the half that is easy to forget: a resource registered after
-- `20260807000000` has no row in the templates that already exist, so it falls back to
-- `resource_visibility` — which is a working default and not a complete one. The grid on
-- Members & Access shows the whole answer, and a blank cell would be a lie.
--
-- NOT RESTRICTED. `journal` stays out of `v_restricted` and gets no 'restricted' visibility
-- row, so `view` resolves to 'everyone' — which is right because the KEY does not decide who
-- reads what. The policies do, on the office. A restricted default would mean an administrator
-- had to grant a key that grants nothing, to unhide a screen whose content is already
-- correctly empty for anybody with no office.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, 'journal', 'view'::public.permission_action,
       CASE WHEN t.is_system AND t.name = 'Administrators'
            THEN 'any'::public.permission_scope
            ELSE 'any'::public.permission_scope END
  FROM public.permission_templates t
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, 'journal', 'everyone'
  FROM public.people p
 WHERE p.family_code IS NOT NULL AND p.family_code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 7. Families created later get it from the seeder ────────────────────────
-- The half §6 covers for today's families. `seed_family_permission_templates()` writes a row
-- for every resource and every action it declares, from `permission_resources` — so a new
-- resource is picked up with NO edit to the function, provided it is not one of the two things
-- the body names by hand. `journal` is neither: it is not in `v_restricted` and it is not in
-- the General VALUES list, so the fall-through at the foot of that function grants `view` at
-- 'any' and Administrators get it from the CROSS JOIN above it.
--
-- SO THERE IS NOTHING TO REWRITE HERE, and §9 asserts that rather than assuming it — the
-- failure mode of being wrong is a family created tomorrow whose members cannot open a screen
-- every existing family can.

-- ── 8. Nothing about staff, and nothing about the tier ─────────────────────
-- No `genorra_staff` involvement: this is family data like any other. The TIER lives in
-- `lib/features.ts` (`plus`, matching Board Positions and Organization — a Journal in a family
-- that cannot record an office would be a screen that can never have content), and no policy
-- consults `families.tier`, which AGENTS.md says none may start to.

-- ── 9. The assertions ───────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_bad text;
  v_n   int;
BEGIN
  -- ── mutations observed, one line changed in each:
  --   the SELECT policy's `auth_holds_family_role` conjunct removed
  --     ERROR: the journal SELECT policy does not test who holds the office
  --   the INSERT policy's `author_id = auth_person_id()` conjunct removed
  --     ERROR: the journal INSERT policy does not pin author_id to the caller
  --   the UPDATE policy's WITH CHECK dropped
  --     ERROR: the journal UPDATE policy has no WITH CHECK — a row could be moved to
  --            another office
  --   a permission_table_map row added for `journal`
  --     ERROR: journal must have no permission_table_map row — the key gates the screen,
  --            the policies gate the rows
  --   the EXECUTE grant on auth_holds_family_role revoked
  --     ERROR: auth_holds_family_role() is not executable by `authenticated` — every
  --            journal query would fail rather than be refused

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public'
                    AND c.relname = 'position_journal_entries'
                    AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'position_journal_entries has no row level security';
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'position_journal_entries';
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'expected 4 policies on position_journal_entries, found %', v_n;
  END IF;

  -- THE CONJUNCTS, READ BACK AS TEXT. Each is a sentence in the header that would otherwise
  -- be documentation of an intention.
  SELECT qual INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'position_journal_entries'
     AND policyname = 'perm:officeholders can read the journal';
  IF v_bad IS NULL OR v_bad NOT LIKE '%auth_holds_family_role%' THEN
    RAISE EXCEPTION 'the journal SELECT policy does not test who holds the office';
  END IF;

  SELECT with_check INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'position_journal_entries'
     AND policyname = 'perm:officeholders can add to the journal';
  IF v_bad IS NULL OR v_bad NOT LIKE '%author_id = auth_person_id()%' THEN
    RAISE EXCEPTION 'the journal INSERT policy does not pin author_id to the caller';
  END IF;

  SELECT with_check INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'position_journal_entries'
     AND policyname = 'perm:authors can edit their own journal entries';
  IF v_bad IS NULL OR v_bad NOT LIKE '%auth_holds_family_role%' THEN
    RAISE EXCEPTION
      'the journal UPDATE policy has no WITH CHECK — a row could be moved to another office';
  END IF;

  -- NO POLICY HERE EVALUATES THE PERMISSION KEY, in either direction. This is the assertion
  -- the header's whole access argument rests on: the key gates the SCREEN and must never come
  -- to gate the rows, because `journal:view` defaults to 'everyone'.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'position_journal_entries'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%auth_permission%')
  THEN
    RAISE EXCEPTION 'a journal policy evaluates auth_permission() — see this file''s header';
  END IF;

  IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE resource_key = 'journal')
     OR EXISTS (SELECT 1 FROM public.permission_table_map
                 WHERE table_name = 'position_journal_entries') THEN
    RAISE EXCEPTION
      'journal must have no permission_table_map row — the key gates the screen, the policies gate the rows';
  END IF;

  -- The guard trigger and the timestamp trigger.
  SELECT string_agg(t, ', ' ORDER BY t) INTO v_bad
    FROM unnest(ARRAY['position_journal_entries_same_family',
                      'position_journal_entries_updated_at']) AS t
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
      WHERE c.relname = 'position_journal_entries' AND g.tgname = t AND NOT g.tgisinternal);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'position_journal_entries is missing trigger(s): %', v_bad;
  END IF;

  -- ── §2b: the helper is reachable from a browser, and the trigger function is not ──
  IF NOT has_function_privilege('authenticated', 'public.auth_holds_family_role(uuid)', 'EXECUTE')
  THEN
    RAISE EXCEPTION
      'auth_holds_family_role() is not executable by `authenticated` — every journal query would fail rather than be refused';
  END IF;
  IF has_function_privilege('anon', 'public.auth_holds_family_role(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'auth_holds_family_role() is executable by anon';
  END IF;
  IF has_function_privilege('anon', 'public.tg_journal_entry_same_family()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.tg_journal_entry_same_family()', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'tg_journal_entry_same_family() is executable by a browser role';
  END IF;

  -- Both new functions set an empty search_path. `SET search_path = ''` lands in proconfig as
  -- `search_path=""` — with the empty string QUOTED — which 20260821000004 learned by
  -- asserting the bare form and reporting a fault in correct code.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('auth_holds_family_role', 'tg_journal_entry_same_family')
     AND NOT EXISTS (
       SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg IN ('search_path=""', 'search_path='));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'function(s) with a mutable search_path: %', v_bad;
  END IF;

  -- ── §6: the resource, its category, and the grants that make the screen openable ──
  SELECT category INTO v_bad FROM public.permission_resources WHERE key = 'journal';
  IF v_bad IS DISTINCT FROM 'journal' THEN
    RAISE EXCEPTION 'the journal resource is missing or carries category %',
      COALESCE(v_bad, 'none');
  END IF;

  -- `permission_resources.actions` IS `text[]`, not `permission_action[]` — the INSERT above
  -- casts and Postgres accepts it, while a `<>` between the two types is 42883 with no
  -- implicit cast to save it. Compared as text for that reason; found by this file failing to
  -- apply, which is the assertion earning its place before it has ever caught anything else.
  IF EXISTS (SELECT 1 FROM public.permission_resources
              WHERE key = 'journal' AND actions <> ARRAY['view']::text[])
  THEN
    RAISE EXCEPTION
      'journal must declare `view` only — no policy reads a write scope, so a write switch would be a control nothing consults';
  END IF;

  -- Every template has the row, or the grid renders a blank cell for a resource that exists.
  SELECT count(*) INTO v_n FROM public.permission_templates t
   WHERE NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                      WHERE tp.template_id = t.id AND tp.resource_key = 'journal');
  IF v_n > 0 THEN
    RAISE EXCEPTION '% template(s) carry no journal grant', v_n;
  END IF;

  -- THE INVARIANT 20260817000004 RESTS ON, re-asserted because this file adds a category.
  SELECT string_agg(format('%s (category=%s)', key, category), ', ' ORDER BY key) INTO v_bad
    FROM public.permission_resources
   WHERE (category = 'admin') IS DISTINCT FROM (key LIKE 'admin/%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'category and key shape disagree for: % — see 20260817000004', v_bad;
  END IF;

  SELECT string_agg(DISTINCT category, ', ') INTO v_bad
    FROM (SELECT category, sort_order FROM public.permission_resources
           GROUP BY category, sort_order HAVING count(*) > 1) d;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'two resources share a sort_order in: %', v_bad;
  END IF;

  -- §7's claim: the seeder needs no edit, because it derives from `permission_resources` and
  -- names neither `journal` nor its category by hand. Asserted rather than assumed — the cost
  -- of being wrong is a family created tomorrow whose members cannot open a screen every
  -- existing family can.
  IF EXISTS (
    SELECT 1 FROM pg_proc pp JOIN pg_namespace n ON n.oid = pp.pronamespace
     WHERE n.nspname = 'public' AND pp.proname = 'seed_family_permission_templates'
       AND pg_get_functiondef(pp.oid) LIKE '%''journal''%') THEN
    RAISE EXCEPTION
      'seed_family_permission_templates() names journal by hand — it should derive it';
  END IF;

  RAISE NOTICE 'position_journal_entries: 4 policies, 2 triggers, journal resource registered';
END $mig$;

-- ── 10. The policies and the guard, exercised for real ──────────────────────
-- §9 reads the catalogue; this runs the rules. A migration executes as the table OWNER and RLS
-- does not apply to the owner, so what CAN be tested here is the half the service role also
-- obeys — the guard trigger — plus the helper function's own answer, which is what all four
-- policies turn on. The policies themselves are attacked by a real member in `tests/rls`.
--
-- Everything is rolled back through a sentinel compared BY MESSAGE, so a genuine failure above
-- is re-raised rather than swallowed by the handler.
DO $mig$
DECLARE
  v_family  text := 'JRNLVERIFY';
  v_person  uuid;
  v_foreign uuid;
  v_role    uuid;
  v_other   uuid;
  v_caught  text;
BEGIN
  BEGIN
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
    VALUES (v_family, 'Journal', 'Officer', 'jrnl1@example.invalid') RETURNING id INTO v_person;
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
    VALUES (v_family || 'X', 'Journal', 'Outsider', 'jrnl2@example.invalid')
    RETURNING id INTO v_foreign;

    INSERT INTO public.family_roles (family_code, name, category, sort_order)
    VALUES (v_family, 'Verify Treasurer', 'executive_officer', 1) RETURNING id INTO v_role;
    INSERT INTO public.family_roles (family_code, name, category, sort_order)
    VALUES (v_family || 'X', 'Verify Outsider Office', 'executive_officer', 1)
    RETURNING id INTO v_other;

    -- 10a. The ordinary row goes in.
    INSERT INTO public.position_journal_entries (family_code, role_id, title, body, author_id)
    VALUES (v_family, v_role, 'Handover', 'Where the bank statements live.', v_person);

    -- 10b. The guard refuses an office in another family.
    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_entries (family_code, role_id, title, author_id)
      VALUES (v_family, v_other, 'Wrong office', v_person);
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL OR v_caught NOT LIKE '%belongs to family%' THEN
      RAISE EXCEPTION 'VERIFY: the guard allowed an entry on another family''s office (%)',
        COALESCE(v_caught, 'no error raised');
    END IF;

    -- 10c. And an author from another family.
    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_entries (family_code, role_id, title, author_id)
      VALUES (v_family, v_role, 'Wrong author', v_foreign);
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL OR v_caught NOT LIKE '%belongs to family%' THEN
      RAISE EXCEPTION 'VERIFY: the guard allowed a cross-family author (%)',
        COALESCE(v_caught, 'no error raised');
    END IF;

    -- 10d. A blank title is refused by the CHECK rather than stored as an untitled note.
    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_entries (family_code, role_id, title, author_id)
      VALUES (v_family, v_role, '   ', v_person);
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL THEN
      RAISE EXCEPTION 'VERIFY: a blank title was accepted';
    END IF;

    -- 10e. RETIRING THE OFFICE TAKES ITS NOTES, which is the honest reading of "the notes
    --      follow the position" — there is no position left for them to follow.
    DELETE FROM public.family_roles WHERE id = v_role;
    IF EXISTS (SELECT 1 FROM public.position_journal_entries WHERE role_id = v_role) THEN
      RAISE EXCEPTION 'VERIFY: journal entries survived the office being retired';
    END IF;

    RAISE NOTICE 'position_journal_entries: guard and cascade verified for real';
    RAISE EXCEPTION 'JRNLVERIFY_ROLLBACK';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'JRNLVERIFY_ROLLBACK' THEN
        RAISE;
      END IF;
  END;
END $mig$;

COMMIT;
