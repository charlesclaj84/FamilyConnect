-- ════════════════════════════════════════════════════════════════════════════
-- ANNOUNCEMENTS JOIN THE REALTIME PUBLICATION
--
-- `20260821000002` published `notifications` and `chat_messages` and its own header set the
-- standing rule: **anything new that subscribes owes its own line in a migration.**
-- `AnnouncementBoard` is about to subscribe, so this is that line.
--
-- ── WHAT WAS ACTUALLY WRONG, AND IT WAS WORSE THAN "NOT LIVE" ───────────────────────
-- Measured 2026-09-02: nothing subscribed to `announcements`, the table was not published,
-- and `createAnnouncement` called no notifier — `lib/notifications.ts` carried a
-- `notifyAllMembers` whose own doc comment said "announcements" and which nothing called.
-- So posting an announcement was SILENT on every channel at once: no bell entry, no live
-- board, no mail. A relative found out by happening to open the page.
--
-- The BELL is the more important half of that repair and is not in this file — it is a call
-- to `notifyAnnouncement` in `createAnnouncement`, because a bell reaches a member who is
-- not looking at the board. This file is the smaller half: the board updating for somebody
-- who IS looking at it.
--
-- ── PUBLISHING A TABLE IS A SECURITY DECISION, NOT PLUMBING ─────────────────────────
-- Realtime evaluates RLS as the SUBSCRIBING ROLE, so §5 of the verify block below is not a
-- formality. `announcements`' SELECT policy is:
--
--     family_code = auth_family_code()
--     AND ( auth_permission('community/announcements','view') = 'any'
--        OR ( auth_permission(...) = 'own' AND author_id = auth_person_id() ) )
--
-- Three helper functions, and every one of them needs `EXECUTE` for `authenticated` or the
-- policy ERRORS rather than refusing. On the realtime path that failure is invisible: there
-- is no HTTP response for anybody to see it on, and an errored policy is indistinguishable
-- from one correctly withholding a row. §2b rule 2, on the one path where it cannot be
-- noticed.
--
-- ── THE AUDIENCE IS NOT A POLICY, AND THAT IS WHY THE CLIENT STILL FILTERS ──────────
-- Who an announcement is ADDRESSED to — national, regional, or one chapter — is
-- `lib/announcement-audience.ts`, applied in TypeScript. It is not in the SELECT policy and
-- must not be: a chapter announcement is READABLE by the whole family (that is what the
-- policy above says) and merely not shown to members of other chapters, which is a §5
-- fetch-narrowing rather than a boundary.
--
-- So realtime will deliver a chapter announcement to every subscriber in the family, and
-- `AnnouncementBoard` applies `addressedTo` to what arrives. **Do not "fix" that by putting
-- the audience into the policy**: it would make the rule a boundary on one surface and a
-- narrowing on three others, and `getUpdatesArchive` already carries a PostgREST twin of it
-- that AGENTS.md calls a stated exception rather than a licence for a third.
--
-- ── REPLICA IDENTITY STAYS `DEFAULT` ────────────────────────────────────────────────
-- Realtime authorizes INSERT and UPDATE against the SELECT policy and **does not authorize
-- DELETE** — a delete is broadcast to every subscriber of that event, carrying whatever the
-- replica identity says. `DEFAULT` is the primary key alone; `FULL` would hand the whole
-- deleted announcement, body included, to anybody with a socket open. Asserted below.
--
-- ── IDEMPOTENT, FOR `20260821000002`'s REASON ───────────────────────────────────────
-- A bare `ALTER PUBLICATION … ADD TABLE` raises 42710 when the table is already a member,
-- and hosted may already carry it from a dashboard toggle this repo cannot see. Under
-- `migrate.yml` a failed job holds the Vercel alias for everything in the same merge, so the
-- ADD is guarded on `pg_publication_tables`.
--
-- ── WHAT THIS FILE CANNOT PROVE ─────────────────────────────────────────────────────
-- That an event actually arrives. A migration can assert membership, the replica identity
-- and the grants; it cannot open a websocket. `npm run realtime:check` is the only thing
-- that can, and this migration is not evidence for the feature working — see the notice at
-- the end, which says so out loud.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which records
--   nothing and can replay this file out of order. See AGENTS.md, "How migrations reach the
--   hosted project".
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. The publication exists ───────────────────────────────────────────────
-- Supabase creates it; a bare Postgres does not. `20260821000002` creates it if missing, and
-- this file may be replayed on a database that has been through neither.
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime WITH (publish = 'insert,update,delete');
    RAISE NOTICE 'created the supabase_realtime publication — this database did not have one';
  END IF;
