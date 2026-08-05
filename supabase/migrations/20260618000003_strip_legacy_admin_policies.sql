-- ============================================================================
-- Authorization rebuild, pass 3b: finish what the sweep started, then drop the
-- legacy flags. SUPERSEDES 20260618000002 — run this instead.
--
-- WHY THIS EXISTS
--   20260618000001 composed the permission check onto every policy:
--       (original expression) AND (self-access OR permission check)
--   That was deliberately conservative — AND can only narrow — but it PRESERVED
--   the legacy admin test inside the original expression:
--       ... AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid()
--                         AND is_admin = true AND family_code = ...)
--
--   Two problems follow:
--     1. people.is_admin still has ~64 dependent policies, so it cannot be
--        dropped (this is the error 20260618000002 reports).
--     2. Nobody has is_admin = true any more — authority comes from group
--        membership — so that clause is permanently false. On a table whose only
--        write policy was the admin one (announcements, dues_*, funds, elections)
--        authenticated writes are now refused outright. The app still works only
--        because those paths use the service-role client, which bypasses RLS.
--
-- WHAT IT DOES
--   Replaces each `EXISTS (... is_admin ...)` sub-expression with TRUE, leaving
--   the rest of the policy — crucially its family scoping — byte-identical. The
--   permission check that the sweep already ANDed on becomes the authority:
--
--       (family_code = auth_family_code() AND true) AND (permission)
--
--   For "uploader or admin" style policies the ownership half also collapses to
--   TRUE, which is correct: ownership is now carried by the permission's own/any
--   scope (see permission_table_map.own_expr), not by a hand-written OR.
--
--   It refuses to touch any policy where the is_admin reference is not inside an
--   EXISTS(...), rather than risk mangling an expression it does not understand.
--
-- IDEMPOTENT: once no policy mentions is_admin, the rewrite loop is a no-op and
-- the columns are already gone, so re-running does nothing.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260618000003_strip_legacy_admin_policies.sql
-- ============================================================================

BEGIN;

