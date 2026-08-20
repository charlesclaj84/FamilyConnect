-- ============================================================================
-- delete_user_hard_purge.sql — HARD delete of a single user.
-- ----------------------------------------------------------------------------
-- Function name: hard_purge_user(p_user_id uuid)  ← uniquely named, distinct
-- from the soft `purge_user()` in delete_user.sql.
--
-- DIFFERENCE FROM purge_user():
--   purge_user()       → anonymizes shared content the user authored (author
--                        column set to NULL; the announcement/gathering/fund/photo
--                        survives).
--   hard_purge_user()  → DESTROYS shared content the user authored. Deleting an
--                        gathering/fund/election/collection cascades to all of its
--                        children, INCLUDING data belonging to OTHER users
--                        (e.g. other members' tasks on a gathering this user
--                        created). This is intentional and irreversible.
--
-- USAGE
--   SELECT * FROM hard_purge_user('00000000-0000-0000-0000-000000000000'::uuid);
-- ============================================================================

CREATE OR REPLACE FUNCTION hard_purge_user(p_user_id uuid)
RETURNS TABLE (step text, rows_affected bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count    bigint;
  v_person   uuid[];
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'hard_purge_user: p_user_id must not be null';
  END IF;

  -- Resolve the user's people id(s) (UNIQUE, normally one).
  SELECT array_agg(id) INTO v_person FROM people WHERE user_id = p_user_id;

  -- ── 1. Destroy resources AUTHORED BY THIS USER (auth.users refs) ───────────
  -- Each delete cascades to its own children.
  DELETE FROM chat_rooms            WHERE created_by = p_user_id;   -- → participants, messages
  DELETE FROM chapters              WHERE created_by = p_user_id;
  DELETE FROM regions               WHERE created_by = p_user_id;

  -- Any remaining auth.users audit refs that don't own a deletable row: NULL
  -- them so the final auth.users delete cannot hit a NO ACTION constraint.
  UPDATE user_roles        SET assigned_by = NULL WHERE assigned_by = p_user_id;
  BEGIN
    UPDATE families        SET created_by  = NULL WHERE created_by  = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  step := 'destroyed auth.users-owned resources'; rows_affected := NULL; RETURN NEXT;

  -- ── 2. Destroy resources AUTHORED BY THIS USER (people refs) ───────────────
  IF v_person IS NOT NULL THEN
    DELETE FROM funds              WHERE created_by  = ANY(v_person);  -- → milestones, allocations, contributions, disbursements
    DELETE FROM elections          WHERE created_by  = ANY(v_person);  -- → positions, nominations, votes
    DELETE FROM photo_collections  WHERE created_by  = ANY(v_person);  -- → photos, tags
    DELETE FROM photos             WHERE uploader_id = ANY(v_person);  -- → tags
    DELETE FROM documents          WHERE uploaded_by = ANY(v_person);
    DELETE FROM announcements      WHERE author_id   = ANY(v_person);
    DELETE FROM fund_allocations   WHERE created_by  = ANY(v_person);
    DELETE FROM fund_contributions WHERE recorded_by = ANY(v_person);
    DELETE FROM fund_disbursements WHERE recorded_by = ANY(v_person);
    DELETE FROM dues_member_plans  WHERE created_by  = ANY(v_person);
    DELETE FROM dues_payments      WHERE recorded_by = ANY(v_person);
  END IF;

  step := 'destroyed people-owned resources'; rows_affected := NULL; RETURN NEXT;

  -- ── 3. Delete the user's people record(s) ──────────────────────────────────
  -- Cascades remaining person-scoped data: relationships, notifications,
  -- dues_payments(person_id), election votes/nominations,
  -- photo_tags, etc.
  DELETE FROM people WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  step := 'deleted people rows'; rows_affected := v_count; RETURN NEXT;

  -- ── 4. Delete the auth account ─────────────────────────────────────────────
  -- Cascades: chat_participants, chat_messages, user_roles.
  DELETE FROM auth.users WHERE id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  step := 'deleted auth.users rows'; rows_affected := v_count; RETURN NEXT;
END;
$$;
