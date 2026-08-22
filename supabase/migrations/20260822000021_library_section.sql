-- ============================================================================
-- Journals -> **Library**, and `journals/officer` -> `library/officer-notes`.
--
-- ── WHAT THIS DOES ──────────────────────────────────────────────────────────
--   journals/officer          -> library/officer-notes      captioned **Officer Notes**
--   journals/meeting-minutes  -> library/meeting-minutes
--   journals/documents        -> library/documents
--   journals/bylaws           -> library/bylaws
--
-- ── WHY THE SECTION IS RENAMED ──────────────────────────────────────────────
-- "Journals" described the section when it held one thing: an officeholder's notebook. It now
-- holds four, and three of them are not journals — Meeting Minutes is what a room decided,
-- Bylaws is what the family is bound by, Documents is a filing cabinet. A heading that names
-- one of its four children is a heading that tells a reader the other three are somewhere else.
--
-- **Library** is what they have in common: things the family keeps and goes back to. It is
-- warm rather than administrative, which matches Community and Gatherings beside it, and it
-- collides with no other caption in the rail.
--
-- ── AND WHY THE ITEM IS RENAMED WITH IT ─────────────────────────────────────
-- `Officer` alone leaned entirely on the word above it. Under a section called Journals it read
-- as "the officer's journal"; under any other word it reads as a list of officers, which is
-- what `/admin/members/board-positions` is. **Officer Notes** says what it is without the
-- section having to carry it, and the route follows the caption (§1).
--
-- The other three captions are unchanged and move only because their SECTION did.
--
-- ── SIX THINGS A KEY RENAME TOUCHES; THIS ONE TOUCHES THREE ─────────────────
-- AGENTS.md's list, in its order:
--
--   1. `permission_resources.key`                — four rows.                    moved below
--   2. `template_permissions.resource_key`       — every grant on every template. copied
--   3. `resource_visibility.resource_key`        — the per-family show/hide.      copied
--   4. `permission_table_map.resource_key`       — ONE OF THE FOUR, and the first draft of
--      this file said "none" and was refused by its own §7. `journals/documents` gates the
--      `documents` table and has since 20260618000001 — its `own_expr` is
--      `uploaded_by = auth_person_id()`, which is what makes an uploader able to delete their
--      own filing and nobody else's. That row moves in place.
--
--      THE OTHER THREE GATE NO TABLE and must not start to, which §7 asserts forwards as well
--      as backwards. An officer's journal is gated by the OFFICE, minutes by the session's own
--      secretary and attendee list, and bylaws by nothing beyond family and approval. A map row
--      appearing later would compose an `auth_permission` factor onto those tables with `view`
--      defaulting to 'everyone', which for the journal would open every officer's notebook to
--      the whole family.
--   5. the composed POLICY EXPRESSIONS           — THREE, all on `documents`, all carrying
--      `journals/documents` as a `%L` literal. Updating the map does NOT touch them: the map is
--      read when the sweep runs and never again. The rewrite loop is copied from
--      20260820000004, which established it for 42 keys.
--   6. FUNCTION BODIES                           — NONE. `seed_family_permission_templates()`
--      derives from `permission_resources` and names none of these four.
--
-- ── THE CATEGORY VALUE STAYS `journal`, AND THAT IS THE PRECEDENT ───────────
-- Its LABEL becomes "Library" in `components/admin/resource-groups.ts`, exactly as the `events`
-- category has printed "Gatherings" since that product was retired. `auth_permission()` reads
-- the category column to decide whether an unregistered-visibility key fails closed, so it is
-- load-bearing in SQL; a caption is one line in a TypeScript map. §7 asserts the value did not
-- move, because a rename of it would be silent and would change how four keys fail.
--
-- ── THE HELP SLUGS STAY TOO ─────────────────────────────────────────────────
-- `journal`, `meeting-minutes`, `documents`, `bylaws`. A slug is a chapter's identity in
-- `/help/<slug>` and AGENTS.md is explicit that it is not a route and moves with nothing. Their
-- `route` fields DO move, and `npm run help:check` is what asserts each is a real `FEATURES`
-- href.
--
-- ── THIS IS THE THIRD MOVE OF THE OFFICER'S ROUTE IN THREE DAYS ─────────────
-- `/journal` -> `/journals` -> `/journals/officer` -> `/library/officer-notes`. Each was one
-- rule being obeyed rather than four opinions: the caption is the route and the route is the
-- key. Worth saying plainly because the churn is the visible part and the rule is not — what it
-- buys is that a reader who knows the rail can write the path, and a reader who has the path
-- can find the file and the grant. The alternative is what 20260820000004 spent 42 keys undoing.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
--   the `template_permissions` copy removed
--     ERROR: template(s) carry no grant for: library/bylaws, library/documents, …
--   the DELETE of the old rows removed
--     ERROR: retired journals key(s) still registered: journals/bylaws, …
--   the label left as 'Officer'
--     ERROR: a moved key landed with the wrong caption: library/officer-notes=Officer
--   the category rewritten to 'library'
--     ERROR: the category value moved to library, and nothing here asked it to
--   the `permission_table_map` update removed
--     ERROR: permission_table_map still points 1 table(s) at a retired journals key
--   the policy rewrite loop removed
--     ERROR: policy/policies still name a retired journals key: documents (…) — which is
--     what the FIRST DRAFT of this file did, by asserting there were none to rewrite
--
-- The half no migration can check is the app: `requireView(user.id, 'library/…')` on pages
-- under `app/(protected)/library/`, and four `href`s in `lib/features.ts`. Getting one wrong
-- 404s the screen for everybody, and what says so is `npm run test:rls`' POSITIVE controls.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The pairs, once ──────────────────────────────────────────────────────
CREATE TEMP TABLE key_moves (
  old_key   text PRIMARY KEY,
  new_key   text NOT NULL,
  new_label text NOT NULL
) ON COMMIT DROP;

