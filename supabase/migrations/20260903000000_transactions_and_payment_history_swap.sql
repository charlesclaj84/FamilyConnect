-- ═══════════════════════════════════════════════════════════════════════════════════════
-- TWO RAIL ROWS TRADE PLACES: Transactions goes to Reporting, Payment History to Accounting.
--
-- ── ONE OF THESE REVERSES `20260822000022`, TWELVE DAYS LATER ──────────────────────────
-- That migration moved Transactions FROM Reporting TO Accounting and argued it at length:
--
--   > Reporting reads a recorded figure BACK while these four ledgers are where a figure is
--   > RECORDED — a dues payment, a donation, a fund contribution, a disbursement, a transfer.
--   > That the page also lists what it holds is what made the old placement plausible; a list
--   > is not a report.
--
-- **The owner has asked for it back (2026-09-03), and that is the decision.** The argument is
-- kept above rather than deleted, because it is the argument somebody will make again — and it
-- is worth knowing that the counter-argument is the page's OWN SHAPE. `/accounting/transactions`
-- is a rail of four ledgers over a sortable, filterable table of every row the family has,
-- with the create trigger as one control in the corner. Whatever the writing is FOR, what the
-- screen mostly IS, and what a member mostly opens it to do, is read the ledger back. The
-- recording is done from a dialog.
--
-- ── AND PAYMENT HISTORY GOES THE OTHER WAY, WHICH IS NOT A SWAP FOR SYMMETRY ───────────
-- `reporting/payment-history` is one member's own receipts — own-only BY CONSTRUCTION rather
-- than by grant, since `getMyPaymentHistory` filters on the caller's own `people` row. It is
-- not a report about the family at all, which is what everything else under Reporting is; it is
-- the reader's own standing, which is what Accounting's Summary and Dues & Donations are.
--
-- Its `category` was ALREADY `accounting` — it has sat in the Accounting block of the grid
-- since it was registered, which is the same evidence `20260822000022` cited for its own move:
-- when the grid and the rail disagree about where a screen belongs, the grid is usually right,
-- because the category was chosen by somebody looking at what the screen holds.
--
-- ── EIGHT KEYS, AND SEVEN OF THEM ARE ONE PAGE ─────────────────────────────────────────
-- Transactions carries six sub-keys, one per ledger write, and `fund-transfers` additionally
-- carries a tier through `lib/features.ts`. Every one is a prefix rename and nothing else
-- changes: same label, same category, same subsection, same sort_order, same actions.
--
-- **NO CATEGORY MOVES, AND THAT IS DELIBERATE.** There is no `reporting` category — the grid
-- groups by SUBJECT, not by rail section, which is why `reporting/pl-summary` and
-- `reporting/dues-projections` are both `accounting` today. Money screens stay `accounting`
-- wherever the rail puts them. Changing it would move eight switches to a heading an
-- administrator has never seen them under, for no gain.
--
-- ── THE SIX PLACES A KEY IS REFERENCED ─────────────────────────────────────────────────
-- Enumerated by `20260805006`, applied to 42 keys by `20260820000004`, and to these seven in
-- the other direction by `20260822000022` — whose shape this file follows exactly:
--
--   1. permission_resources.key                     — §2
--   2. template_permissions.resource_key            — §3, every grant on every template
--   3. resource_visibility.resource_key             — §4, the per-family show/hide
--   4. permission_table_map.resource_key            — §5, which table the key gates
--   5. the COMPOSED POLICY EXPRESSIONS              — §6, and this is the one that bites
--   6. SECURITY DEFINER function bodies             — §7
--
-- §6 is the trap. `_perm_predicate()` interpolates the key with `%L`, so each composed policy
-- carries the key as literal TEXT that updating the map does not change. Left behind, the
-- policy asks about a key that no longer exists, `auth_permission` falls through to its
-- default, and the table goes world-readable for view while every write fails closed. Measured
-- here: TEN policies across four tables carry one of these literals.
--
-- §7 finds nothing today, asserted rather than assumed — no function body names either key.
-- The block runs anyway, because the next key move should not have to rediscover that it can.
--
-- None of the foreign keys is ON UPDATE CASCADE, so a key cannot be `UPDATE`d in place:
-- dependents are copied onto the new key and the old rows dropped, in that order.
--
-- ── AND THE HALF THIS FILE CANNOT DO ───────────────────────────────────────────────────
-- A bare key in TypeScript that goes stale FAILS OPEN — an unregistered non-admin key resolves
-- `view` to `'everyone'` (AGENTS.md §6), so `requireView` admits everybody and the switch on
-- Members & Access moves nothing. That is the opposite of every other kind of stale reference
-- in this codebase, and it is why `20260820000004` left four live for two days. The code sweep
-- is in the same commit, and the check is `git grep` of the OLD keys — bare, not as routes.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master. See AGENTS.md, "How migrations reach the
--   hosted project".
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. THE MOVES ──────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE key_moves (old_key text PRIMARY KEY, new_key text NOT NULL) ON COMMIT DROP;

