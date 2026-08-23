-- ═══════════════════════════════════════════════════════════════════════════════════════
-- A NEW FAMILY'S ORDINARY MEMBERS COULD NOT OPEN SAFETY CHECK-INS.
--
-- `20260823000002` §10 argues at length that the General template must hold
-- `community/safety-check-ins` at `view: 'own'`, because `requireView` resolves with `can()` and
-- a `'none'` grant answers **404** — so the family's own emergency check-in would be answerable
-- only by administrators, from a switch whose label says nothing about answering.
--
-- IT BACKFILLED THE TEMPLATES THAT EXISTED AND DID NOT TEACH THE SEED. So every family created
-- AFTERWARDS got `view: 'none'` from `seed_family_permission_templates()`, which is the exact
-- failure §6 of AGENTS.md describes: *"a resource registered later has no row in the templates
-- that already exist"* — and its mirror, a grant that reaches the old templates and not the new
-- ones. Measured on a fresh `db reset`: both fixture families' General template held
-- `view | none`.
--
-- ── AND THE ASSERTION THAT SHOULD HAVE CAUGHT IT SKIPPED, WHICH IS THE REAL LESSON ─────
-- `20260823000002`'s verify block does check this. It is written as:
--
--     IF EXISTS (a General template) AND NOT EXISTS (that template granting view) THEN RAISE
--
-- On a fresh database the migration chain runs before any family exists, so there IS no General
-- template, the guard is false, and the whole check passes having examined nothing. That is
-- AGENTS.md's *"A verify block that can skip must not be the only check"* — written about
-- `20260806000012`'s missing `auth.users` row — arriving again in a different costume, in a file
-- whose author had read it.
--
-- SO THIS ONE ASSERTS THE FUNCTION'S SOURCE, which needs no fixture and cannot skip. The
-- per-family check is kept as well, and stays conditional, because it genuinely cannot run on an
-- empty database — the split AGENTS.md prescribes: assert what needs no fixture unconditionally,
-- and `RAISE NOTICE` for the part that cannot.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ─────────────────────────────────────────────
--   the function rewrite skipped (only the backfill applied)
--     ERROR: seed_family_permission_templates() does not grant General view on
--            community/safety-check-ins — every family created after this would 404 its own
--            members out of answering a check-in
--   the backfill's `scope = 'none'` conjunct widened to unconditional
--     no error, and that is why it is NOT widened — see §2.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. TEACH THE SEED ─────────────────────────────────────────────────────────────────
-- REWRITTEN IN PLACE rather than restated, for `20260822000023`'s reason: this function has been
-- redefined by seven migrations now, and restating a hundred lines to add one row is how a grant
-- added by one of them gets quietly reverted.
--
-- THE TARGET IS THE EXPLICIT `VALUES` LIST, not the `CASE` insert below it. Order matters and is
-- what makes this work: the explicit list runs FIRST and the defaulting insert is
-- `ON CONFLICT DO NOTHING`, so a key named here keeps its stated scope and everything else falls
-- through to the visibility-derived default. Adding the row to the second insert instead would be
-- ignored, silently, because the first one would already have written nothing for this key.
DO $mig$
DECLARE
  v_def text;
  -- ANCHORED ON THE LAST ROW OF THE LIST AND ITS CLOSING PARENTHESIS. Matching on a bare
  -- `('community/gallery', 'delete', 'own')` would also match nothing else today and would break
  -- the moment somebody appends a row after it; anchoring on the terminator means a reformat is
  -- a loud failure rather than a silent no-op.
  v_old text := '      (''community/gallery'',    ''delete'', ''own'')'
                || E'\n' || '    ) AS t(k, act, sc)';
  v_new text := '      (''community/gallery'',    ''delete'', ''own''),'
                || E'\n' || '      (''community/safety-check-ins'', ''view'', ''own'')'
                || E'\n' || '    ) AS t(k, act, sc)';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'seed_family_permission_templates';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'seed_family_permission_templates() is missing — cannot add the General grant';
  END IF;

  IF position('community/safety-check-ins'', ''view' IN v_def) > 0 THEN
    RAISE NOTICE 'safety check-ins: seed already grants General view';
  ELSIF position(v_old IN v_def) = 0 THEN
    -- LOUD RATHER THAN SILENT, and this is the assertion that matters: a no-op rewrite would
    -- leave every family created afterwards unable to open the screen, which is precisely the
    -- state this migration exists to repair.
    RAISE EXCEPTION
      'seed_family_permission_templates() no longer holds the General VALUES list this '
      'migration expects — it has been reformatted or extended. Re-read the function and update '
      'this replacement rather than widening the match.';
  ELSE
    EXECUTE replace(v_def, v_old, v_new);
    RAISE NOTICE 'safety check-ins: seed now grants General view at own for new families';
  END IF;
