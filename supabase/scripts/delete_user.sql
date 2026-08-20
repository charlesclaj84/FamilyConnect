-- ============================================================================
-- delete_user.sql — Purge ALL data for a single user, given their auth user id.
-- ----------------------------------------------------------------------------
-- This removes the user's account and every record tied to them. Shared
-- resources the user merely *authored* (announcements, photos, funds, gatherings,
-- etc.) are NOT deleted — their author/creator column is set to NULL so the
-- resource survives but is anonymized. The user's own personal records
-- (profile, relationships, notifications, dues, RSVPs, votes, chat) ARE deleted.
--
-- Why a function: deletion order matters because some columns reference
-- auth.users(id) with NO ON DELETE rule (default NO ACTION), which would block
-- `DELETE FROM auth.users`. We NULL those first, then let cascades do the rest.
--
-- USAGE
--   -- one call, fully transactional (all-or-nothing):
--   SELECT purge_user('00000000-0000-0000-0000-000000000000'::uuid);
--
--   -- or run the whole file with psql, passing the id as a variable:
--   psql "$DATABASE_URL" -v user_id="'00000000-0000-0000-0000-000000000000'" -f delete_user.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION purge_user(p_user_id uuid)
RETURNS TABLE (step text, rows_affected bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count bigint;
BEGIN
  -- ── 0. Sanity check ───────────────────────────────────────────────────────
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'purge_user: p_user_id must not be null';
  END IF;

  -- ── 1. NULL out auth.users references that have NO cascade rule ─────────────
  -- These would otherwise raise a foreign-key violation on the final delete.
  -- They are audit/creator/assignee columns on shared resources; NULLing them
  -- anonymizes the resource without destroying it.

  UPDATE user_roles            SET assigned_by = NULL WHERE assigned_by = p_user_id;
  UPDATE chapters              SET created_by  = NULL WHERE created_by  = p_user_id;
  UPDATE regions               SET created_by  = NULL WHERE created_by  = p_user_id;
  UPDATE chat_rooms            SET created_by  = NULL WHERE created_by  = p_user_id;
  -- `families` may still exist from the pre-redesign schema; ignore if dropped.
  BEGIN
    UPDATE families            SET created_by  = NULL WHERE created_by  = p_user_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  step := 'nulled auth.users audit refs'; rows_affected := NULL; RETURN NEXT;

  -- ── 2. Delete the user's people record(s) ──────────────────────────────────
  -- people.user_id is UNIQUE, so this is normally a single row. Deleting it
  -- CASCADES to everything keyed on people(id) with ON DELETE CASCADE:
  --   person_relationships, notifications, dues_payments, dues_member_plans,
  --   fund_disbursements (person_id), election_nominations
  --   (nominee_id), election_votes (voter_id/nominee_id), photo_tags (person_id).
  -- And SET-NULLs people(id) creator refs (announcements.author_id,
  -- documents.uploaded_by, photos.uploader_id,
  -- photo_collections.created_by, funds.created_by, fund_*.recorded_by/created_by,
  -- elections.created_by, *.tagged_by, *.recorded_by,
  -- election_nominations.nominated_by).
  DELETE FROM people WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  step := 'deleted people rows'; rows_affected := v_count; RETURN NEXT;

  -- ── 3. Delete the auth account ─────────────────────────────────────────────
  -- CASCADES to: chat_participants, chat_messages, user_roles.
  DELETE FROM auth.users WHERE id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  step := 'deleted auth.users rows'; rows_affected := v_count; RETURN NEXT;
END;
$$;

-- ----------------------------------------------------------------------------
-- Optional: invoke directly when running this file with psql -v user_id=...
-- (Comment this out if you only want to define the function.)
-- ----------------------------------------------------------------------------
-- \if :{?user_id}
--   SELECT * FROM purge_user(:user_id::uuid);
-- \endif
