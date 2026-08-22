-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Transactions moves from Reporting to Accounting — route, folder AND permission key.
--
-- ── WHY THE KEY HAS TO MOVE AT ALL ─────────────────────────────────────────────────────
-- AGENTS.md, "The route tree IS the nav rail": a screen's route is `/<its rail section>/<its
-- rail caption>`, and its permission key is that route without the leading slash. The rail
-- row moved to Accounting, so `/reporting/transactions` became `/accounting/transactions`,
-- so `reporting/transactions` became `accounting/transactions`. There is no version of this
-- where only the caption moves: an administrator matching a switch on Members & Access to
-- the thing it switches off would find the switch filed under Reporting and the screen filed
-- under Accounting.
--
-- The move itself is the ask, and the argument for it is that Reporting reads a recorded
-- figure BACK while these four ledgers are where a figure is RECORDED — a dues payment, a
-- donation, a fund contribution, a disbursement, a transfer. That the page also lists what it
-- holds is what made the old placement plausible; a list is not a report.
--
-- ── SEVEN KEYS, NOT ONE ────────────────────────────────────────────────────────────────
-- The page's own key plus six sub-keys, each of which gates one ledger's WRITE (and, for
-- `fund-transfers`, carries a tier of its own through `lib/features.ts`). Every one of them
-- is a prefix rename and nothing else changes — same label, same category (`accounting`,
-- which it already was), same subsection, same sort_order, same actions.
--
-- ── THE SIX PLACES A KEY IS REFERENCED ─────────────────────────────────────────────────
-- Enumerated by 20260805000006 and applied to 42 keys by 20260820000004, whose shape this
-- file follows exactly:
--
--   1. permission_resources.key                     — §2 below
--   2. template_permissions.resource_key            — §3, every grant on every template
--   3. resource_visibility.resource_key             — §4, the per-family show/hide
--   4. permission_table_map.resource_key            — §5, which table the key gates
--   5. the COMPOSED POLICY EXPRESSIONS              — §6, and this is the one that bites
--   6. SECURITY DEFINER function bodies             — §7
--
-- §6 is the trap. `_perm_predicate()` interpolates the key with %L, so each composed policy
-- carries the key as literal text that updating the map does NOT change. Left behind, the
-- policy asks about a key that no longer exists, `auth_permission` falls through to its
-- default, and the table goes world-readable for view while every write fails closed.
--
-- None of the foreign keys is ON UPDATE CASCADE, so a key cannot be UPDATEd in place:
-- dependents are copied onto the new key and the old rows dropped, in that order.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. THE MOVES ──────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE key_moves (old_key text PRIMARY KEY, new_key text NOT NULL) ON COMMIT DROP;

INSERT INTO key_moves (old_key, new_key) VALUES
  ('reporting/transactions',                    'accounting/transactions'),
  ('reporting/transactions/dues-payments',      'accounting/transactions/dues-payments'),
  ('reporting/transactions/donation-payments',  'accounting/transactions/donation-payments'),
  ('reporting/transactions/fund-contributions', 'accounting/transactions/fund-contributions'),
  ('reporting/transactions/fund-disbursements', 'accounting/transactions/fund-disbursements'),
  ('reporting/transactions/fund-transfers',     'accounting/transactions/fund-transfers'),
  ('reporting/transactions/reversals',          'accounting/transactions/reversals');

DO $mig$
DECLARE v_found int;
BEGIN
  SELECT count(*) INTO v_found
    FROM key_moves m JOIN public.permission_resources pr ON pr.key = m.old_key;
  RAISE NOTICE 'transactions move: % of 7 key(s) present to move', v_found;
END $mig$;

-- ── §2. THE RESOURCE ROWS ──────────────────────────────────────────────────────────────
-- Category, subsection, sort_order and actions are all carried across verbatim. The category
-- was ALREADY `accounting` — these rows have sat in the Accounting block of the grid since
-- 20260805000005, which is itself evidence the rail row was in the wrong section rather than
-- the grid being in the wrong category.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
SELECT m.new_key, pr.label, pr.category, pr.subsection, pr.sort_order, pr.actions
  FROM key_moves m
  JOIN public.permission_resources pr ON pr.key = m.old_key
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── §3. EVERY FAMILY'S GRANTS ──────────────────────────────────────────────────────────
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, m.new_key, tp.action, tp.scope, tp.updated_at
  FROM public.template_permissions tp
  JOIN key_moves m ON m.old_key = tp.resource_key
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── §4. THE PER-FAMILY SHOW/HIDE ───────────────────────────────────────────────────────
INSERT INTO public.resource_visibility (family_code, resource_key, visibility, updated_at)
SELECT rv.family_code, m.new_key, rv.visibility, rv.updated_at
  FROM public.resource_visibility rv
  JOIN key_moves m ON m.old_key = rv.resource_key
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── §5. WHICH TABLE EACH KEY GATES ─────────────────────────────────────────────────────
UPDATE public.permission_table_map ptm
   SET resource_key = m.new_key
  FROM key_moves m
 WHERE ptm.resource_key = m.old_key;

-- ── §6. THE COMPOSED POLICIES ──────────────────────────────────────────────────────────
-- Read each policy back out of pg_policies, rewrite the literal, drop and recreate. The
-- `::text` suffix is part of the match on purpose: it is what %L-interpolation produces, and
-- matching the bare literal would also hit a key that merely CONTAINS this one as a prefix.
DO $mig$
DECLARE
  p       record;
  m       record;
  v_roles text;
  v_qual  text;
  v_check text;
  v_count int := 0;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, qual, with_check, roles
      FROM pg_policies
     WHERE schemaname = 'public'
       AND EXISTS (
             SELECT 1 FROM key_moves k
              WHERE COALESCE(pg_policies.qual, '') LIKE '%' || quote_literal(k.old_key) || '%'
                 OR COALESCE(pg_policies.with_check, '') LIKE '%' || quote_literal(k.old_key) || '%')
  LOOP
    v_qual  := p.qual;
    v_check := p.with_check;
    FOR m IN SELECT old_key, new_key FROM key_moves LOOP
      v_qual  := replace(v_qual,  quote_literal(m.old_key) || '::text',
                                  quote_literal(m.new_key) || '::text');
      v_check := replace(v_check, quote_literal(m.old_key) || '::text',
                                  quote_literal(m.new_key) || '::text');
    END LOOP;
    v_roles := array_to_string(p.roles, ', ');
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO %s', p.policyname, p.tablename,
                   p.cmd, v_roles)
            || CASE WHEN v_qual  IS NOT NULL THEN format(' USING (%s)', v_qual)       ELSE '' END
            || CASE WHEN v_check IS NOT NULL THEN format(' WITH CHECK (%s)', v_check) ELSE '' END;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'transactions move: rewrote % policy/policies onto the new keys', v_count;
END $mig$;

-- ── §7. FUNCTION BODIES ────────────────────────────────────────────────────────────────
-- A SECURITY DEFINER function that gates itself with the key written into its own source is
-- invisible to every step above. Three shapes, enumerated rather than recalled exactly as
-- 20260820000004 does — each of the three was found there by an assertion failing, one after
-- another, not by reading.
DO $mig$
DECLARE
  f       record;
  m       record;
  v_def   text;
  v_count int := 0;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND EXISTS (
             SELECT 1 FROM key_moves k
              WHERE pg_get_functiondef(p.oid)
                    LIKE '%auth_permission(' || quote_literal(k.old_key) || '%'
                 OR pg_get_functiondef(p.oid)
                    LIKE '%auth_can(' || quote_literal(k.old_key) || '%'
                 OR pg_get_functiondef(p.oid)
                    LIKE '%resource_key = ' || quote_literal(k.old_key) || '%')
  LOOP
    v_def := f.def;
    FOR m IN SELECT old_key, new_key FROM key_moves LOOP
      v_def := replace(v_def, 'auth_permission(' || quote_literal(m.old_key),
                              'auth_permission(' || quote_literal(m.new_key));
      v_def := replace(v_def, 'auth_can(' || quote_literal(m.old_key),
                              'auth_can(' || quote_literal(m.new_key));
      v_def := replace(v_def, 'resource_key = ' || quote_literal(m.old_key),
                              'resource_key = ' || quote_literal(m.new_key));
    END LOOP;
    EXECUTE v_def;
    v_count := v_count + 1;
    RAISE NOTICE 'transactions move: rekeyed function %', f.proname;
  END LOOP;
  RAISE NOTICE 'transactions move: rekeyed % function body/bodies', v_count;
END $mig$;

-- ── §8. DROP THE OLD ROWS ──────────────────────────────────────────────────────────────
-- LAST, and only after every dependent has been copied. The FKs are ON DELETE CASCADE, so
-- doing this first would take the grants with it.
DELETE FROM public.permission_resources pr
 USING key_moves m
 WHERE pr.key = m.old_key;

-- ── §9. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(m.old_key, ', ' ORDER BY m.old_key) INTO v_bad
    FROM key_moves m JOIN public.permission_resources pr ON pr.key = m.old_key;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'old resource key(s) survived: %', v_bad;
  END IF;

  SELECT string_agg(m.new_key, ', ' ORDER BY m.new_key) INTO v_bad
    FROM key_moves m
   WHERE NOT EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = m.new_key);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'new resource key(s) missing: %', v_bad;
  END IF;

  SELECT string_agg(DISTINCT m.old_key, ', ') INTO v_bad
    FROM key_moves m
   WHERE EXISTS (SELECT 1 FROM public.template_permissions t WHERE t.resource_key = m.old_key)
      OR EXISTS (SELECT 1 FROM public.resource_visibility  r WHERE r.resource_key = m.old_key)
      OR EXISTS (SELECT 1 FROM public.permission_table_map p WHERE p.resource_key = m.old_key);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'grants, visibility or map rows still name: %', v_bad;
  END IF;

  -- §6's trap, asserted rather than assumed.
  SELECT string_agg(DISTINCT m.old_key, ', ') INTO v_bad
    FROM key_moves m, pg_policies pol
   WHERE pol.schemaname = 'public'
     AND (COALESCE(pol.qual, '') || COALESCE(pol.with_check, ''))
         LIKE '%' || quote_literal(m.old_key) || '::text%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'policies still evaluate: %', v_bad;
  END IF;

  SELECT string_agg(DISTINCT m.old_key, ', ') INTO v_bad
    FROM key_moves m, pg_proc pp
    JOIN pg_namespace n ON n.oid = pp.pronamespace
   WHERE n.nspname = 'public'
     AND pg_get_functiondef(pp.oid) LIKE '%' || quote_literal(m.old_key) || '%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a function body still names: %', v_bad;
  END IF;

  -- The map row that makes `fund_transfers` reachable at all must have travelled. It is the
  -- one transactions sub-key that gates a TABLE rather than a screen band, so losing it would
  -- leave the composed policy asking about a key with no map row behind it.
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_table_map
     WHERE resource_key = 'accounting/transactions/fund-transfers'
  ) THEN
    RAISE EXCEPTION 'fund_transfers lost its permission_table_map row in the move';
  END IF;

  -- 20260817000004's invariant, which every migration touching this table re-asserts:
  -- category and key shape may never disagree, in either direction.
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
END $mig$;

COMMIT;
