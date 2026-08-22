-- ============================================================================
-- `journals` -> `journals/officer`. The rail item is captioned **Officer**.
--
-- ── WHY A MIGRATION FOR A CAPTION, AGAIN ────────────────────────────────────
-- The rail read **Journals > Journals**: a section of one, whose item wore the section's own
-- word. That is the sanctioned shape only while the two mean the same thing (AGENTS.md, "A
-- section whose own index page IS the section does not double up"), and it stops being true
-- the moment the item is named for WHOSE notebook it is. The section is the feature; the item
-- is the officer's journal. So:
--
--     "A screen's route is `/<its rail section>/<its rail caption>`, kebab-cased. Its folder
--      is that path, and its permission key is that path without the leading slash."
--
-- Caption Officer under section Journals gives `/journals/officer`, and the key follows the
-- route. Leaving the key at `journals` under an item captioned Officer is the archaeology
-- 20260820000004 spent 42 keys undoing.
--
-- IT ALSO LEAVES ROOM. A journal that belongs to a CHAPTER rather than to an office is the
-- obvious second item in this section, and it would have had nowhere to go under a `/journals`
-- that was already a page.
--
-- ── THIS IS 20260822000000 AGAIN, ONE LEVEL DOWN, AND STILL CHEAP ───────────
-- AGENTS.md enumerates SIX things a key rename touches. This one touches three, and §5
-- asserts the other three rather than assuming them — the same list, the same order, the same
-- reasons that file gives:
--
--   1. `permission_resources.key`                — the row.                      moved below
--   2. `template_permissions.resource_key`       — every grant on every template. copied
--   3. `resource_visibility.resource_key`        — the per-family show/hide.      copied
--   4. `permission_table_map.resource_key`       — NONE, and asserted in both directions.
--      20260821000005 rests its whole access argument on this key gating no table: the OFFICE
--      decides who reads an entry, and `journals:view` resolves to 'everyone'. A map row would
--      compose an `auth_permission` factor onto these tables and open every officer's notebook
--      to the whole family.
--   5. the composed POLICY EXPRESSIONS           — NONE, for the same reason. Asked of
--      `pg_policies` below rather than of the migration files, because a composed policy is a
--      string that existed in no file anyone reviewed.
--   6. FUNCTION BODIES                           — NONE. `seed_family_permission_templates()`
--      derives from `permission_resources` and names neither the key nor its category, so a
--      family created tomorrow picks `journals/officer` up from the seeder with no edit.
--
-- ── WHAT DELIBERATELY DOES NOT MOVE ─────────────────────────────────────────
-- * **The three tables**, `position_journal_*`. A table name is not a caption and no
--   administrator ever reads one.
-- * **The category VALUE**, `journal`, whose LABEL is "Journals" in
--   `components/admin/resource-groups.ts`. `auth_permission()` reads that column to decide
--   whether an unregistered-visibility key fails closed, so it is load-bearing in SQL and
--   renaming it buys a heading nobody would notice. The `events` category printing
--   "Gatherings" is the standing precedent.
-- * **The help chapter's slug**, `journal`. A slug is NOT a route and moves with nothing.
--   Its `route` field DOES move, because that is checked against `FEATURES` by
--   `npm run help:check`.
-- * **The GRID's grouping.** The key gains a slash, and `getResources()` longest-prefix-matches
--   `getFeature()` — which is why the FEATURES entry has to move in the same commit. A key
--   under a prefix with no live entry vanishes from the grid with no error at all.
--
-- ── COPY-THEN-DELETE, NOT UPDATE ────────────────────────────────────────────
-- The two dependent foreign keys are ON DELETE CASCADE and not ON UPDATE CASCADE, so an
-- in-place `UPDATE permission_resources SET key` is rejected. New row, dependents copied onto
-- it, old row dropped — at which point the cascade sweeps only the duplicates this file left.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
--   the `template_permissions` copy removed
--     ERROR: N template(s) carry no journals/officer grant
--   the `resource_visibility` copy removed
--     ERROR: N family/families lost their journals visibility row in the rename
--     (on a database where any family had one — see the note beside the snapshot in §2)
--   the DELETE of the old row removed
--     ERROR: the journals key still exists — a rename that leaves both is two screens
--   the label left as 'Journals'
--     ERROR: the journals/officer resource is captioned Journals, not Officer
--
-- The half no migration can check is the app: `requireView(user.id, 'journals/officer')` on a
-- page at `app/(protected)/journals/officer/`, `href: '/journals/officer'` in
-- `lib/features.ts`, the Sidebar row, and the three `can(..., 'journals/officer', 'view')`
-- calls in `app/actions/journal.ts`. Getting one wrong 404s the screen for everybody, and what
-- says so is `npm run test:rls`' POSITIVE controls.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The new row, every column copied from the old one ────────────────────
-- Label is the ONE thing that changes. `actions` in particular stays `view` alone, which
-- 20260821000005 argues at length: no policy on these tables reads a write scope, so a write
-- switch would be a control nothing consults.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
SELECT 'journals/officer', 'Officer', pr.category, pr.subsection, pr.sort_order, pr.actions
  FROM public.permission_resources pr
 WHERE pr.key = 'journals'
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 2. Every grant and every visibility row, carried across ─────────────────
-- `updated_at` is carried rather than defaulted: these rows are decisions somebody already
-- made, and stamping them today would report a family as having changed a permission on the
-- day of a rename.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, 'journals/officer', tp.action, tp.scope, tp.updated_at
  FROM public.template_permissions tp
 WHERE tp.resource_key = 'journals'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

INSERT INTO public.resource_visibility (family_code, resource_key, visibility, updated_at)
SELECT rv.family_code, 'journals/officer', rv.visibility, rv.updated_at
  FROM public.resource_visibility rv
 WHERE rv.resource_key = 'journals'
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- WHICH FAMILIES HAD ONE, snapshotted before §3 removes the evidence. §4 asserts that none of
-- them lost it, which is the invariant a RENAME owes and is a different claim from "every
-- family has a row".
--
-- THE DIFFERENCE MATTERS AND 20260822000000 GOT IT WRONG in a way that has not bitten yet.
-- That file asserts every family with a member has a `journals` row, on the strength of
-- 20260821000005 having written one for each. True the moment it applied, and false on any
-- database where something has since swept the table — `tests/rls/seed.mjs` deletes
-- `resource_visibility` for its fixture families on every run, and `reset_families.sql` empties
-- it wholesale. So that assertion is a landmine on a developer's laptop rather than a check,
-- and it is asserting something a non-admin key does not need anyway: absence resolves `view`
-- to 'everyone', which is exactly what this screen wants. The rows are worth CARRYING (a
-- family that had chosen a value keeps it) and not worth INVENTING.
CREATE TEMP TABLE _officer_rename_had ON COMMIT DROP AS
  SELECT rv.family_code FROM public.resource_visibility rv
   WHERE rv.resource_key = 'journals';

-- ── 3. And the old row goes ─────────────────────────────────────────────────
-- Safe only after §2. Both dependents cascade, so this sweeps the `journals` copies of rows
-- that now exist under `journals/officer` — and leaving it out would leave a family with two
-- Journal switches, one of which governs a route that no longer resolves.
DELETE FROM public.permission_resources WHERE key = 'journals';

-- ── 4. The assertions ───────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_bad text;
  v_n   int;
BEGIN
  -- The new row exists and the old one does not. Both halves: a rename that leaves both keys
  -- gives every family two switches for one screen, and the one they turn off is a coin toss.
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'journals/officer') THEN
    RAISE EXCEPTION 'the journals/officer resource was not created';
  END IF;
  IF EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'journals') THEN
    RAISE EXCEPTION
      'the journals key still exists — a rename that leaves both is two screens';
  END IF;

  SELECT label INTO v_bad FROM public.permission_resources WHERE key = 'journals/officer';
  IF v_bad IS DISTINCT FROM 'Officer' THEN
    RAISE EXCEPTION 'the journals/officer resource is captioned %, not Officer',
      COALESCE(v_bad, 'null');
  END IF;

  -- THE CATEGORY DID NOT MOVE, which is the thing this file says it is not doing. The category
  -- is a column three resolvers agree about; the caption is one line in a TypeScript map.
  SELECT category INTO v_bad FROM public.permission_resources WHERE key = 'journals/officer';
  IF v_bad IS DISTINCT FROM 'journal' THEN
    RAISE EXCEPTION 'the journals/officer category moved to %, and nothing here asked it to',
      COALESCE(v_bad, 'null');
  END IF;

  -- `actions` IS `text[]` on this table, not `permission_action[]` — a `<>` between the two
  -- types is 42883 with no implicit cast to save it. Compared as text for that reason.
  IF EXISTS (SELECT 1 FROM public.permission_resources
              WHERE key = 'journals/officer' AND actions <> ARRAY['view']::text[]) THEN
    RAISE EXCEPTION
      'journals/officer must declare view only — no policy reads a write scope, so a write switch would be a control nothing consults';
  END IF;

  -- ── Every grant and every visibility row came across ──
  -- Counted against the TEMPLATES rather than against the old rows, which are gone by now:
  -- what matters is that no template renders a blank cell for a resource that exists (§6).
  SELECT count(*) INTO v_n FROM public.permission_templates t
   WHERE NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                      WHERE tp.template_id = t.id AND tp.resource_key = 'journals/officer');
  IF v_n > 0 THEN
    RAISE EXCEPTION '% template(s) carry no journals/officer grant', v_n;
  END IF;

  -- NOBODY LOST A ROW THEY HAD. Measured against the snapshot taken in §2 rather than against
  -- the roster, for the reason stated there: a family with no row is a family resolving to the
  -- 'everyone' default, which is correct for this key, while a family whose row VANISHED in
  -- this file has had a stated decision thrown away.
  SELECT count(*) INTO v_n
    FROM _officer_rename_had h
   WHERE NOT EXISTS (SELECT 1 FROM public.resource_visibility rv
                      WHERE rv.family_code = h.family_code
                        AND rv.resource_key = 'journals/officer');
  IF v_n > 0 THEN
    RAISE EXCEPTION '% family/families lost their journals visibility row in the rename', v_n;
  END IF;

  -- ── The three AGENTS.md items this rename claims not to touch ──
  -- 4. THE KEY GATES NO TABLE, in both directions, restated for the new key.
  IF EXISTS (SELECT 1 FROM public.permission_table_map
              WHERE resource_key IN ('journal', 'journals', 'journals/officer'))
     OR EXISTS (SELECT 1 FROM public.permission_table_map
                 WHERE table_name IN ('position_journal_entries',
                                      'position_journal_notes',
                                      'position_journal_attendees')) THEN
    RAISE EXCEPTION
      'journals/officer must have no permission_table_map row — the key gates the screen, the office gates the rows';
  END IF;

  -- 5. NO POLICY ANYWHERE CARRIES EITHER KEY AS A LITERAL.
  SELECT string_agg(format('%s.%s (%s)', schemaname, tablename, policyname), ', ')
    INTO v_bad
    FROM pg_policies
   WHERE (COALESCE(qual, '') || COALESCE(with_check, '')) ~ '''(journal|journals)''';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'policy/policies still name a retired journal key: %', v_bad;
  END IF;

  -- 6. NO FUNCTION BODY CARRIES IT EITHER. The seeder derives from `permission_resources`, so
  --    this is asserted rather than trusted — a hard-coded key in a SECURITY DEFINER body is
  --    the shape 20260820000004 found by an assertion failing, three times over.
  SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prosrc ~ '''(journal|journals)''';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'function body/bodies still name a retired journal key: %', v_bad;
  END IF;

  RAISE NOTICE 'journals -> journals/officer; the rail item is captioned Officer';
END $mig$;

COMMIT;
