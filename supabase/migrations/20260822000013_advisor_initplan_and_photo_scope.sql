-- ============================================================================
-- `auth_rls_initplan`: eight policies re-evaluated `auth.uid()` once per ROW.
-- AND FIVE OF THE EIGHT HAD NO FAMILY CONJUNCT AT ALL -- HELD SHUT BY THE POLICY BESIDE THEM.
--
-- ---- THE PERFORMANCE HALF, WHICH IS THE ONE THE ADVISOR ASKED ABOUT --------
-- `auth.uid()` reads the request's JWT claims. It is STABLE, but a bare call inside a policy
-- predicate is re-planned as a per-row expression, so a 400-row page evaluates it 400 times.
-- Wrapping it as `(SELECT auth.uid())` turns it into an InitPlan the planner evaluates ONCE
-- per statement. It is semantics-preserving by definition -- the value cannot change within a
-- statement -- which is why most of the composed policies already carry the wrapped form:
-- `20260618000001` emitted it, and the bare calls are all in expressions written by hand
-- before or after that sweep.
--
-- Ten policies were named. `20260822000011` fixed `notifications` SELECT and `20260822000012`
-- fixed `election_votes` SELECT while rewriting them for other reasons; the remaining eight
-- are here.
--
-- ---- AND THEN THE PHOTO POLICIES, WHICH ARE NOT A PERFORMANCE PROBLEM -----
-- Reading the five flagged photo policies in order to rewrite them is how this was found.
-- Every one of them looked like this:
--
--     USING (((uploader_id IN (SELECT people.id FROM people WHERE people.user_id = auth.uid()))
--             OR true)
--            AND (false OR auth_permission('review/photos','delete') = 'any'
--                       OR (auth_permission('review/photos','delete') = 'own'
--                           AND uploader_id = auth_person_id())))
--
-- `X OR true` IS `true`. The first conjunct -- the whole of "the person who uploaded it" -- is
-- dead text, and what is left is a permission check with NO `family_code` anywhere in it. So
-- as WRITTEN, `photos` UPDATE and DELETE, `photo_collections` UPDATE and DELETE and
-- `photo_tags` DELETE admitted any caller holding the grant at scope 'any', in any family.
--
-- The `OR true` is residue from the sweep: these five predicates were `<owner> OR is_admin(…)`
-- when `people.is_admin` still existed, and `20260618000003` replaced the admin half with the
-- literal `true` on its way to `auth_permission`. Everywhere else that produced a harmless
-- `false OR` in the self_expr slot; here it landed on the side of an OR that was carrying the
-- family scoping, and swallowed it.
--
-- ---- IT WAS LATENT, NOT EXPLOITABLE, AND THE MEASUREMENT IS THE POINT ------
-- The first draft of this file called it a live cross-family hole. That was WRONG, and it was
-- the mutation check that said so: the five probes written for it in `tests/rls/raw/photos.mjs`
-- stayed GREEN with the `OR true` form restored. Measured afterwards, against the local stack,
-- as BRAVO's administrator with a real JWT, straight through PostgREST:
--
--   A. `OR true` write policy + the real (family-scoped) SELECT policy
--      DELETE /rest/v1/photos?id=eq.<an ALPHA photo>   ->  204, and the row SURVIVES
--   B. `OR true` write policy + SELECT policy widened to `USING (true)`, nothing else changed
--      the same request                                ->  204, and ALPHA's photograph is GONE
--
-- So the write policy really was unbounded, and what refused the request was the READ policy
-- beside it. The rule is in PostgreSQL's own: an UPDATE or DELETE whose WHERE clause
-- references the table's columns needs SELECT rights on those rows, so the SELECT policies are
-- applied too. PostgREST cannot express an unfiltered UPDATE or DELETE, and `auth_permission`
-- resolved 'any' for that caller (checked, not assumed) -- so nothing but the SELECT policy can
-- account for (A), and (B) is the control that proves it.
--
-- **THEREFORE, FOR A BROWSER CALLER, THE SELECT POLICY IS THE FLOOR OF EVERY UPDATE AND
-- DELETE.** A write policy cannot be wider in practice than the read policy on the same table.
-- That is worth knowing in both directions: it is why this was not an incident, and it is why
-- widening a SELECT policy is a WRITE decision as well as a read one -- a future "share an
-- album by link" feature on `photos` would have turned all five of these live in one edit.
--
-- ---- SO WHY FIX IT AT ALL ------------------------------------------------
-- Because a dead conjunct reads as protection, and the next person to touch `photos` SELECT
-- would have no way to know the write policies were resting on it. Defence in depth is the
-- whole argument here rather than a slogan: after this file the two layers are independent,
-- and the verify block asserts `OR true` appears in NO policy in the schema, so the shape
-- cannot come back quietly.
--
-- The repair is to say what the other two policies on each of those tables already say:
--
--     photos, photo_collections     family_code = public.auth_family_code()
--     photo_tags                    photo_id IN (photos of this family)
--
-- and let the permission predicate keep doing own-versus-any, which is what it is for. That is
-- exactly the shape of `perm:family can view photos` and `perm:family can upload photos`,
-- which were never affected -- the two write policies were the odd ones out on their own table.
--
-- ---- WHAT THIS CHANGES FOR A CALLER, PRECISELY ----------------------------
-- Nothing, inside a family, and nothing for anybody outside one either -- see the measurement
-- above. A member with `review/photos:delete` at 'own' could already only reach their own rows
-- and can still reach exactly those. No grant is narrowed and no row inside the family becomes
-- unreachable, so no migration-time backfill is owed.
--
-- `tests/rls` gains five raw probes in the same commit, and they are labelled for what they
-- ARE evidence of -- the SELECT-policy floor, which nothing tested before -- rather than for
-- the conjunct this file adds, which no client-side probe can see. The conjunct is asserted
-- here, in SQL, because here is the only place it can be.
-- ============================================================================

