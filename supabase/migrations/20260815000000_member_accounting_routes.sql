-- ============================================================================
-- Dues, Donations and Payment History stop being panes and become screens.
--
-- WHY
--   20260808000000 gave each pane of /account-summary its own grant, under the
--   `account-summary/` prefix, because a rail item is a job a family delegates. They
--   are not rail items any more: each one is a destination on the main rail, with its
--   own route, its own page and its own address. AGENTS.md §1 is unambiguous about
--   what that means — "the resource key is the route without its leading slash" — so
--   the keys move with the routes:
--
--     account-summary/dues       ->  dues              (/dues)
--     account-summary/donations  ->  donations         (/donations)
--     account-summary/history    ->  payment-history   (/payment-history)
--
--   Summary keeps its own key and its own route and becomes what its name says: a
--   digest of the four things below it, each section fetched only under the grant
--   that governs the screen it summarises.
--
-- `dues` IS A RESURRECTED KEY, AND IT MEANS SOMETHING ELSE NOW. 20260808000001
-- retired the old one — "Dues Records" — which governed the `dues_payments` SELECT
-- that both My Summary and Transactions passed through. That question ("may I see
-- OTHER people's payments") now lives on the two `transactions/*` ledger keys and
-- stays there. This key governs a SCREEN: the member's own schedules, their own
-- cadence, their own next installment. Own-only by construction, exactly as the pane
-- it replaces was — getMyDuesSummary() filters `.eq('person_id', myPersonId)` in the
-- action, before RLS is consulted at all.
--
--   So the two things that made the old key dangerous must both stay absent, and §5
--   asserts it rather than trusting this paragraph:
--     * NO permission_table_map row may name it. It gates no table.
--     * NO policy may evaluate auth_permission('dues', …). The one that used to is
--       rewritten and gone.
--   A future RLS sweep that re-composes a policy from a map row is exactly the shape
--   20260808000001 §3 removed the map rows to prevent. Do not put them back.
--
-- BEHAVIOUR-PRESERVING for every existing family. §2 copies each pane's grant onto
-- its new key before §4 deletes the old row, so nobody's access changes on deploy —
-- including a family that had narrowed one pane and left the others open.
--
-- NEW FAMILIES NEED NOTHING. seed_family_permission_templates() (20260807000000)
-- enumerates permission_resources rather than a literal list: Administrators get
-- 'any' on every action a resource declares, and General gets view 'any' on every
-- non-admin category. All four keys below are `accounting`, so both templates are
-- correct for a family created after this without a line of change.
--
-- NOT ADDED TO 20260618000000's SEED, deliberately, and this is the same call
-- 20260808000000 made for the three keys it created. That seed's ON CONFLICT DO
-- UPDATE is what would REVERT a later change, so §6 asks for an edit there when a
-- later migration touches a row the seed names. It names none of these. What it does
-- name is the retired `dues` row at sort_order 110, which is load-bearing chain
-- history — 20260618000001 composes policies from it and 20260808000001 deletes it —
-- so it is left exactly as it is. A replay inserts it, uses it, deletes it, and lands
-- here, which re-registers the key at 105 with the meaning above.
--
-- IDEMPOTENT. Every insert is ON CONFLICT, and the delete is unfiltered by state.
-- Safe on an empty database, where the backfill loops find no templates.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. Three routes register ────────────────────────────────────────────────
-- VIEW IS THE ONLY ACTION, unchanged from the panes and for the same reason. The one
-- control on any of these screens is the cadence picker and the opt-out on the
-- member's own dues row, which goes through setMyDuesPlan() — self-service by
-- definition, since create and edit default to scope 'none' and demanding a grant
-- would mean a family could not choose how to pay (AGENTS.md §2). An edit column here
-- would be a switch wired to nothing.
--
-- NO SUBSECTION. These are top-level rail items now, so they sit in the Accounting
-- category beside Summary and Transactions rather than indented under a heading.
-- Named explicitly in the column list so the ON CONFLICT arm can clear the heading a
-- replay of 20260808000000 would otherwise leave behind.
--
-- sort_order 105-107 follows the rail: Summary (100), its Family Funds section (101),
-- then Dues, Donations, Payment History, then Transactions (115) and its own block.
-- 101-103 are freed by §4 and 110 by 20260808000001; §5 asserts the category still
-- has no duplicate, which is the invariant 20260806000005 established.
--
-- CAPTIONS COME FROM THE SCREEN (AGENTS.md, "One rail item, one permission
-- resource"). "Upcoming Dues" was the pane's caption; the rail item and the page both
-- say "Dues", so this row does too.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('dues',            'Dues',            'accounting', NULL, 105, ARRAY['view']::TEXT[]),
  ('donations',       'Donations',       'accounting', NULL, 106, ARRAY['view']::TEXT[]),
  ('payment-history', 'Payment History', 'accounting', NULL, 107, ARRAY['view']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 1b. Summary's Family Funds section ──────────────────────────────────────
-- The one part of the new Summary that is NOT a digest of a screen beside it: the
-- family's funds and what each holds. It has no route of its own, so it takes a
-- sub-key under the page that renders it — the mechanism AGENTS.md names for a
-- capability that lives inside a page rather than at a URL, and the same shape
-- `transactions/dues-payments` uses.
--
-- The `account-summary/` prefix is load-bearing: getResources() drops any row where
-- isFeatureFuture('/' || key) is true, and getFeature() longest-prefix-matches, so
-- this resolves to the live /account-summary entry. A key under a 'future' prefix
-- vanishes from the Members grid with no error at all — which is precisely what would
-- happen to `family-finances/funds`, the other name this could have had.
--
-- IT IS NOT THE GRANT THE `funds` TABLE IS GATED BY, and must not be confused with
-- one. permission_table_map points funds, fund_allocations, fund_contributions and
-- fund_milestones at `family-finances`, and that is still the RLS predicate deciding
-- which rows come back. This is an APP-LAYER gate on whether the section is rendered
-- and whether the query runs at all — exactly what 20260808000000 §2 says the two
-- payment-ledger views are, and for the same reason: a section hidden over data
-- already fetched has published that data (AGENTS.md §5).
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('account-summary/funds', 'Family Funds', 'accounting', 'Summary', 101, ARRAY['view']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 2. Every grant follows its pane ─────────────────────────────────────────
-- Two passes, and the order is load-bearing. The first copies each pane's OWN scope
-- onto its new key, so a family that had narrowed exactly one of them keeps that
-- answer. The second is the fallback for anything the first did not reach, and takes
-- the page's grant — the same shape 20260808000000 §1 used when it created the panes.
-- DO NOTHING throughout, so a re-run never stamps over a grant an administrator has
-- since adjusted, and so the second pass cannot overwrite the first.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, m.new_key, 'view'::public.permission_action, tp.scope, NOW()
  FROM public.template_permissions tp
  JOIN (VALUES
    ('account-summary/dues',      'dues'),
    ('account-summary/donations', 'donations'),
    ('account-summary/history',   'payment-history')
  ) AS m(old_key, new_key) ON m.old_key = tp.resource_key
 WHERE tp.action = 'view'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, k.key, 'view'::public.permission_action, tp.scope, NOW()
  FROM public.template_permissions tp
 CROSS JOIN (VALUES
   ('dues'), ('donations'), ('payment-history'), ('account-summary/funds')
 ) AS k(key)
 WHERE tp.resource_key = 'account-summary' AND tp.action = 'view'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- The per-family default moves too, for the families that set one. A key with no row
-- here resolves to 'everyone' for view, which is what the panes resolved to for every
-- family that never narrowed them — so an absent row is the right answer rather than
-- a gap. Copying it is what carries across a family that DID narrow a pane through
-- resource_visibility rather than through a template.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility, updated_at)
SELECT rv.family_code, m.new_key, rv.visibility, NOW()
  FROM public.resource_visibility rv
  JOIN (VALUES
    ('account-summary/dues',      'dues'),
    ('account-summary/donations', 'donations'),
    ('account-summary/history',   'payment-history')
  ) AS m(old_key, new_key) ON m.old_key = rv.resource_key
ON CONFLICT (family_code, resource_key) DO NOTHING;

INSERT INTO public.resource_visibility (family_code, resource_key, visibility, updated_at)
SELECT rv.family_code, 'account-summary/funds', rv.visibility, NOW()
  FROM public.resource_visibility rv
 WHERE rv.resource_key = 'account-summary'
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 2b. Assert the copy BEFORE §4 destroys the evidence ─────────────────────
-- Every pane grant is now the SAME SCOPE on the screen that replaced it. This has to
-- run here rather than with the rest of the verification: §4 cascades the pane rows
-- away, and afterwards there is nothing left to compare against.
--
-- It is a strictly sharper test than "the new key has a row", which is what §5c can
-- still ask once the panes are gone — and the difference is not academic. Mistyping one
-- key in the map above silently drops that pane's answer through to the FALLBACK pass,
-- which grants the page's scope instead. A member's access degrades from 'any' to 'own'
-- with a row present at the end of it, and every count-based assertion goes green.
-- Checked by doing exactly that (`account-summary/histry`), which passes without this
-- block and fails with it.
DO $$
DECLARE v_bad int; v_names text;
BEGIN
  SELECT count(*), string_agg(DISTINCT old.resource_key, ', ')
    INTO v_bad, v_names
    FROM public.template_permissions old
    JOIN (VALUES
      ('account-summary/dues',      'dues'),
      ('account-summary/donations', 'donations'),
      ('account-summary/history',   'payment-history')
    ) AS m(old_key, new_key) ON m.old_key = old.resource_key
    LEFT JOIN public.template_permissions new
      ON new.template_id = old.template_id
     AND new.resource_key = m.new_key
     AND new.action = old.action
   WHERE old.action = 'view'
     AND (new.scope IS NULL OR new.scope <> old.scope);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % pane grant(s) did not arrive on their screen with the same scope (%)', v_bad, v_names;
  END IF;
END $$;

-- ── 3. Summary's own caption stops promising a rail ─────────────────────────
-- Unchanged key, unchanged route, unchanged grant. Only the row's meaning narrows:
-- it used to open a page holding three panes, and now opens a digest of four screens.
-- Nothing to write — the row is already 'Summary' at 100 with actions {view} — so
-- this section exists to say that the absence of a statement here is deliberate.

-- ── 4. The pane keys retire ─────────────────────────────────────────────────
-- Cascades template_permissions and resource_visibility for each key, which is the
-- point: §2 has already copied both onto the routes, and a switch left on a screen
-- that no longer exists is worse than no switch — it reads as a control being
-- honoured. Same treatment 20260808000001 gave `dues` and 20260807000000 gave
-- `admin/groups`.
--
-- SAFE TO DELETE WITHOUT REWRITING A POLICY FIRST, which is NOT true in general and
-- was the trap 20260808000001 opens with. Deleting a resource changes what
-- auth_permission() RETURNS for its key — 'any' for view — so dropping one a policy
-- names turns that policy into a tautology. These three name nothing: they have no
-- permission_table_map row, they appear in no policy, and every read behind them was
-- always own-only in the action. §5 asserts the first two rather than trusting this.
DELETE FROM public.permission_resources
 WHERE key IN ('account-summary/dues', 'account-summary/donations', 'account-summary/history');

-- ── 5. Verify ───────────────────────────────────────────────────────────────
-- Unconditional. Everything asserted is schema, configuration or policy text, so none
-- of it needs a fixture and none of it can be skipped into a false pass — the failure
-- mode 20260806000012 shipped and AGENTS.md now warns about.
DO $$
DECLARE
  v_bad   int;
  v_names text;
BEGIN
  -- 5a. The four new resources exist.
  SELECT COUNT(*) INTO v_bad
    FROM (VALUES ('dues'), ('donations'), ('payment-history'), ('account-summary/funds')) AS k(key)
   WHERE NOT EXISTS (SELECT 1 FROM public.permission_resources r WHERE r.key = k.key);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % new resource(s) missing', v_bad;
  END IF;

  -- 5b. The three pane keys are gone, grants and visibility rows with them.
  SELECT COUNT(*) INTO v_bad FROM public.permission_resources
   WHERE key IN ('account-summary/dues', 'account-summary/donations', 'account-summary/history');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % pane resource(s) survived', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_bad FROM public.template_permissions
   WHERE resource_key IN ('account-summary/dues', 'account-summary/donations', 'account-summary/history');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % template grant(s) for a retired pane were not cascaded', v_bad;
  END IF;

  -- 5c. Nobody lost access on the way across. Every template that could view a pane
  -- can view the screen that replaced it — the assertion the copy in §2 exists to
  -- make, and the one thing here that a mistyped key in that JOIN would break
  -- silently, since a missing grant merely hides a nav item.
  SELECT COUNT(*) INTO v_bad
    FROM public.template_permissions tp
   WHERE tp.resource_key = 'account-summary' AND tp.action = 'view'
     AND EXISTS (SELECT 1 FROM (VALUES ('dues'), ('donations'), ('payment-history'), ('account-summary/funds')) AS k(key)
                  WHERE NOT EXISTS (
                    SELECT 1 FROM public.template_permissions n
                     WHERE n.template_id = tp.template_id AND n.resource_key = k.key AND n.action = 'view'));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % template(s) can view Summary but not every screen under it', v_bad;
  END IF;

  -- 5d. The accounting category still sorts unambiguously. 20260806000005's
  -- invariant: the grids emit a sub-section header the moment `subsection` changes,
  -- so a tie in sort_order puts a row inside a block it does not belong to.
  SELECT COUNT(*) INTO v_bad FROM (
    SELECT sort_order FROM public.permission_resources
     WHERE category = 'accounting'
     GROUP BY sort_order HAVING COUNT(*) > 1
  ) d;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % duplicate sort_order value(s) in the accounting category', v_bad;
  END IF;

  -- 5e. Every sub-resource still has its parent row — 20260808000000 §6b's invariant,
  -- re-asserted because this migration both adds a sub-key and deletes three.
  SELECT COUNT(*) INTO v_bad
    FROM public.permission_resources pr
   WHERE length(pr.key) - length(replace(pr.key, '/', '')) >= CASE WHEN pr.key LIKE 'admin/%' THEN 2 ELSE 1 END
     AND NOT EXISTS (
       SELECT 1 FROM public.permission_resources parent
        WHERE parent.key = left(pr.key, length(pr.key) - position('/' in reverse(pr.key)))
     );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % sub-resource(s) have no parent resource row', v_bad;
  END IF;

  -- 5f. No resource carries a grant for an action it does not declare.
  SELECT COUNT(*) INTO v_bad
    FROM public.template_permissions tp
    JOIN public.permission_resources pr ON pr.key = tp.resource_key
   WHERE NOT (tp.action::text = ANY(pr.actions));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % template grant(s) name an action their resource does not declare', v_bad;
  END IF;

  -- 5g. THE RESURRECTION GUARD, and the reason this file may re-use the word `dues`
  -- at all. The retired key was dangerous because policies evaluated it and the map
  -- would have re-composed them; the new one governs a screen and must gate no table.
  IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE resource_key = 'dues') THEN
    RAISE EXCEPTION 'ROLLBACK: the dues key is back in permission_table_map — see the header';
  END IF;

  -- Matched on the rendered literal `'dues'::text`, not on the word: 'admin/account/dues'
  -- and 'transactions/dues-payments' both contain it and both are live keys that must
  -- NOT match. Same test 20260808000001 §4b makes, re-made at this point in the chain,
  -- because what it proved then says nothing about what has been composed since.
  SELECT count(*), string_agg(tablename || '.' || policyname, ', ')
    INTO v_bad, v_names
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '') LIKE '%auth_permission(''dues''::text%'
       OR COALESCE(with_check, '') LIKE '%auth_permission(''dues''::text%');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % policy(ies) evaluate the dues key, which now gates only a screen: %', v_bad, v_names;
  END IF;

  -- 5h. And dues_payments still admits a member their own rows unconditionally. That
  -- clause is what makes /dues and /payment-history work for a member holding neither
  -- ledger grant, which is most of a family — and it is the one thing that would make
  -- all three new screens render empty for almost everybody if it were lost.
  SELECT count(*) INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'dues_payments' AND cmd = 'SELECT'
     AND qual LIKE '%auth_person_id()%';
  IF v_bad <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 1 dues_payments SELECT policy keeping the self clause, found %', v_bad;
  END IF;
END $$;

COMMIT;