INSERT INTO key_moves VALUES
  ('journals/officer',         'library/officer-notes',    'Officer Notes'),
  ('journals/meeting-minutes', 'library/meeting-minutes',  'Meeting Minutes'),
  ('journals/documents',       'library/documents',        'Documents'),
  ('journals/bylaws',          'library/bylaws',           'Bylaws');

-- ── 2. The new rows ─────────────────────────────────────────────────────────
-- Category, subsection, sort_order and `actions` are all CARRIED. Only the key and, for one of
-- the four, the label change: this is a section being renamed, not a permission model being
-- reconsidered, and a migration that quietly widened an `actions` array on its way past would
-- be the worst kind of rename.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
SELECT m.new_key, m.new_label, pr.category, pr.subsection, pr.sort_order, pr.actions
  FROM public.permission_resources pr
  JOIN key_moves m ON m.old_key = pr.key
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 3. Every grant and every visibility row, carried across ─────────────────
-- `updated_at` is carried rather than defaulted: these are decisions somebody already made, and
-- stamping them today would report a family as having changed a permission on the day of a
-- rename.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, m.new_key, tp.action, tp.scope, tp.updated_at
  FROM public.template_permissions tp
  JOIN key_moves m ON m.old_key = tp.resource_key
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

INSERT INTO public.resource_visibility (family_code, resource_key, visibility, updated_at)
SELECT rv.family_code, m.new_key, rv.visibility, rv.updated_at
  FROM public.resource_visibility rv
  JOIN key_moves m ON m.old_key = rv.resource_key
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- Snapshotted before §6 removes the evidence, so §7 can assert what was LOST rather than what
-- every family happens to have — 20260822000017's argument, which that file's own header
-- explains at length.
CREATE TEMP TABLE vis_before ON COMMIT DROP AS
  SELECT rv.family_code, m.new_key
    FROM public.resource_visibility rv
    JOIN key_moves m ON m.old_key = rv.resource_key;

-- ── 4. Which table each key gates ───────────────────────────────────────────
-- One row, `documents`. Keyed on `table_name`, so it moves in place.
UPDATE public.permission_table_map ptm
   SET resource_key = m.new_key
  FROM key_moves m
 WHERE ptm.resource_key = m.old_key;

-- ── 5. Rewrite the policies that carry a key as a literal ───────────────────
-- Copied from 20260820000004 §5, which argues every line of it. In short: `_perm_predicate()`
-- renders the key with `%L`, so the WHOLE literal including its quotes is replaced — prefix
-- bleed is impossible because `'journals/documents'::text` and `'journals/documents/x'::text`
-- are different strings. Each policy is dropped and recreated under its own name, command and
-- roles, with ONLY the clauses it actually had: a NULL `qual` or `with_check` is meaningful,
-- and `format(' USING (%s)', NULL)` renders as ' USING ()' rather than NULL, so it is a CASE
-- and never a COALESCE.
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
              WHERE COALESCE(pg_policies.qual, '') LIKE '%''' || k.old_key || '''%'
                 OR COALESCE(pg_policies.with_check, '') LIKE '%''' || k.old_key || '''%')
  LOOP
    v_qual  := p.qual;
    v_check := p.with_check;
    FOR m IN SELECT old_key, new_key FROM key_moves LOOP
      v_qual  := replace(v_qual,  '''' || m.old_key || '''::text', '''' || m.new_key || '''::text');
      v_check := replace(v_check, '''' || m.old_key || '''::text', '''' || m.new_key || '''::text');
    END LOOP;

    v_roles := array_to_string(p.roles, ', ');
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO %s', p.policyname, p.tablename,
                   p.cmd, v_roles)
            || CASE WHEN v_qual  IS NOT NULL THEN format(' USING (%s)', v_qual)       ELSE '' END
            || CASE WHEN v_check IS NOT NULL THEN format(' WITH CHECK (%s)', v_check) ELSE '' END;

    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'rewrote % policy/policies onto the library keys', v_count;
END $mig$;

-- ── 6. The old rows go ──────────────────────────────────────────────────────
-- Safe only after §3: both dependents cascade, so this sweeps the `journals/*` copies of rows
-- that now exist under `library/*`. Leaving it out would give every family two switches for
-- each screen, one of which governs a route that no longer resolves.
DELETE FROM public.permission_resources pr
 USING key_moves m
 WHERE pr.key = m.old_key;