-- ---- 1  people INSERT -----------------------------------------------------
-- Verbatim apart from the wrapping. The middle disjunct is the registration path: a brand-new
-- account has no membership yet, so `auth_family_code()` is NULL and the family code comes
-- from the verified JWT instead. `auth.jwt()` is wrapped for the same reason as `auth.uid()`.
DROP POLICY IF EXISTS "perm:family can insert people" ON public.people;

CREATE POLICY "perm:family can insert people"
  ON public.people FOR INSERT TO authenticated
  WITH CHECK (
    (created_by = (SELECT auth.uid()) OR user_id = (SELECT auth.uid()))
    AND (
      family_code = public.auth_family_code()
      OR (
        user_id = (SELECT auth.uid())
        AND public.auth_family_code() IS NULL
        AND family_code = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'family_code')
      )
    )
    AND (
      user_id = (SELECT auth.uid())
      OR public.auth_permission('community/directory', 'create'::public.permission_action) = 'any'
      OR (public.auth_permission('community/directory', 'create'::public.permission_action) = 'own'
          AND user_id = (SELECT auth.uid()))
    )
  );

-- ---- 1b  people UPDATE and DELETE -----------------------------------------
-- NOT ON THE ADVISOR'S LIST, and they are the same defect. Measured rather than assumed:
-- fifteen policies in `public` call `auth.uid()` per row and the lint named ten of them, so
-- three chat policies (rewritten in `20260822000011`) and these two were going to be left
-- behind by a fix that trusted the report. Both are rewritten verbatim apart from the
-- wrapping.
--
-- Note what scopes these two, because it is NOT `family_code` and that is correct: a row the
-- caller CREATED is narrower than a row in the caller's family, and it is the only thing that
-- can be said about `people` rows here -- the DELETE exists so somebody can undo their own
-- mistaken addition of a record with no account, and it must not become "administrators may
-- delete relatives".
DROP POLICY IF EXISTS "perm:users can update own or created people" ON public.people;
DROP POLICY IF EXISTS "perm:users can delete people they created without accounts" ON public.people;

