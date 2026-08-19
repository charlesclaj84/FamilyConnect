-- ============================================================================
-- Board positions become a family's own list. The 25 built-ins go, `family_roles`
-- stops being a hybrid, and its SELECT policy stops publishing one family's list
-- to another.
--
-- ── WHAT WAS WRONG, IN THREE SEPARATE WAYS ──────────────────────────────────
--
-- 1. `family_roles_name_key` IS `UNIQUE (name)` ALONE, ACROSS EVERY FAMILY.
--    `20260604000000` created the table with `name TEXT NOT NULL UNIQUE` before
--    there was a `family_code` column at all; `20260604000002` added the column
--    and never revisited the constraint. So two families cannot both call a role
--    "Reunion Treasurer" — the second gets a raw 23505 — and, sharper, ONE family
--    creating a role named 'President' takes that name off the built-in list for
--    EVERY other family forever, because `seed_global_lookups()` is
--    `ON CONFLICT (name) DO NOTHING`. `20260817000003` §4a had to be rewritten
--    around that collision and its RAISE WARNING names this migration's job.
--
--    The fixture in `tests/rls/seed.mjs` is the standing evidence it already
--    bites: its custom positions are called `ALPHATEST Historian` and
--    `BRAVOTEST Historian`, because two families cannot both seed "Historian".
--
-- 2. THE SELECT POLICY HAS NO FAMILY CONJUNCT. `20260604000000` wrote
--    `USING (true)` — correct for a table that was 25 identical global rows —
--    `20260615000004` never revisited it, and `20260618000001`'s sweep faithfully
--    preserved the `true`, producing:
--
--      perm:authenticated can read roles
--        USING ((true) AND (false OR auth_permission('admin/boardpositions','view') = 'any'
--                                 OR (… = 'own' AND false)))
--
--    So anybody holding that grant IN THEIR OWN FAMILY can read EVERY family's
--    board positions straight off PostgREST. Every other family-scoped table in
--    that map carries `family_code = auth_family_code()` underneath; this one is
--    the hybrid, so it never got one. Names only, and tolerable while the table
--    was a global lookup — and it is the whole content of the table once the list
--    is per-family. **This is the cross-pollination**, not `user_roles`, which has
--    carried a `family_code` since the day it was created.
--
-- 3. `family_role_exclusions` EXISTS ONLY TO HIDE GLOBAL ROWS. A row there means
--    "this family does not use that built-in position". With no built-ins there is
--    nothing to opt out of: a family deletes a position it does not want.
--
-- ── THE DECISION: A FAMILY STARTS WITH NO POSITIONS ─────────────────────────
-- Taken 2026-08-19. The 25 names are not moved, not offered as a preset and not
-- suggested in the form — they are gone. A family configures the positions it
-- actually has, which is the only version of this table that can be per-family
-- without the hybrid coming back.
--
-- THAT IS NOT THE SAME AS DESTROYING WHAT A FAMILY ALREADY USES, and §2 below is
-- the difference. Both foreign keys into this table are `ON DELETE CASCADE`
-- (`user_roles_role_id_fkey`, `family_role_exclusions_role_id_fkey`), so deleting
-- the globals outright would silently strip every officer of their seat with no
-- record anywhere — this is the opposite of `relationship_types`, whose inbound FK
-- RESTRICTs and would have refused. So every built-in position a family has
-- actually ASSIGNED becomes that family's own row and the assignment is repointed
-- at it. A family that has assigned none starts empty, which is the decision; a
-- family with a President keeps its President.
--
-- ── WHY THIS EMPTIES A "GLOBAL LOOKUP" AND THAT IS NOT THE INCIDENT ─────────
-- AGENTS.md's "Four tables in `public` are product data" is written about exactly
-- this table, and `20260817000003` exists because a purge emptied it on hosted and
-- nothing could put it back. Read together with this file the two are consistent:
-- that migration restored rows the product still claimed to offer, and this one
-- retires the claim. What must move WITH the decision, in this commit, is every
-- place that asserts those rows exist — otherwise the next merge to `master` goes
-- red after `db push` has already applied the schema:
--
--   supabase/scripts/audit_global_lookups.sql   family_roles leaves the lookup list
--                                              (it RAISEs on zero, and it is a step
--                                              in migrate.yml, so it holds the alias)
--   supabase/scripts/truncate_entire_database.sql
--                                              leaves the keep-list; §6b's special
--                                              case for its global half goes; §3's
--                                              partial DELETE becomes redundant
--   supabase/scripts/reset_families.sql        §7 deletes the table outright; §11's
--                                              keep-list entry goes
--   §7 below                                   `seed_global_lookups()` stops seeding
--                                              it, and its COMMENT stops saying it does
--
-- THE CHAIN ORDER MAKES THE APPLIED MIGRATIONS SAFE, and it is worth stating
-- because the reflex is that this file contradicts them. `20260817000003` runs
-- EARLIER: on a fresh `db reset` it seeds its 25 rows and its §4a assertion passes,
-- and only then does this file delete them. Editing that applied file was neither
-- needed nor allowed to help (an edit to an applied migration reaches fresh
-- databases only).
--
-- ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────
-- No INSERT, UPDATE or DELETE policy is added. Per AGENTS.md §2c a table with no
-- policy for a command denies it to the browser outright, and every write to
-- `family_roles` goes through a server action on the service-role client that
-- re-applies family scoping by hand. Adding write policies would be adding a
-- second, weaker way in.
--
-- IDEMPOTENT. Every step is `IF EXISTS` / `IF NOT EXISTS` or keyed on state that
-- the step itself removes, so a second run changes nothing. Safe on an empty
-- database: §2 and §3 match no rows and the DDL still applies.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See
--   AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. Say out loud what is about to happen ─────────────────────────────────
-- This migration destroys data on hosted (the built-in rows) and rewrites data
-- (assignments repointed). Nothing else in the chain can report that afterwards,
-- so it is counted here and printed. A NOTICE rather than an assertion: every
-- count below is legitimately zero on a laptop and legitimately non-zero on
-- hosted, so there is no value to refuse on.
DO $mig$
DECLARE
  v_globals     bigint;
  v_assigned    bigint;
  v_families    bigint;
  v_exclusions  bigint;
  v_collisions  text;
