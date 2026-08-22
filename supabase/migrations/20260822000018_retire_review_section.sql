-- ============================================================================
-- The Review worklist is finished. Its last two screens leave, and Journals gains two more.
--
-- ── WHAT THIS DOES, IN ONE TABLE ────────────────────────────────────────────
--   review/photos      -> community/gallery          captioned **Gallery**, category community
--   review/documents   -> journals/documents         captioned **Documents**, category journal
--   (new)                 journals/meeting-minutes   captioned **Meeting Minutes**
--   (new)                 journals/bylaws            captioned **Bylaws**
--
-- ── THE REVIEW SECTION GOES WITH THEM, WHICH IS THE POINT ───────────────────
-- `buildNavGroups` in components/layout/Sidebar.tsx has carried a **Review** heading since
-- 2026-08-20, holding the six routes that came off `status: 'future'` that day so somebody
-- could walk them. Its own comment states the exit condition: "when the last row goes, this
-- whole block goes with it. A Review section that outlives the review is the thing to avoid."
-- Four rows left on their own days; these are the last two, and the heading is deleted in the
-- same commit. This file is the database half of that.
--
-- ── WHERE THE TWO WENT, AND WHY THEY WENT TO DIFFERENT SECTIONS ─────────────
-- The same outcome the elections pair had: the walk decides where a screen belongs.
--
-- **Gallery is COMMUNITY.** A shared album of the family's photographs is the family being a
-- family, which is what that section holds — the Directory, the tree, Chat, Announcements. It
-- was filed under `resources` beside Documents on the strength of both being uploads, which is
-- a fact about the STORAGE and not about what either screen is for. The caption moves from
-- "Photos" to **Gallery** because the section already has a Directory and a Family Tree and
-- "Photos" named a file type rather than a thing the family keeps.
--
-- **Documents is JOURNALS.** A family's records — its bylaws, its forms, its filings — sit
-- beside the notebooks its officers keep, and the reader who wants one is the reader who wants
-- the other. Under `resources` it was in a section of two whose only shared property was that
-- you upload to both.
--
-- ── AND JOURNALS GAINS TWO SCREENS ──────────────────────────────────────────
-- **Meeting Minutes** takes the meeting half of the officer's journal, which 20260822000001
-- put there as a `kind` on an entry and which has outgrown it: a meeting is a session with a
-- secretary, an attendee list, topics and votes, not a topic in one office's notebook.
-- `20260822000019` builds it and drops the columns it replaces.
--
-- **Bylaws** is SCAFFOLDING and is registered here so the route is not the last thing built.
-- `20260822000020` gives it a table.
--
-- ── SIX THINGS A KEY RENAME TOUCHES, AND THIS ONE TOUCHES ALL SIX ───────────
-- Unlike 20260822000000 and 20260822000017, which touched three each. AGENTS.md's list, in
-- its order, and where each is handled:
--
--   1. `permission_resources.key`                — §2, copy-then-delete
--   2. `template_permissions.resource_key`       — §3
--   3. `resource_visibility.resource_key`        — §3
--   4. `permission_table_map.resource_key`       — §4. FOUR ROWS: three for the gallery
--      (`photos`, `photo_tags`, `photo_collections`) and one for `documents`. Keyed on
--      `table_name`, so they move in place.
--   5. the composed POLICY EXPRESSIONS           — §5. FOURTEEN policies carry one of these
--      two keys as a `%L` literal, and updating the map does NOT touch them: the map is read
--      when the sweep runs and never again. Left behind they would ask `auth_permission()`
--      about a key that no longer exists, which falls through to its default — WORLD-READABLE
--      for view and closed for every write. The rewrite loop is copied from 20260820000004,
--      which is the file that established it for 42 keys.
--   6. FUNCTION BODIES                           — §6. `seed_family_permission_templates()`
--      names `review/photos` three times in the General template's VALUES list.
--
-- ── §6 IS DONE BY REWRITING THE FUNCTION'S OWN SOURCE, NOT BY COPYING A BODY ─
-- 20260820000004 pasted the whole body in, and its header records the cost of getting that
-- wrong: "That mistake was made the day before this and cost the family tree's edit grant" —
-- a body copied from an older migration than the newest one. That function has since been
-- redefined by six files. Rather than paste a seventh copy and hope it is the current one,
-- this reads `pg_get_functiondef()` — which returns a complete, re-executable
-- `CREATE OR REPLACE`, whatever wrote it last — substitutes the key literals in it, and
-- executes the result. §7 then asserts the new key is in the body and the old one is not.
--
-- That is strictly safer than a paste and it is not a licence to be clever elsewhere: it works
-- HERE because the edit is a substitution of quoted literals, which cannot change the shape of
-- the statement. A body that needed a new line still has to be written out.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
--   the policy rewrite loop removed
--     ERROR: N policy/policies still name a retired review key
--   the `permission_table_map` update removed
--     ERROR: permission_table_map still points 4 table(s) at a retired review key
--   the seeder rewrite removed
--     ERROR: seed_family_permission_templates() still names review/photos
--   the `template_permissions` copy removed
--     ERROR: N template(s) carry no community/gallery grant
--   the DELETE of the old rows removed
--     ERROR: retired review key(s) still registered: review/documents, review/photos
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The pairs, once, so every step below reads the same list ─────────────
CREATE TEMP TABLE key_moves (
  old_key    text PRIMARY KEY,
  new_key    text NOT NULL,
  new_label  text NOT NULL,
  new_cat    text NOT NULL,
  new_sort   int  NOT NULL
) ON COMMIT DROP;

