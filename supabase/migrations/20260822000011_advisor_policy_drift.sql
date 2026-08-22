-- ============================================================================
-- HOSTED HAS POLICIES THIS REPO NEVER WROTE, AND THREE OF THEM ARE HOLES.
--
-- This migration exists because of an advisor warning that reads like a performance note --
-- `multiple_permissive_policies` on `chat_rooms` INSERT and `chat_participants` INSERT -- and
-- is not one. Permissive policies are OR-ed. A second, weaker policy beside a correct one
-- does not slow the correct one down; it REPLACES it, for every caller the weak one admits.
--
-- ---- HOW IT WAS FOUND, WHICH IS THE PART WORTH KEEPING ---------------------
-- The advisors were run against hosted AND against a fresh local `db reset`, and the two were
-- diffed by policy name and by md5 of (qual, with_check). That is the only way any of this is
-- visible: `npm run db:check` compares migration VERSIONS and hosted's ledger is clean;
-- `db:audit` looks for a superseded policy sitting beside its replacement and finds the two
-- INSERT pairs but not the eight single-policy divergences, because a policy that was
-- REPLACED rather than duplicated leaves nothing to sit beside.
--
--     hosted 130 policies      local 135 (the two journal migrations are not merged yet)
--     hosted-only 12           local-only 10 (+7 journal)
--
-- Every one of the 12 is on a table whose policies predate `20260618000001`'s sweep, and the
-- names say what happened: `perm:chat_messages_insert` is a name that sweep GENERATES, and it
-- exists on hosted because the policy was there for it to rename. It was there because
-- `chat_install.sql` -- an UNVERSIONED file that applied to nothing, see AGENTS.md "Two
-- things about editing migrations" -- was run by hand against hosted. The chain's own chat
-- policies then arrived later under different names, and hosted kept both sets.
--
-- ---- THE FOUR DIVERGENCES THAT MATTER, WEAKEST FIRST -----------------------
--
--  1. `chat_rooms` INSERT. Hosted carries BOTH `perm:family members can create rooms`
--     (CHECK family_code = auth_family_code() AND <perm>) and `perm:chat_rooms_insert`
--     (CHECK **true** AND <perm>). OR-ed, the family conjunct is gone: anyone holding
--     `community/chat:create` -- which the General template grants -- can insert a chat room
--     stamped with ANY family's code. AGENTS.md section 3 and section 4, in the one place a
--     policy was supposed to be doing the work.
--
--  2. `chat_participants` INSERT. Same shape. The chain's policy requires the room to be in
--     the caller's family; hosted's extra one requires only `true` and an approved
--     membership. So an approved member of any family can add themselves to any room, by id.
--
--  3. `chat_messages` INSERT. Not a duplicate -- a REPLACEMENT, and it is missing
--     `auth_uid_is_room_participant(room_id)`. Hosted's only INSERT policy is
--     `sender_id = auth.uid() AND <perm>`, so a member can post into a room they are not in,
--     in a family they do not belong to. Together with (2) that is a complete cross-family
--     write path into another family's conversation, with every check satisfied.
--
--  4. `person_relationships` SELECT. Hosted's is `family_code = auth_family_code()`; the
--     chain's adds `auth_membership_approved()`. `20260819000008` restores that policy only
--     IF it is missing, and on hosted it WAS missing, so hosted took the restored form and
--     never got the conjunct `20260806000011` section 6 swept in. The consequence is exactly
--     what Phase 3 built `alphaPending` for: an applicant nobody has admitted reads the
--     family's whole relationship graph. `tests/rls`'s `raw:person_relationships SELECT
--     (applicant)` asserts they cannot -- and has only ever been asserting it about the local
--     database.
--
-- Two more are drift without teeth, reconciled anyway so the two databases stop disagreeing:
-- `families` SELECT (hosted's swept form keys on `auth_permission('dashboard','view')`, a key
-- nothing registers, so it falls through to the 'everyone' default and resolves to the same
-- answer as the chain's plain family conjunct), and the four `perm:chat_*` names whose
-- expressions match the chain's exactly and are only named differently.
--
-- ---- AND `notifications` INSERT IS DROPPED RATHER THAN RECONCILED ----------
-- The two databases disagree about it and NEITHER is right. Hosted has the swept form
-- (recipient must be the caller, or hold a `notifications:create` grant -- on a resource key
-- `20260805000007` DELETED, so it resolves to nothing and the policy means "addressed to
-- me"). Local has `family_code = auth_family_code() AND true AND auth_membership_approved()`
-- -- any approved member may write a notification to ANY member of their family, which is a
-- forged bell entry: "Your membership was approved", from a stranger, linking anywhere.
--
-- Nothing legitimate needs either. Every notification in the product is written by
-- `lib/notifications.ts`, a plain module on the SERVICE ROLE with no URL -- which is the
-- whole reason it is a module and not an action (AGENTS.md, "Sending email is a plain
-- module"). Section 2c: a table with no policy for a command denies that command to the
-- browser outright. So the right policy is none, and SELECT and UPDATE stay untouched: the
-- bell reads and marks read on the user client, and Realtime evaluates that SELECT policy for
-- the subscription `20260821000002` published.
--
-- `tests/rls`'s `raw:notifications INSERT (applicant)` was evidence for the approval conjunct
-- and is now evidence for the policy's ABSENCE, which is strictly stronger -- the same move
-- `STORAGE_CASES` made when `event-photos` was dropped. Its comment is updated in the same
-- commit.
--
-- ---- WHY THIS IS SAFE TO APPLY TO A DATABASE THAT NEVER DRIFTED -----------
-- Every drop is `IF EXISTS` and every create is preceded by one, so on a fresh `db reset` the
-- file reads as "drop the chain's policy and write the same policy back", and the verify
-- block proves it. Nothing here is conditional on which database it runs against: afterwards
-- both hold exactly the policies named below, which is the property the diff above could not
-- assume.
--
-- ONE INTENTIONAL CHANGE RIDES ALONG. Every `auth.uid()` in a rewritten expression is written
-- `(SELECT auth.uid())`, which is the `auth_rls_initplan` fix -- the planner then evaluates it
-- once per statement instead of once per row. It is semantics-preserving (`auth.uid()` is
-- STABLE within a statement) and it is the same rewrite `20260822000013` makes for the other
-- nine policies the advisor named. `notifications` SELECT is one of that ten and is fixed
-- here, because it is being rewritten anyway.
-- ============================================================================

-- ---- 1  chat_rooms --------------------------------------------------------
DROP POLICY IF EXISTS "perm:chat_rooms_insert"                ON public.chat_rooms;  -- the hole
DROP POLICY IF EXISTS "perm:chat_rooms_select"                ON public.chat_rooms;  -- the old name
DROP POLICY IF EXISTS "perm:family members can create rooms"  ON public.chat_rooms;
DROP POLICY IF EXISTS "perm:participants can view rooms"      ON public.chat_rooms;

CREATE POLICY "perm:family members can create rooms"
  ON public.chat_rooms FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND (
      public.auth_permission('community/chat', 'create'::public.permission_action) = 'any'
      OR (public.auth_permission('community/chat', 'create'::public.permission_action) = 'own'
          AND created_by = (SELECT auth.uid()))
    )
  );

CREATE POLICY "perm:participants can view rooms"
  ON public.chat_rooms FOR SELECT TO authenticated
  USING (
    public.auth_uid_is_room_participant(id)
    AND (
      public.auth_permission('community/chat', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('community/chat', 'view'::public.permission_action) = 'own'
          AND created_by = (SELECT auth.uid()))
    )
  );

-- ---- 2  chat_participants -------------------------------------------------
DROP POLICY IF EXISTS "perm:chat_participants_insert" ON public.chat_participants;  -- the hole
DROP POLICY IF EXISTS "perm:chat_participants_select" ON public.chat_participants;  -- the old name
DROP POLICY IF EXISTS "perm:family members can be added as participants" ON public.chat_participants;
DROP POLICY IF EXISTS "perm:participants can view room members"         ON public.chat_participants;

CREATE POLICY "perm:family members can be added as participants"
  ON public.chat_participants FOR INSERT TO authenticated
  WITH CHECK (
    room_id IN (SELECT r.id FROM public.chat_rooms r
                 WHERE r.family_code = public.auth_family_code())
    AND (
      user_id = (SELECT auth.uid())
      OR public.auth_permission('community/chat', 'create'::public.permission_action) = 'any'
      OR (public.auth_permission('community/chat', 'create'::public.permission_action) = 'own'
          AND user_id = (SELECT auth.uid()))
    )
    AND public.auth_membership_approved()
  );

CREATE POLICY "perm:participants can view room members"
  ON public.chat_participants FOR SELECT TO authenticated
  USING (
    public.auth_uid_is_room_participant(room_id)
    AND (
      user_id = (SELECT auth.uid())
      OR public.auth_permission('community/chat', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('community/chat', 'view'::public.permission_action) = 'own'
          AND user_id = (SELECT auth.uid()))
    )
    AND public.auth_membership_approved()
  );

-- ---- 3  chat_messages -----------------------------------------------------
-- The INSERT policy is the one that changes on hosted: `auth_uid_is_room_participant` is what
-- makes "you may write in rooms you are in" true, and hosted's version did not have it.
DROP POLICY IF EXISTS "perm:chat_messages_insert" ON public.chat_messages;
DROP POLICY IF EXISTS "perm:chat_messages_select" ON public.chat_messages;
DROP POLICY IF EXISTS "perm:chat_messages_update" ON public.chat_messages;
DROP POLICY IF EXISTS "perm:chat_messages_delete" ON public.chat_messages;
DROP POLICY IF EXISTS "perm:participants can send messages"   ON public.chat_messages;
DROP POLICY IF EXISTS "perm:participants can read messages"   ON public.chat_messages;
DROP POLICY IF EXISTS "perm:senders can update own messages"  ON public.chat_messages;
DROP POLICY IF EXISTS "perm:senders can delete own messages"  ON public.chat_messages;

CREATE POLICY "perm:participants can send messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND public.auth_uid_is_room_participant(room_id)
    AND (
      public.auth_permission('community/chat', 'create'::public.permission_action) = 'any'
      OR (public.auth_permission('community/chat', 'create'::public.permission_action) = 'own'
          AND sender_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "perm:participants can read messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    public.auth_uid_is_room_participant(room_id)
    AND (
      public.auth_permission('community/chat', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('community/chat', 'view'::public.permission_action) = 'own'
          AND sender_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "perm:senders can update own messages"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    sender_id = (SELECT auth.uid())
    AND (
      public.auth_permission('community/chat', 'edit'::public.permission_action) = 'any'
      OR (public.auth_permission('community/chat', 'edit'::public.permission_action) = 'own'
          AND sender_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND (
      public.auth_permission('community/chat', 'edit'::public.permission_action) = 'any'
      OR (public.auth_permission('community/chat', 'edit'::public.permission_action) = 'own'
          AND sender_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "perm:senders can delete own messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (
    sender_id = (SELECT auth.uid())
    AND (
      public.auth_permission('community/chat', 'delete'::public.permission_action) = 'any'
      OR (public.auth_permission('community/chat', 'delete'::public.permission_action) = 'own'
          AND sender_id = (SELECT auth.uid()))
    )
  );

-- ---- 4  families ----------------------------------------------------------
-- The chain's plain family conjunct. Hosted's swept form asked
-- `auth_permission('dashboard','view')`, and `dashboard` is deliberately not in
-- `permission_resources` (AGENTS.md, "the Personal pages are deliberately outside all of
-- this"), so it fell through to the 'everyone' default and resolved 'any' for every approved
-- member. The same answer, asked of a key nobody can configure -- which is worse than not
-- asking, because the grid shows no switch for it.
DROP POLICY IF EXISTS "perm:members can view own family" ON public.families;
DROP POLICY IF EXISTS "members can view own family"      ON public.families;

CREATE POLICY "members can view own family"
  ON public.families FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

-- ---- 5  notifications -----------------------------------------------------
-- INSERT goes away on both databases. See the header: no browser caller exists, and the two
-- versions that did exist were a forged-notification path (local) and a policy about a
-- deleted resource key (hosted).
DROP POLICY IF EXISTS "perm:admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "admins can insert notifications"      ON public.notifications;

-- SELECT stays, in the chain's form, with the initplan rewrite.
DROP POLICY IF EXISTS "perm:users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "users can view own notifications"      ON public.notifications;

CREATE POLICY "users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND recipient_id IN (SELECT p.id FROM public.people p
                          WHERE p.user_id = (SELECT auth.uid()))
    AND public.auth_membership_approved()
  );

-- ---- 6  person_relationships ----------------------------------------------
-- The approval conjunct hosted never got.
DROP POLICY IF EXISTS "family can view relationships" ON public.person_relationships;

CREATE POLICY "family can view relationships"
  ON public.person_relationships FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
  );

-- ---- 7  Verify ------------------------------------------------------------
DO $verify$
DECLARE
  v_n integer;
  v_txt text;
BEGIN
  -- (a) One permissive policy per (table, command) on all six tables. This is the assertion
  --     that would have caught the drift: it is FALSE on hosted before this file runs.
  SELECT count(*) INTO v_n FROM (
    SELECT tablename, cmd FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('chat_rooms','chat_participants','chat_messages',
                         'families','notifications','person_relationships')
     GROUP BY tablename, cmd HAVING count(*) > 1
  ) dup;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'still % (table, command) pair(s) carrying more than one policy', v_n;
  END IF;

  -- (b) The four conjuncts whose absence was the hole, read back out of the catalogue rather
  --     than trusted from the CREATE above.
  SELECT with_check INTO v_txt FROM pg_policies
   WHERE schemaname='public' AND tablename='chat_rooms' AND cmd='INSERT';
  IF v_txt IS NULL OR v_txt NOT LIKE '%auth_family_code()%' THEN
    RAISE EXCEPTION 'chat_rooms INSERT has no family conjunct: %', coalesce(v_txt,'<none>');
  END IF;

  SELECT with_check INTO v_txt FROM pg_policies
   WHERE schemaname='public' AND tablename='chat_participants' AND cmd='INSERT';
  IF v_txt IS NULL OR v_txt NOT LIKE '%chat_rooms%' THEN
    RAISE EXCEPTION 'chat_participants INSERT does not scope the room: %', coalesce(v_txt,'<none>');
  END IF;

  SELECT with_check INTO v_txt FROM pg_policies
   WHERE schemaname='public' AND tablename='chat_messages' AND cmd='INSERT';
  IF v_txt IS NULL OR v_txt NOT LIKE '%auth_uid_is_room_participant%' THEN
    RAISE EXCEPTION 'chat_messages INSERT does not require participation: %', coalesce(v_txt,'<none>');
  END IF;

  SELECT qual INTO v_txt FROM pg_policies
   WHERE schemaname='public' AND tablename='person_relationships' AND cmd='SELECT';
  IF v_txt IS NULL OR v_txt NOT LIKE '%auth_membership_approved()%' THEN
    RAISE EXCEPTION 'person_relationships SELECT admits an applicant: %', coalesce(v_txt,'<none>');
  END IF;

  -- (c) notifications INSERT is gone, and the other two commands are not.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='notifications' AND cmd='INSERT';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'notifications still has % INSERT policy(ies)', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='notifications' AND cmd IN ('SELECT','UPDATE');
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'notifications should keep exactly its SELECT and UPDATE policies, found %', v_n;
  END IF;

  RAISE NOTICE 'policy drift reconciled on 6 tables; notifications INSERT removed.';
END
$verify$;
