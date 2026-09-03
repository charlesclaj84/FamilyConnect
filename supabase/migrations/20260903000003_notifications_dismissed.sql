-- ============================================================================
-- A notification can be cleared FROM THE BELL, and only from the bell.
--
-- Asked for 2026-09-03: "provide a way to remove a notification from the bell only".
--
-- ── A DISMISSAL, NOT A DELETION, AND THE ASK SAYS SO ────────────────────────
-- "from the bell only" is the whole design. A notification is the record of something that
-- happened to a member — a task assigned, an approval decided, a meeting they are expected
-- at — and `/community/updates` is the archive built to be that history. Deleting the row
-- would clear the bell AND remove it from the archive, which is a second, unasked-for
-- change and an unrecoverable one.
--
-- So `dismissed_at` is a marker the BELL reads and the ARCHIVE ignores. A member who clears
-- forty entries has an empty bell and a complete history.
--
-- ── AND A DELETE WAS NOT AVAILABLE ANYWAY, WHICH IS THE OTHER HALF ─────────
-- `notifications` carries exactly a SELECT and an UPDATE policy — asserted by
-- `20260822000011` §(c), which reconciled hosted drift and states that this table "should
-- keep exactly its SELECT and UPDATE policies". Per AGENTS.md §2c a table with no policy for
-- a command denies it, so the browser cannot DELETE from this table at all, and the
-- alternative to a column was a new DELETE policy — a wider boundary bought to do something
-- narrower than what a column does.
--
-- **DO NOT ADD ONE.** That assertion is a step in the migration chain and would have to be
-- edited to make room, which is the shape of an assertion being weakened to fit a feature.
--
-- ── NO NEW POLICY IS NEEDED FOR THIS COLUMN, AND THAT IS WHY ───────────────
-- The existing UPDATE policy admits a member's write to their OWN notification rows, and a
-- policy has no opinion about which column changed — the same property that makes
-- `people_guard_permission_template` necessary over on `people`. Here it is what we want:
-- `read_at` and `dismissed_at` are both facts about the recipient's own reading of their own
-- mail, and neither decides money, membership or access.
--
-- SO NO GUARD TRIGGER EITHER. The three on `people` exist because a column there decides
-- something a member must not decide about themselves. Nothing consults `dismissed_at` but
-- the bell's own query.
--
-- ── WHAT IT IS DELIBERATELY NOT ────────────────────────────────────────────
-- Not a `read_at` variant. Read and dismissed are different facts and both are worth having:
-- the badge counts unread, and the LIST hides dismissed. Folding them would mean opening the
-- bell cleared it, which is the behaviour nobody asked for and the one that loses entries a
-- member glanced at and meant to come back to.
--
-- Not family-scoped by hand: it is a column on a row that already carries `family_code` and
-- `recipient_id`, and it is written through the USER client, so RLS is the whole boundary.
-- ============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.notifications.dismissed_at IS
  'When the recipient cleared this entry FROM THE BELL. The bell filters these out; '
  '/community/updates deliberately does not, because it is the archive. NULL means still '
  'in the bell. Written by the recipient through the user client under the existing UPDATE '
  'policy — see 20260903000003.';

-- ── THE INDEX MATCHES THE BELL'S QUERY, WHICH GAINED A CONJUNCT ──────────────
-- `getNotifications` and `getUnreadCount` both filter on `recipient_id` and now also on
-- `dismissed_at IS NULL`. PARTIAL on that conjunct, so the index holds only the rows the bell
-- can ever return: a member who dismisses steadily over a year has an index that stays the
-- size of their bell rather than the size of their history.
CREATE INDEX IF NOT EXISTS notifications_recipient_live_idx
  ON public.notifications (recipient_id, created_at DESC)
  WHERE dismissed_at IS NULL;

-- ── VERIFY ──────────────────────────────────────────────────────────────────
-- Both directions, per AGENTS.md: that the column and index exist, AND that this migration
-- did not quietly open the DELETE the header argues against.
DO $$
DECLARE
  v_n int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications'
       AND column_name = 'dismissed_at'
  ) THEN
    RAISE EXCEPTION 'notifications.dismissed_at was not added';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'notifications_recipient_live_idx'
  ) THEN
    RAISE EXCEPTION 'notifications_recipient_live_idx was not created';
  END IF;

  -- THE POLICY SET IS UNCHANGED. `20260822000011` asserts this table keeps exactly its
  -- SELECT and UPDATE policies; re-asserting it here is what stops a later reading of this
  -- feature ("a member should be able to delete one") from adding a DELETE policy and
  -- discovering the objection only when that older migration is replayed on a fresh database.
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'notifications';
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'notifications should have exactly 2 policies (SELECT, UPDATE), found %', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'notifications'
     AND cmd IN ('SELECT', 'UPDATE');
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'notifications policies are not the expected SELECT and UPDATE pair';
  END IF;

  RAISE NOTICE 'notifications.dismissed_at added; the bell filters it, the archive does not.';
END $$;