-- ── 7. The assertions ───────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_bad text;
  v_n   int;
BEGIN
  -- 7a. Four new rows, four old ones gone, and each captioned as this file says.
  SELECT count(*) INTO v_n FROM key_moves m
   WHERE NOT EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = m.new_key);
  IF v_n > 0 THEN
    RAISE EXCEPTION '% library resource(s) were not created', v_n;
  END IF;

  SELECT string_agg(m.old_key, ', ' ORDER BY m.old_key) INTO v_bad
    FROM key_moves m JOIN public.permission_resources pr ON pr.key = m.old_key;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'retired journals key(s) still registered: %', v_bad;
  END IF;

  SELECT string_agg(format('%s=%s', pr.key, pr.label), ', ') INTO v_bad
    FROM public.permission_resources pr
    JOIN key_moves m ON m.new_key = pr.key
   WHERE pr.label <> m.new_label;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a moved key landed with the wrong caption: %', v_bad;
  END IF;

  -- 7b. THE CATEGORY DID NOT MOVE. It is the thing this file says it is not doing, and getting
  -- it wrong is silent: `auth_permission()` reads this column to decide whether a key with no
  -- visibility row fails closed, so a changed value changes how all four keys fail.
  SELECT string_agg(format('%s=%s', pr.key, pr.category), ', ') INTO v_bad
    FROM public.permission_resources pr
    JOIN key_moves m ON m.new_key = pr.key
   WHERE pr.category <> 'journal';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'the category value moved: % — and nothing here asked it to', v_bad;
  END IF;

  -- 7c. Nothing anywhere still names a retired key. Three places, and the second would fail
  -- OPEN: a policy asking about a key nobody has registered falls through `auth_permission` to
  -- its default, which is 'everyone' for view.
  SELECT count(*) INTO v_n
    FROM public.permission_table_map ptm JOIN key_moves m ON m.old_key = ptm.resource_key;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'permission_table_map still points % table(s) at a retired journals key', v_n;
  END IF;

  SELECT string_agg(format('%s (%s)', tablename, policyname), ', ') INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND EXISTS (SELECT 1 FROM key_moves k
                  WHERE COALESCE(pg_policies.qual, '') LIKE '%''' || k.old_key || '''%'
                     OR COALESCE(pg_policies.with_check, '') LIKE '%''' || k.old_key || '''%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'policy/policies still name a retired journals key: %', v_bad;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND EXISTS (SELECT 1 FROM key_moves k WHERE p.prosrc LIKE '%''' || k.old_key || '''%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'function body/bodies still name a retired journals key: %', v_bad;
  END IF;

  -- 7d. `library/documents` GATES `documents` AND THE OTHER THREE GATE NOTHING. Both halves,
  -- and the second is the claim the access model of three of these four screens rests on:
  -- their row rules are the office, the session's secretary and the attendee list, none of
  -- which a key can express. A map row appearing later would compose an `auth_permission`
  -- factor onto those tables with `view` defaulting to 'everyone'.
  IF NOT EXISTS (SELECT 1 FROM public.permission_table_map
                  WHERE resource_key = 'library/documents' AND table_name = 'documents') THEN
    RAISE EXCEPTION 'library/documents no longer gates the documents table';
  END IF;

  SELECT string_agg(format('%s -> %s', ptm.resource_key, ptm.table_name), ', ') INTO v_bad
    FROM public.permission_table_map ptm
   WHERE ptm.resource_key IN ('library/officer-notes', 'library/meeting-minutes',
                              'library/bylaws');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'a library key that must gate no table gates one: % — the office, the secretary and the attendee list are the row rules, not the key',
      v_bad;
  END IF;

  -- ...and the three policies really did land on the new key, which is the half that catches a
  -- rewrite loop that ran and matched nothing.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'documents'
     AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%library/documents%';
  IF v_n <> 3 THEN
    RAISE EXCEPTION
      'expected 3 documents policies naming library/documents, found %', v_n;
  END IF;

  -- 7e. Every template renders a cell for every moved key (§6).
  SELECT string_agg(DISTINCT m.new_key, ', ') INTO v_bad
    FROM public.permission_templates t
    CROSS JOIN key_moves m
   WHERE NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                      WHERE tp.template_id = t.id AND tp.resource_key = m.new_key);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'template(s) carry no grant for: %', v_bad;
  END IF;

  -- 7f. Nobody lost a visibility row they had. Against §3's snapshot, never against the roster.
  SELECT count(*) INTO v_n
    FROM vis_before b
   WHERE NOT EXISTS (SELECT 1 FROM public.resource_visibility rv
                      WHERE rv.family_code = b.family_code AND rv.resource_key = b.new_key);
  IF v_n > 0 THEN
    RAISE EXCEPTION '% family/families lost a visibility row in the rename', v_n;
  END IF;

  RAISE NOTICE 'Journals -> Library; the officer''s notebook is library/officer-notes';
END $mig$;

COMMIT;
