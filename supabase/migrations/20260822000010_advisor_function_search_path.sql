-- ============================================================================
-- Five functions had a role-mutable `search_path`. TODO.md has carried them since
-- 2026-08-12; this is the entry being closed.
--
-- ── WHAT THE ADVISOR IS ACTUALLY SAYING ─────────────────────────────────────
-- `function_search_path_mutable`, five WARN findings on hosted and the same five locally:
-- `_perm_predicate`, `set_updated_at`, `update_funds_updated_at`,
-- `update_photo_collections_updated_at` and `auth_uid_is_room_participant`. With no
-- `search_path` pinned, the path is whatever the CALLER's is at the moment the body runs, so
-- a caller who can create an object in a schema that resolves earlier than the intended one
-- shadows a table or function the body references — and a SECURITY DEFINER body then runs
-- that shadow AS ITS OWNER.
--
-- ONE OF THE FIVE IS THAT SHAPE AND FOUR ARE TIDINESS. `auth_uid_is_room_participant` is
-- SECURITY DEFINER, is what narrows chat to its participants, and is evaluated by REALTIME as
-- the subscribing role (AGENTS.md §2b) — since `20260821000002` put `chat_messages` in the
-- publication, that path is live rather than aspirational. The other four are INVOKER: they
-- already run as the caller, so shadowing buys the caller nothing they did not have.
--
-- What has been holding it shut is that nothing grants `CREATE ON SCHEMA public` to `anon` or
-- `authenticated` — `supabase/seed.sql` grants USAGE and table DML, not CREATE. That is one
-- missing grant away from mattering, which is the kind of thing that should not depend on a
-- grant nobody is watching.
--
-- ── THE TRAP, WHICH IS WHY THIS IS NOT A FIVE-LINE FIX ──────────────────────
-- `SET search_path = ''` means every reference in the body must be schema-qualified, and
-- plpgsql does not resolve names until the body RUNS — so a broken version is created
-- without complaint and throws for its first caller. `20260806000012` shipped exactly that
-- (`public.gen_random_bytes` where pgcrypto lives in `extensions`) and applied cleanly.
--
-- So: every reference below is qualified, and §6 CALLS each function rather than trusting
-- that it applied. `auth_uid_is_room_participant` has NO call site in the tree — Realtime
-- reaches it through RLS — so a broken version would surface as chat silently delivering
-- nothing, which is the worst possible way to find out. It is exercised first.
--
-- `pg_catalog` is always searched implicitly, so `now()` and `format()` resolve with an empty
-- path. Nothing else in these five bodies comes from anywhere but `public` and `auth`.
--
-- ── WHAT IS NOT CHANGED ─────────────────────────────────────────────────────
-- The three `*_updated_at` triggers are three identical bodies and stay three. Collapsing
-- them onto one function would mean re-pointing every trigger that names them, which is a
-- larger change than this file is, and none of them is the thing the advisor is worried
-- about. Nor is any body rewritten: `CREATE OR REPLACE` here re-states each one verbatim and
-- adds only the `SET search_path`.
-- ============================================================================

-- ── §1  auth_uid_is_room_participant — the SECURITY DEFINER one ─────────────
-- `chat_participants` is the one unqualified reference, and it is the one that matters:
-- shadow that table and this function answers `true` for any room, as its owner, for a
-- Realtime subscriber.
CREATE OR REPLACE FUNCTION public.auth_uid_is_room_participant(p_room_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE room_id = p_room_id
      AND user_id = auth.uid()
  );
$$;

-- ── §2  _perm_predicate — the policy composer ───────────────────────────────
-- IMMUTABLE, INVOKER, and pure text assembly: `format()` is pg_catalog and the identifiers it
-- interpolates are already written `public.…` in the template. Pinned for uniformity.
CREATE OR REPLACE FUNCTION public._perm_predicate(
  p_resource text, p_action text, p_own_expr text, p_self_expr text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path = ''
AS $$
  SELECT format(
    '((%s) OR public.auth_permission(%L, %L::public.permission_action) = ''any'''
    || ' OR (public.auth_permission(%L, %L::public.permission_action) = ''own'' AND (%s)))',
    p_self_expr, p_resource, p_action, p_resource, p_action, p_own_expr
  );
$$;

-- ── §3-5  the three updated_at triggers ─────────────────────────────────────
-- Trigger functions need no EXECUTE grant (checked at CREATE TRIGGER time, not at fire
-- time), and these touch nothing but NEW and `now()`.
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_funds_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.update_photo_collections_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── §6  Verify: the config is set AND the bodies still run ──────────────────
DO $verify$
DECLARE
  v_missing text;
  v_participant boolean;
  v_predicate text;
BEGIN
  -- (a) all five carry it, and nothing in `public` is left with a mutable path.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_missing
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prokind = 'f'
     AND NOT EXISTS (
       SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c
        WHERE c LIKE 'search\_path=%'
     );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'functions in public still have a mutable search_path: %', v_missing;
  END IF;

  -- (b) THE HALF `20260806000012` SKIPPED. A migration that only asserts the catalogue
  --     reports success over a function that throws for its first caller. Both of these
  --     resolve a reference that the empty path could have broken.
  SELECT public.auth_uid_is_room_participant('00000000-0000-0000-0000-000000000000'::uuid)
    INTO v_participant;
  IF v_participant IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'auth_uid_is_room_participant answered % for a room nobody is in', v_participant;
  END IF;

  SELECT public._perm_predicate('community/chat', 'view', 'false', 'false') INTO v_predicate;
  IF v_predicate IS NULL OR v_predicate NOT LIKE '%public.auth_permission%' THEN
    RAISE EXCEPTION '_perm_predicate returned %', coalesce(v_predicate, '<null>');
  END IF;

  RAISE NOTICE 'search_path pinned on 5 functions; both callable bodies exercised.';
END
$verify$;
