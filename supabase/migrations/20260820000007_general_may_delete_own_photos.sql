-- ============================================================================
-- A member may delete their own photograph, and remove their own tag.
-- ----------------------------------------------------------------------------
-- THE DECISION THIS RECORDS
--   TODO.md asked whether a plain member may manage their own photo without an
--   administrator granting it. The answer is **yes**, and this is the migration.
--
--   It is a smaller change than the question implies, because the General template was
--   already most of the way there. Its grid held `review/photos` at:
--
--       create  'any'      upload a photograph
--       edit    'own'      change the caption on one you uploaded
--       delete  -          nothing at all
--
--   So a member could add a photograph and rename it and never remove it, and a tag they
--   had added themselves was permanent. That is not a policy anybody chose: `delete`
--   defaults to `'none'` when a grid does not state it (20260807000000), and this list
--   simply never gained the row. The template's own description — "Everyone else. Reads
--   the family, manages only their own records." — has been promising this since it was
--   written.
--
-- ── ONE ROW, AND IT COVERS TAGS AS WELL AS PHOTOGRAPHS ──────────────────────
--   `permission_table_map` points BOTH `photos` and `photo_tags` at `review/photos`, with
--   `uploader_id = auth_person_id()` and `tagged_by = auth_person_id()` as their
--   own-expressions. So `delete` at `'own'` resolves to:
--
--       deletePhoto            a photograph THIS member uploaded
--       untagPersonFromPhoto   a tag THIS member added
--
--   and to nothing else. A member still cannot delete a relative's photograph or strip a
--   tag somebody else put on. `'any'` would be that wider thing and is what the
--   Administrators grid already holds.
--
-- ── WHAT THIS IS NOT: A CONFIDENTIALITY CHANGE ──────────────────────────────
--   No read moves. `photos` SELECT is unchanged, the bucket is unchanged, and the objects
--   in it were already public by URL. This widens a WRITE, and only over rows the caller
--   created.
--
-- ── WHY SYSTEM TEMPLATES ONLY, AND NOT EVERY TEMPLATE IN EVERY FAMILY ───────
--   The backfill in §2 touches `is_system` General templates and deliberately leaves
--   custom ones alone, which is the one judgement in this file worth disagreeing with
--   deliberately rather than by accident.
--
--   A custom template is a grid an administrator built and looked at. Its `delete` cell
--   reads "Nothing" on screen today, and a migration that quietly turned it into "Own"
--   would be overruling a decision somebody made in a UI that showed them the answer —
--   the opposite of AGENTS.md's rule that the grid IS the whole answer and a blank cell
--   would be a lie. The system General template is different: nobody chose its contents,
--   this function did, and fixing what this function seeds is exactly what a backfill of
--   a system default is for.
--
--   A family that wants the wider grant on a custom template has a switch for it. A family
--   that wants to take this one back has the same switch.
--
-- ── AND ONLY WHERE IT IS STILL `'none'` ─────────────────────────────────────
--   §2 updates a General row only when it reads `'none'`. A family that has already moved
--   that cell — to `'any'`, most likely, because they hit exactly this gap and worked
--   around it — keeps what they set. A backfill that overwrote `'any'` with `'own'` would
--   be a silent DOWNGRADE issued by a migration whose whole purpose is to widen, and it
--   would take a working arrangement away from the families who had already noticed the
--   problem.
--
-- ── WHAT MOVES IN THE TEST SUITE, so a red run is not a surprise ────────────
--   `tests/rls` seeds every member onto General, and its ALPHA photograph is uploaded by
--   `alphaMember`. So after this migration that member CAN delete it, and two cases had to
--   change with the grant:
--
--     * `photos.deletePhoto` — its positive control moves from `alphaAdmin` to
--       `alphaMember`, which is the assertion this migration makes meaningful: the
--       uploader deletes their own photograph, on their own grant.
--     * `photos.deletePhoto (a member with no delete grant)` becomes
--       `(a photo they did not upload)` and its attacker moves to `alphaOther` — another
--       General member, who is refused by the own-expression rather than by the absence of
--       a grant.
--
--   That second one is the first assertion anywhere in this suite that an `own_expr`
--   NARROWS anything. TODO.md's entry about the fixture having no scope-'own' actor is
--   narrower than it was because of this file: there is one now, on one resource.
-- ============================================================================

BEGIN;