BEGIN
  SELECT count(*) INTO v_globals    FROM public.family_roles WHERE family_code IS NULL;
  SELECT count(*) INTO v_assigned   FROM public.user_roles ur
    JOIN public.family_roles fr ON fr.id = ur.role_id WHERE fr.family_code IS NULL;
  SELECT count(DISTINCT ur.family_code) INTO v_families FROM public.user_roles ur
    JOIN public.family_roles fr ON fr.id = ur.role_id WHERE fr.family_code IS NULL;
  SELECT count(*) INTO v_exclusions FROM public.family_role_exclusions;

  RAISE NOTICE 'board positions: % built-in row(s) to retire; % assignment(s) across % family(ies) '
    'will be repointed at a family-owned copy; % exclusion row(s) will go with the table',
    v_globals, v_assigned, v_families, v_exclusions;

  -- A family that already owns a row with the same name as a built-in it has
  -- assigned. §2 must NOT create a second one; it repoints at the row that exists.
  -- Reported because it is the residue of problem 1 above and is worth seeing.
  SELECT string_agg(DISTINCT format('%s/%s', ur.family_code, fr.name), ', ')
    INTO v_collisions
    FROM public.user_roles ur
    JOIN public.family_roles fr ON fr.id = ur.role_id
   WHERE fr.family_code IS NULL
     AND EXISTS (SELECT 1 FROM public.family_roles own
                  WHERE own.family_code = ur.family_code AND own.name = fr.name);
  IF v_collisions IS NOT NULL THEN
    RAISE NOTICE 'board positions: family already owns a row of the same name, repointing at it '
      'rather than duplicating: %', v_collisions;
  END IF;
END $mig$;

-- ── 1b. The global UNIQUE has to go FIRST ───────────────────────────────────
-- Before §2 and not after: while `UNIQUE (name)` stands, inserting a family-owned
-- 'President' collides with the built-in 'President' this migration has not
-- deleted yet. The new per-family index is created in §5, once the rows are in the
-- shape it describes.
ALTER TABLE public.family_roles DROP CONSTRAINT IF EXISTS family_roles_name_key;

