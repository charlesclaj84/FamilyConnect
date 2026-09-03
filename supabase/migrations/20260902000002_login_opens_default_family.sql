-- ════════════════════════════════════════════════════════════════════════════
-- SIGNING IN OPENS THE DEFAULT FAMILY, WHICH IT NEVER DID
--
-- `20260617000000` gave `user_family_settings` two columns and a comment saying what each
-- is for:
--
--   -- ── 2. Which family is the user viewing, and which opens on login ────────────
--   active_family_code  TEXT,
--   default_family_code TEXT,
--
-- and `auth_family_code()` orders by active, then default, then oldest. So the default only
-- ever decides anything when the active selection is NULL or names a family the caller has
-- left — and **nothing has ever cleared it.** `set_active_family` writes it on every switch
-- and it persists in the table for good.
--
-- The consequence is that "which opens on login" is false for anybody who has ever used the
-- family switcher: every session afterwards opens on whichever family they last happened to
-- be looking at, and the Default control on /my-families changes nothing they can see. That
-- is not a regression — it is a column that was declared, documented, given an RPC, and
-- never consulted, which is the shape AGENTS.md keeps calling out as worse than an absence.
--
-- ── WHY THIS IS AN RPC AND NOT AN UPDATE FROM THE APP ───────────────────────────────
-- `user_family_settings` has a SELECT policy and NO insert or update policy at all, which
-- that migration states as a decision: *"the RPCs below are SECURITY DEFINER and re-validate
-- membership, so they are the only supported write path for an end user."* So a browser
-- cannot write the column, and neither may this — it joins those RPCs rather than working
-- around them.
--
-- ── WHAT IT DOES, AND WHAT IT REFUSES TO DO ─────────────────────────────────────────
-- It sets `active_family_code` to `default_family_code`, and ONLY when that default names a
-- family the caller is still a member of. Three things follow, and each is a case the naive
-- version gets wrong:
--
--   NO DEFAULT SET          It leaves the active selection ALONE rather than clearing it.
--                           Clearing would fall through to `p.created_at ASC` — the OLDEST
--                           membership — so a member with no stated default would be thrown
--                           out of the family they were last in and into their first one,
--                           every login. That is a worse product than the bug being fixed.
--   A DEFAULT THEY LEFT     Same answer, for the same reason: the resolver already skips a
--                           value naming a family they do not belong to, so writing it would
--                           change nothing and clearing would do harm.
--   A REMOVED FAMILY        Left alone deliberately. `set_active_family` is open for a
--                           removed family on purpose (`20260817000006`: refusing "would
--                           report 'not a member', which is false, and would leave somebody
--                           with no route to find out what happened"), and a default pointing
--                           at one is the same case. `requireFamilyActive` is what shows them
--                           `FamilyRemoved` when they get there.
--
-- IT IS IDEMPOTENT and safe to call on any request. It writes only when the active selection
-- differs from the default, so a second call is a no-op rather than a second row version.
--
-- ── AND IT CANNOT WIDEN ACCESS, WHICH IS THE ONLY SECURITY QUESTION HERE ────────────
-- It takes NO PARAMETER. There is nothing a caller can pass, so there is nothing to
-- validate: the only two values it can read are this user's own settings row, and the only
-- value it can write is one that a membership check has just confirmed. Compare
-- `set_active_family`, which takes a code and therefore must check it — AGENTS.md §2b's
-- *"never take an identity as a parameter"* satisfied by having no parameter at all.
--
-- `auth.uid()` is the caller. A NULL one is refused outright rather than silently doing
-- nothing, so an admin-client call — which has no `auth.uid()` — fails loudly instead of
-- sailing past, which is the rule `set_membership_status` already keeps.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master. See AGENTS.md, "How migrations reach the
--   hosted project".
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.open_default_family()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     uuid := (SELECT auth.uid());
  v_default text;
  v_active  text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT s.default_family_code, s.active_family_code
    INTO v_default, v_active
    FROM public.user_family_settings s
   WHERE s.user_id = v_uid;

  -- No default stated, or one naming a family they have left. Leave the active selection
  -- alone — see the header: clearing it falls through to the OLDEST membership, which is a
  -- worse answer than the one they were already looking at.
  IF v_default IS NULL THEN
    RETURN v_active;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.people
     WHERE user_id = v_uid AND family_code = v_default
  ) THEN
    RETURN v_active;
  END IF;

  -- Already there. Written as a guard rather than relying on the UPDATE being harmless, so
  -- `updated_at` does not move on every page load that happens to call this.
  IF v_active IS NOT DISTINCT FROM v_default THEN
    RETURN v_active;
  END IF;

  UPDATE public.user_family_settings
     SET active_family_code = v_default,
         updated_at         = NOW()
   WHERE user_id = v_uid;

  RETURN v_default;