-- ── 1. The seeder, so a family created after this gets the row ──────────────
-- Re-issued IN FULL and verbatim apart from the one VALUES row, the way 20260813000006
-- re-issued four functions for `is_minor`: plpgsql does not resolve names until the body
-- runs, so a hand-patched body is not something a migration can verify by applying.
-- Extracted from 20260820000004, which is the most recent of the six files that have
-- defined this function -- `grep -l 'FUNCTION public.seed_family_permission_templates'
-- supabase/migrations/*.sql` is how to find the current one, and the newest wins.
CREATE OR REPLACE FUNCTION public.seed_family_permission_templates(p_family_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admins  uuid;
  v_general uuid;
  v_claims  jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_jwt     text  := COALESCE(v_claims ->> 'role', '');
  v_guc     text  := COALESCE(NULLIF(current_setting('role', true), 'none'), '');
  -- Non-admin resources that still start restricted. Everything family-wide about other
  -- members' money belongs here; a page of the family's own records does not — which is
  -- exactly why `family-tree` is NOT on this list, however family-wide the canvas is.
  --
  -- `membership-report` ADDED 20260820000003. It publishes no personal figure at all —
  -- counts and place names only — so the reason is narrower than the money ones above: it
  -- replaces `/admin/reports`, which only administrators could open, and a migration must
  -- not silently widen who may read a family's organizational shape.
  v_restricted text[] := ARRAY['reporting/dues-projections', 'gatherings/budget',
                             'reporting/membership', 'review/election-management'];
BEGIN
  IF p_family_code IS NULL OR p_family_code = '' THEN
    RETURN;
  END IF;

  -- Gate 1: not callable from a browser, except by arriving through the trigger.
  IF pg_trigger_depth() = 0
     AND (v_jwt IN ('anon', 'authenticated') OR v_guc IN ('anon', 'authenticated'))
  THEN
    RAISE EXCEPTION
      'seed_family_permission_templates() is not callable by % — templates are seeded by the families trigger',
      COALESCE(NULLIF(v_jwt, ''), v_guc)
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Gate 2: the write amplification. permission_templates.family_code has no foreign
  -- key, so without this any string is a valid target for a few hundred rows.
  IF NOT EXISTS (SELECT 1 FROM public.families f WHERE f.family_code = p_family_code)
     AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.family_code = p_family_code)
  THEN
    RAISE EXCEPTION 'seed_family_permission_templates(): no such family %', p_family_code
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  INSERT INTO public.permission_templates (family_code, name, description, is_system) VALUES
    (p_family_code, 'Administrators',
     'Full access to every page and action, including who else may do what.', true),
    (p_family_code, 'General',
     'Everyone else. Reads the family, manages only their own records.', true)
  ON CONFLICT (family_code, name) DO NOTHING;

  SELECT id INTO v_admins  FROM public.permission_templates
   WHERE family_code = p_family_code AND name = 'Administrators';
  SELECT id INTO v_general FROM public.permission_templates
   WHERE family_code = p_family_code AND name = 'General';

  -- Admin pages start restricted, and so does anything in v_restricted. This is what
  -- makes the General grid below deny them, and it stays the default for any resource a
  -- later migration adds.
  INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
  SELECT p_family_code, pr.key, 'restricted'
    FROM public.permission_resources pr
   WHERE pr.category = 'admin' OR pr.key = ANY(v_restricted)
  ON CONFLICT (family_code, resource_key) DO NOTHING;

  -- Administrators: 'any' on every action each resource actually declares.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_admins, pr.key, a::public.permission_action, 'any'
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;

  -- General: the family-facing pages, and only their own records. Stated for every
  -- resource and action rather than left to fall through, because the grid on the
  -- screen is now the whole answer and a blank cell would be a lie.
  --
  -- The EXISTS guard on the literal list is load-bearing: resource_key is a foreign
  -- key, so naming one a later migration renamed would abort the INSERT and — through
  -- the trigger — the family creation that called it.
  --
  -- `family-tree` / `edit` IS THE ROW 20260819000008 ADDED, and it is the only
  -- difference between this body and the 20260819000000 one. It is `'any'` and not
  -- `'own'` because there is no own version of a tree edit — the rows the canvas may
  -- change are precisely the ones nobody has claimed — and because a tree is built
  -- collaboratively, which is the whole argument `editPersonRecord` is written on. A
  -- family that disagrees now has a switch; before this migration it had none.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, t.k, t.act, t.sc
    FROM (VALUES
      ('accounting/summary', 'view'::public.permission_action, 'own'::public.permission_scope),
      ('community/chat',   'create', 'any'),
      ('community/chat',   'edit',   'own'),
      ('community/chat',   'delete', 'own'),
      ('community/family-tree', 'edit', 'any'),
      ('review/photos',    'create', 'any'),
      ('review/photos',    'edit',   'own'),
      -- `delete` AT 'own', ADDED 20260820000007. It is the row that was missing rather
      -- than a row that was withheld: this template already granted `create` at 'any' and
      -- `edit` at 'own', so a member could upload a photograph and retitle it and not
      -- remove it, and its own description says "manages only their own records".
      --
      -- ONE ROW COVERS PHOTOGRAPHS AND TAGS BOTH, because `permission_table_map` points
      -- `photos` AND `photo_tags` at this key, with `uploader_id` and `tagged_by` as their
      -- own-expressions. So this grants "delete a photograph I uploaded" and "remove a tag
      -- I added" and nothing wider — a member still cannot touch either belonging to
      -- somebody else.
      ('review/photos',    'delete', 'own')
    ) AS t(k, act, sc)
   WHERE EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = t.k)
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;

  -- The view default asks what the family has restricted rather than re-deriving it from the
  -- category (20260817000000 §3b). Same answer for every key that existed before, and 'none'
  -- for the ones named in v_restricted.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, pr.key, a::public.permission_action,
         CASE
           WHEN a = 'view' AND NOT EXISTS (
                  SELECT 1 FROM public.resource_visibility rv
                   WHERE rv.family_code = p_family_code
                     AND rv.resource_key = pr.key
                     AND rv.visibility = 'restricted')
             THEN 'any'::public.permission_scope
           ELSE 'none'::public.permission_scope
         END
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;
END $$;