-- ── 2. Every built-in a family actually uses becomes that family's own ──────
-- Two statements. The first gives each (family, assigned built-in) pair a real row
-- unless the family already owns one by that name; the second repoints the
-- assignments at whichever row now holds the name. Both are driven off
-- `user_roles`, so a built-in nobody was given is not copied anywhere — that is
-- what "a family starts with no positions" means for an existing family.
-- `is_global` IS DELIBERATELY NOT NAMED, and the omission is what keeps this file
-- idempotent. §5 drops that column, so a second run of a statement naming it fails at
-- analysis before its `WHERE fr.family_code IS NULL` can match zero rows — which would have
-- made the header's IDEMPOTENT claim false on the one statement that is not `IF EXISTS`.
-- The column is `NOT NULL DEFAULT false` while it exists, so leaving it out inserts the
-- same value.
INSERT INTO public.family_roles (name, category, sort_order, scope, family_code)
SELECT DISTINCT fr.name, fr.category, fr.sort_order, fr.scope, ur.family_code
  FROM public.user_roles ur
  JOIN public.family_roles fr ON fr.id = ur.role_id
 WHERE fr.family_code IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.family_roles own
      WHERE own.family_code = ur.family_code AND own.name = fr.name);

UPDATE public.user_roles ur
   SET role_id = own.id
  FROM public.family_roles built_in, public.family_roles own
 WHERE ur.role_id = built_in.id
   AND built_in.family_code IS NULL
   AND own.family_code = ur.family_code
   AND own.name = built_in.name;

-- ── 3. The built-ins go ─────────────────────────────────────────────────────
-- Asserted first, because the CASCADE is silent: if any assignment still names a
-- built-in, deleting it would take the assignment with it and nothing would say so.
DO $mig$
DECLARE v_left bigint;
BEGIN
  SELECT count(*) INTO v_left
    FROM public.user_roles ur
    JOIN public.family_roles fr ON fr.id = ur.role_id
   WHERE fr.family_code IS NULL;
  IF v_left > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % assignment(s) still name a built-in board position after §2, so deleting '
      'the built-ins would CASCADE them away. §2 repoints by (family_code, name) — a row whose '
      'family has no matching name is the case to look at.', v_left;
  END IF;
END $mig$;

DELETE FROM public.family_roles WHERE family_code IS NULL;

-- ── 4. `family_role_exclusions` retires with the thing it excluded ──────────
-- §3's CASCADE has just emptied it — every row referenced a built-in — so this
-- drops an empty table rather than data. The map row goes too: a
-- `permission_table_map` row naming a table that does not exist is precisely the
-- defect `20260819000003` cleared for `adults`, and leaving one behind here would
-- reintroduce it in the same afternoon.
DELETE FROM public.permission_table_map WHERE table_name = 'family_role_exclusions';
DROP TABLE IF EXISTS public.family_role_exclusions;

-- ── 5. The table stops being a hybrid ──────────────────────────────────────
-- `family_code` NOT NULL is the honest statement of "a position belongs to one
-- family", and it is also an assertion: it fails if §3 left a row behind.
ALTER TABLE public.family_roles ALTER COLUMN family_code SET NOT NULL;

-- `is_global` can no longer be true, and a column that can only hold one value is
-- the two-facts-that-disagree shape AGENTS.md §4b forbids (`is_minor` is the worked
-- example). Three readers branched on it and all three are rewritten in this
-- commit. Dropping without CASCADE deliberately: if anything else depends on the
-- column — a view, an index, a policy — this refuses rather than removing it.
ALTER TABLE public.family_roles DROP COLUMN IF EXISTS is_global;

-- Per-family uniqueness, with `family_code` LEADING. Both halves are deliberate:
-- the uniqueness is what problem 1 was about, and the column order is what makes
-- the index usable as a prefix for the read every caller now makes
-- (`WHERE family_code = …  ORDER BY sort_order`). `(name, family_code)` would
-- enforce the same constraint and index nothing anybody asks for.
--
-- NULLs are not a consideration any more, which is why this is a plain unique index
-- and not the partial-index-plus-global pair TODO.md sketched: Postgres treats NULLs
-- as distinct, so `UNIQUE (family_code, name)` alone would have permitted unlimited
-- duplicate built-ins — and `family_code` is NOT NULL as of the statement above.
CREATE UNIQUE INDEX IF NOT EXISTS family_roles_family_code_name_key
  ON public.family_roles (family_code, name);

