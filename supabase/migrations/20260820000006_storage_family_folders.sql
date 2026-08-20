-- ============================================================================
-- A bucket folder belongs to one family. Close the other three buckets.
-- ----------------------------------------------------------------------------
-- WHAT FOUND THIS
--   `tests/rls` grew a Storage harness on 2026-08-20 (`tests/rls/raw/storage.mjs`), which
--   is the gap `cases.mjs`'s UNCOVERED list had recorded since Phase 3: the four upload
--   actions write to Supabase Storage, whose bucket policies are a SEPARATE access-control
--   system from the composed RLS policies that suite was built for. Nothing in
--   `20260618000001`'s sweep touches `storage.objects`, `audit:family-scope` does not look
--   at it, and §2c's argument about `public` tables says nothing about a bucket.
--
--   The first run of that harness found three things, each MEASURED against the local stack
--   rather than read off a policy:
--
--   1. `photos` — ONE FAMILY CAN WRITE INTO ANOTHER'S FOLDER. The INSERT policy from
--      `20260610000001` is `bucket_id = 'photos'` and nothing else, i.e. any signed-in user,
--      ANY path. As BRAVO's administrator, `PUT photos/ALPHATEST/<alpha collection>/pwned.jpg`
--      returned 200. The bucket is `public: true`, so that object is then served by URL to
--      anybody — the same shape `20260820000002` closed on `avatars`, one bucket over.
--
--   2. `photos` — NOBODY CAN EVER DELETE A PHOTOGRAPH'S FILE, and this is the worse of the
--      two. The DELETE policy is `auth.uid()::text = (storage.foldername(name))[1]` — the
--      correct pattern, aimed at the wrong layout. `uploadPhoto` writes
--      `{family_code}/{collection_id}/{uuid}.{ext}`, so the first folder is `ALPHATEST` and
--      never a uuid, and the policy matches nothing for ANYONE. Measured: the uploader's own
--      `remove()` of their own object answered **200 with an empty array** — Storage reports
--      a refused delete as a success with nothing removed, which is why `deletePhoto` has
--      never been able to notice. So every photograph a family has "deleted" is still in the
--      bucket and still world-readable at its URL, indefinitely.
--
--   3. `documents` — CROSS-FAMILY READ *AND* DELETE, on a PRIVATE bucket. All four policies
--      are `auth.uid() IS NOT NULL`, so as BRAVO's administrator: downloading ALPHA's
--      document returned its bytes, listing ALPHA's prefix returned its filenames, and
--      `remove()` of ALPHA's document removed it — 1 object, reported as removed. A pending
--      ALPHA applicant could upload as well.
--
-- ── WHY `documents` IS FIXED HERE WHEN `20260820000002` DECLINED TO ─────────────────
--   That migration named it and left it, on the ground that it is behind `status: 'future'`
--   and "its objects have no per-user layout to enforce — `app/actions/documents.ts` does not
--   upload anything yet", so inventing a path convention in a migration would be deciding
--   that feature's storage layout somewhere nobody would find it.
--
--   **THE PREMISE WAS WRONG.** `uploadDocument` has existed since `20260610000000` and writes
--   `{family_code}/{uuid}.{ext}`. The convention was already chosen, in code, by the action
--   that ships. So this is not inventing a layout — it is enforcing the one that is already
--   there, which was the only thing the earlier decision was waiting for. Recorded plainly
--   because that is the kind of premise which, left standing, keeps a hole open for a year:
--   the file said "no layout exists" and a two-line grep said otherwise.
--
--   The `status: 'future'` half is not a reason either, and AGENTS.md says so at length:
--   "COMING SOON WITHHOLDS A PAGE. IT DOES NOT WITHHOLD AN ACTION." `uploadDocument` and
--   `deleteDocument` are live HTTP endpoints today.
--
-- ── THE FAMILY FOLDER IS THE PREDICATE, AND `auth.uid()` CANNOT BE ─────────────────
--   `avatars` is laid out per USER, so `(auth.uid())::text = (storage.foldername(name))[1]`
--   is exactly right there. `photos` and `documents` are laid out per FAMILY, and a family
--   code is not a uuid, so the same expression can only ever match nothing — which is finding
--   2. The predicate that fits the layout is:
--
--       (storage.foldername(name))[1] = public.auth_family_code()
--
--   `auth_family_code()` is the same SECURITY DEFINER resolver every composed policy in
--   `public` is written against, and it is granted to `authenticated` (asserted below,
--   because a policy expression is evaluated as the QUERYING role and a missing grant would
--   fail every query rather than refusing it — AGENTS.md §2b, rule 2).
--
--   `auth_membership_approved()` is ANDed in as well, matching `20260806000011` §6's sweep
--   over the `public` tables: somebody who has typed a family code and has not been admitted
--   is inside the family boundary by every test `auth_family_code()` applies, and must not be
--   filing objects into the family's storage. Measured before the fix: a pending applicant's
--   upload succeeded.
--
--   ONE CONSEQUENCE, STATED SO IT IS A DECISION. `auth_family_code()` resolves the caller's
--   ACTIVE family, so a member of two families cannot delete a photograph they uploaded in
--   the other one until they switch to it. That is how every other boundary in this product
--   behaves — family isolation is by active family throughout — and the alternative (a
--   membership lookup per object) would admit a caller acting in ALPHA to BRAVO's folder,
--   which is the hole this closes.
--
-- ── PUBLIC READ IS UNCHANGED ON `photos`, DELIBERATELY ─────────────────────────────
--   Same boundary `20260820000002` kept for `avatars`: the hole was WRITE, and narrowing a
--   public bucket's READ is a product decision with a real cost (a signed URL per image per
--   render). `documents` is a PRIVATE bucket, so its read policy is not that question at all
--   — it is the leak itself, and it is narrowed here.
--
-- ── `event-photos` IS FROZEN, NOT DROPPED ──────────────────────────────────────────
--   It is orphaned: `20260819000006` retired Events and dropped every table that referenced
--   it, so nothing in the tree reads or writes this bucket. Its three write policies were
--   still `auth.uid() IS NOT NULL`, any path — a world-readable file host any signed-in user
--   could upload to, kept warm for a feature that no longer exists.
--
--   The policies are DROPPED and none replace them, which per §2c's logic denies every write
--   outright. That is not the same as dropping the bucket, which AGENTS.md still carries and
--   which this cannot do: `storage.objects` refuses a direct DELETE (a trigger answers "Use
--   the Storage API instead", 42501), so removing the objects is an API operation and the
--   bucket row cannot go while they exist. Freezing the writes is the part a migration CAN
--   do, and it is the part that matters — read stays open because the objects are already
--   public and the URLs are already out.
-- ============================================================================

BEGIN;

-- ── 1. Assert the two helpers are callable by the browser role ──────────────
-- A policy expression is evaluated as the QUERYING role. If either of these lost its
-- `authenticated` grant, every photo and document query would fail with "permission denied
-- for function" rather than being refused — a broken feature, not a closed hole. Checked
-- before the policies are written rather than after, so the migration refuses instead of
-- shipping a bucket nobody can use.
DO $mig$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.auth_family_code()', 'EXECUTE') THEN
    RAISE EXCEPTION 'ROLLBACK: authenticated cannot EXECUTE auth_family_code() — every storage policy below would error rather than refuse';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.auth_membership_approved()', 'EXECUTE') THEN
    RAISE EXCEPTION 'ROLLBACK: authenticated cannot EXECUTE auth_membership_approved()';
  END IF;
END $mig$;

-- ── 2. `photos` — writes are scoped to the caller's own family folder ───────
DROP POLICY IF EXISTS "authenticated can upload to photos" ON storage.objects;
DROP POLICY IF EXISTS "uploader can delete from photos"    ON storage.objects;

CREATE POLICY "photos_family_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = public.auth_family_code()
    AND public.auth_membership_approved()
  );