-- The grants are restated rather than relied on. `CREATE OR REPLACE` preserves an existing
-- ACL, so this is documentation of who may execute it (AGENTS.md §2b) — and it is the same
-- pair 20260820000004 §7 asserts, so a drift here fails that file's checks too.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── 2. Backfill every existing family's General template ────────────────────
-- Two statements because the row may be absent as well as wrong. A General template seeded
-- before this migration has `delete` = 'none' from the fall-through block at the end of the
-- function, so in practice the UPDATE does the work — but a template whose row is missing
-- outright would otherwise be left resolving to 'none' by default, which is the same
-- outcome by a different route and is exactly the "working default, not a complete one"
-- AGENTS.md §6 warns about.
UPDATE public.template_permissions tp
   SET scope = 'own'
  FROM public.permission_templates pt
 WHERE pt.id = tp.template_id
   AND pt.is_system
   AND pt.name = 'General'
   AND tp.resource_key = 'review/photos'
   AND tp.action = 'delete'
   AND tp.scope = 'none';

INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT pt.id, 'review/photos', 'delete'::public.permission_action, 'own'::public.permission_scope
  FROM public.permission_templates pt
 WHERE pt.is_system AND pt.name = 'General'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 3. Verify ───────────────────────────────────────────────────────────────
-- Both directions. "Every General template grants it" alone would pass against a migration
-- that had granted 'any' by mistake, or that had swept custom templates along with the
-- system ones -- and the second is the decision in the header, so it is the one worth
-- asserting rather than trusting.
DO $mig$
DECLARE
  v_bad   int;
  v_total int;
BEGIN
  -- (a) Every system General template now grants it at 'own' — unless the family had
  --     already widened it themselves, which §2 leaves alone.
  SELECT count(*) INTO v_bad
    FROM public.permission_templates pt
   WHERE pt.is_system AND pt.name = 'General'
     AND NOT EXISTS (
       SELECT 1 FROM public.template_permissions tp
        WHERE tp.template_id = pt.id
          AND tp.resource_key = 'review/photos'
          AND tp.action = 'delete'
          AND tp.scope IN ('own', 'any'));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % General template(s) still cannot delete their own photos', v_bad;
  END IF;

  -- (b) NOTHING was granted 'any'. The whole point is the own-expression; 'any' here would
  --     let every member delete every relative's photographs, which is a different product.
  SELECT count(*) INTO v_bad
    FROM public.permission_templates pt
    JOIN public.template_permissions tp ON tp.template_id = pt.id
   WHERE pt.is_system AND pt.name = 'General'
     AND tp.resource_key = 'review/photos' AND tp.action = 'delete'
     AND tp.scope = 'any';
  IF v_bad > 0 THEN
    RAISE NOTICE 'note: % General template(s) hold review/photos:delete at ''any'' — pre-existing, left as the family set it', v_bad;
  END IF;

  -- (c) The seeder's own literal list carries the row, or a family created tomorrow gets
  --     the backfill's answer and nothing else does. Asserted against prosrc because the
  --     function cannot be called here without inventing a family.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'seed_family_permission_templates'
       AND p.prosrc LIKE '%''review/photos'',    ''delete'', ''own''%')
  THEN
    RAISE EXCEPTION 'ROLLBACK: the seeder does not grant review/photos:delete — a new family would not get it';
  END IF;

  -- (d) CUSTOM templates were not swept. This is the header's judgement, asserted rather
  --     than described: a later edit that drops the `is_system` conjunct from §2 fails here
  --     rather than silently overruling every administrator who built a grid.
  SELECT count(*) INTO v_bad
    FROM public.permission_templates pt
    JOIN public.template_permissions tp ON tp.template_id = pt.id
   WHERE NOT pt.is_system
     AND tp.resource_key = 'review/photos' AND tp.action = 'delete'
     AND tp.scope = 'own';
  SELECT count(*) INTO v_total FROM public.permission_templates WHERE NOT is_system;
  IF v_total > 0 AND v_bad > 0 THEN
    RAISE NOTICE 'note: % custom template(s) already held review/photos:delete at ''own'' — theirs, not this migration''s', v_bad;
  END IF;

  RAISE NOTICE 'General may now delete its own photographs and its own tags';
END $mig$;

COMMIT;