-- A name is what the screen prints. An empty one is unreachable and undeletable in
-- the UI, and `createBoardPosition` used to accept `''` because only the client
-- checked — and the client is not in the request path.
ALTER TABLE public.family_roles DROP CONSTRAINT IF EXISTS family_roles_name_not_blank;
ALTER TABLE public.family_roles
  ADD CONSTRAINT family_roles_name_not_blank CHECK (btrim(name) <> '');

COMMENT ON TABLE public.family_roles IS
  'The board positions ONE family uses. Per-family since 20260819000004: there are no '
  'global rows, `family_code` is NOT NULL, and (family_code, name) is unique. Writes go '
  'through app/actions/admin/chapters.ts on the service role — there is no INSERT/UPDATE/'
  'DELETE policy, deliberately (AGENTS.md §2c).';

-- ── 6. The SELECT policy gains the family conjunct ─────────────────────────
-- Problem 2. The replacement is the composed predicate with the two conjuncts it
-- should always have had, written out longhand because the thing it replaces was
-- COMPOSED at migration time and exists in no file (AGENTS.md, incident 2).
--
-- Three notes on the translation, none of it a loosening:
--
--   * `auth_permission(…) = 'any'` is the WHOLE permission factor, exactly as the
--     composed policy resolved: `own_expr` and `self_expr` for this table are both
--     the literal 'false', so the `'own'` disjunct was `('own' AND false)` — dead.
--     Writing `OR = 'own'` here would GRANT something the old policy refused, so
--     the 'own' switch is removed from the grid instead
--     (`NO_OWNER_KEYS`, components/admin/resource-groups.ts).
--   * `auth_membership_approved()` is new and narrows. `auth_family_code()` resolves
--     for a PENDING member deliberately and permanently, so without it somebody who
--     had joined by family code and not been admitted could read the catalogue on
--     an Administrators template. Every table `20260806000011` §6 swept carries this
--     conjunct; `family_roles` was skipped there because its `self_expr` is 'false'.
--   * THE NAME IS KEPT, EXACTLY, AND THAT IS LOAD-BEARING RATHER THAN LAZY. It reads
--     oddly now — this policy is about a family, not about "authenticated" — and it stays
--     because `audit_policy_shadowing.sql` detects a hand-replayed migration by looking
--     for the PAIR (`x`, `perm:x`) on one table. `20260604000000` still carries a bare,
--     unguarded `CREATE POLICY "authenticated can read roles" … USING (true)`, and that
--     file being replayed against hosted by hand is the exact incident AGENTS.md records
--     for `20260602000000_families.sql`. Renaming this to something honest would leave the
--     replayed `USING (true)` policy with no `perm:` twin, so the audit in `migrate.yml`
--     would report clean while permissive policies OR-ed the hole straight back open — on
--     the one table this migration exists to close it on. The `perm:` prefix also keeps
--     `20260618000001`'s sweep from wrapping this a second time
--     (`policyname NOT LIKE 'perm:%'`).
DROP POLICY IF EXISTS "perm:authenticated can read roles" ON public.family_roles;
DROP POLICY IF EXISTS "authenticated can read roles"      ON public.family_roles;
CREATE POLICY "perm:authenticated can read roles"
  ON public.family_roles FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_permission('admin/boardpositions', 'view') = 'any'
  );