CREATE POLICY "perm:users can update own or created people"
  ON public.people FOR UPDATE TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()))
    AND (
      user_id = (SELECT auth.uid())
      OR public.auth_permission('community/directory', 'edit'::public.permission_action) = 'any'
      OR (public.auth_permission('community/directory', 'edit'::public.permission_action) = 'own'
          AND user_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND (
      user_id = (SELECT auth.uid())
      OR public.auth_permission('community/directory', 'edit'::public.permission_action) = 'any'
      OR (public.auth_permission('community/directory', 'edit'::public.permission_action) = 'own'
          AND user_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "perm:users can delete people they created without accounts"
  ON public.people FOR DELETE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    AND user_id IS NULL
    AND (
      user_id = (SELECT auth.uid())
      OR public.auth_permission('community/directory', 'delete'::public.permission_action) = 'any'
      OR (public.auth_permission('community/directory', 'delete'::public.permission_action) = 'own'
          AND user_id = (SELECT auth.uid()))
    )
  );

-- ---- 2  election_votes INSERT ---------------------------------------------
DROP POLICY IF EXISTS "perm:family can cast votes" ON public.election_votes;

CREATE POLICY "perm:family can cast votes"
  ON public.election_votes FOR INSERT TO authenticated
  WITH CHECK (
    public.election_window_open(election_id, 'voting')
    AND public.election_area_includes_person(election_id, voter_id)
    AND voter_id IN (SELECT p.id FROM public.people p
                      WHERE p.user_id = (SELECT auth.uid()))
    AND (
      voter_id = public.auth_person_id()
      OR public.auth_permission('community/elections', 'create'::public.permission_action) = 'any'
      OR (public.auth_permission('community/elections', 'create'::public.permission_action) = 'own'
          AND voter_id = public.auth_person_id())
    )
  );

-- ---- 3  election_nominations UPDATE ---------------------------------------
-- The own_expr here is `nominated_by`, not `nominee_id`: at scope 'own' you may edit a
-- nomination YOU made. The self arm is the nominee accepting their own. Both kept as they
-- were.
DROP POLICY IF EXISTS "perm:nominees can accept nominations" ON public.election_nominations;

CREATE POLICY "perm:nominees can accept nominations"
  ON public.election_nominations FOR UPDATE TO authenticated
  USING (
    public.auth_may_see_election_id(election_id)
    AND nominee_id IN (SELECT p.id FROM public.people p
                        WHERE p.user_id = (SELECT auth.uid()))
    AND (
      nominee_id = public.auth_person_id()
      OR public.auth_permission('community/elections', 'edit'::public.permission_action) = 'any'
      OR (public.auth_permission('community/elections', 'edit'::public.permission_action) = 'own'
          AND nominated_by = public.auth_person_id())
    )
  )
  WITH CHECK (
    public.auth_may_see_election_id(election_id)
    AND nominee_id IN (SELECT p.id FROM public.people p
                        WHERE p.user_id = (SELECT auth.uid()))
    AND (
      nominee_id = public.auth_person_id()
      OR public.auth_permission('community/elections', 'edit'::public.permission_action) = 'any'
      OR (public.auth_permission('community/elections', 'edit'::public.permission_action) = 'own'
          AND nominated_by = public.auth_person_id())
    )
  );

-- ---- 4  photos: the family conjunct the `OR true` swallowed ---------------
DROP POLICY IF EXISTS "perm:uploader or admin can update photos" ON public.photos;
DROP POLICY IF EXISTS "perm:uploader or admin can delete photos" ON public.photos;

CREATE POLICY "perm:family can update photos"
  ON public.photos FOR UPDATE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND (
      public.auth_permission('review/photos', 'edit'::public.permission_action) = 'any'
      OR (public.auth_permission('review/photos', 'edit'::public.permission_action) = 'own'
          AND uploader_id = public.auth_person_id())
    )
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND (
      public.auth_permission('review/photos', 'edit'::public.permission_action) = 'any'
      OR (public.auth_permission('review/photos', 'edit'::public.permission_action) = 'own'
          AND uploader_id = public.auth_person_id())
    )
  );

CREATE POLICY "perm:family can delete photos"
  ON public.photos FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND (
      public.auth_permission('review/photos', 'delete'::public.permission_action) = 'any'
      OR (public.auth_permission('review/photos', 'delete'::public.permission_action) = 'own'
          AND uploader_id = public.auth_person_id())
    )
  );

-- ---- 5  photo_collections: the same repair --------------------------------
DROP POLICY IF EXISTS "perm:creator or admin can update photo_collections" ON public.photo_collections;
DROP POLICY IF EXISTS "perm:creator or admin can delete photo_collections" ON public.photo_collections;

CREATE POLICY "perm:family can update photo_collections"
  ON public.photo_collections FOR UPDATE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND (
      public.auth_permission('review/photos', 'edit'::public.permission_action) = 'any'
      OR (public.auth_permission('review/photos', 'edit'::public.permission_action) = 'own'
          AND created_by = public.auth_person_id())
    )
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND (
      public.auth_permission('review/photos', 'edit'::public.permission_action) = 'any'
      OR (public.auth_permission('review/photos', 'edit'::public.permission_action) = 'own'
          AND created_by = public.auth_person_id())
    )
  );