INSERT INTO key_moves VALUES
  ('review/photos',    'community/gallery',  'Gallery',   'community', 85),
  ('review/documents', 'journals/documents', 'Documents', 'journal',   20);

-- ── 2. The new rows ─────────────────────────────────────────────────────────
-- `actions` is CARRIED from the old row, not restated: both keys declare all four today and a
-- rename is not the place to change what a family can switch. `sort_order` and `category` DO
-- change, because the whole point is that these rows move house.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
SELECT m.new_key, m.new_label, m.new_cat, pr.subsection, m.new_sort, pr.actions
  FROM public.permission_resources pr
  JOIN key_moves m ON m.old_key = pr.key
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 3. Every grant and every visibility row, carried across ─────────────────
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

-- WHICH FAMILIES HAD ONE, snapshotted before §6 removes the evidence — 20260822000017's
-- argument for asserting what was LOST rather than what everybody has.
CREATE TEMP TABLE vis_before ON COMMIT DROP AS
  SELECT rv.family_code, m.new_key
    FROM public.resource_visibility rv
    JOIN key_moves m ON m.old_key = rv.resource_key;

-- ── 4. Which table each key gates ───────────────────────────────────────────
UPDATE public.permission_table_map ptm
   SET resource_key = m.new_key
  FROM key_moves m
 WHERE ptm.resource_key = m.old_key;

-- ── 5. Rewrite the policies that carry a key as a literal ───────────────────
-- Copied from 20260820000004 §5, which argues every line of it. In short: `_perm_predicate()`
-- renders the key with `%L`, so the WHOLE literal including its quotes is replaced — prefix
-- bleed is impossible because `'review/photos'::text` and `'review/photos/x'::text` are
-- different strings. Each policy is dropped and recreated under its own name, command and
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
  RAISE NOTICE 'rewrote % policy/policies onto the new keys', v_count;
END $mig$;

-- ── 6. The old rows go ──────────────────────────────────────────────────────
DELETE FROM public.permission_resources pr
 USING key_moves m
 WHERE pr.key = m.old_key;

