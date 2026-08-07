-- ============================================================================
-- Create a new family from inside the app, not only at registration.
--
-- WHY THIS IS AN RPC AND NOT AN ACTION WRITING TWO ROWS
--   Neither insert is one the caller's own policies can make, and that is by design
--   rather than an oversight to route around:
--
--     families  has no INSERT policy at all. Nothing may insert through the user
--               client; registration uses the service role.
--     people    its INSERT policy demands `family_code = auth_family_code()`, which
--               for anyone who already belongs to a family is their EXISTING family.
--               The bootstrap branch beside it fires only when auth_family_code() IS
--               NULL — i.e. during first registration — so a second membership cannot
--               be inserted through it either.
--
--   The alternative is the service-role client in a server action, which is what
--   register.ts does. That works, but it means re-applying by hand everything RLS
--   would have done, in TypeScript, in a file that is a public HTTP endpoint. Doing it
--   here keeps the whole operation in one transaction and one place, next to
--   join_family_by_code(), which is its mirror image.
--
-- CALL IT WITH THE USER CLIENT. Every check below keys on auth.uid(), and the service
-- role has none — so the `v_user IS NULL` branch refuses outright rather than creating
-- a family owned by nobody, which is a state with no administrator and no way back.
--
-- WHAT THE TRIGGERS DO, SO THIS FUNCTION DOES NOT HAVE TO
--   The ORDER of the two inserts is the whole trick, and it is load-bearing:
--
--     1. INSERT families  → families_seed_system_groups (20260806000008) creates
--                           Administrators / Board Users / General, their policy, and
--                           a 'restricted' visibility row for every admin resource.
--     2. INSERT people    → people_inherit_shared_profile (20260617000001) fills the
--                           new row's name, contact and address from the caller's
--                           OLDEST existing membership — "creation uses their profile"
--                           needs no code here at all;
--                           people_stamp_membership_status (20260806000011) sees a
--                           family with no approved member yet and stamps 'approved',
--                           so the founder is not left waiting for their own approval;
--                           people_join_system_groups (20260806000008) puts them in
--                           General, and — because families.created_by = their user_id
--                           — in Administrators too.
--
--   Insert the people row first and all three of those are wrong: there are no groups
--   to join yet, and the founder ends up an ordinary member of a family nobody can
--   administer. Which is exactly the bug 20260806000008 was written to end.
--
-- THE CODE IS GENERATED HERE, NOT ACCEPTED AS AN ARGUMENT
--   A `p_code` parameter would let any signed-in caller choose their family's code by
--   posting to this endpoint directly, bypassing whatever the UI does — so short and
--   memorable codes would be squatted within a week. Not a confidentiality problem
--   (UNIQUE stops collisions with a real family) but a land grab, and avoidable.
--
--   Same alphabet and length as generateCode() in app/actions/register.ts, and for the
--   same reasons recorded there: 0/O, 1/I/L and U are dropped so a code survives being
--   read aloud and written down. 30^6 ≈ 729 million.
--
-- IDEMPOTENT. Creates functions only.
-- ============================================================================

BEGIN;

-- ── 1. A code that is unguessable and dictatable ────────────────────────────
-- gen_random_bytes (pgcrypto) rather than random(): random() is seeded per session and
-- is not a cryptographic source, and the family code is the only string standing
-- between a stranger and the Member Approvals queue of a family they picked.
--
-- SCHEMA-QUALIFIED `extensions.` — Supabase installs pgcrypto there, not in public,
-- and this function pins search_path (as every SECURITY DEFINER function here does),
-- so an unqualified call resolves to nothing. plpgsql does not check function bodies at
-- CREATE time, so getting this wrong produces a migration that applies cleanly and a
-- function that throws the first time anybody calls it. It did exactly that once.
--
-- REJECTION SAMPLING, not `% 30`. 256 is not a multiple of 30, so plain modulo makes
-- the first 16 letters of the alphabet slightly likelier than the last 14. It would
-- take an enormous sample to notice and it costs one comparison to remove, so it is
-- removed: bytes at or above 240 are discarded and redrawn.
CREATE OR REPLACE FUNCTION public.gen_family_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
  v_alphabet CONSTANT text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_len      CONSTANT int  := 6;
  v_n        CONSTANT int  := 30;   -- length(v_alphabet)
  v_limit    CONSTANT int  := 240;  -- largest multiple of 30 at or below 256
  v_out      text := '';
  v_byte     int;
BEGIN
  WHILE length(v_out) < v_len LOOP
    v_byte := get_byte(extensions.gen_random_bytes(1), 0);
    IF v_byte < v_limit THEN
      v_out := v_out || substr(v_alphabet, (v_byte % v_n) + 1, 1);
    END IF;
  END LOOP;
  RETURN v_out;
END $$;

REVOKE ALL ON FUNCTION public.gen_family_code() FROM PUBLIC;