END $$;

COMMENT ON FUNCTION public.open_default_family() IS
  'Point the active family at the login default, for a caller who has just signed in. '
  'Takes no parameter and can only ever write this user''s own stated default, which it '
  'first confirms they are still a member of. Leaves the active selection alone when there '
  'is no usable default: clearing it would fall through to the oldest membership. '
  'Added 20260902000002 — until then default_family_code was documented as "which opens on '
  'login" and nothing consulted it.';

REVOKE ALL ON FUNCTION public.open_default_family() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_default_family() TO authenticated;

-- ── Verify ──────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n INT;
BEGIN
  -- SECURITY DEFINER, because it writes a table with no UPDATE policy. The whole mechanism
  -- depends on it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'open_default_family' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'open_default_family() is missing or is not SECURITY DEFINER';
  END IF;

  -- `search_path = ''`, per AGENTS.md on a SECURITY DEFINER function.
  --
  -- MATCHED ON THE PREFIX, not on equality, and the first draft of this assertion FAILED THE
  -- MIGRATION for it: `SET search_path = ''` is stored in `proconfig` as `search_path=""`
  -- — with the empty string quoted — not as `search_path=`. Measured against
  -- `set_active_family` and `auth_family_code`, which both carry it. A `@> ARRAY['search_path=']`
  -- test is therefore always false, which is the shape AGENTS.md warns about twice: an
  -- assertion that cannot pass is as useless as one that cannot fail, and this one at least
  -- had the decency to abort loudly.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'open_default_family'
       AND EXISTS (
         SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) AS c
          WHERE c LIKE 'search_path=%'
       )
  ) THEN
    RAISE EXCEPTION 'open_default_family() does not pin search_path';
  END IF;

  -- IT TAKES NO ARGUMENT, and that is the security argument rather than a detail (§2b): a
  -- function with nothing to pass has nothing to validate. If a future edit gives it a
  -- parameter, every sentence in this file's header about that stops being true.
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'open_default_family' AND p.pronargs = 0;
  IF v_n <> 1 THEN
    RAISE EXCEPTION
      'open_default_family() must take no argument — a parameter would need validating';
  END IF;

  -- EXECUTE for `authenticated` and NOT for `anon`. The browser calls it right after a
  -- sign-in, so it needs the first; an anonymous caller has no `auth.uid()` and would be
  -- refused anyway, but a grant nobody needs is a grant nobody has reviewed (§2b rule 1).
  IF NOT has_function_privilege('authenticated', 'public.open_default_family()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute open_default_family()';
  END IF;
  IF has_function_privilege('anon', 'public.open_default_family()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute open_default_family()';
  END IF;

  -- AND `user_family_settings` STILL HAS NO WRITE POLICY. The reason this is an RPC at all,
  -- asserted so a future policy does not quietly make the browser a second write path.
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_family_settings'
     AND cmd <> 'SELECT';
  IF v_n > 0 THEN
    RAISE EXCEPTION
      '% write policy(ies) on user_family_settings — the RPCs are meant to be the only path', v_n;
  END IF;

  RAISE NOTICE 'open_default_family() installed: signing in now opens the login default';
END $mig$;

COMMIT;
