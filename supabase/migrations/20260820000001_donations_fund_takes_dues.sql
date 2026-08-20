-- ============================================================================
-- The Donations fund may take a share of dues. This restates the comment that said otherwise.
--
-- ── WHY A MIGRATION FOR A COMMENT ───────────────────────────────────────────
-- Because the comment is INSIDE a function body, and the only way to change one of those is
-- to redefine the function. `seed_family_system_funds()` (20260807000003) creates the
-- Donations fund at priority 1000 with this note beside the number:
--
--     -- Last in priority order. It is excluded from dues routing in code; this is the
--     -- belt-and-braces position in case it ever is not.
--
-- As of 2026-08-20 it is not. `getActiveFundsForRouting` in app/actions/dues.ts and
-- `getFundAllocations` in app/actions/funds.ts both dropped their `.is('system_key', null)`
-- filters, so the fund is in the routing table and in the waterfall like any other. A family
-- that wants part of its dues going to the general pot can now say so, and the pot they mean
-- is the one every donation already lands in.
--
-- AGENTS.md permits exactly this and no more: rewriting a comment in an applied migration is
-- safe because the file is never re-read, and the SEED here is not a comment — it is a
-- function every new family calls. Leaving it would make the note actively false at the one
-- place somebody reads before changing the number it explains. That is the same narrow ground
-- the `USAGE: psql` sweep earned, and it does not license editing migration prose generally.
--
-- ── THE NUMBER IS UNCHANGED AND IS NOW LOAD-BEARING ─────────────────────────
-- 1000 was chosen as belt-and-braces and has become the actual mechanism.
-- `effectiveAllocations` in lib/fund-routing.ts hands 100% to the FIRST fund by priority
-- whenever nothing is configured, so a fund at 1000 sorts last and can never become an
-- unconfigured family's default recipient — which is what makes including it a new capability
-- rather than a silent redirection of every family's dues. Lower it and that guarantee goes.
--
-- ── WHAT DOES CHANGE FOR A FAMILY WITH NO OTHER FUND ────────────────────────
-- Their dues used to route NOWHERE: the funds query answered no rows, `routeContribution`
-- returned nothing, and the payment was recorded against the member with no fund contribution
-- behind it. It now lands in Donations, at 100%, because it is the only fund there is. That is
-- the better answer and it is the reason this is worth doing at all — the feature works for a
-- family that has not built a fund yet, which is every family on its first day.
--
-- ── AND NOTHING ELSE MOVES ──────────────────────────────────────────────────
-- No existing row is touched: no fund's priority, no `fund_allocations` row, no contribution.
-- A donation still routes WHOLE to this fund by `system_key` and never consults the waterfall
-- (`kind = donation` in app/actions/dues.ts). `system_key` still means "cannot be deleted or
-- switched off" — that part of the flag is unchanged, and it is now the whole of what the flag
-- withholds.
-- ============================================================================

BEGIN;

-- ── 1. The seeder, verbatim except for the comment ──────────────────────────
-- Diff this against 20260807000003 before changing anything: the body is identical, and the
-- only edit is the note beside `1000`. It keeps the same two guards that migration argued for
-- — SECURITY DEFINER with an empty search_path, and ON CONFLICT DO NOTHING so a replay or a
-- second trigger firing is a no-op rather than a 23505.
CREATE OR REPLACE FUNCTION public.seed_family_system_funds(p_family_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $seed$
BEGIN
  INSERT INTO public.funds (
    family_code, name, description, system_key,
    active, priority, minimum_cents, open_contributions
  )
  VALUES (
    p_family_code,
    'Donations',
    'Every donation the family receives lands here. Created automatically and cannot be removed.',
    'donations',
    TRUE,
    -- LAST IN PRIORITY ORDER, AND THIS NUMBER IS NOW LOAD-BEARING.
    --
    -- It said "excluded from dues routing in code; this is the belt-and-braces position in
    -- case it ever is not" until 20260820000001. It is not excluded any more — the fund can
    -- be given a share of dues like any other — and 1000 is what makes that safe rather than
    -- disruptive: effectiveAllocations() hands 100% to the first fund BY PRIORITY when a
    -- family has configured nothing, so at 1000 this fund sorts last and cannot become that
    -- default while the family has any other fund.
    --
    -- Lower it and every family with unconfigured routing starts sending its dues here.
    1000,
    0,
    FALSE
  )
  ON CONFLICT DO NOTHING;
END $seed$;

-- No GRANT. It is called by the `families` insert trigger and by nothing else, and a trigger
-- function's EXECUTE is checked at CREATE TRIGGER time rather than at fire time (AGENTS.md
-- §2b) — so granting it would only make it callable directly, which for a seeder is the one
-- thing not to offer. 20260806000015's assertion block is what keeps that true.

-- ── 2. Verify ───────────────────────────────────────────────────────────────
-- The function is EXERCISED rather than asserted to exist: plpgsql resolves nothing until the
-- body runs, so a bad reference in a redefinition applies cleanly and throws for the first
-- family created afterwards — in production, if the local run never made one.
DO $mig$
DECLARE
  v_code     text := 'DONFUND';
  v_priority integer;
  v_key      text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'seed_family_system_funds'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: seed_family_system_funds() is missing';
  END IF;

  -- A throwaway family. The insert trigger calls the seeder, so this exercises the real path
  -- rather than a direct call — which is also the only way to find out the trigger still fires.
  INSERT INTO public.families (family_code, family_name) VALUES (v_code, 'Donations fund probe');

  SELECT f.priority, f.system_key INTO v_priority, v_key
    FROM public.funds f
   WHERE f.family_code = v_code AND f.system_key = 'donations';

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: a new family got no Donations fund';
  END IF;

  -- THE GUARANTEE THE APP NOW DEPENDS ON, and not a formality: if a later edit lowers this,
  -- every family with unconfigured routing silently starts sending its dues to Donations and
  -- nothing in the app would report it.
  IF v_priority <> 1000 THEN
    RAISE EXCEPTION
      'ROLLBACK: the Donations fund seeded at priority %, expected 1000 — see the comment in '
      'the function body, which the routing default depends on', v_priority;
  END IF;

  -- Order as 20260813000003's verify block established: the families row goes first, because
  -- funds_protect_system() releases a system fund for deletion on exactly one condition —
  -- that the families row is already gone. This probe is the reason that matters here.
  DELETE FROM public.families              WHERE family_code = v_code;
  DELETE FROM public.funds                 WHERE family_code = v_code;
  DELETE FROM public.template_permissions tp
   USING public.permission_templates t
   WHERE tp.template_id = t.id AND t.family_code = v_code;
  DELETE FROM public.permission_templates  WHERE family_code = v_code;
  DELETE FROM public.resource_visibility   WHERE family_code = v_code;

  RAISE NOTICE 'seed_family_system_funds: Donations seeded at priority 1000, eligible for dues routing';
END $mig$;

COMMIT;