-- ── 7. `seed_global_lookups()` stops claiming to seed this table ────────────
-- `CREATE OR REPLACE` in a NEW migration, because editing `20260817000003` would
-- reach fresh databases only. Everything else about the function is unchanged and
-- restated rather than referenced: SECURITY INVOKER, `search_path = ''`, every
-- reference schema-qualified, no grant to `anon` or `authenticated` (default
-- privileges revoke EXECUTE since 20260806000015, and `CREATE OR REPLACE` does not
-- change privileges, so there is nothing to re-revoke).
--
-- `relationship_types` is the whole body now, and its comment is the reason the
-- function still exists: `person_relationships.relationship_type_id` is ON DELETE
-- RESTRICT, so those rows must be inserted-if-missing rather than replaced.
CREATE OR REPLACE FUNCTION public.seed_global_lookups()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  -- ── relationship_types ────────────────────────────────────────────────────
  -- The twenty from 20260602000003 in its order, then the three from
  -- 20260610000004. The first nine are `TREE_RELATIONSHIPS` in lib/family-tree.ts
  -- — the vocabulary the tree builder writes — so a name added there is a name
  -- that belongs here.
  --
  -- `person_relationships.relationship_type_id` is ON DELETE RESTRICT, so these
  -- rows must never be deleted-and-reinserted while any edge exists: the ids would
  -- change and the delete would be refused. Inserting what is missing is the only
  -- safe shape, which is another reason the purge EXCLUDES this table rather than
  -- emptying and refilling it.
  INSERT INTO public.relationship_types (name) VALUES
    ('Father'), ('Mother'),
    ('Paternal Grandfather'), ('Paternal Grandmother'),
    ('Maternal Grandfather'), ('Maternal Grandmother'),
    ('Son'), ('Daughter'),
    ('Grandson'), ('Granddaughter'),
    ('Brother'), ('Sister'),
    ('Uncle'), ('Aunt'),
    ('Nephew'), ('Niece'),
    ('Cousin'),
    ('Husband'), ('Wife'), ('Partner'),
    ('Ex-Husband'), ('Ex-Wife'), ('Ex-Partner')
  ON CONFLICT (name) DO NOTHING;

  -- ── family_roles IS NO LONGER A GLOBAL LOOKUP, and must not come back ─────
  -- 20260819000004 made board positions per-family: there are no rows with a NULL
  -- `family_code`, the column is NOT NULL, and the 25 built-in names are gone from
  -- the product. Re-adding an INSERT here would fail on the NOT NULL, and adding
  -- one WITH a family code would be this function inventing family data — which is
  -- the one thing a reseeder of product reference data must never do.
END $fn$;

COMMENT ON FUNCTION public.seed_global_lookups() IS
  'Idempotently restores the global lookup that can be stated as a closed vocabulary: '
  'relationship_types. The ONE authority for those rows — called by 20260817000003 '
  '(which is how it reached hosted) and by supabase/scripts/truncate_entire_database.sql '
  '(which is what makes a full purge survivable). It seeded family_roles until '
  '20260819000004 made board positions per-family, and must not seed it again. '
  'permission_resources and permission_table_map are deliberately NOT here: they are '
  'assembled by ~20 migrations and cannot be honestly copied. Grant nothing to anon or '
  'authenticated.';

-- ── 8. Verify, unconditionally ─────────────────────────────────────────────
-- Catalogue and row-count reads only, so nothing here needs a fixture and nothing
-- can skip itself into a false pass.
DO $mig$
DECLARE
  v_n       bigint;
  v_txt     text;
