-- ============================================================================
-- `notifications` and `chat_messages` join the realtime publication, so the two
-- features that have always subscribed to them actually receive anything.
--
-- ── WHAT WAS BROKEN, AND WHY NOBODY NOTICED ─────────────────────────────────
-- Three `postgres_changes` subscriptions have shipped in this product:
--
--   components/layout/NotificationBell.tsx   INSERT on `notifications`, filtered on the
--                                            caller's own `recipient_id`
--   components/chat/MessageThread.tsx        INSERT on `chat_messages`, filtered on room
--   components/chat/ChatShell.tsx            INSERT on `chat_messages`, unfiltered — the
--                                            unread tracker, which relies on RLS to narrow
--
-- Realtime's `postgres_changes` reads the WAL through the `supabase_realtime` PUBLICATION,
-- and **that publication held zero tables.** Measured, not inferred:
--
--   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';   -- (0 rows)
--
-- So all three subscriptions connected, subscribed, and received nothing, forever. The bell
-- kept working because `getNotifications` is server-rendered by `TopBar` on every page load,
-- so it refreshes on navigation — which is exactly why this survived: the feature degraded to
-- something that looks like it is working slowly rather than to something visibly broken. Chat
-- had no such fallback and simply did not deliver a message until the reader navigated.
--
-- Publication membership is DATABASE STATE that the Supabase dashboard edits by hand, so it is
-- invisible to `npm run db:check` (which compares migration versions) and to `db:audit` (which
-- reads policies). The only mention of `supabase_realtime` anywhere in this repo was a
-- COMMENTED-OUT line in `20260603000000_chat.sql` telling a reader to run it in the SQL editor
-- — which is the same shape as the `USAGE:` headers AGENTS.md records as having caused a
-- production incident by telling a reader to apply a migration by hand: an instruction in a
-- migration, addressed to a person, that nothing verifies and nobody ran. (The command they
-- carried is not reproduced here. `npm run db:check` fails a migration that spells out a
-- psql connection target, quotation or not, and finding that out by tripping it is the
-- check working.)
--
-- ── BOTH TABLES, AND THAT IS DELIBERATE ─────────────────────────────────────
-- The ask was notifications. Chat is in the same file because it is the same one-line defect
-- through the same missing mechanism, and because AGENTS.md §2b already asserts chat realtime
-- WORKS — *"Realtime counts: it evaluates RLS as the subscribing role, so
-- `auth_uid_is_room_participant()` is load-bearing for chat despite having no call site."*
-- That sentence has been false for as long as it has existed: the function is load-bearing for
-- a subscription that was never fed. Fixing one table and leaving the other would leave the
-- claim wrong and invite a near-identical migration next week.
--
-- ── RLS IS THE BOUNDARY, AND REALTIME EVALUATES IT AS THE SUBSCRIBER ────────
-- This is the part that makes adding a table to a publication a security decision rather than
-- a plumbing one. Realtime does NOT broadcast rows to everybody: for each change it evaluates
-- the table's SELECT policy with the subscriber's `request.jwt.claims` set, as the subscribing
-- role. Both tables are already correct for that, and both were checked rather than assumed:
--
--   notifications   `family_code = auth_family_code() AND recipient_id IN (own people rows)
--                    AND auth_membership_approved()`
--   chat_messages   `auth_uid_is_room_participant(room_id) AND community/chat:view`
--
-- **EVERY FUNCTION IN THOSE POLICIES NEEDS `EXECUTE` FOR `authenticated`**, per AGENTS.md §2b
-- rule 2, and the realtime path is the one where getting it wrong is invisible: a policy that
-- ERRORS is indistinguishable from a policy that refuses, because either way no event arrives
-- and there is no request for anybody to see a 500 on. `20260806000015` derives those grants
-- from `pg_policies`, so all four are already granted — the verify block below asserts it
-- anyway, because this is the file whose whole purpose is to start relying on them.
--
-- ── REPLICA IDENTITY STAYS `DEFAULT`, AND THAT IS A SECURITY DECISION ───────
-- Both tables are `relreplident = 'd'` (the primary key), and this migration deliberately does
-- NOT set `FULL`.
--
-- Realtime authorizes INSERT and UPDATE events against the SELECT policy, using the new row.
-- **It does not authorize DELETE** — a DELETE is broadcast to every subscriber of that event,
-- and what the payload contains is decided entirely by the replica identity. With `DEFAULT` it
-- is the primary key and nothing else: a uuid, carrying no family code, no recipient, no title
-- and no message body. With `FULL` it would be the whole deleted row, unauthorized, to anybody
-- holding the anon key and a session.
--
-- So: `FULL` is what a future feature wanting `old_record` will reach for, and it must not be
-- set on either of these tables without deciding what a DELETE may tell a stranger first. The
-- verify block asserts it, so the decision cannot be reversed silently.
--
-- **The narrower alternative was considered and rejected.** The publication publishes
-- insert, update AND delete, and since it held no tables at all this migration could have set
-- `publish = 'insert,update'` and removed the DELETE channel outright — closing even the uuid.
-- It is not done for one reason: that setting is publication-WIDE and permanent, so the next
-- table somebody enables from the Supabase dashboard would silently lose its DELETE events,
-- with nothing anywhere explaining why. A per-table exposure of one uuid that nothing
-- subscribes to is not worth a repo-wide trap. Recorded here so the option is visible rather
-- than absent.
--
-- ── IDEMPOTENT, AND IT HAS TO BE MORE CAREFULLY THAN USUAL ──────────────────
-- A bare `ALTER PUBLICATION … ADD TABLE` raises **42710** (`duplicate_object`) when the table
-- is already a member — and the table may well already be a member on hosted, because the
-- dashboard is how this is normally done and this repo cannot see whether somebody did. Under
-- `migrate.yml` a failed job holds the Vercel alias, so an unguarded ADD here is a migration
-- that deploys nothing on the one database most likely to have been touched by hand. Each ADD
-- is therefore guarded on `pg_publication_tables`.
--
-- The publication itself is created if absent, which is what makes this file apply to an empty
-- database. `supabase db reset` does create it (measured: it exists, with
-- `publish = 'insert,update,delete'` and no members), so this branch is for a bare Postgres
-- rather than for a Supabase project — but a migration that assumed platform state would be a
-- migration that cannot be replayed, which is the property AGENTS.md asks for first.
--
-- ── AND IT IS CHECKED BY SUBSCRIBING, WHICH NO MIGRATION CAN DO ─────────────
-- Everything below is catalogue state. It cannot answer the only question that matters — does
-- an event actually arrive, and does it arrive at the right person — because that needs a
-- websocket and a running Realtime container. `npm run realtime:check`
-- (scripts/realtime-check.mjs) is that half: it subscribes as a real member, writes a row as
-- the service role, and asserts both that the intended recipient receives it and that a
-- second member does not. Run it after this applies. It is a hand-run verifier, on the same
-- footing as `email:check` and `art:check`, because it needs the local stack up.
--
-- **It earned its place on its first run**, by reporting that `notifications` delivered nothing
-- while `chat_messages` delivered on the same socket. That turned out to be a race in the
-- HARNESS rather than a defect here — `SUBSCRIBED` is the client's acknowledgement, not
-- walrus's, so a row written before the subscription is registered reaches nobody — and
-- establishing it took bisecting this policy conjunct by conjunct and then restoring it whole.
--
-- Worth knowing if you write another one: a fixed settle delay did NOT fix it. It passed twice
-- and failed on the third run, because the first channel on a fresh socket is the slow one and
-- no defensible number covers it. The script waits for a THROWAWAY row to come back instead —
-- a positive observation of the path under test — and reports "never became live" as its own
-- finding, so a publication problem never presents as a withheld row. See the readiness-gate
-- comment in that file; the failure direction being closed is the expensive one, a working
-- feature reported broken about a security boundary.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
-- Four copies of this file, one line changed in each, replayed against a reset database; every
-- one aborted, and the clean file prints its NOTICE. Observed output, not expected:
--
--   m1  §2's ARRAY narrowed to chat_messages, so notifications is never added
--         ERROR: notifications is not in the supabase_realtime publication
--   m2  the same, narrowed the other way
--         ERROR: chat_messages is not in the supabase_realtime publication
--   m3  `ALTER TABLE notifications REPLICA IDENTITY FULL` before replaying the clean file
--         ERROR: a realtime-published table carries REPLICA IDENTITY FULL — a DELETE would
--                broadcast the whole row
--   m4  `REVOKE EXECUTE ON FUNCTION public.auth_person_id() FROM authenticated`, then the
--       clean file — a real drift rather than a doctored assertion
--         ERROR: authenticated cannot execute policy helper(s): public.auth_person_id()
--
-- AND THE HALF THAT MATTERS MOST IS MUTATION-CHECKED IN THE OTHER FILE. `npm run
-- realtime:check` was run against two mutations of its own, each tripping exactly one line:
-- dropping `notifications` from the publication fails "the recipient receives their own
-- notification", and opening its SELECT policy to `USING (true)` fails "another member's
-- notification is withheld by RLS". So neither half of that pair is decoration.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The publication exists ───────────────────────────────────────────────
-- Supabase creates this; a bare Postgres does not. Created with the same `publish` set
-- Supabase uses, so a database that goes through this branch behaves like one that did not.
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime WITH (publish = 'insert,update,delete');
    RAISE NOTICE 'created the supabase_realtime publication — this database did not have one';
  END IF;