-- UPDATE gets BOTH halves. `USING` is which objects you may reach; `WITH CHECK` is what you
-- may turn them into — without the second, a member could RENAME an object out of their own
-- family's folder into another family's, which is finding 1 by another route. There was no
-- UPDATE policy on this bucket at all before, so this is a new capability rather than a
-- narrowed one, and it is added because `upload({ upsert: true })` needs it: replacing an
-- object at an existing path is an UPDATE, and `uploadAvatar` relies on exactly that.
CREATE POLICY "photos_family_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = public.auth_family_code()
    AND public.auth_membership_approved()
  )
  WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = public.auth_family_code()
    AND public.auth_membership_approved()
  );

-- The one that was broken for the whole life of the bucket. `deletePhoto` can now actually
-- remove the file it says it removed.
CREATE POLICY "photos_family_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = public.auth_family_code()
    AND public.auth_membership_approved()
  );

-- `public can view photos` is untouched — see the header.

-- ── 3. `documents` — a private bucket, scoped to the family folder ──────────
DROP POLICY IF EXISTS "documents_auth_read"   ON storage.objects;
DROP POLICY IF EXISTS "documents_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_auth_delete" ON storage.objects;

-- READ is narrowed here, unlike on the two public buckets, because this bucket is
-- `public: false` and its read policy IS the boundary. `list()` is a SELECT under the
-- covers, so this closes the enumeration finding along with the download one.
CREATE POLICY "documents_family_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.auth_family_code()
    AND public.auth_membership_approved()
  );