BEGIN
  -- 8a. No global rows, and none can be written.
  SELECT count(*) INTO v_n FROM public.family_roles WHERE family_code IS NULL;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % family_roles row(s) still have a NULL family_code', v_n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.family_roles'::regclass
       AND attname = 'family_code' AND NOT attnotnull AND attnum > 0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles.family_code is still nullable';
  END IF;

  -- 8b. `is_global` is gone.
  IF EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.family_roles'::regclass
       AND attname = 'is_global' AND attnum > 0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles.is_global survived';
  END IF;

  -- 8c. The old global UNIQUE is gone and the per-family one is here.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.family_roles'::regclass AND conname = 'family_roles_name_key'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles_name_key is still present — name is still globally unique';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'family_roles'
       AND indexname = 'family_roles_family_code_name_key'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles_family_code_name_key was not created';
  END IF;

  -- Prove it constrains rather than merely existing. Two families may share a name;
  -- one family may not repeat one. Asserted by asking the catalogue what the index
  -- is over, because inserting probe rows would need a family and this file has none.
  SELECT string_agg(a.attname, ',' ORDER BY k.ord) INTO v_txt
    FROM pg_index i
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
   WHERE i.indexrelid = 'public.family_roles_family_code_name_key'::regclass;
  IF v_txt IS DISTINCT FROM 'family_code,name' THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles_family_code_name_key is over (%), expected (family_code,name)', v_txt;
  END IF;

  -- 8d. The blank-name CHECK.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.family_roles'::regclass
       AND conname = 'family_roles_name_not_blank' AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles_name_not_blank is missing';
  END IF;

  -- 8e. The exclusions table and its catalogue row are both gone.
  IF to_regclass('public.family_role_exclusions') IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: family_role_exclusions still exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.permission_table_map WHERE table_name = 'family_role_exclusions'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: permission_table_map still maps family_role_exclusions';
  END IF;

  -- 8f. The SELECT policy, and the family conjunct specifically. Matched on the
  -- rendered text because that is the only place the composed predicate exists.
  SELECT p.qual INTO v_txt
    FROM pg_policies p
   WHERE p.schemaname = 'public' AND p.tablename = 'family_roles' AND p.cmd = 'SELECT';
  IF v_txt IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles has no SELECT policy — the table is now unreadable';
  END IF;
  IF v_txt NOT LIKE '%auth_family_code()%' THEN
    RAISE EXCEPTION 'ROLLBACK: the family_roles SELECT policy has no family_code conjunct: %', v_txt;
  END IF;
  IF v_txt NOT LIKE '%auth_membership_approved()%' THEN
    RAISE EXCEPTION 'ROLLBACK: the family_roles SELECT policy does not require an approved membership: %', v_txt;
  END IF;
  IF v_txt NOT LIKE '%admin/boardpositions%' THEN
    RAISE EXCEPTION 'ROLLBACK: the family_roles SELECT policy lost its permission factor: %', v_txt;
  END IF;

  -- THE NAME, because `audit_policy_shadowing.sql` is keyed on it. See §6: renaming this
  -- policy takes `family_roles` out of that audit's coverage, and `20260604000000`'s bare
  -- `USING (true)` policy is still replayable by hand.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'family_roles'
       AND policyname = 'perm:authenticated can read roles'
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: the family_roles SELECT policy is not named "perm:authenticated can read '
      'roles". That name is what audit_policy_shadowing.sql pairs with the bare policy '
      '20260604000000 still creates; renaming it silently removes this table from that audit.';
  END IF;

  -- Exactly one SELECT policy. Permissive policies are OR-ed, so a second one is
  -- how a family conjunct comes to decide nothing (incident 2).
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'family_roles' AND cmd = 'SELECT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles has % SELECT policies; permissive policies are OR-ed', v_n;
  END IF;

  -- And still no write policy, which is what denies the browser (§2c).
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'family_roles' AND cmd <> 'SELECT';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles gained % non-SELECT policy(ies); every write goes '
      'through a server action on the service role', v_n;
  END IF;

  -- 8g. The reseeder no longer touches this table. Asserted against the stored
  -- source, because the function is not called here and plpgsql resolves nothing
  -- until it runs — an INSERT left in the body would be invisible to every other
  -- check in this block.
  SELECT p.prosrc INTO v_txt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'seed_global_lookups';
  IF v_txt IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: seed_global_lookups() is missing';
  END IF;
  IF v_txt LIKE '%INSERT INTO public.family_roles%' THEN
    RAISE EXCEPTION 'ROLLBACK: seed_global_lookups() still inserts into family_roles';
  END IF;
  IF v_txt NOT LIKE '%INSERT INTO public.relationship_types%' THEN
    RAISE EXCEPTION 'ROLLBACK: seed_global_lookups() no longer seeds relationship_types';
  END IF;

  -- It must still RUN. The body changed, and plpgsql does not resolve names until
  -- the body runs — this is the 20260806000012 lesson, and the function's only
  -- other caller is a purge script nobody runs on a schedule.
  PERFORM public.seed_global_lookups();

  -- 8h. `user_roles` came through with every assignment intact and family-owned.
  SELECT count(*) INTO v_n
    FROM public.user_roles ur
    LEFT JOIN public.family_roles fr ON fr.id = ur.role_id
   WHERE fr.id IS NULL;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % user_roles row(s) name no board position', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.user_roles ur
    JOIN public.family_roles fr ON fr.id = ur.role_id
   WHERE fr.family_code IS DISTINCT FROM ur.family_code;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % assignment(s) point at a position belonging to another family', v_n;
  END IF;

  -- 8i. The resource is still registered with all four actions, and still maps
  -- `family_roles` and `user_roles`. Deleting the exclusions row must not have
  -- taken its neighbours.
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'admin/boardpositions') THEN
    RAISE EXCEPTION 'ROLLBACK: admin/boardpositions is not registered';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_table_map
     WHERE table_name = 'family_roles' AND resource_key = 'admin/boardpositions'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles is no longer mapped to admin/boardpositions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_table_map
     WHERE table_name = 'user_roles' AND resource_key = 'admin/boardpositions'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: user_roles is no longer mapped to admin/boardpositions';
  END IF;

  RAISE NOTICE 'board positions are per-family: no global rows, (family_code, name) unique, '
    'family conjunct on the SELECT policy, exclusions retired';
END $mig$;

COMMIT;