END $mig$;

-- ── 2. `announcements` joins it ─────────────────────────────────────────────
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    RAISE NOTICE 'added to supabase_realtime: announcements';
  ELSE
    RAISE NOTICE 'announcements was already in supabase_realtime — nothing to add';
  END IF;
END $mig$;

-- ── 3. What it is for, on the table itself ──────────────────────────────────
-- A COMMENT rather than only a line in this file, for `20260821000002`'s reason: publication
-- membership is the one piece of state a reader cannot find by grepping the repo, and the
-- next person to wonder why this table is replicated will be looking at `\d+ announcements`.
COMMENT ON TABLE public.announcements IS
  'Family announcements. IN THE supabase_realtime PUBLICATION (20260902000001) — AnnouncementBoard subscribes to INSERT, UPDATE and DELETE for its own family_code, and Realtime evaluates this table''s SELECT policy as the subscribing role. The AUDIENCE rule (national / regional / chapter) is NOT in that policy and must not be: it is a §5 fetch-narrowing applied in lib/announcement-audience.ts, so the client filters what arrives. Do not set REPLICA IDENTITY FULL: Realtime does not authorize DELETE events, so FULL would broadcast whole deleted announcements to any subscriber.';

-- ── 4. Verify ───────────────────────────────────────────────────────────────
-- Catalogue reads only, all unconditional — there is no fixture to be missing, so this block
-- cannot report success by skipping.
DO $mig$
DECLARE
  v_missing TEXT;
  v_n INT;
BEGIN
  -- (a) Membership.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'announcements'
  ) THEN
    RAISE EXCEPTION 'announcements is not in the supabase_realtime publication';
  END IF;

  -- (b) REPLICA IDENTITY is not FULL. See the header: Realtime does not authorize a DELETE
  -- event, so FULL is the difference between broadcasting a primary key and broadcasting a
  -- deleted announcement's whole body.
  IF EXISTS (
    SELECT 1 FROM pg_class
     WHERE oid = 'public.announcements'::regclass AND relreplident = 'f'
  ) THEN
    RAISE EXCEPTION
      'announcements carries REPLICA IDENTITY FULL — a DELETE would broadcast the whole row';
  END IF;

  -- (c) RLS is on. A published table without it would deliver every family's announcements to
  -- every subscriber, which is the whole boundary here.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
     WHERE oid = 'public.announcements'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'announcements does not have RLS enabled';
  END IF;

  -- (d) It has a SELECT policy at all. Realtime narrows by the SELECT policy, so a table with
  -- none delivers nothing — a subscription that connects, reports SUBSCRIBED and is fed
  -- silence, which is the exact failure `20260821000002` was written to end.
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'announcements' AND cmd = 'SELECT';
  IF v_n = 0 THEN
    RAISE EXCEPTION 'announcements has no SELECT policy — realtime would deliver nothing';
  END IF;

  -- (e) THE POLICY'S HELPERS ARE EXECUTABLE BY `authenticated`. The one check in this file
  -- whose absence is invisible: a missing grant makes the policy ERROR rather than refuse,
  -- and on the realtime path there is no HTTP response to see it on. §2b rule 2.
  SELECT string_agg(f.sig, ', ') INTO v_missing
    FROM (VALUES
      ('public.auth_family_code()'),
      ('public.auth_person_id()'),
      ('public.auth_permission(text, permission_action)')
    ) AS f(sig)
   WHERE NOT has_function_privilege('authenticated', f.sig, 'EXECUTE');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated cannot execute policy helper(s): %', v_missing;
  END IF;

  -- (f) AND THE AUDIENCE IS STILL NOT IN THE POLICY. If it ever moves in, the client filter
  -- becomes a second expression of a boundary rather than of a narrowing — see the header.
  -- Checked as text, which is all a policy is in `pg_policies`.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'announcements' AND cmd = 'SELECT'
       AND coalesce(qual, '') LIKE '%chapter_id%'
  ) THEN
    RAISE EXCEPTION
      'the announcements SELECT policy now reads chapter_id — the audience is a §5 narrowing, not a boundary; see this migration''s header before changing that';
  END IF;

  RAISE NOTICE 'supabase_realtime: announcements published, replica identity default, three policy helpers executable. THIS DOES NOT PROVE AN EVENT ARRIVES — run npm run realtime:check.';
END $mig$;

COMMIT;