CREATE POLICY "perm:family can delete photo_collections"
  ON public.photo_collections FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND (
      public.auth_permission('review/photos', 'delete'::public.permission_action) = 'any'
      OR (public.auth_permission('review/photos', 'delete'::public.permission_action) = 'own'
          AND created_by = public.auth_person_id())
    )
  );

-- ---- 6  photo_tags: scoped through its photo, as its own read policy is ---
DROP POLICY IF EXISTS "perm:tagger or admin can delete photo_tags" ON public.photo_tags;

CREATE POLICY "perm:family can delete photo_tags"
  ON public.photo_tags FOR DELETE TO authenticated
  USING (
    photo_id IN (SELECT p.id FROM public.photos p
                  WHERE p.family_code = public.auth_family_code())
    AND (
      public.auth_permission('review/photos', 'delete'::public.permission_action) = 'any'
      OR (public.auth_permission('review/photos', 'delete'::public.permission_action) = 'own'
          AND tagged_by = public.auth_person_id())
    )
  );

-- ---- 7  Verify ------------------------------------------------------------
DO $verify$
DECLARE
  r     record;
  v_n   integer;
BEGIN
  -- (a) NO POLICY IN THE SCHEMA STILL CALLS `auth.uid()` OR `auth.jwt()` PER ROW. Asserted
  --     across every policy rather than for the eight this file rewrites, because the lint
  --     under-reported: it named ten of the fifteen that had one.
  --
  --     Postgres regexes are POSIX and have no lookbehind, so this cannot be a negative
  --     lookahead pattern. The wrapped call deparses as `( SELECT auth.uid() AS uid)` --
  --     remove every occurrence of that shape and anything left is a bare call.
  FOR r IN
    SELECT tablename, policyname,
           regexp_replace(coalesce(qual,'') || ' ~ ' || coalesce(with_check,''),
                          '\( SELECT auth\.[a-z]+\(\)( AS [a-z]+)?\)', '<wrapped>', 'g') AS expr
      FROM pg_policies
     WHERE schemaname = 'public'
  LOOP
    IF r.expr LIKE '%auth.uid()%' OR r.expr LIKE '%auth.jwt()%' THEN
      RAISE EXCEPTION 'policy %.% still calls auth.uid()/auth.jwt() per row: %',
        r.tablename, r.policyname, r.expr;
    END IF;
  END LOOP;

  -- (b) `X OR true` is gone from every policy in the schema, not just the five. It is never
  --     anything but a mistake -- a conjunct somebody wrote and something later neutered.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public'
     AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%OR true%';
  IF v_n > 0 THEN
    RAISE EXCEPTION '% policy expression(s) still contain "OR true"', v_n;
  END IF;

  -- (c) All five repaired policies scope by family, one way or the other.
  FOR r IN
    SELECT * FROM (VALUES
      ('photos',            'perm:family can update photos',            'auth_family_code()'),
      ('photos',            'perm:family can delete photos',            'auth_family_code()'),
      ('photo_collections', 'perm:family can update photo_collections', 'auth_family_code()'),
      ('photo_collections', 'perm:family can delete photo_collections', 'auth_family_code()'),
      ('photo_tags',        'perm:family can delete photo_tags',        'photos')
    ) AS t(tbl, pol, fragment)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename=r.tbl AND policyname=r.pol
         AND coalesce(qual,'') LIKE '%' || r.fragment || '%'
    ) THEN
      RAISE EXCEPTION '%.% is missing or unscoped', r.tbl, r.pol;
    END IF;
  END LOOP;

  RAISE NOTICE 'initplan rewrite complete; photo write policies are family-scoped.';
END
$verify$;