END $mig$;

-- ── 2. The two tables join it ───────────────────────────────────────────────
-- Guarded per table on `pg_publication_tables`, for the 42710 reason in the header: hosted may
-- already carry either one from a hand toggle in the dashboard, and an aborted job here holds
-- the Vercel alias for everything in the same merge.
DO $mig$
DECLARE
  t text;
  v_added text[] := '{}';
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications', 'chat_messages'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      v_added := v_added || t;
    END IF;
  END LOOP;

  IF cardinality(v_added) > 0 THEN
    RAISE NOTICE 'added to supabase_realtime: %', array_to_string(v_added, ', ');
  ELSE
    RAISE NOTICE 'nothing to add — supabase_realtime already carried every table this file names';
  END IF;
END $mig$;

-- ── 3. What each table is for, on the table itself ──────────────────────────
-- A `COMMENT` rather than a line in this file, because publication membership is the one piece
-- of state a reader cannot find by grepping the repo: the next person to wonder why a table is
-- replicated will be looking at `\d+ notifications`, not at a migration from 2026.
COMMENT ON TABLE public.notifications IS
  'In-app notifications. IN THE supabase_realtime PUBLICATION (20260821000002) — NotificationBell subscribes to INSERT filtered on its own recipient_id, and Realtime evaluates this table''s SELECT policy as the subscribing role. Do not set REPLICA IDENTITY FULL: Realtime does not authorize DELETE events, so FULL would broadcast whole deleted rows to any subscriber.';
