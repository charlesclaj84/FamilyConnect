-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Four ACTIVITY reports: Gatherings, Elections, Meetings, and Board & Offices.
--
-- ── WHAT WAS MISSING ───────────────────────────────────────────────────────────────────
-- Reporting had five screens on 2026-08-22 and every one of them read the MONEY. Membership
-- is the roster; Payment History, Transactions, Dues Projections and P&L Summary are four
-- views of the ledger. Nothing anywhere reported on what the family DOES — who is behind on a
-- reunion task, whether an election drew a turnout worth calling a mandate, how often the
-- board actually meets, or which offices are standing empty. These four answer that.
--
-- They register together because they are one absence rather than four, and because the
-- decisions below are the same decision made four times.
--
-- ── EACH SITS IN THE CATEGORY OF THE THING IT REPORTS ON ───────────────────────────────
-- There is no `reporting` category and this migration does not invent one. The five existing
-- reports are already scattered by subject — `reporting/membership` is `community`,
-- `reporting/payment-history` and the rest are `accounting` — so a report sits in the grid
-- beside the screen whose records it counts. An administrator restricting Gatherings and its
-- report finds the two switches together, which is the reason that precedent is worth
-- following rather than tidying.
--
--   reporting/gatherings   events      95   after gatherings/calendar (94)
--   reporting/elections    community   81   after community/elections (80)
--   reporting/meetings     journal     16   after library/meeting-minutes (15)
--   reporting/board        community   73   between reporting/membership (72) and
--                                           community/family-tree (75)
--
-- `reporting/board` CANNOT be category `admin`, and that is enforced rather than chosen:
-- 20260817000004 asserts that `category = 'admin'` and `key LIKE 'admin/%'` never disagree in
-- either direction, and this key is not an `admin/` one. It is not an administrator's tool —
-- see the page header for why it is deliberately separate from
-- `admin/members/board-positions`.
--
-- ── `view` ONLY ────────────────────────────────────────────────────────────────────────
-- Nothing on a report writes anything. `permission_resources.actions` decides which switches
-- the grid renders, and a switch nothing consults reads as a control being honoured — the
-- reason 20260808000000 narrowed `transactions` and `account-summary` to `view` alone.
--
-- ── RESTRICTED PER FAMILY, AND GRANTED TO ADMINISTRATORS ───────────────────────────────
-- §6's obligation, both halves. Every one of these names people against something they have
-- not done — a task nobody finished, a meeting somebody never voted in, an office standing
-- empty — which is the same argument that made `reporting/membership` and
-- `reporting/dues-projections` restricted. And "restricted with nobody granted is a screen
-- that exists and cannot be opened", so the Administrators template gets all four in the same
-- migration.
--
-- THE BACKFILL TOUCHES `is_system` TEMPLATES ONLY. A custom grid is one an administrator built
-- and looked at, and a migration must not overrule a cell somebody set in a UI that showed
-- them the answer — 20260820000007's rule, applied again.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. THE RESOURCE ROWS ──────────────────────────────────────────────────────────────
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES
  ('reporting/gatherings', 'Gatherings Report',      'events',    NULL, 95, ARRAY['view']::TEXT[]),
  ('reporting/elections',  'Elections Report',       'community', NULL, 81, ARRAY['view']::TEXT[]),
  ('reporting/meetings',   'Meetings Report',        'journal',   NULL, 16, ARRAY['view']::TEXT[]),
  ('reporting/board',      'Board & Offices Report', 'community', NULL, 73, ARRAY['view']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- THE LABEL SAYS "Report", where the rail item says only "Gatherings". That is deliberate and
-- is the one place the two are allowed to differ: AGENTS.md's rule is that captions come from
-- the screen, and under the Reporting HEADING the rail already says which these are. The grid
-- has no such heading — its blocks are by category, so `reporting/gatherings` would sit two
-- rows from `gatherings` wearing the same word, and an administrator would have no way to
-- tell which switch closes the screen and which closes the report.

-- ── §2. RESTRICTED FOR EVERY EXISTING FAMILY ───────────────────────────────────────────
-- Derived from `people` rather than `families`, matching 20260820000003: a family whose row
-- predates the `families` table's own backfills still has members, and a family with no
-- members has nobody to restrict anything from.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, k.key, 'restricted'
  FROM public.people p
 CROSS JOIN (VALUES ('reporting/gatherings'), ('reporting/elections'),
                    ('reporting/meetings'), ('reporting/board')) AS k(key)
 WHERE p.family_code IS NOT NULL AND p.family_code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── §3. THE ADMINISTRATORS GRANT ───────────────────────────────────────────────────────
-- Without this the four screens are restricted with nobody able to open them — and in the
-- worst ordering the screen that just locked is the one that could unlock it.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, k.key, 'view'::public.permission_action, 'any'::public.permission_scope, NOW()
  FROM public.permission_templates t
 CROSS JOIN (VALUES ('reporting/gatherings'), ('reporting/elections'),
                    ('reporting/meetings'), ('reporting/board')) AS k(key)
 WHERE t.is_system AND t.name = 'Administrators'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── §4. AND AN EXPLICIT `none` FOR GENERAL ─────────────────────────────────────────────
-- The grid is MATERIALIZED (20260807000000): every template carries an explicit row for every
-- resource and action, so the screen can show the whole answer without explaining a
-- fall-through. A resource registered later has no row in the templates that already exist and
-- falls back to `resource_visibility` — which is a working default and not a complete one.
-- This writes what `seed_family_permission_templates` would write for a family created after
-- today, so an existing family's General template renders a switch an administrator can move.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, k.key, 'view'::public.permission_action, 'none'::public.permission_scope, NOW()
  FROM public.permission_templates t
 CROSS JOIN (VALUES ('reporting/gatherings'), ('reporting/elections'),
                    ('reporting/meetings'), ('reporting/board')) AS k(key)
 WHERE t.is_system AND t.name = 'General'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── §5. NEW FAMILIES GET THEM RESTRICTED TOO ───────────────────────────────────────────
-- `seed_family_permission_templates()` carries a `v_restricted` array. It is REWRITTEN in
-- place rather than restated: the function has been redefined by four migrations since it was
-- written, and restating a hundred lines to change one array is how a grant added in one of
-- them gets quietly reverted. 20260820000004 does the same thing to function bodies for the
-- same reason, and the verify block below asserts the grants it must not have lost.
DO $mig$
DECLARE
  v_def text;
  v_old text := 'ARRAY[''reporting/dues-projections'', ''gatherings/budget'','
                || E'\n' || '                               ''reporting/membership'']';
  v_new text := 'ARRAY[''reporting/dues-projections'', ''gatherings/budget'','
                || E'\n' || '                               ''reporting/membership'','
                || E'\n' || '                               ''reporting/gatherings'', ''reporting/elections'','
                || E'\n' || '                               ''reporting/meetings'', ''reporting/board'']';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'seed_family_permission_templates';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'seed_family_permission_templates() does not exist';
  END IF;

  -- MATCHED ON THE WHOLE ARRAY LITERAL, not on one key. Replacing `'reporting/membership'`
  -- alone would also hit the assertion 20260820000004 leaves in the body, and a match that
  -- can hit two places is a match that will.
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'seed_family_permission_templates() no longer holds the v_restricted array '
      'this migration expects — it has been reformatted or extended. Re-read the function and '
      'update this replacement rather than widening the match.';
  END IF;

  EXECUTE replace(v_def, v_old, v_new);
  RAISE NOTICE 'activity reports: four keys added to seed_family_permission_templates()''s restricted list';
END $mig$;

-- The lockdown's rule (§2b): this function is called only by the families trigger and by the
-- service role, so it is granted to nobody. Restated after a redefinition because
-- CREATE OR REPLACE keeps the ACL but a future refactor into DROP + CREATE would not.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── §6. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_keys text[] := ARRAY['reporting/gatherings', 'reporting/elections',
                         'reporting/meetings', 'reporting/board'];
  v_bad  text;
BEGIN
  SELECT string_agg(k, ', ' ORDER BY k) INTO v_bad
    FROM unnest(v_keys) AS k
   WHERE NOT EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = k);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'resource key(s) not registered: %', v_bad;
  END IF;

  -- NONE OF THE FOUR MAY GATE A TABLE, and it is asserted rather than assumed. They are
  -- READINGS: every row they count is already governed by the key that owns it
  -- (`gatherings`, `community/elections`, `library/meeting-minutes`,
  -- `admin/members/board-positions`). A `permission_table_map` row appearing here later would
  -- compose an `auth_permission('reporting/…', …)` factor onto one of those tables with
  -- `view` defaulting to `'everyone'` — the shape 20260822000021 §9f asserts against for the
  -- Library keys, for exactly the same reason.
  SELECT string_agg(resource_key, ', ') INTO v_bad
    FROM public.permission_table_map WHERE resource_key = ANY(v_keys);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a report key gates a table, which it must not: %', v_bad;
  END IF;

  -- Restricted everywhere, per §2.
  SELECT string_agg(DISTINCT format('%s/%s', p.family_code, k), ', ') INTO v_bad
    FROM public.people p CROSS JOIN unnest(v_keys) AS k
   WHERE p.family_code IS NOT NULL AND p.family_code <> ''
     AND NOT EXISTS (
       SELECT 1 FROM public.resource_visibility rv
        WHERE rv.family_code = p.family_code AND rv.resource_key = k
          AND rv.visibility = 'restricted');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'not restricted for: %', v_bad;
  END IF;

  -- Granted to every Administrators template, per §3. The other half of §6's rule: a
  -- restricted screen nobody can open is the failure this pairs with.
  SELECT string_agg(DISTINCT format('%s/%s', t.family_code, k), ', ') INTO v_bad
    FROM public.permission_templates t CROSS JOIN unnest(v_keys) AS k
   WHERE t.is_system AND t.name = 'Administrators'
     AND NOT EXISTS (
       SELECT 1 FROM public.template_permissions tp
        WHERE tp.template_id = t.id AND tp.resource_key = k
          AND tp.action = 'view' AND tp.scope = 'any');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Administrators cannot open: %', v_bad;
  END IF;

  -- §5 landed, and did not lose a grant an earlier migration added. Both directions.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'seed_family_permission_templates'
       AND pg_get_functiondef(p.oid) LIKE '%reporting/gatherings%'
       AND pg_get_functiondef(p.oid) LIKE '%reporting/board%'
       AND pg_get_functiondef(p.oid) LIKE '%gatherings/budget%'
       AND pg_get_functiondef(p.oid) LIKE '%community/family-tree%'
       AND pg_get_functiondef(p.oid) LIKE '%reporting/membership%'
  ) THEN
    RAISE EXCEPTION 'seed_family_permission_templates() did not take the four keys, or lost one '
      'an earlier migration added';
  END IF;

  IF has_function_privilege('anon', 'public.seed_family_permission_templates(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.seed_family_permission_templates(text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'seed_family_permission_templates() is executable by a browser role';
  END IF;

  -- 20260817000004's invariant, re-asserted by every migration that touches this table.
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
