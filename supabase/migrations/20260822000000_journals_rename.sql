-- ============================================================================
-- `journal` -> `journals`. One key, one route, one caption.
--
-- ── WHY A MIGRATION FOR A LETTER ────────────────────────────────────────────
-- The screen is called **Journals** now. AGENTS.md ("The route tree IS the nav rail") leaves
-- nothing to decide after that:
--
--     "A screen's route is `/<its rail section>/<its rail caption>`, kebab-cased. Its folder
--      is that path, and its permission key is that path without the leading slash."
--
-- So the caption moving to Journals moves `/journal` to `/journals`, and moves the key with
-- it. A route of `/journal` under a rail item captioned Journals is exactly the archaeology
-- 20260820000004 spent 42 keys undoing — every one of them defensible on the day it was
-- written and none of them findable a year later.
--
-- ── THIS IS THE CHEAPEST POSSIBLE VERSION OF THAT RENAME, AND THAT IS A FACT ──────
-- AGENTS.md enumerates SIX things a key rename touches. `journal` is one day old and touches
-- three of them, which §5 asserts rather than assumes:
--
--   1. `permission_resources.key`                — the row.                      moved below
--   2. `template_permissions.resource_key`       — every grant on every template. copied
--   3. `resource_visibility.resource_key`        — the per-family show/hide.      copied
--   4. `permission_table_map.resource_key`       — NONE. 20260821000005 asserts, in both
--      directions, that this key gates no table: the office decides who reads an entry, and
--      the key gates only the SCREEN. So there is nothing here to move and §5 re-asserts the
--      absence, because a row appearing later would silently make the key a row filter.
--   5. the composed POLICY EXPRESSIONS           — NONE, for the same reason. No policy on
--      `position_journal_entries` evaluates `auth_permission` at all, and no policy anywhere
--      else names this key. Verified with the enumeration AGENTS.md gives for exactly this:
--        grep -rhoE "auth_[a-z_]+\('[a-z/-]+'" supabase/migrations/*.sql | sort -u
--      the only hit for journal being a COMMENT in 20260821000005. §5 asks the catalogue
--      rather than trusting that grep.
--   6. FUNCTION BODIES                           — NONE. `seed_family_permission_templates()`
--      derives from `permission_resources` and names neither the key nor its category, which
--      20260821000005 §9 already asserts and §5 here re-asserts against the NEW key. That is
--      what makes this file the whole rename: a family created tomorrow picks `journals` up
--      from the seeder with no edit, exactly as it picked `journal` up yesterday.
--
-- ── WHAT DELIBERATELY DOES NOT MOVE ─────────────────────────────────────────
-- * **The table**, `position_journal_entries`. A table name is not a caption and no
--   administrator ever reads one. Renaming it would rewrite four policies, two triggers, an
--   index and every `from(...)` in the tree to change nothing anybody can see.
-- * **The category VALUE**, `journal`. Its LABEL becomes "Journals" in
--   `components/admin/resource-groups.ts`, which is the precedent that file already states
--   for `events` printing "Gatherings": "A caption is one line here; a category is a column
--   three resolvers agree about." `auth_permission()` reads that column to decide whether an
--   unregistered-visibility key fails closed, so it is load-bearing in SQL and a rename of it
--   buys a heading nobody would notice.
-- * **The help chapter's slug**, `journal`. AGENTS.md is explicit that a slug is NOT a route
--   and must never be swept with one — it is the chapter's identity in `/help/<slug>` and it
--   moves with nothing.
--
-- ── COPY-THEN-DELETE, NOT UPDATE ────────────────────────────────────────────
-- The two dependent foreign keys are ON DELETE CASCADE and not ON UPDATE CASCADE, so an
-- in-place `UPDATE permission_resources SET key` is rejected. Same order 20260820000004 used:
-- the new row, then every dependent copied onto it, then the old row dropped — at which point
-- the cascade sweeps only the duplicates this file left behind.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
--   the `template_permissions` copy removed
--     ERROR: N template(s) carry no journals grant
--   the `resource_visibility` copy removed
--     ERROR: N family/families lost their journals visibility row
--   the DELETE of the old row removed
--     ERROR: the journal key still exists — a rename that leaves both is two screens
--   `journals` given category `admin`
--     ERROR: category and key shape disagree for: journals (category=admin)
--
-- The half no migration can check is the app: `requireView(user.id, 'journals')` on a page at
-- `app/(protected)/journals/`, and `href: '/journals'` in `lib/features.ts`. Getting one of
-- those wrong 404s the screen for everybody — `viewableResources()` walks the registry, so an
-- unregistered page can never be hidden from anybody — and what says so is
-- `npm run test:rls`' POSITIVE controls, which is how the same class of mistake was caught in
-- 20260820000004 (five actions where a family's own administrator could no longer do their
-- own job, with every attack assertion still passing).
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The new row, every column copied from the old one ────────────────────
-- Label is the ONE thing that changes. Category, subsection, sort_order and `actions` are
-- carried, so the grid renders the switch in the same place with a new caption — and `actions`
-- in particular stays `view` alone, which 20260821000005 argues at length: no policy on this
-- table reads a write scope, so a write switch would be a control nothing consults.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
SELECT 'journals', 'Journals', pr.category, pr.subsection, pr.sort_order, pr.actions
  FROM public.permission_resources pr
 WHERE pr.key = 'journal'
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 2. Every grant and every visibility row, carried across ─────────────────
-- `updated_at` is carried rather than defaulted: these rows are the same decisions somebody
-- already made, and stamping them today would report a family as having changed a permission
-- on the day of a rename.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, 'journals', tp.action, tp.scope, tp.updated_at
  FROM public.template_permissions tp
 WHERE tp.resource_key = 'journal'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

INSERT INTO public.resource_visibility (family_code, resource_key, visibility, updated_at)
SELECT rv.family_code, 'journals', rv.visibility, rv.updated_at
  FROM public.resource_visibility rv
 WHERE rv.resource_key = 'journal'
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 3. And the old row goes ─────────────────────────────────────────────────
-- Safe only after §2. Both dependents cascade, so this sweeps the `journal` copies of rows
-- that now exist under `journals` — and leaving it out would leave a family with two Journal
-- switches, one of which governs a screen that no longer exists.
DELETE FROM public.permission_resources WHERE key = 'journal';

-- ── 4. Nothing else to do, and that is the claim §5 tests ───────────────────
-- No `permission_table_map` row to move, no policy literal to rewrite, no function body to
-- redefine. Each of those is an ASSERTION below rather than a sentence here, because all three
-- are things a later migration could add without anybody thinking about this file.

-- ── 5. The assertions ───────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_bad text;
  v_n   int;
BEGIN
  -- The new row exists and the old one does not. Both halves: a rename that leaves both keys
  -- gives every family two switches for one screen, and the one they turn off is a coin toss.
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'journals') THEN
    RAISE EXCEPTION 'the journals resource was not created';
  END IF;
  IF EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'journal') THEN
    RAISE EXCEPTION
      'the journal key still exists — a rename that leaves both is two screens';
  END IF;

  SELECT label INTO v_bad FROM public.permission_resources WHERE key = 'journals';
  IF v_bad IS DISTINCT FROM 'Journals' THEN
    RAISE EXCEPTION 'the journals resource is captioned %, not Journals',
      COALESCE(v_bad, 'null');
  END IF;

  -- `actions` IS `text[]` on this table, not `permission_action[]` — a `<>` between the two
  -- types is 42883 with no implicit cast to save it, which 20260821000005 learned by failing
  -- to apply. Compared as text for that reason.
  IF EXISTS (SELECT 1 FROM public.permission_resources
              WHERE key = 'journals' AND actions <> ARRAY['view']::text[]) THEN
    RAISE EXCEPTION
      'journals must declare view only — no policy reads a write scope, so a write switch would be a control nothing consults';
  END IF;

  -- ── Every grant and every visibility row came across ──
  -- Counted against the TEMPLATES rather than against the old rows, which are gone by now:
  -- what matters is that no template renders a blank cell for a resource that exists (§6).
  SELECT count(*) INTO v_n FROM public.permission_templates t
   WHERE NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                      WHERE tp.template_id = t.id AND tp.resource_key = 'journals');
  IF v_n > 0 THEN
    RAISE EXCEPTION '% template(s) carry no journals grant', v_n;
  END IF;

  -- One row per family that had one. `journal`'s own migration wrote 'everyone' for every
  -- family with a member, so a family that has lost its row here has lost a stated default.
  SELECT count(*) INTO v_n
    FROM (SELECT DISTINCT p.family_code AS family_code FROM public.people p
           WHERE p.family_code IS NOT NULL AND p.family_code <> '') f
   WHERE NOT EXISTS (SELECT 1 FROM public.resource_visibility rv
                      WHERE rv.family_code = f.family_code AND rv.resource_key = 'journals');
  IF v_n > 0 THEN
    RAISE EXCEPTION '% family/families lost their journals visibility row', v_n;
  END IF;

  -- ── The three things AGENTS.md lists that this rename claims not to touch ──
  -- 4. THE KEY GATES NO TABLE, in both directions. This is the assertion 20260821000005's
  --    whole access argument rests on, restated for the new key: `journals:view` resolves to
  --    'everyone', so a `permission_table_map` row would open every officer's notebook to the
  --    whole family through a policy factor nobody wrote by hand.
  IF EXISTS (SELECT 1 FROM public.permission_table_map
              WHERE resource_key IN ('journal', 'journals'))
     OR EXISTS (SELECT 1 FROM public.permission_table_map
                 WHERE table_name = 'position_journal_entries') THEN
    RAISE EXCEPTION
      'journals must have no permission_table_map row — the key gates the screen, the office gates the rows';
  END IF;

  -- 5. NO POLICY ANYWHERE CARRIES EITHER KEY AS A LITERAL. Asked of `pg_policies` rather than
  --    of the migration files, because a composed policy is a string that existed in no file
  --    anyone reviewed — which is the whole reason AGENTS.md numbers this as its own item.
  SELECT string_agg(format('%s.%s (%s)', schemaname, tablename, policyname), ', ')
    INTO v_bad
    FROM pg_policies
   WHERE (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%''journal''%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'policy/policies still name the old journal key: %', v_bad;
  END IF;

  -- 6. THE SEEDER DERIVES, so a family created tomorrow gets `journals` with no edit here. The
  --    failure mode of being wrong is invisible until somebody registers a family and cannot
  --    open a screen every existing family can.
  IF EXISTS (
    SELECT 1 FROM pg_proc pp JOIN pg_namespace n ON n.oid = pp.pronamespace
     WHERE n.nspname = 'public' AND pp.proname = 'seed_family_permission_templates'
       AND pg_get_functiondef(pp.oid) LIKE '%''journal%') THEN
    RAISE EXCEPTION
      'seed_family_permission_templates() names a journal key by hand — it should derive it';
  END IF;

  -- 20260817000004's invariant, re-asked because this file writes a resource row. `journals`
  -- is a non-admin key in a non-admin category, so it holds in both directions.
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

  RAISE NOTICE 'journal -> journals: resource renamed, grants and visibility carried across';
END $mig$;

COMMIT;