CREATE POLICY "documents_family_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.auth_family_code()
    AND public.auth_membership_approved()
  );

CREATE POLICY "documents_family_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.auth_family_code()
    AND public.auth_membership_approved()
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.auth_family_code()
    AND public.auth_membership_approved()
  );

CREATE POLICY "documents_family_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.auth_family_code()
    AND public.auth_membership_approved()
  );

-- ── 4. `event-photos` — writes frozen, nothing replaces them ───────────────
-- No policy for a command denies that command (§2c). Read is left as it is: the objects are
-- already public and their URLs are already out, so closing read now protects nothing and
-- would only make the eventual drop harder to verify.
DROP POLICY IF EXISTS "event_photos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "event_photos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "event_photos_auth_delete" ON storage.objects;

-- ── 5. Verify ───────────────────────────────────────────────────────────────
-- BOTH DIRECTIONS, and the negative one is the whole point: an assertion that the new
-- policies exist would have passed against the versions this file replaces, which also
-- existed. `20260820000002` learned that the hard way and its verify block is the model.
DO $mig$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('photos_family_insert', 'photos_family_update', 'photos_family_delete',
                        'documents_family_read', 'documents_family_insert',
                        'documents_family_update', 'documents_family_delete');
  IF v_count <> 7 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 7 family-scoped storage policies, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('authenticated can upload to photos', 'uploader can delete from photos',
                        'documents_auth_read', 'documents_auth_insert',
                        'documents_auth_update', 'documents_auth_delete',
                        'event_photos_auth_insert', 'event_photos_auth_update',
                        'event_photos_auth_delete');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % of the any-path policies survived', v_count;
  END IF;

  -- `event-photos` keeps exactly its read policy and nothing else.
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND qual LIKE '%event-photos%' OR with_check LIKE '%event-photos%';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: expected exactly 1 surviving event-photos policy (read), found %', v_count;
  END IF;

  -- The avatar policies are NOT touched by this file and are asserted anyway. They are the
  -- precedent this migration copies, and a later edit to the wrong bucket's policies is
  -- exactly the mistake that would otherwise be found by somebody's profile picture.
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('avatars_owner_insert', 'avatars_owner_update', 'avatars_owner_delete');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'ROLLBACK: the three avatar owner policies should still be here, found %', v_count;
  END IF;

  RAISE NOTICE 'photos + documents writes are family-folder scoped; documents read narrowed; event-photos writes frozen';
END $mig$;

-- ── 6. Exercised as `authenticated`, because that is the only role these bind ──
-- The migration owner bypasses RLS, so asserting from here without switching role proves
-- nothing at all. There is no family fixture in an empty database, so this probes the ONE
-- thing that needs no rows: that a caller with no resolvable family — `auth_family_code()`
-- answers NULL — is refused rather than admitted. A NULL on either side of `=` makes the
-- predicate NULL, which RLS treats as false; asserting it is what stops a future rewrite
-- from reaching for `COALESCE` and opening the bucket to every unattached account.
--
-- `storage` refuses a direct DELETE (a trigger answers "Use the Storage API instead"), so the
-- probe raises a sentinel inside a plpgsql BEGIN…EXCEPTION — an implicit subtransaction — to
-- unwind its own insert. The sentinel is compared by MESSAGE, or a policy that wrongly
-- REFUSED would be swallowed by the same handler and reported as a pass.
DO $mig$
DECLARE
  v_stranger uuid := 'cccccccc-3333-3333-3333-333333333333';
BEGIN
  SET LOCAL role TO authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('photos', 'ALPHATEST/probe/probe.jpg', v_stranger);
    RAISE EXCEPTION 'ROLLBACK: an account with no family wrote into a family photo folder';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;  -- expected
  END;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('documents', 'ALPHATEST/probe.pdf', v_stranger);
    RAISE EXCEPTION 'ROLLBACK: an account with no family wrote into a family document folder';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;  -- expected
  END;

  -- The frozen bucket: no INSERT policy at all, so this is refused for everybody.
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('event-photos', 'ALPHATEST/probe.jpg', v_stranger);
    RAISE EXCEPTION 'ROLLBACK: event-photos still accepts writes';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;  -- expected
  END;

  RESET role;
  RAISE NOTICE 'storage: an account with no family is refused by all three buckets';
END $mig$;

COMMIT;
