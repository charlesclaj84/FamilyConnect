-- ============================================================================
-- One member-facing screen for what you owe and what you can give.
-- ----------------------------------------------------------------------------
-- WHAT MOVES
--   `/accounting/dues` and `/accounting/donations` become one page,
--   `/accounting/dues-and-donations`, with the two lists as panes of it. The two permission
--   keys become one, `accounting/dues-and-donations`, and the old rows are deleted.
--
--   Both screens answer one question — *where do I stand with my family's money?* One is the
--   schedules a member is on and what the next installment costs; the other is the drives the
--   family is running and what this member has given. A member checking one is a member
--   checking both, and two rail items sent them back to the rail to do it.
--
-- ── WHY ONE KEY AND NOT TWO PANES UNDER TWO KEYS ────────────────────────────
--   AGENTS.md allows a pane to keep its own key — `/admin/members` spans four and
--   `/announcements` three — and sets the test for when it must: "If a family could never
--   sensibly hold one and not the other, they were one job and should have been one key."
--
--   These are that case. Both are `view` and nothing else; both are the READER'S OWN standing
--   and publish no figure about anybody else; both are `tier: 'standard'`; and neither has a
--   `permission_table_map` row, so neither gates a table — they gate whether the app FETCHES
--   the caller's own rows, which are `.eq('person_id', myPersonId)`-filtered before RLS is
--   consulted at all. A family restricting "your dues" while publishing "your donations" is
--   not a configuration anybody would choose; it is one this product happened to allow.
--
--   THE ADMIN SIDE WENT THE OTHER WAY IN THE SAME BATCH, and the two are not in tension.
--   `admin/accounting/dues` and `admin/accounting/donations` were one rail item and are two
--   again, because THERE the separation is real and sold: "Separation of duties — per-feature
--   permissions, so recording dues is not the same as paying money out" is a Free plan bullet
--   in `lib/plans.ts`. Setting up what a family charges and setting up what it can be given to
--   are two jobs a treasurer can be trusted with separately. Reading your own balance is not.
--
-- ── THE SIX PLACES A KEY LIVES, AND WHICH ONES THESE TWO ARE IN ─────────────
--   `20260820000004` enumerated them. Measured against the local stack before writing this,
--   rather than assumed, because the expensive half of a key change is the half nobody checks:
--
--     1. `permission_resources`                two rows            — §2 deletes them
--     2. `template_permissions.resource_key`   every family's grid — §2 copies, then CASCADE
--     3. `resource_visibility.resource_key`    per-family default  — §2 copies, then CASCADE
--     4. `permission_table_map.resource_key`   **NONE.** Neither key gates a table.
--     5. composed POLICY expressions           **NONE.** No policy evaluates either key.
--     6. SECURITY DEFINER function bodies      **NONE.** No `prosrc` names either.
--
--   4, 5 and 6 being empty is what makes this a small migration rather than a policy sweep,
--   and it is a property of these keys rather than of key changes generally: they govern
--   SCREENS. A key with a map row could not be merged without recomposing every policy that
--   interpolated it. §4 asserts all three are still empty, so a later migration that gives one
--   of them a table cannot make this file quietly wrong.
--
-- ── THE GRANTS ARE MERGED UPWARD, NEVER DOWNWARD ────────────────────────────
--   A template that could view EITHER can view the merged page: the new scope is the more
--   permissive of the two, ranked `any > own > none`. Downward would silently take a screen
--   away from a family that had granted one of the halves, which is not a decision a migration
--   gets to make — and `view` here is either 'any' or 'none' in practice, since neither key has
--   an own-expression to make 'own' mean anything.
--
--   Same for `resource_visibility`: 'everyone' wins over 'restricted', because a family that
--   left one of the two open plainly did not intend the merged screen to be shut.
--
-- ── NO ROUTE SURVIVES AS A REDIRECT, AND THAT IS THE CHEAP ANSWER TODAY ─────
--   AGENTS.md's "FIVE ROUTES ARE REDIRECTS" pattern keeps an old route alive so its key stays
--   honest. It does not apply: the keys are GONE, so there is nothing to keep honest, and a
--   redirect route with no key would be a `FEATURES` entry that governs nothing.
--
--   What that costs is a bookmark to `/accounting/dues` answering Coming Soon at the edge
--   (`proxy.ts` refuses an unregistered path under a registered prefix). NO FAMILY IS USING
--   THIS PRODUCT YET, so there are no bookmarks — the same fact `20260819000006` retired
--   Events on. If this happened after launch it would owe two redirect routes.
-- ============================================================================

BEGIN;