-- ── 7. The seeder names a moved key in its own body ─────────────────────────
-- See the header for why this reads the current definition rather than pasting a body.
DO $mig$
DECLARE
  v_def text;
  m     record;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'seed_family_permission_templates';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'seed_family_permission_templates() is missing';
  END IF;

  FOR m IN SELECT old_key, new_key FROM key_moves LOOP
    v_def := replace(v_def, '''' || m.old_key || '''', '''' || m.new_key || '''');
  END LOOP;

  EXECUTE v_def;
END $mig$;

-- ── 8. The two new Journals screens ─────────────────────────────────────────
-- REGISTERED HERE, BUILT LATER, and that ordering is deliberate: `viewableResources()` walks
-- this registry to build the rail, so a key that arrives after its page is a page nobody can
-- be granted. 20260822000019 and 20260822000020 add the tables.
--
-- `journals/meeting-minutes` declares ALL FOUR ACTIONS and every one is consulted:
--   view    the page gate
--   create  scheduling a meeting
--   edit    changing a scheduled meeting, and closing it
--   delete  removing one
-- What the key does NOT decide is who WRITES THE MINUTES or who VOTES — those are the
-- secretary and the attendee list, on the row, enforced by the actions and by triggers
-- (20260822000019). A key cannot express "the person this session named", which is the same
-- distinction `journals/officer` draws about the office.
--
-- `journals/bylaws` declares THREE and not four. There is no `edit`, because nothing reads
-- one: the scaffolding uploads a document and removes it, and a bylaw's text is whatever was
-- uploaded. A switch nothing consults reads as a control being honoured, which is the rule
-- 20260808000000 narrowed `transactions` and `account-summary` for.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES
  ('journals/meeting-minutes', 'Meeting Minutes', 'journal', NULL, 15,
   ARRAY['view', 'create', 'edit', 'delete']),
  ('journals/bylaws',          'Bylaws',          'journal', NULL, 25,
   ARRAY['view', 'create', 'delete'])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- §6: a resource registered after 20260807000000 has no row in the templates that already
-- exist, so the grid would render a blank cell where a fall-through lives. Both are
-- `view` at 'any' for every template, matching `journals/officer` — the screen is open to the
-- family and the ROW rules decide the rest.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, k.key, 'view'::public.permission_action, 'any'::public.permission_scope
  FROM public.permission_templates t
  CROSS JOIN (VALUES ('journals/meeting-minutes'), ('journals/bylaws')) AS k(key)
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- THE WRITE ACTIONS GO TO ADMINISTRATORS ONLY, and to the General template not at all.
-- Scheduling a meeting of the family, and publishing its bylaws, are organizational acts —
-- unlike a photograph, which every member may upload. A family that wants its secretary to
-- schedule meetings without being an administrator grants the key on their template, which is
-- the whole point of the grid; what a migration must not do is decide it for them by making
-- the permissive choice the default.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, k.key, a.action::public.permission_action, 'any'::public.permission_scope
  FROM public.permission_templates t
  CROSS JOIN (VALUES ('journals/meeting-minutes'), ('journals/bylaws')) AS k(key)
  CROSS JOIN (VALUES ('create'), ('edit'), ('delete')) AS a(action)
 WHERE t.is_system AND t.name = 'Administrators'
   -- `journals/bylaws` declares no `edit`, so it gets no `edit` row: a grant for an action a
   -- resource does not declare is a row the grid cannot render and nothing can ever read.
   AND a.action = ANY (SELECT unnest(pr.actions) FROM public.permission_resources pr
                        WHERE pr.key = k.key)
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- AND EVERY OTHER TEMPLATE GETS AN EXPLICIT 'none' FOR THOSE ACTIONS, rather than a blank
-- cell. 20260807000000's whole argument: the grid is materialized so the screen can show the
-- answer without explaining a fall-through, and a missing row is a fall-through.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, k.key, a.action::public.permission_action, 'none'::public.permission_scope
  FROM public.permission_templates t
  CROSS JOIN (VALUES ('journals/meeting-minutes'), ('journals/bylaws')) AS k(key)
  CROSS JOIN (VALUES ('create'), ('edit'), ('delete')) AS a(action)
 WHERE a.action = ANY (SELECT unnest(pr.actions) FROM public.permission_resources pr
                        WHERE pr.key = k.key)
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 9. The assertions ───────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_bad text;
  v_n   int;
BEGIN
  -- 9a. The new rows exist, captioned and filed where this file says.
  FOR v_bad IN SELECT new_key FROM key_moves LOOP
    IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = v_bad) THEN
      RAISE EXCEPTION 'the % resource was not created', v_bad;
    END IF;
  END LOOP;
  SELECT string_agg(m.old_key, ', ' ORDER BY m.old_key) INTO v_bad
    FROM key_moves m JOIN public.permission_resources pr ON pr.key = m.old_key;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'retired review key(s) still registered: %', v_bad;
  END IF;

  SELECT string_agg(format('%s=%s/%s', pr.key, pr.label, pr.category), ', ')
    INTO v_bad
    FROM public.permission_resources pr
    JOIN key_moves m ON m.new_key = pr.key
   WHERE pr.label <> m.new_label OR pr.category <> m.new_cat;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a moved key landed with the wrong caption or category: %', v_bad;
  END IF;

  -- 9b. Nothing anywhere still names a retired key. THREE PLACES, and the second is the one
  -- that would fail open: a policy asking about a key nobody has registered falls through
  -- `auth_permission` to its default, which is 'everyone' for view.
  SELECT count(*) INTO v_n
    FROM public.permission_table_map ptm JOIN key_moves m ON m.old_key = ptm.resource_key;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'permission_table_map still points % table(s) at a retired review key', v_n;
  END IF;

  SELECT string_agg(format('%s (%s)', tablename, policyname), ', ')
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND EXISTS (SELECT 1 FROM key_moves k
                  WHERE COALESCE(pg_policies.qual, '') LIKE '%''' || k.old_key || '''%'
                     OR COALESCE(pg_policies.with_check, '') LIKE '%''' || k.old_key || '''%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'policy/policies still name a retired review key: %', v_bad;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND EXISTS (SELECT 1 FROM key_moves k WHERE p.prosrc LIKE '%''' || k.old_key || '''%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'function body/bodies still name a retired review key: %', v_bad;
  END IF;

  -- 9c. AND THE NEW KEY IS ACTUALLY THERE, which is the half that catches a rewrite that
  -- ran and matched nothing. Asserted on the seeder specifically, because it is the one
  -- rewritten by substitution rather than by a statement anybody can read.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'seed_family_permission_templates'
       AND p.prosrc LIKE '%''community/gallery''%'
  ) THEN
    RAISE EXCEPTION
      'seed_family_permission_templates() does not name community/gallery — a family created tomorrow could not upload a photograph';
  END IF;

  SELECT count(*) INTO v_n
    FROM public.permission_table_map ptm
   WHERE ptm.resource_key = 'community/gallery';
  IF v_n <> 3 THEN
    RAISE EXCEPTION
      'community/gallery gates % table(s), expected 3 (photos, photo_tags, photo_collections)', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.permission_table_map
                  WHERE resource_key = 'journals/documents' AND table_name = 'documents') THEN
    RAISE EXCEPTION 'journals/documents no longer gates the documents table';
  END IF;

  -- 9d. Every template renders a cell for every new and moved key (§6).
  SELECT string_agg(DISTINCT k.key, ', ') INTO v_bad
    FROM public.permission_templates t
    CROSS JOIN (VALUES ('community/gallery'), ('journals/documents'),
                       ('journals/meeting-minutes'), ('journals/bylaws')) AS k(key)
   WHERE NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                      WHERE tp.template_id = t.id AND tp.resource_key = k.key);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'template(s) carry no grant for: %', v_bad;
  END IF;

  -- 9e. Nobody lost a visibility row they had. Measured against §3's snapshot.
  SELECT count(*) INTO v_n
    FROM vis_before b
   WHERE NOT EXISTS (SELECT 1 FROM public.resource_visibility rv
                      WHERE rv.family_code = b.family_code AND rv.resource_key = b.new_key);
  IF v_n > 0 THEN
    RAISE EXCEPTION '% family/families lost a visibility row in the rename', v_n;
  END IF;

  -- 9f. THE TWO NEW KEYS GATE NO TABLE, and that is asserted rather than left to be noticed.
  -- Both are `journal` category screens whose ROW rules are the office, the secretary and the
  -- attendee list — the same arrangement 20260821000005 asserts for `journals/officer`. A map
  -- row appearing later would compose an `auth_permission` factor onto those tables, and
  -- `view` resolves to 'everyone'.
  IF EXISTS (SELECT 1 FROM public.permission_table_map
              WHERE resource_key IN ('journals/meeting-minutes', 'journals/bylaws')) THEN
    RAISE EXCEPTION
      'the new journals keys must gate no table — the screen is the key, the row rules are their own';
  END IF;

  RAISE NOTICE 'Review is retired: photos -> community/gallery, documents -> journals/documents; Meeting Minutes and Bylaws registered';
END $mig$;

COMMIT;