INSERT INTO key_moves (old_key, new_key) VALUES
  ('accounting/transactions',                    'reporting/transactions'),
  ('accounting/transactions/dues-payments',      'reporting/transactions/dues-payments'),
  ('accounting/transactions/donation-payments',  'reporting/transactions/donation-payments'),
  ('accounting/transactions/fund-contributions', 'reporting/transactions/fund-contributions'),
  ('accounting/transactions/fund-disbursements', 'reporting/transactions/fund-disbursements'),
  ('accounting/transactions/fund-transfers',     'reporting/transactions/fund-transfers'),
  ('accounting/transactions/reversals',          'reporting/transactions/reversals'),
  ('reporting/payment-history',                  'accounting/payment-history');

DO $mig$
DECLARE v_found int;
BEGIN
  SELECT count(*) INTO v_found
    FROM key_moves m JOIN public.permission_resources pr ON pr.key = m.old_key;
  RAISE NOTICE 'rail swap: % of 8 key(s) present to move', v_found;
END $mig$;

-- ── §2. THE RESOURCE ROWS ──────────────────────────────────────────────────────────────
-- Label, category, subsection, sort_order and actions all carried across verbatim. See the
-- header for why no category moves.
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
-- Read each policy back out of `pg_policies`, rewrite the literal, drop and recreate. The
-- `::text` suffix is part of the match on purpose: it is what `%L`-interpolation produces, and
-- matching the bare literal would also hit a key that merely CONTAINS this one as a prefix —
-- which every one of the six sub-keys does to `accounting/transactions`.
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
  RAISE NOTICE 'rail swap: rewrote % policy/policies onto the new keys', v_count;
  -- MEASURED AT TEN when this was written — four on `fund_contributions`, two on
  -- `fund_disbursements`, two on `dues_payments`, two on `fund_transfers`. Stated as a floor
  -- rather than an equality: a policy added later is a policy this block should also rewrite,
  -- and asserting the exact count would make that a migration failure instead.
  IF v_count < 10 THEN
    RAISE EXCEPTION 'only % policy/policies carried these keys — expected at least 10, so '
      'something has already rewritten them and this migration is not the whole move', v_count;
  END IF;
END $mig$;

-- ── §7. FUNCTION BODIES ────────────────────────────────────────────────────────────────
-- A SECURITY DEFINER function that gates itself with the key written into its own source is
-- invisible to every step above. Three shapes, enumerated rather than recalled — each was
-- found in `20260820000004` by an assertion failing, one after another, not by reading.
--
-- IT FINDS NOTHING TODAY. Measured before writing this file, and the block is here anyway:
-- the next key move must not have to rediscover that this step exists, and a function gaining
-- one of these keys between now and the deploy would otherwise be missed silently.
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
    RAISE NOTICE 'rail swap: rekeyed function %', f.proname;
  END LOOP;
  RAISE NOTICE 'rail swap: rekeyed % function body/bodies', v_count;
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

  -- THE THREE MAP ROWS MUST HAVE TRAVELLED. These are the transactions sub-keys that gate a
  -- TABLE rather than a screen band, so losing one leaves a composed policy asking about a key
  -- with no map row behind it — and the next policy sweep would then compose nothing for it.
  SELECT string_agg(k, ', ' ORDER BY k) INTO v_bad
    FROM (VALUES ('reporting/transactions/fund-contributions'),
                 ('reporting/transactions/fund-disbursements'),
                 ('reporting/transactions/fund-transfers')) AS want(k)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.permission_table_map WHERE resource_key = want.k);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'permission_table_map lost: %', v_bad;
  END IF;

  -- AND PAYMENT HISTORY GATES NO TABLE, WHICH IS ALSO ASSERTED. It is one member's own
  -- receipts read through `getMyPaymentHistory`, which filters on their own `people` row — the
  -- rows are gated by `dues_payments`' own policy under `…/dues-payments`, and a map row
  -- appearing here later would compose a SECOND `auth_permission` factor onto that table.
  IF EXISTS (
    SELECT 1 FROM public.permission_table_map WHERE resource_key = 'accounting/payment-history'
  ) THEN
    RAISE EXCEPTION 'accounting/payment-history must gate no table — see this migration';
  END IF;

  -- `20260817000004`'s invariant, which every migration touching this table re-asserts:
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

  RAISE NOTICE 'rail swap: 8 keys moved, policies rewritten, map intact';
END $mig$;

COMMIT;