-- ── Surgical removal of one EXISTS(...is_admin...) sub-expression ────────────
-- Text surgery on the rendered expression, with balanced-paren matching so the
-- whole subquery is removed and nothing else is disturbed.
CREATE OR REPLACE FUNCTION public._strip_is_admin_clause(p_expr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v        text := p_expr;
  v_up     text;
  v_pos    int;
  v_exists int;
  v_p      int;
  v_i      int;
  v_open   int;
  v_close  int;
  v_depth  int;
  v_guard  int := 0;
BEGIN
  IF v IS NULL THEN
    RETURN NULL;
  END IF;

  LOOP
    v_guard := v_guard + 1;
    IF v_guard > 25 THEN
      RAISE EXCEPTION 'runaway rewrite on: %', p_expr;
    END IF;

    -- Case-insensitive search, but splice from the original: upper() preserves
    -- byte offsets for the ASCII identifiers and keywords involved here.
    v_up  := upper(v);
    v_pos := position('IS_ADMIN' in v_up);
    EXIT WHEN v_pos = 0;

    -- Walk forward through every EXISTS before the reference; the last one is
    -- the innermost enclosing subquery.
    v_exists := 0;
    v_i := 1;
    LOOP
      v_p := position('EXISTS' in substr(v_up, v_i));
      EXIT WHEN v_p = 0;
      v_p := v_i + v_p - 1;
      EXIT WHEN v_p > v_pos;
      v_exists := v_p;
      v_i := v_p + 6;
    END LOOP;

    IF v_exists = 0 THEN
      RAISE EXCEPTION
        'is_admin reference is not inside an EXISTS(...); refusing to rewrite: %', p_expr;
    END IF;

    v_open := v_exists + position('(' in substr(v, v_exists)) - 1;
    IF v_open < v_exists THEN
      RAISE EXCEPTION 'no opening paren after EXISTS in: %', p_expr;
    END IF;

    v_depth := 0;
    v_close := 0;
    FOR v_i IN v_open .. length(v) LOOP
      IF substr(v, v_i, 1) = '(' THEN
        v_depth := v_depth + 1;
      ELSIF substr(v, v_i, 1) = ')' THEN
        v_depth := v_depth - 1;
        IF v_depth = 0 THEN
          v_close := v_i;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    IF v_close = 0 THEN
      RAISE EXCEPTION 'unbalanced parentheses in: %', p_expr;
    END IF;

    v := substr(v, 1, v_exists - 1) || 'true' || substr(v, v_close + 1);
  END LOOP;

  RETURN v;
END $$;

-- ── Rewrite every policy that still mentions is_admin ───────────────────────
-- Snapshot first: recreating policies inside a loop over pg_policies would be
-- iterating the catalog while mutating it.
CREATE TEMP TABLE _legacy_admin_policies AS
SELECT tablename, policyname, cmd, qual, with_check,
       array_to_string(roles, ', ') AS roles
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%is_admin%' OR with_check ILIKE '%is_admin%');

DO $$
DECLARE
  r       record;
  v_qual  text;
  v_check text;
  v_count int := 0;
BEGIN
  FOR r IN SELECT * FROM _legacy_admin_policies ORDER BY tablename, policyname LOOP
    v_qual  := public._strip_is_admin_clause(r.qual);
    v_check := public._strip_is_admin_clause(COALESCE(r.with_check, r.qual));

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);

    IF r.cmd = 'SELECT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO %s USING (%s)',
                     r.policyname, r.tablename, r.roles, v_qual);
    ELSIF r.cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK (%s)',
                     r.policyname, r.tablename, r.roles, v_check);
    ELSIF r.cmd = 'UPDATE' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
                     r.policyname, r.tablename, r.roles, v_qual, v_check);
    ELSIF r.cmd = 'DELETE' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO %s USING (%s)',
                     r.policyname, r.tablename, r.roles, v_qual);
    ELSIF r.cmd = 'ALL' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO %s USING (%s) WITH CHECK (%s)',
                     r.policyname, r.tablename, r.roles, v_qual, v_check);
    ELSE
      RAISE EXCEPTION 'unhandled policy command % on %.%', r.cmd, r.tablename, r.policyname;
    END IF;

    v_count := v_count + 1;
    RAISE NOTICE 'rewrote %.%s (%)', r.tablename, r.policyname, r.cmd;
  END LOOP;

  RAISE NOTICE 'stripped the legacy admin test from % policies', v_count;
END $$;

DROP TABLE _legacy_admin_policies;

-- ── Confirm nothing depends on the flags any more ───────────────────────────
DO $$
DECLARE
  v_left int;
BEGIN
  SELECT COUNT(*) INTO v_left
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual ILIKE '%is_admin%' OR with_check ILIKE '%is_admin%'
      OR qual ILIKE '%can_approve%' OR with_check ILIKE '%can_approve%');

  IF v_left > 0 THEN
    RAISE EXCEPTION 'aborting: % policies still reference the legacy flags', v_left;
  END IF;
END $$;

-- ── Nobody loses access ─────────────────────────────────────────────────────
-- Same guard as 20260618000002: every is_admin holder must already be in a group
-- that can manage permissions.
DO $$
DECLARE
  v_orphans int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'people' AND column_name = 'is_admin'
  ) THEN
    SELECT COUNT(*) INTO v_orphans
    FROM public.people p
    WHERE p.is_admin = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_group_members m
        JOIN public.user_groups g       ON g.id = m.group_id
        JOIN public.group_permissions gp ON gp.group_id = g.id
        WHERE m.person_id = p.id
          AND gp.resource_key = 'admin/groups'
          AND gp.action = 'edit'
          AND gp.scope <> 'none'
      );

    IF v_orphans > 0 THEN
      RAISE EXCEPTION
        'aborting: % person(s) have is_admin = true but are in no group that can manage permissions',
        v_orphans;
    END IF;
  END IF;
END $$;

ALTER TABLE public.people DROP COLUMN IF EXISTS is_admin;
ALTER TABLE public.people DROP COLUMN IF EXISTS can_approve;

DROP FUNCTION IF EXISTS public._strip_is_admin_clause(text);

COMMIT;
