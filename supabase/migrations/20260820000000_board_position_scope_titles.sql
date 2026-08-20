-- ============================================================================
-- One title, one per scope: "President" may exist at National, Regional and Chapter.
--
-- ── WHAT THIS CHANGES ───────────────────────────────────────────────────────
-- `family_roles` has been UNIQUE (family_code, name) since 20260819000004 made board
-- positions per-family. That is one title per family, full stop — so a family with a
-- national President and a President in each region could name only one of them
-- "President" and had to invent "Regional President" for the other, which is a workaround
-- the product forced and then printed on the screen.
--
-- The key becomes UNIQUE (family_code, name, scope). Three rows may now be called
-- President, one per scope, and no two rows at the SAME scope can share a name.
--
-- ── WHY SCOPE AND NOT SOMETHING FINER ───────────────────────────────────────
-- The obvious next step is one position row per REGION — a "President" row for the Eastern
-- region and another for the Western — and it is the wrong model, which is worth stating
-- because the request can be read that way ("Regional/Chapter scopes can be set for each
-- region/chapter").
--
-- WHICH region a regional position is FOR is already recorded, on the ASSIGNMENT rather
-- than on the position: `user_roles.region_id` and `user_roles.chapter_id`, written by
-- `assignBoardPosition` and checked against `family_roles.scope` there. So a family with
-- four regions has ONE regional President row and four assignments, one per region, each
-- naming its region — which is what "can be set for each region" already means today and is
-- what the screen shows in its Region column.
--
-- Modelling it the other way would put the region in TWO places that can disagree
-- (`family_roles` and `user_roles`), multiply the catalogue by the number of regions, and
-- make adding a fifth region a job of adding N positions. It is the same argument
-- `20260813000007` makes about `link_kind` living on the edge rather than on the person, and
-- the same one AGENTS.md makes about `is_minor`: one fact, one place.
--
-- ── AND WHY THE SCOPE ITSELF IS NOT EDITABLE HERE ───────────────────────────
-- Nothing in this migration lets a position CHANGE scope after it has been created, and
-- that is deliberate rather than unfinished. `user_roles.scope` is copied from the position
-- at assignment time and the region/chapter columns are filled from it — so flipping a
-- national position to regional would leave every existing assignment claiming a scope with
-- no region beside it, which `assignBoardPosition`'s own rule 3 exists to prevent. A family
-- that wants the other scope adds the position at that scope, which is exactly what this
-- migration makes possible.
--
-- ── NOTHING TO BACKFILL, AND THE INDEX SWAP IS THE WHOLE CHANGE ─────────────
-- Widening a unique key can never make existing rows invalid: every pair distinct under
-- (family_code, name) is distinct under (family_code, name, scope). So there is no data
-- migration and no possibility of one being needed — the assertion at the bottom states
-- that as a fact about the row count rather than assuming it.
-- ============================================================================

BEGIN;

-- ── 1. The key ──────────────────────────────────────────────────────────────
-- ── IT IS AN INDEX, NOT A CONSTRAINT, AND THE FIRST DRAFT OF THIS FILE GOT IT WRONG ──
-- `20260819000004` created it with `CREATE UNIQUE INDEX`, so `pg_constraint` has no row for
-- it at all and `ALTER TABLE … DROP CONSTRAINT IF EXISTS` is a silent no-op — the `IF EXISTS`
-- turning what should have been an error into nothing. The first version of this migration did
-- exactly that and then asserted the old key was gone by looking in `pg_constraint`, which
-- agreed, so the assertion passed over a key that was still enforcing. What caught it was §2's
-- other half, the one that WRITES: the three-scope insert failed 23505 naming
-- `family_roles_family_code_name_key`. An assertion that only reads the catalogue would have
-- shipped this.
--
-- Both forms are dropped, in case a database somewhere has it as a constraint. `DROP INDEX` on
-- an index a constraint owns is refused (2BP01), so the order matters: constraint first, and
-- the index drop then finds nothing left to do.
ALTER TABLE public.family_roles
  DROP CONSTRAINT IF EXISTS family_roles_family_code_name_key;
DROP INDEX IF EXISTS public.family_roles_family_code_name_key;

-- IF NOT EXISTS so a replay is a no-op rather than a 42P07.
CREATE UNIQUE INDEX IF NOT EXISTS family_roles_family_code_name_scope_key
  ON public.family_roles (family_code, name, scope);

COMMENT ON COLUMN public.family_roles.scope IS
  'national | regional | chapter. Part of the uniqueness key since 20260820000000, so one '
  'title may exist once per scope. WHICH region or chapter a scoped position is FOR lives on '
  'the assignment (user_roles.region_id / chapter_id), never here — see that migration.';

-- ── 2. Verify ───────────────────────────────────────────────────────────────
-- Unconditional and fixture-free, and it exercises the new key in BOTH directions: an
-- assertion that the index merely exists would pass against an index on the old two columns.
DO $mig$
DECLARE
  v_code   text := 'ROLESCOPE';
  v_before bigint;
  v_after  bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'family_roles'
       AND indexname = 'family_roles_family_code_name_scope_key'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: family_roles_family_code_name_scope_key was not created';
  END IF;

  -- BOTH CATALOGUES, because the old key is an INDEX and not a constraint — see §1. Asking
  -- `pg_constraint` alone is what let the first draft of this file report success over a key
  -- that was still enforcing.
  IF EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'family_roles'
       AND indexname = 'family_roles_family_code_name_key'
  ) OR EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.family_roles'::regclass
       AND conname = 'family_roles_family_code_name_key'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: the old two-column key is still there, so nothing changed';
  END IF;

  SELECT count(*) INTO v_before FROM public.family_roles;

  INSERT INTO public.families (family_code, family_name) VALUES (v_code, 'Role scope probe');

  -- THE SAME TITLE AT THREE SCOPES. This is the assertion the migration exists for.
  INSERT INTO public.family_roles (family_code, name, category, scope, sort_order) VALUES
    (v_code, 'President', 'executive_officer', 'national', 1),
    (v_code, 'President', 'executive_officer', 'regional', 2),
    (v_code, 'President', 'executive_officer', 'chapter',  3);

  -- AND STILL ONE PER SCOPE. A widened key that admits anything is not a key, and a family
  -- with two national Presidents is a screen with two identical rows nobody can tell apart.
  BEGIN
    INSERT INTO public.family_roles (family_code, name, category, scope, sort_order)
    VALUES (v_code, 'President', 'executive_officer', 'national', 4);
    RAISE EXCEPTION 'ROLLBACK: a duplicate title at the same scope was admitted';
  EXCEPTION WHEN unique_violation THEN
    NULL;  -- expected
  END;

  -- Order as 20260813000003's verify block established: the family row goes first, because
  -- funds_protect_system() only releases a system fund once the families row is gone.
  DELETE FROM public.family_roles          WHERE family_code = v_code;
  DELETE FROM public.families              WHERE family_code = v_code;
  DELETE FROM public.funds                 WHERE family_code = v_code;
  DELETE FROM public.template_permissions tp
   USING public.permission_templates t
   WHERE tp.template_id = t.id AND t.family_code = v_code;
  DELETE FROM public.permission_templates  WHERE family_code = v_code;
  DELETE FROM public.resource_visibility   WHERE family_code = v_code;

  SELECT count(*) INTO v_after FROM public.family_roles;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'ROLLBACK: the probe left % family_roles row(s) behind', v_after - v_before;
  END IF;

  RAISE NOTICE 'family_roles: one title per scope, duplicates within a scope still refused';
END $mig$;

COMMIT;