-- ── 1. The new resource ─────────────────────────────────────────────────────
-- `sort_order` 105 is the slot `accounting/dues` had, so the merged item lands where Dues was
-- on the grid rather than at the bottom of the Accounting group. Nothing renumbers: 106
-- (Donations) simply goes, and a gap in a sort order is invisible.
--
-- `actions = {view}` and nothing else. Both halves were view-only and everything either screen
-- can DO is self-service — `setMyDuesPlan`, `setMyDuesOptOut`, both `requireMember()` — so an
-- `edit` column here would be a switch wired to nothing (AGENTS.md, "Declare only the actions
-- something reads").
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES ('accounting/dues-and-donations', 'Dues & Donations', 'accounting', NULL, 105, ARRAY['view'])
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      actions = EXCLUDED.actions;

-- ── 2. Carry every family's answer across ───────────────────────────────────
-- BEFORE the delete, and it has to be: all three foreign keys to `permission_resources` are
-- ON DELETE CASCADE (measured), so dropping the old rows takes every grant and every
-- visibility row with them. Copy first, delete second, and never the other way round.

-- Per-family visibility. 'everyone' beats 'restricted' — see the header.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT rv.family_code, 'accounting/dues-and-donations',
       CASE WHEN bool_or(rv.visibility = 'everyone') THEN 'everyone' ELSE 'restricted' END
  FROM public.resource_visibility rv
 WHERE rv.resource_key IN ('accounting/dues', 'accounting/donations')
 GROUP BY rv.family_code
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- Every template's grid. The more permissive of the two scopes wins.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT tp.template_id, 'accounting/dues-and-donations', 'view'::public.permission_action,
       (ARRAY['none', 'own', 'any'])[max(
         CASE tp.scope::text WHEN 'any' THEN 3 WHEN 'own' THEN 2 ELSE 1 END
       )]::public.permission_scope
  FROM public.template_permissions tp
 WHERE tp.resource_key IN ('accounting/dues', 'accounting/donations')
   AND tp.action = 'view'
 GROUP BY tp.template_id
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 3. Retire the two ───────────────────────────────────────────────────────
-- The CASCADE does the dependent rows. Stated rather than relied on silently, because the
-- ordering above is the whole correctness of this file.
DELETE FROM public.permission_resources
 WHERE key IN ('accounting/dues', 'accounting/donations');

-- ── 4. Verify ───────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_count    int;
  v_expected int;
BEGIN
  -- (a) The new row exists, view-only, in the accounting group.
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE key = 'accounting/dues-and-donations'
       AND category = 'accounting'
       AND actions = ARRAY['view']
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: accounting/dues-and-donations is missing or malformed';
  END IF;

  -- (b) The two old rows are gone, and so is everything that referenced them.
  SELECT count(*) INTO v_count FROM public.permission_resources
   WHERE key IN ('accounting/dues', 'accounting/donations');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % old resource row(s) survived', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.template_permissions
   WHERE resource_key IN ('accounting/dues', 'accounting/donations');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % old template grant(s) survived the cascade', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.resource_visibility
   WHERE resource_key IN ('accounting/dues', 'accounting/donations');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % old visibility row(s) survived the cascade', v_count;
  END IF;

  -- (c) NOBODY LOST A SCREEN. Every template that could view either half can view the merged
  --     page. Counted BEFORE the delete would be impossible — the rows are gone — so this
  --     counts the other direction: every template that now grants it, against every template
  --     that has a grid at all. A template with no row for this key falls through to the
  --     family's `resource_visibility`, which §2 also carried, so absence is not a loss; what
  --     would be a loss is a template holding 'none' where it used to hold 'any', and the
  --     upward merge in §2 makes that unreachable.
  SELECT count(*) INTO v_count FROM public.template_permissions
   WHERE resource_key = 'accounting/dues-and-donations' AND scope = 'none';
  IF v_count > 0 THEN
    RAISE NOTICE '% template(s) hold the merged screen at ''none'' — both halves were ''none'' for them', v_count;
  END IF;

  -- (d) THE THREE PLACES THIS FILE CLAIMS ARE EMPTY, ASSERTED. If a later migration gives the
  --     merged key a table, a policy or a function, this file's argument for being small stops
  --     holding — and it fails here rather than being discovered by a screen that reads [].
  SELECT count(*) INTO v_count FROM public.permission_table_map
   WHERE resource_key LIKE 'accounting/dues%' OR resource_key = 'accounting/donations';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % permission_table_map row(s) name a member accounting key — this merge did not recompose any policy', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'public'
     AND (coalesce(qual, '') LIKE '%''accounting/dues%'
       OR coalesce(with_check, '') LIKE '%''accounting/dues%'
       OR coalesce(qual, '') LIKE '%''accounting/donations%'
       OR coalesce(with_check, '') LIKE '%''accounting/donations%');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % policy/policies evaluate a member accounting key', v_count;
  END IF;

  -- The quote before the key is what keeps `admin/accounting/donations` out of these two
  -- checks: it is a different key, it IS named by two policies on `donation_beneficiaries`,
  -- and nothing here touches it.
  SELECT count(*) INTO v_count FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace
     AND (prosrc LIKE '%''accounting/dues%' OR prosrc LIKE '%''accounting/donations%');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % function(s) name a member accounting key in their body', v_count;
  END IF;

  SELECT count(*) INTO v_expected FROM public.permission_templates;
  SELECT count(*) INTO v_count FROM public.template_permissions
   WHERE resource_key = 'accounting/dues-and-donations';
  RAISE NOTICE 'accounting/dues-and-donations: % of % templates carry a grid row for it',
    v_count, v_expected;
END $mig$;

COMMIT;