END $mig$;

-- The lockdown's rule (§2b): called only by the families trigger and by the service role, so it
-- is granted to nobody. Restated after a redefinition because CREATE OR REPLACE keeps the ACL
-- but a future refactor into DROP + CREATE would not.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── §2. REPAIR THE FAMILIES THAT ALREADY HAVE THE WRONG ANSWER ─────────────────────────
--
-- `20260823000002` §10's backfill was `ON CONFLICT DO NOTHING`, so it wrote nothing for a family
-- created between that migration and this one: the seed had already put a `'none'` row there and
-- the conflict clause left it alone. This is the UPDATE that finishes the job.
--
-- ── THREE CONJUNCTS, AND EACH DECLINES TO OVERRULE SOMETHING SOMEBODY CHOSE ────────────
-- `20260820000007`'s pattern, and its argument applies unchanged:
--
--   `is_system`          a CUSTOM grid is one an administrator built and looked at. A migration
--                        must not overrule a cell somebody set in a UI that showed them the
--                        answer.
--   `name = 'General'`   the only system template this grant is about. Administrators already
--                        hold `'any'`.
--   `scope = 'none'`     so a family that has deliberately WIDENED this to `'any'` keeps what
--                        they chose. Widening it unconditionally would be a silent downgrade
--                        issued by a migration whose whole purpose is to widen — and the
--                        mutation note at the top records that dropping this conjunct raises no
--                        error, which is exactly why it has to be reasoned about rather than
--                        tested for.
UPDATE public.template_permissions tp
   SET scope = 'own'::public.permission_scope, updated_at = NOW()
  FROM public.permission_templates t
 WHERE t.id = tp.template_id
   AND t.is_system
   AND t.name = 'General'
   AND tp.resource_key = 'community/safety-check-ins'
   AND tp.action = 'view'
   AND tp.scope = 'none'::public.permission_scope;

-- AND THE ROW MAY BE ABSENT ENTIRELY on a template that predates the key, which the UPDATE above
-- cannot reach. `20260823000002` §10 inserts it; this is the same insert, repeated because a
-- family created in the window between the two migrations has the row and a family older than
-- both may not.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, 'community/safety-check-ins', 'view'::public.permission_action,
       'own'::public.permission_scope, NOW()
  FROM public.permission_templates t
 WHERE t.is_system AND t.name = 'General'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── §3. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_src text;
  v_bad text;
BEGIN
  -- 1. THE UNCONDITIONAL HALF, which is the whole point of this file. It needs no family, no
  --    template and no fixture, so it cannot skip on a fresh database the way the check in
  --    `20260823000002` did.
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'seed_family_permission_templates';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'seed_family_permission_templates() is missing';
  END IF;
  IF position('community/safety-check-ins'', ''view' IN v_src) = 0 THEN
    RAISE EXCEPTION 'seed_family_permission_templates() does not grant General view on '
      'community/safety-check-ins — every family created after this would 404 its own members '
      'out of answering a check-in';
  END IF;

  -- 2. AND THE SAME FOR THE KEY THIS ONE'S ABSENCE WAS MODELLED ON. `20260823000002` added
  --    `community/safety-check-ins` to `v_restricted`, and that rewrite and this one target the
  --    same function — so a botched second replace could drop the first. Cheap to re-assert.
  IF position('community/safety-check-ins''];' IN v_src) = 0
     AND position('''community/safety-check-ins''' IN v_src) = 0 THEN
    RAISE EXCEPTION 'seed_family_permission_templates() has lost community/safety-check-ins from '
      'v_restricted — the key would default to everyone-for-view and publish every roster';
  END IF;

  -- 3. THE CONDITIONAL HALF. Every General template that exists now holds the grant. Stated as a
  --    NOTICE when there is nothing to check, so a skip is VISIBLE rather than silent — which is
  --    the correction this migration is really making.
  IF NOT EXISTS (SELECT 1 FROM public.permission_templates WHERE is_system AND name = 'General')
  THEN
    RAISE NOTICE 'safety check-ins: no General template exists yet, so the per-family half of '
      'this check could not run. The source assertion above covers every family created later.';
  ELSE
    SELECT string_agg(DISTINCT COALESCE(t.family_code, '(none)'), ', ') INTO v_bad
      FROM public.permission_templates t
      LEFT JOIN public.template_permissions tp
             ON tp.template_id = t.id
            AND tp.resource_key = 'community/safety-check-ins'
            AND tp.action = 'view'
     WHERE t.is_system AND t.name = 'General'
       AND COALESCE(tp.scope::text, 'none') = 'none';
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'these families'' General template still cannot open safety check-ins: %',
        v_bad;
    END IF;
    RAISE NOTICE 'safety check-ins: every existing General template grants view';
  END IF;
END $mig$;

COMMIT;
