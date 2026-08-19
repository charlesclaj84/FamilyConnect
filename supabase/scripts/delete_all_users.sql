-- ============================================================================
-- delete_all_users.sql — Remove EVERY user and all of their data.
-- ----------------------------------------------------------------------------
-- Deletes all `people` rows and all `auth.users` rows. With no users left,
-- user-owned personal data is removed by cascade; shared resources that had a
-- creator are anonymized (creator set to NULL). This does NOT drop schema-only
-- config rows that carry no user reference (e.g. dues_schedules).
-- For a complete wipe of every table, use truncate_entire_database.sql instead.
--
-- THIS AFFECTS ALL ACCOUNTS. It is wrapped in a transaction — review, then
-- COMMIT (or ROLLBACK to abort).
--
-- USAGE
--   psql "$DATABASE_URL" -f delete_all_users.sql
-- ============================================================================

BEGIN;

-- ── 1. NULL every auth.users audit/creator ref with no cascade rule ──────────
UPDATE user_roles            SET assigned_by = NULL WHERE assigned_by IS NOT NULL;
UPDATE event_types           SET created_by  = NULL WHERE created_by  IS NOT NULL;
UPDATE event_blueprint_items SET created_by  = NULL WHERE created_by  IS NOT NULL;
UPDATE events                SET created_by  = NULL WHERE created_by  IS NOT NULL;
UPDATE events                SET approved_by = NULL WHERE approved_by IS NOT NULL;
UPDATE event_assignments     SET assigned_to = NULL WHERE assigned_to IS NOT NULL;
UPDATE event_assignments     SET assigned_by = NULL WHERE assigned_by IS NOT NULL;
UPDATE event_assignments     SET approved_by = NULL WHERE approved_by IS NOT NULL;
UPDATE chapters              SET created_by  = NULL WHERE created_by  IS NOT NULL;
UPDATE regions               SET created_by  = NULL WHERE created_by  IS NOT NULL;
UPDATE event_hotel_bookings  SET created_by  = NULL WHERE created_by  IS NOT NULL;
UPDATE chat_rooms            SET created_by  = NULL WHERE created_by  IS NOT NULL;
DO $$ BEGIN
  UPDATE families SET created_by = NULL WHERE created_by IS NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ── 2. Delete all people (cascades all person-scoped data) ───────────────────
DELETE FROM people;

-- ── 3. Delete all auth accounts (cascades chat, user_roles, event_rsvp) ──────
DELETE FROM auth.users;

-- Review the row counts above, then:
COMMIT;
-- ROLLBACK;  -- ← uncomment instead of COMMIT to abort.