COMMENT ON TABLE public.chat_messages IS
  'Chat messages. IN THE supabase_realtime PUBLICATION (20260821000002) — MessageThread subscribes filtered on room_id and ChatShell subscribes UNFILTERED, relying entirely on auth_uid_is_room_participant() in the SELECT policy to narrow it. Do not set REPLICA IDENTITY FULL, for the reason on notifications.';

-- ── 4. Verify ───────────────────────────────────────────────────────────────
-- Catalogue reads only, all unconditional — there is no fixture to be missing, so this block
-- cannot report success by skipping. What it CANNOT check is whether an event arrives; that is
-- `npm run realtime:check`, and this block says so on a clean run rather than leaving the gap
-- to be assumed away.
DO $mig$
DECLARE
  v_missing text;
  v_ident   char;
BEGIN
  -- (a) Both tables are members.
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('notifications'), ('chat_messages')) AS t(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t.name
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '% is not in the supabase_realtime publication', v_missing;
  END IF;

  -- (b) Neither carries REPLICA IDENTITY FULL. See the header: Realtime does not authorize a
  -- DELETE, so this is what keeps a deleted row's payload down to its primary key.
  FOR v_ident IN
    SELECT c.relreplident FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('notifications', 'chat_messages')
  LOOP
    IF v_ident = 'f' THEN
      RAISE EXCEPTION
        'a realtime-published table carries REPLICA IDENTITY FULL — a DELETE would broadcast the whole row';
    END IF;
  END LOOP;

  -- (c) Every function the two SELECT policies evaluate is executable by `authenticated`.
  -- AGENTS.md §2b rule 2, and the realtime path is where a missing grant is INVISIBLE: the
  -- policy errors instead of refusing, no event arrives, and there is no HTTP response for
  -- anybody to see a failure in. `auth_permission` is included because the composed chat
  -- policy calls it, and `auth_uid_is_room_participant` because ChatShell's subscription is
  -- unfiltered and that function is the whole of what narrows it.
  SELECT string_agg(f.sig, ', ') INTO v_missing
    FROM (VALUES
      ('public.auth_family_code()'),
      ('public.auth_person_id()'),
      ('public.auth_membership_approved()'),
      ('public.auth_uid_is_room_participant(uuid)'),
      ('public.auth_permission(text, public.permission_action)')
    ) AS f(sig)
   WHERE NOT has_function_privilege('authenticated', f.sig, 'EXECUTE');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated cannot execute policy helper(s): %', v_missing;
  END IF;

  -- (d) Both tables still have RLS enabled. Adding a table to a publication is exactly the
  -- change that would turn a missing `ENABLE ROW LEVEL SECURITY` from a bad read into a
  -- broadcast, so it is worth one line here rather than assumed from a file in June.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname IN ('notifications', 'chat_messages')
       AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'a realtime-published table does not have RLS enabled';
  END IF;

  -- (e) And each has a SELECT policy at all. RLS enabled with no SELECT policy denies every
  -- read (§2c), which for a published table means realtime silently delivers nothing — the
  -- state this migration exists to end, reached by a different route.
  IF EXISTS (
    SELECT 1 FROM (VALUES ('notifications'), ('chat_messages')) AS t(name)
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t.name AND cmd = 'SELECT'
     )
  ) THEN
    RAISE EXCEPTION 'a realtime-published table has no SELECT policy — realtime would deliver nothing';
  END IF;

  RAISE NOTICE 'supabase_realtime: notifications and chat_messages published, replica identity default, five policy helpers executable. THIS DOES NOT PROVE AN EVENT ARRIVES — run npm run realtime:check.';
END $mig$;

COMMIT;
