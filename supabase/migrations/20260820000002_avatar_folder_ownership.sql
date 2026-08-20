-- ============================================================================
-- Your avatar folder is yours. Nobody else may write to it.
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
-- `20260609000000` created the `avatars` bucket with three write policies of this shape:
--
--     bucket_id = 'avatars' AND auth.uid() IS NOT NULL
--
-- which is "any signed-in user, any path". `uploadAvatar` writes to `{auth.uid()}/avatar.ext`,
-- so the LAYOUT is per-user and nothing enforced it. Measured 2026-08-20 by doing it: as
-- `authenticated` with one uuid in the JWT, an INSERT naming another user's folder succeeded.
--
-- What that buys an attacker is worse than it first sounds, because the bucket is `public`:
-- the file at `{someone-else}/avatar.jpg` is served by URL to anybody and is what the
-- Directory, the family tree and the top bar all render beside that person's name. So it is
-- not "overwrite a file" — it is choose the picture the whole family sees under somebody
-- else's name. UPDATE and DELETE were equally open, so removing a member's photo was a
-- one-line request too.
--
-- ── THE FIX IS THE PATTERN THE `photos` BUCKET ALREADY USES ─────────────────
-- `uploader can delete from photos` has had it since 20260610000001:
--
--     (auth.uid())::text = (storage.foldername(name))[1]
--
-- `storage.foldername()` splits the object name on '/' and returns the directory parts, so
-- `[1]` is the first folder — the uuid `uploadAvatar` puts there. This applies it to all three
-- avatar write policies. Nothing about the app changes: it already wrote to that path.
--
-- ── PUBLIC READ IS KEPT, DELIBERATELY ───────────────────────────────────────
-- `avatars_public_read` stays as it is. A profile picture is rendered by `next/image` and by
-- plain `<img>` in several places, and a private bucket would mean a signed URL per avatar per
-- render — a different feature with a different cost. It is also not the hole: the hole was
-- WRITE. FutureFeature.md carries the separate question of whether these should be public at
-- all, and this migration deliberately does not answer it, because narrowing read is a
-- product decision and closing a write hole is not.
--
-- ── AND THE OTHER TWO BUCKETS ARE LEFT ALONE, WHICH IS A DECISION ───────────
-- `documents` and `event-photos` carry the same "any authenticated user, any path" policies.
-- Neither is fixed here and both are named so the omission is recorded rather than assumed:
--
--   * `event-photos` is ORPHANED. Retiring Events dropped every table that referenced it
--     (20260819000006) and nothing reads or writes it now. AGENTS.md already carries dropping
--     the bucket outright, which is the right repair and is a storage operation rather than a
--     migration.
--   * `documents` is behind `status: 'future'`. Its objects have no per-user layout to enforce
--     — `app/actions/documents.ts` does not upload anything yet — so there is no folder rule
--     to write. It belongs in the same review AGENTS.md demands of any roadmap feature's
--     actions before the flag flips, and inventing a path convention here would be deciding
--     that feature's storage layout in a migration nobody reading the feature would find.
-- ============================================================================

BEGIN;

-- ── 1. Replace the three write policies ─────────────────────────────────────
-- DROP then CREATE rather than ALTER: a policy's USING/WITH_CHECK can be altered in place, but
-- dropping states the replacement plainly and makes a re-run idempotent.
DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;

-- INSERT: you may create an object only inside your own folder.
CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- UPDATE: both halves. `USING` is which rows you may reach, `WITH_CHECK` is what you may turn
-- them into — without the second, an owner could RENAME their object into somebody else's
-- folder, which is the hole again by another route.
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- ── 2. Verify ───────────────────────────────────────────────────────────────
-- Both directions, and the negative one is the whole point: an assertion that the three
-- policies EXIST would have passed against the versions this file replaces.
DO $mig$
DECLARE
  v_attacker uuid := 'aaaaaaaa-1111-1111-1111-111111111111';
  v_victim   uuid := 'bbbbbbbb-2222-2222-2222-222222222222';
  v_count    int;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('avatars_owner_insert', 'avatars_owner_update', 'avatars_owner_delete');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 3 owner-scoped avatar policies, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('avatars_auth_insert', 'avatars_auth_update', 'avatars_auth_delete');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % of the old any-path avatar policies survived', v_count;
  END IF;

  -- EXERCISED AS `authenticated`, because that is the role the browser speaks as and the only
  -- one these policies constrain. The migration owner bypasses RLS, so asserting from here
  -- without switching role would prove nothing at all.
  SET LOCAL role TO authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_attacker, 'role', 'authenticated')::text, true);

  -- ── YOUR OWN FOLDER: ALLOWED, AND THE ROW IS UNWOUND RATHER THAN DELETED ────────
  -- `storage` has a trigger refusing direct DELETE ("Use the Storage API instead", 42501), so
  -- the obvious cleanup is not available from a migration — the first draft of this file tried
  -- it and aborted here. A plpgsql `BEGIN … EXCEPTION` block is an implicit SUBTRANSACTION, so
  -- raising a sentinel after the insert rolls the insert back and leaves nothing behind.
  --
  -- The sentinel is compared by MESSAGE, which is what distinguishes "the probe worked" from
  -- "the insert was refused" — without that test a policy that wrongly refused an owner would
  -- be swallowed by the same handler and reported as a pass.
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('avatars', v_attacker::text || '/avatar.jpg', v_attacker);
    RAISE EXCEPTION 'probe:owner-write-ok';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'probe:owner-write-ok' THEN
      RAISE EXCEPTION 'ROLLBACK: an owner could not write to their own avatar folder: %', SQLERRM;
    END IF;
  END;

  -- SOMEBODY ELSE'S: refused. This is the assertion the file exists for, and it needs no
  -- unwinding because the write does not happen.
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('avatars', v_victim::text || '/avatar.jpg', v_attacker);
    RAISE EXCEPTION 'ROLLBACK: an authenticated user still wrote into another user''s folder';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;  -- expected: RLS refused it
  END;

  RESET role;

  RAISE NOTICE 'avatars: writes are folder-scoped to the owner, public read unchanged';
END $mig$;

COMMIT;
