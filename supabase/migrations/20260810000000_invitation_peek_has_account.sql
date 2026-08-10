-- ============================================================================
-- An invitation can say whether the address it names already has an account.
--
-- THE BUG
--   Someone invited to a family, still waiting on its approval queue, was invited to a
--   SECOND family. They followed the link, pressed "Create an account" — the primary
--   button on /invite/<token>, and the only one that sounds like accepting — and
--   registration failed. It fails two different ways and neither is usable:
--
--     confirmations OFF  GoTrue answers "User already registered", surfaced raw.
--     confirmations ON   GoTrue does NOT error. To keep signUp from being an account
--                        enumeration oracle it returns a FABRICATED user: a fresh
--                        random id and an empty `identities` array. register.ts then
--                        redeemed the invitation against an id that is in no table, so
--                        redeem_family_invitation() found no auth.users row, compared
--                        NULL to the invited address and answered "This invitation was
--                        sent to a different email address" — on a screen displaying
--                        exactly that address. It then deleted a user id that had never
--                        existed.
--
--   The route that works was on the same screen the whole time: sign in, and
--   /invite/<token> redeems on GET. redeem_family_invitation() inserts a second
--   `people` row, the stamp trigger of 20260806000011 pends it, and the account is
--   awaiting approval at both families at once — which is the correct end state, and
--   already what the model supports. Nothing was missing but a signpost.
--
-- WHY NOT SIMPLY ATTACH THE FAMILY TO THE ADDRESS
--   Because registerUser is a `'use server'` export, i.e. a public HTTP endpoint with
--   no session. "The address already exists, so add the membership to it" is a write
--   onto an account the caller has not authenticated as; the password they typed
--   proves nothing unless it is verified, and verifying it turns /register into a
--   second sign-in endpoint and a password oracle. A forwarded link would then act on
--   someone else's account — and for a `pre_approved` invitation it would confer an
--   APPROVED membership on an account whose owner never touched the flow. The token is
--   a narrowing condition over the address (20260806000013 §4); the account is the
--   identity. So the fix is a signpost to sign-in, not a second way in.
--
-- WHAT IS DISCLOSED, AND TO WHOM
--   `has_account` is one bit — "this address can sign in" — and peek is the one
--   function `anon` may execute (20260806000015 §5). Reaching it needs an invitation
--   that is unspent, unrevoked, unexpired, and whose 32-byte token was generated once
--   and handed to the person who addressed it to that address. Someone holding that
--   already knows the address; learning that it has an account tells them nothing
--   about any address they did not already have. It is NOT a general enumeration
--   endpoint, and it must not become one: this is the reason the bit lives behind the
--   token rather than behind an email parameter.
--
--   Any auth.users row counts, confirmed or not. An unconfirmed account is still an
--   account that blocks signUp, so "sign in" remains the correct instruction — the
--   sign-in error then tells them their address is unconfirmed, which is true and
--   actionable, where "User already registered" was neither.
--
-- IDEMPOTENT.
-- ============================================================================

BEGIN;

-- DROP, not CREATE OR REPLACE. This adds a column to the RETURNS TABLE, and Postgres
-- refuses to change an existing function's return type in place. The argument list is
-- unchanged, so unlike 20260806000014 there is no overload left stranded — but a DROP
-- takes the function's GRANTs with it, and 20260806000015 §6 set default privileges
-- that REVOKE EXECUTE from anon and authenticated for everything created afterwards.
-- The re-grant below is therefore load-bearing, not tidying: without it a visitor with
-- no session cannot peek, and /invite/<token> shows "this invitation is not valid" for
-- every invitation that is.
DROP FUNCTION IF EXISTS public.peek_family_invitation(text);

CREATE FUNCTION public.peek_family_invitation(p_token text)
RETURNS TABLE (
  valid        boolean,
  email        text,
  family_name  text,
  pre_approved boolean,
  -- Whether `email` can already sign in. Both sides lowered: family_invitations.email
  -- is stored lower(btrim(...)) by create_family_invitation(), and comparing an
  -- unnormalized auth.users.email would answer "no account" for an address that has
  -- one — which is the answer that sends someone back into the failing register flow.
  has_account  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT true, i.email, f.family_name, i.pre_approved,
         EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = i.email)
    FROM public.family_invitations i
    LEFT JOIN public.families f ON f.family_code = i.family_code
   WHERE i.token_hash = encode(extensions.digest(COALESCE(p_token, ''), 'sha256'), 'hex')
     AND i.accepted_at IS NULL
     AND i.revoked_at IS NULL
     AND i.expires_at > NOW()
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.peek_family_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_family_invitation(text) TO authenticated, anon;

-- ── Verify ──────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n int;
  s   text;
  bad text[] := '{}';
BEGIN
  -- Exactly one. An unchanged argument list cannot leave an overload behind, but
  -- 20260806000014 exists because a defaulted parameter quietly did, and an ambiguous
  -- name is refused by PostgREST for every caller.
  SELECT COUNT(*) INTO v_n FROM pg_proc
   WHERE proname = 'peek_family_invitation' AND pronamespace = 'public'::regnamespace;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: % overloads of peek_family_invitation, expected 1', v_n;
  END IF;

  -- The new column, by name, because that is what the callers select. A missing column
  -- would not fail this migration — it would fail /invite/<token> and /register.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p, unnest(p.proargnames) AS n
     WHERE p.proname = 'peek_family_invitation'
       AND p.pronamespace = 'public'::regnamespace
       AND n = 'has_account'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: peek_family_invitation() does not return has_account';
  END IF;

  -- auth.users is readable from here. Needs no fixture — an address that matches
  -- nothing still proves the reference resolves and the schema is reachable, which is
  -- the half of 20260806000012's lesson that can be checked unconditionally.
  PERFORM EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = 'probe@example.invalid');

  -- The grants the DROP took away, re-asserted here rather than left to
  -- 20260806000015 §7 — that block has already run, and this file just recreated one
  -- of the functions it named.
  IF NOT has_function_privilege('anon',
       'public.peek_family_invitation(text)'::regprocedure, 'EXECUTE') THEN
    bad := bad || 'anon LOST public.peek_family_invitation(text) — /invite/<token> is dead for anyone without a session';
  END IF;
  IF NOT has_function_privilege('authenticated',
       'public.peek_family_invitation(text)'::regprocedure, 'EXECUTE') THEN
    bad := bad || 'authenticated LOST public.peek_family_invitation(text)';
  END IF;
  IF NOT has_function_privilege('service_role',
       'public.peek_family_invitation(text)'::regprocedure, 'EXECUTE') THEN
    bad := bad || 'service_role LOST public.peek_family_invitation(text)';
  END IF;

  -- And it is STILL the only anon-executable function in the schema. The DROP/CREATE
  -- ran under default privileges this file did not set, so this is the check that
  -- catches them having drifted.
  FOR s IN SELECT p.oid::regprocedure::text FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace
              AND has_function_privilege('anon', p.oid, 'EXECUTE')
              AND p.oid <> 'public.peek_family_invitation(text)'::regprocedure::oid
  LOOP bad := bad || ('anon STILL HAS ' || s); END LOOP;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: peek_family_invitation grants are wrong:%',
      E'\n  ' || array_to_string(bad, E'\n  ');
  END IF;

  RAISE NOTICE 'peek_family_invitation(): has_account added, grants intact';
END $mig$;

-- PostgREST caches the schema, including each function's return shape. Without this the
-- API keeps serving the four-column version and `has_account` reads as undefined.
NOTIFY pgrst, 'reload schema';

COMMIT;