-- ── 2. Create the family ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_family(p_family_name text)
RETURNS TABLE (ok boolean, family_code text, family_name text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user      uuid := (SELECT auth.uid());
  v_name      text := btrim(COALESCE(p_family_name, ''));
  v_email     text;
  v_confirmed timestamptz;
  v_meta      jsonb;
  v_code      text;
  v_tries     int := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Not authenticated'; RETURN;
  END IF;

  IF v_name = '' THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Enter a family name'; RETURN;
  END IF;

  IF length(v_name) > 100 THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text,
      'That family name is too long (100 characters maximum).'; RETURN;
  END IF;

  SELECT u.email, u.email_confirmed_at, u.raw_user_meta_data
    INTO v_email, v_confirmed, v_meta
    FROM auth.users u WHERE u.id = v_user;

  -- The same gate join_family_by_code() applies, for the same reason and then one
  -- more: a family's founder is its first administrator, so an unverified address
  -- here does not just get someone in, it hands them the permission model.
  IF v_confirmed IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text,
      'Confirm your email address before creating a family.'; RETURN;
  END IF;

  -- A courtesy that produces a clean message instead of a constraint violation; the
  -- guarantee is families.family_code UNIQUE, which also settles the race between this
  -- SELECT and the INSERT below.
  LOOP
    v_tries := v_tries + 1;
    v_code := public.gen_family_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.families f WHERE f.family_code = v_code);
    IF v_tries >= 5 THEN
      RETURN QUERY SELECT false, NULL::text, NULL::text,
        'Could not generate a unique family code. Please try again.'; RETURN;
    END IF;
  END LOOP;

  -- ORDER IS LOAD-BEARING — see the header. families first, so its trigger has seeded
  -- the groups by the time the people trigger goes looking for them.
  --
  -- created_by is auth.uid() and never a parameter: it is what makes this caller the
  -- founder, and therefore what tg_person_join_system_groups() reads to decide who
  -- lands in Administrators.
  INSERT INTO public.families (family_code, family_name, created_by)
  VALUES (v_code, v_name, v_user);

  -- first/last name are NOT NULL DEFAULT ''. The inherit trigger fills them (and the
  -- rest of the profile) from the caller's oldest membership, which is the whole of
  -- "creation uses their profile"; the metadata fallback covers an account with no
  -- other row, which cannot happen from /my-families but can from a direct call.
  INSERT INTO public.people (user_id, family_code, first_name, last_name,
                             primary_email, created_by, is_minor)
  VALUES (v_user, v_code,
          COALESCE(v_meta ->> 'first_name', ''),
          COALESCE(v_meta ->> 'last_name', ''),
          lower(COALESCE(v_email, '')),
          v_user, false);

  RETURN QUERY SELECT true, v_code, v_name, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.create_family(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_family(text) TO authenticated;

-- ── 3. Verify ───────────────────────────────────────────────────────────────
-- The founder must come out approved AND administering, or the family is born in the
-- state 20260806000008 exists to prevent: readable admin pages nobody can act on. That
-- depends on three triggers firing in the right order, which is not something to take
-- on trust from a comment — so it is exercised here, against a throwaway family, and
-- rolled back.
DO $mig$
DECLARE
  v_user  uuid;
  v_code  text;
  v_admin boolean;
  v_status text;
  v_probe text;
BEGIN
  -- FIRST, and unconditionally. plpgsql does not resolve names in a function body until
  -- the body runs, so a mis-qualified call inside gen_family_code() produces a migration
  -- that applies without complaint and a function that throws for every caller. That is
  -- not a hypothetical: the first version of this file said `public.gen_random_bytes`,
  -- Supabase installs pgcrypto into `extensions`, and the only reason it was caught is
  -- that someone called it by hand afterwards. This assertion needs no fixture, so it
  -- cannot be skipped the way the founder test below can.
  v_probe := public.gen_family_code();
  IF v_probe IS NULL OR length(v_probe) <> 6
     OR v_probe !~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$' THEN
    RAISE EXCEPTION 'ROLLBACK: gen_family_code() returned %, expected 6 alphabet chars', v_probe;
  END IF;

  SELECT id INTO v_user FROM auth.users LIMIT 1;
  IF v_user IS NULL THEN
    -- Genuinely nothing to test against: the founder path needs a real auth user. Said
    -- out loud rather than passed over, so an empty local database does not read as
    -- "the triggers were checked". Hosted has users, so it runs there.
    RAISE NOTICE 'no auth users yet — founder trigger test skipped (gen_family_code verified)';
    RETURN;
  END IF;

  v_code := 'ZZ' || substr(public.gen_family_code(), 1, 4);
  INSERT INTO public.families (family_code, family_name, created_by)
  VALUES (v_code, 'Migration Smoke Test', v_user);
  INSERT INTO public.people (user_id, family_code, first_name, last_name, created_by)
  VALUES (v_user, v_code, 'Smoke', 'Test', v_user);

  SELECT p.membership_status INTO v_status
    FROM public.people p WHERE p.user_id = v_user AND p.family_code = v_code;
  IF v_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'ROLLBACK: a family founder came out %, not approved', v_status;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_group_members m
      JOIN public.user_groups g ON g.id = m.group_id
      JOIN public.people p ON p.id = m.person_id
     WHERE g.family_code = v_code AND g.name = 'Administrators'
       AND p.user_id = v_user
  ) INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'ROLLBACK: a family founder did not land in Administrators';
  END IF;

  -- Undo it. The smoke test must not leave a family behind.
  DELETE FROM public.user_group_members m
   USING public.user_groups g
   WHERE m.group_id = g.id AND g.family_code = v_code;
  DELETE FROM public.group_permissions gp
   USING public.user_groups g
   WHERE gp.group_id = g.id AND g.family_code = v_code;
  DELETE FROM public.people WHERE family_code = v_code;
  DELETE FROM public.user_groups WHERE family_code = v_code;
  DELETE FROM public.resource_visibility WHERE family_code = v_code;
  DELETE FROM public.families WHERE family_code = v_code;

  RAISE NOTICE 'founder smoke test passed (approved + Administrators), family % removed', v_code;
END $mig$;

COMMIT;
