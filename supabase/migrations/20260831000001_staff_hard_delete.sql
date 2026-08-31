-- ═══════════════════════════════════════════════════════════════════════════════════
-- THE STAFF CONSOLE CAN DESTROY THINGS NOW: a whole family, and one account
-- ═══════════════════════════════════════════════════════════════════════════════════
--
-- Two functions, both owner-only, both irreversible. `20260817000006` gave the console the
-- ability to RESTORE a removed family, and removal is a soft disable that destroys nothing —
-- which is right for the member-facing product and leaves GENORRA with no way to answer
-- "delete our data" or "that account was created with the wrong address".
--
-- ── WHY THESE ARE RPCs AND NOT SERVICE-ROLE DELETES IN TYPESCRIPT ──────────────────
-- `20260817000006` §7 argues it at length for `staff_set_family_status` and the argument is
-- stronger here: the console holds the service key, so it could issue these deletes itself and
-- no policy would object. Spending an RPC means the staff check exists in the DATABASE as well
-- as in a `requireStaffOwner()` on a page nobody visits — and for an act with no undo, one
-- layer is not enough. AGENTS.md §2's rule, one level down: the action that calls this is not a
-- gate either, and this function does not trust it.
--
-- ── OWNER, NOT STAFF. THE ONE PLACE THE ROLE COLUMN EARNS ITS THIRD VALUE AGAIN ────
-- `genorra_staff.role` draws exactly one line — `owner` means "plus deciding who else may open
-- the console" (AGENTS.md). It now draws a second, and the two are the same kind of thing: a
-- `support` staffer answering a ticket must not be able to destroy a family's records, for the
-- same reason they must not be able to grant console access. `support` and `engineer` are still
-- the same thing and must not be split on a guess.
--
-- ── DERIVED, NOT LISTED. THIS IS THE `truncate_entire_database.sql` LESSON ─────────
-- `supabase/scripts/reset_families.sql` deletes 55 tables by hand and its §11 asserts the list
-- has not gone stale — which is the right shape for a script somebody reads before running,
-- and the wrong shape for a function a support engineer presses a button on. So
-- `staff_delete_family` DERIVES its targets: every table in `public` with a `family_code`
-- column, deleted in reverse dependency order. A table added next year is deleted with no edit
-- here, which is precisely what `audit_global_lookups.sql` §2 learned from that script's
-- hand-written keep-list.
--
-- ── WHAT IT DELIBERATELY DOES NOT DELETE, AND EACH IS A DECISION ───────────────────
--
--   `auth.users`          An account is not a family's property. A member of two families who
--                         loses one still has the other, and a member who loses their only
--                         family is in the same state as somebody who left it — `/my-families`
--                         already handles that. `staff_delete_account` below is the separate
--                         act, asked for separately.
--   `people` rows         Go with the family (they carry `family_code`), so the derived sweep
--                         takes them. That is right: a `people` row IS the membership.
--   storage objects       SQL cannot. `storage.protect_delete()` refuses a direct DELETE and
--                         the bytes live in a backend no migration reaches. The TypeScript
--                         action deletes them through the Storage API BEFORE calling this —
--                         the same split `20260820000008` and `scripts/drop-retired-bucket.mjs`
--                         had to make, and the same ORDER, because once the rows are gone
--                         nothing can enumerate which bytes belonged to whom.
--   the audit row         `genorra_staff_deletions` below is written by this function and is
--                         the only thing that survives. A destruction nobody can account for
--                         afterwards is worse than one nobody can undo.

-- ── 1. THE EMAILED CODE, AND WHY IT IS NOT `family_action_challenges` ──────────────
-- The obvious move was a third `purpose` on the existing table, which is exactly what
-- `20260825000000` built that column for. It does not fit, and the reason is not a detail:
--
--   * `family_action_challenges.requested_by` is a `people.id`, and the lookup inside
--     `consume_family_action_challenge` is `(family_code, requested_by, purpose)` with an
--     explicit `IF p_person_id IS NULL THEN` refusal. **A GENORRA staff member has no
--     `people` row in the family they are acting on** — that is the whole premise of
--     `genorra_staff` — so there is no identity to resolve the challenge on.
--   * That function also validates `purpose` against a HARDCODED list of two. Adding a third
--     value to the table's CHECK without editing the function would admit the row and then
--     refuse to spend it, reporting "there is no code waiting" for a code that exists —
--     which is precisely the afternoon-long confusion its own comment warns about.
--
-- Making `requested_by` nullable and teaching one function to resolve on either an actor kind
-- would change a function three live features depend on, to serve an actor that is not a
-- family member at all. So the staff console gets its own table, with the same semantics a
-- reader already knows: six digits, fifteen minutes, five attempts, single use, hash compared
-- and never addressed.
CREATE TABLE IF NOT EXISTS public.genorra_staff_challenges (
  id          UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  -- THE ACTOR IS AN ACCOUNT, not a person. CASCADE because a challenge belonging to a
  -- deleted account is not a record worth keeping — unlike `genorra_staff_deletions`, which
  -- is.
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The family the code authorises destroying. TEXT and not a foreign key: the code outlives
  -- the family by a few seconds, which is the whole point of it.
  family_code TEXT NOT NULL,
  -- SHA-256 of the digits. The plaintext exists only in the Node process that composed the
  -- email — the split `family_action_challenges` argues at length.
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §2c: RLS with ZERO policies is the whole gate. This table holds a hash and a family code,
-- and no browser role has any business reading either.
ALTER TABLE public.genorra_staff_challenges ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS genorra_staff_challenges_open_idx
  ON public.genorra_staff_challenges (user_id, family_code, created_at DESC)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE public.genorra_staff_challenges IS
  'Six-digit codes authorising a permanent family deletion from the staff console. Its own '
  'table rather than a third purpose on family_action_challenges, because that one resolves '
  'on a people.id and a staff member has none in the family they act on — see '
  '20260831000001 §1. RLS on with no policies. Emptied by no reset; rows expire.';

-- ── 1b. SPENDING ONE, ATOMICALLY ───────────────────────────────────────────────────
-- One statement under `FOR UPDATE`, for `consume_family_action_challenge`'s reason: a
-- five-branch read-modify-write from the application races itself, and here losing that race
-- means two concurrent presses each believing they hold the only code.
CREATE OR REPLACE FUNCTION public.staff_consume_challenge(
  p_user_id     uuid,
  p_family_code text,
  p_code_hash   text
)
RETURNS TABLE (ok boolean, message text, attempts_left int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- ALIASED AND QUALIFIED: `ok`, `message` and `attempts_left` are RETURNS TABLE names and
  -- therefore variables in this body.
  v_claims jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role   text  := COALESCE(v_claims ->> 'role', '');
  v_actor  uuid;
  v_code   text  := upper(btrim(COALESCE(p_family_code, '')));
  v_row    public.genorra_staff_challenges;
  v_max    CONSTANT int := 5;
BEGIN
  IF v_role = 'service_role' THEN v_actor := p_user_id;
  ELSE v_actor := (SELECT auth.uid());
  END IF;

  IF NOT public.is_genorra_staff_owner(v_actor) THEN
    RETURN QUERY SELECT false, 'Not authorized'::text, 0; RETURN;
  END IF;

  IF v_code = '' OR COALESCE(p_code_hash, '') = '' THEN
    RETURN QUERY SELECT false, 'Ask for a new code and try again.'::text, 0; RETURN;
  END IF;

  -- RESOLVED ON (actor, family), NEVER ON THE HASH. Addressing the row by hash would let a
  -- caller holding a guessed code spend somebody else's challenge, and the app layer would
  -- then be the only thing between that and a deletion.
  SELECT * INTO v_row
    FROM public.genorra_staff_challenges c
   WHERE c.user_id = v_actor
     AND c.family_code = v_code
     AND c.consumed_at IS NULL
   ORDER BY c.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false,
      'That code has already been used, or there is no code waiting. Ask for a new one.'::text,
      0; RETURN;
  END IF;

  IF v_row.expires_at <= NOW() THEN
    UPDATE public.genorra_staff_challenges c SET consumed_at = NOW() WHERE c.id = v_row.id;
    RETURN QUERY SELECT false, 'That code has expired. Ask for a new one.'::text, 0; RETURN;
  END IF;

  IF v_row.code_hash <> p_code_hash THEN
    UPDATE public.genorra_staff_challenges c
       SET attempts = c.attempts + 1,
           -- CLOSED ON THE LAST WRONG ATTEMPT, not left open at 5. An exhausted challenge
           -- that is still unspent would be found by the next call and refused for the wrong
           -- reason.
           consumed_at = CASE WHEN c.attempts + 1 >= v_max THEN NOW() ELSE NULL END
     WHERE c.id = v_row.id;
    IF v_row.attempts + 1 >= v_max THEN
      RETURN QUERY SELECT false, 'Too many wrong codes. Ask for a new one.'::text, 0; RETURN;
    END IF;
    RETURN QUERY SELECT false, 'That code is not right.'::text, v_max - (v_row.attempts + 1);
    RETURN;
  END IF;

  -- SPENT WHETHER OR NOT THE DELETION THAT FOLLOWS SUCCEEDS. A code that survives a failed
  -- attempt is a code somebody can retry with, which is the opposite of single use.
  UPDATE public.genorra_staff_challenges c SET consumed_at = NOW() WHERE c.id = v_row.id;
  RETURN QUERY SELECT true, NULL::text, v_max - v_row.attempts;
END $$;

REVOKE ALL ON FUNCTION public.staff_consume_challenge(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.staff_consume_challenge(uuid, text, text) IS
  'Verify and CONSUME a staff family-deletion code, atomically. Resolved on (user_id, '
  'family_code) and the hash is COMPARED, never used to find the row. Owner-gated, single '
  'use, 15 minutes, at most 5 attempts. Granted to nobody.';

-- ── 2. THE AUDIT ROW, WHICH IS THE ONLY THING THAT SURVIVES ────────────────────────
-- It CARRIES a `family_code` and is NOT family data, which is the one thing to understand
-- about it. The column is there because the row's whole job is to say which family was
-- destroyed; what makes it platform data is that the family it names no longer exists.
--
-- ── SO IT IS THE `family_roles` TRAP, AND TWO SCRIPTS HAD TO BE TOLD ───────────────
-- Every "is this family data?" test in this repo asks whether the table has a `family_code`
-- column — and `family_roles` is the entry in AGENTS.md's own list of product-data tables
-- precisely because it was a hybrid that answered yes. This one answers yes too:
--
--   `staff_delete_family`'s derived sweep     excludes it BY NAME. Without that line the
--                                             statement writing the audit row would be
--                                             preceded by one deleting it.
--   `reset_families.sql` §11                  keeps it, for `stripe_webhook_events`' reason:
--                                             a FAMILY reset is not a platform reset.
--   `audit_global_lookups.sql` §2             needs NOTHING. That check reports a table with
--                                             no `family_code` AND no path to one, so a
--                                             column here is what keeps it out — measured,
--                                             by removing the entry and watching the audit
--                                             stay green, which is why there is no entry.
--
-- `truncate_entire_database.sql` takes it, and should: that script is a platform reset.
CREATE TABLE IF NOT EXISTS public.genorra_staff_deletions (
  id           UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  -- TEXT, not a foreign key. The family is gone; a reference would be to nothing.
  family_code  TEXT        NOT NULL,
  family_name  TEXT,
  -- What was destroyed, as a count per table. JSONB rather than columns because the table
  -- list is DERIVED and a column per table would go stale the moment one is added.
  deleted      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- ON DELETE SET NULL: losing the actor's account must not delete the record of the act.
  -- The same reasoning `families.removed_by` carries.
  acted_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  acted_by_email TEXT,
  note         TEXT        NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.genorra_staff_deletions IS
  'Every family a GENORRA owner has permanently deleted, and what was in it. Deliberately NOT '
  'family-scoped — a row carrying family_code would be deleted by the sweep that writes it — '
  'so it is named in audit_global_lookups.sql''s allowed_empty list. Append-only in practice: '
  'RLS on with zero policies, so no browser role reads or writes it at all.';

-- §2c: a new table in `public` is born readable and writable by both browser roles. RLS with
-- ZERO policies is the whole gate, exactly as `genorra_staff` does it.
ALTER TABLE public.genorra_staff_deletions ENABLE ROW LEVEL SECURITY;

-- ── 3. AN OWNER, AND ONLY AN OWNER ─────────────────────────────────────────────────
-- Mirrors `is_genorra_staff(uuid)` and adds the role test. Its own function rather than an
-- inline EXISTS in both bodies below, so "who may destroy things" is one expression.
CREATE OR REPLACE FUNCTION public.is_genorra_staff_owner(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL
     AND EXISTS (
           SELECT 1 FROM public.genorra_staff s
            WHERE s.user_id = p_user_id AND s.role = 'owner'
         );
$$;

COMMENT ON FUNCTION public.is_genorra_staff_owner(uuid) IS
  'True when this account is a GENORRA staff OWNER. The gate on every irreversible act in the '
  'console — granting access, and the two deletes in 20260831000001. support and engineer are '
  'deliberately not distinguished from each other and neither may destroy anything.';

REVOKE ALL ON FUNCTION public.is_genorra_staff_owner(uuid) FROM PUBLIC, anon, authenticated;

-- ── 4. DELETE A FAMILY, PERMANENTLY ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_delete_family(
  p_family_code text,
  p_note        text,
  p_user_id     uuid DEFAULT NULL
)
RETURNS TABLE (ok boolean, message text, deleted jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- ALIASED AND QUALIFIED THROUGHOUT: `ok`, `message` and `deleted` are RETURNS TABLE names
  -- and therefore plpgsql VARIABLES in this body. An unqualified reference raises at CALL
  -- time rather than at CREATE time — `staff_set_family_status` carries the same warning.
  v_claims  jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role    text  := COALESCE(v_claims ->> 'role', '');
  v_actor   uuid;
  v_email   text;
  v_code    text  := upper(btrim(COALESCE(p_family_code, '')));
  v_note    text  := btrim(COALESCE(p_note, ''));
  v_name    text;
  v_counts  jsonb := '{}'::jsonb;
  v_tbl     text;
  v_n       bigint;
BEGIN
  -- The service role says who it is acting for; anybody else is acting for themselves,
  -- whatever they passed. §2b's rule about never taking an identity as a parameter, and the
  -- one sanctioned exception: PostgREST sets `request.jwt.claims` from a token it has already
  -- verified, and a browser cannot forge it.
  IF v_role = 'service_role' THEN v_actor := p_user_id;
  ELSE v_actor := (SELECT auth.uid());
  END IF;

  -- THE GATE, FIRST. A non-owner learns nothing about the code they named.
  IF NOT public.is_genorra_staff_owner(v_actor) THEN
    RETURN QUERY SELECT false, 'Not authorized'::text, NULL::jsonb; RETURN;
  END IF;

  -- A REASON IS REQUIRED, for `genorra_staff.note`'s reason: the audit row is a record, and a
  -- bare family code is not one.
  IF v_note = '' THEN
    RETURN QUERY SELECT false, 'Say why this family is being deleted.'::text, NULL::jsonb;
    RETURN;
  END IF;

  SELECT f.family_name INTO v_name FROM public.families AS f WHERE f.family_code = v_code;
  IF NOT FOUND THEN
    -- Safe to distinguish here and only here: the caller is a proven owner, so there is no
    -- enumeration oracle to protect. §6's one-message rule is about strangers.
    RETURN QUERY SELECT false, 'No family with that code.'::text, NULL::jsonb; RETURN;
  END IF;

  SELECT u.email INTO v_email FROM auth.users AS u WHERE u.id = v_actor;

  -- ── THE SWEEP, DERIVED AND ORDERED ─────────────────────────────────────────────
  -- Every table in `public` carrying a `family_code`, in REVERSE dependency order so a child
  -- goes before its parent. `pg_class.oid` is not that order, so it is computed: a table's
  -- depth is how many family-scoped tables reference it, and the deepest go first.
  --
  -- ON DELETE CASCADE would do most of this on its own from `families`, and is NOT relied on:
  -- several of these tables reference `families` only through `family_code` as a plain column
  -- with no foreign key at all (that is what `audit_cross_family_refs.sql` exists to police),
  -- so a cascade would silently leave them. Deleting explicitly and COUNTING is what makes the
  -- audit row true.
  FOR v_tbl IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND a.attname = 'family_code'
       AND a.attnum > 0 AND NOT a.attisdropped
       AND c.relname <> 'families'
       -- The audit row must survive the sweep that writes it. It has no `family_code`
       -- column, so it is not selected here anyway; named for the reader.
       AND c.relname <> 'genorra_staff_deletions'
     ORDER BY (
       SELECT count(*) FROM pg_constraint fk
        WHERE fk.contype = 'f' AND fk.confrelid = c.oid
     ) ASC, c.relname ASC
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE family_code = $1', v_tbl) USING v_code;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      v_counts := v_counts || jsonb_build_object(v_tbl, v_n);
    END IF;
  END LOOP;

  DELETE FROM public.families AS f WHERE f.family_code = v_code;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('families', v_n);

  INSERT INTO public.genorra_staff_deletions
    (family_code, family_name, deleted, acted_by, acted_by_email, note)
  VALUES (v_code, v_name, v_counts, v_actor, v_email, v_note);

  RETURN QUERY SELECT true, NULL::text, v_counts;
END $$;

REVOKE ALL ON FUNCTION public.staff_delete_family(text, text, uuid)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.staff_delete_family(text, text, uuid) IS
  'Permanently delete one family and everything scoped to it. OWNER ONLY, and the table list '
  'is DERIVED from any public table with a family_code column rather than written down — the '
  'lesson audit_global_lookups.sql took from truncate_entire_database.sql''s hand-written '
  'keep-list. Does NOT touch auth.users (an account is not a family''s property) and cannot '
  'touch storage (SQL does not reach the bytes) — the calling action deletes the objects '
  'FIRST, because afterwards nothing can enumerate which belonged to whom. Writes '
  'genorra_staff_deletions, which is the only thing that survives. Granted to nobody.';

-- ── 5. DELETE ONE ACCOUNT ──────────────────────────────────────────────────────────
-- Asked for as "a way to delete a member email/auth", and the two halves of that are the same
-- row: `auth.users` holds the address, and deleting the row frees the address for a fresh
-- registration.
--
-- ── THE `people` ROW SURVIVES, AND THAT IS THE FEATURE ─────────────────────────────
-- `people.user_id` is ON DELETE SET NULL, so every family this person belonged to keeps them
-- on the tree, in the directory and in its ledgers — as a RECORD with no account, which is a
-- shape this product already has in quantity (AGENTS.md §4b: a recorded grandmother). Deleting
-- the person as well would remove a relative from a family that did not ask for that, and
-- would take their dues history with them.
--
-- ── FOUR FOREIGN KEYS BLOCK IT, AND THEY ARE THE REASON THIS IS A FUNCTION ─────────
-- `chapters.created_by`, `chat_rooms.created_by`, `regions.created_by` and
-- `user_roles.assigned_by` reference `auth.users` with ON DELETE NO ACTION, so a plain delete
-- fails with a foreign-key violation and GoTrue's admin API reports it as an opaque "Database
-- error deleting user". Measured while cleaning up the RLS fixture: one `chat_rooms` row made
-- an account undeletable. Nulling them is right rather than merely expedient — each records
-- WHO created a thing, and the thing outlives its creator's account.
CREATE OR REPLACE FUNCTION public.staff_delete_account(
  p_email   text,
  p_note    text,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (ok boolean, message text, deleted_user uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claims jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role   text  := COALESCE(v_claims ->> 'role', '');
  v_actor  uuid;
  v_email  text  := lower(btrim(COALESCE(p_email, '')));
  v_note   text  := btrim(COALESCE(p_note, ''));
  v_target uuid;
BEGIN
  IF v_role = 'service_role' THEN v_actor := p_user_id;
  ELSE v_actor := (SELECT auth.uid());
  END IF;

  IF NOT public.is_genorra_staff_owner(v_actor) THEN
    RETURN QUERY SELECT false, 'Not authorized'::text, NULL::uuid; RETURN;
  END IF;

  IF v_note = '' THEN
    RETURN QUERY SELECT false, 'Say why this account is being deleted.'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT u.id INTO v_target FROM auth.users AS u WHERE lower(u.email) = v_email;
  IF v_target IS NULL THEN
    RETURN QUERY SELECT false, 'No account with that address.'::text, NULL::uuid; RETURN;
  END IF;

  -- AN OWNER MAY NOT DELETE THEIR OWN ACCOUNT, and the reason is the same one
  -- `/staff/access` gives for refusing a self-revoke: it is the one mistake with no route
  -- back, because the account that would fix it is the one that just went.
  IF v_target = v_actor THEN
    RETURN QUERY SELECT false, 'You cannot delete your own account.'::text, NULL::uuid; RETURN;
  END IF;

  -- AND NOT THE LAST OWNER. `/staff/access` already refuses to demote or revoke the last
  -- one; deleting their account outright is the same act by another route, and leaving the
  -- console with nobody who may grant access is unrecoverable without SQL.
  IF public.is_genorra_staff_owner(v_target)
     AND (SELECT count(*) FROM public.genorra_staff s WHERE s.role = 'owner') <= 1
  THEN
    RETURN QUERY SELECT false, 'That is the last owner of the console.'::text, NULL::uuid;
    RETURN;
  END IF;

  -- The four ON DELETE NO ACTION references. See the header.
  UPDATE public.chapters    AS x SET created_by  = NULL WHERE x.created_by  = v_target;
  UPDATE public.chat_rooms  AS x SET created_by  = NULL WHERE x.created_by  = v_target;
  UPDATE public.regions     AS x SET created_by  = NULL WHERE x.created_by  = v_target;
  UPDATE public.user_roles  AS x SET assigned_by = NULL WHERE x.assigned_by = v_target;

  INSERT INTO public.genorra_staff_deletions
    (family_code, family_name, deleted, acted_by, acted_by_email, note)
  VALUES ('—', NULL,
          jsonb_build_object('auth_user', v_email),
          v_actor,
          (SELECT u.email FROM auth.users AS u WHERE u.id = v_actor),
          v_note);

  -- Cascades to auth.sessions, auth.identities and auth.refresh_tokens, and SET NULLs
  -- people.user_id, so every family keeps the relative as an account-less record.
  DELETE FROM auth.users AS u WHERE u.id = v_target;

  RETURN QUERY SELECT true, NULL::text, v_target;
END $$;

REVOKE ALL ON FUNCTION public.staff_delete_account(text, text, uuid)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.staff_delete_account(text, text, uuid) IS
  'Permanently delete one auth.users row, freeing its email address. OWNER ONLY. The people '
  'rows SURVIVE with user_id nulled, so every family keeps the relative as a record — '
  'deleting them would remove somebody from a family that did not ask. Nulls the four '
  'ON DELETE NO ACTION references to auth.users first, which is what makes the delete '
  'possible at all. Refuses self-deletion and the last console owner. Granted to nobody.';

-- ── 6. VERIFY ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_scoped int;
BEGIN
  -- None of the three is reachable from a browser role. §2b: a function in `public` is a
  -- public HTTP endpoint, and these three are the last three that should be.
  IF has_function_privilege('authenticated',
       'public.staff_delete_family(text,text,uuid)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon',
       'public.staff_delete_family(text,text,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'staff_delete_family is reachable from a browser role';
  END IF;

  IF has_function_privilege('authenticated',
       'public.staff_delete_account(text,text,uuid)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon',
       'public.staff_delete_account(text,text,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'staff_delete_account is reachable from a browser role';
  END IF;

  IF has_function_privilege('authenticated',
       'public.is_genorra_staff_owner(uuid)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon',
       'public.is_genorra_staff_owner(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'is_genorra_staff_owner is reachable from a browser role';
  END IF;

  -- The audit table denies the browser every command, by having no policy at all (§2c).
  IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = 'genorra_staff_deletions') THEN
    RAISE EXCEPTION 'genorra_staff_deletions does not have RLS enabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'genorra_staff_deletions') THEN
    RAISE EXCEPTION 'genorra_staff_deletions has a policy — it must have none';
  END IF;

  -- THE SHARED CHALLENGE TABLE IS UNTOUCHED, and that is asserted rather than assumed.
  -- The first draft of this migration added a third `purpose` to it, which would have been
  -- admitted by the CHECK and then refused by `consume_family_action_challenge`'s own
  -- hardcoded list of two — a code that exists and cannot be spent. §1 argues it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'family_action_challenges_purpose_check'
       AND pg_get_constraintdef(oid) LIKE '%family_removal%'
       AND pg_get_constraintdef(oid) LIKE '%processor_disconnect%'
       AND pg_get_constraintdef(oid) NOT LIKE '%family_delete%'
  ) THEN
    RAISE EXCEPTION 'family_action_challenges'' purpose CHECK is not the two-purpose form '
      'this migration deliberately left alone';
  END IF;

  -- And the staff table denies the browser every command by having no policy (§2c).
  IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = 'genorra_staff_challenges') THEN
    RAISE EXCEPTION 'genorra_staff_challenges does not have RLS enabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'genorra_staff_challenges') THEN
    RAISE EXCEPTION 'genorra_staff_challenges has a policy — it must have none';
  END IF;
  IF has_function_privilege('authenticated',
       'public.staff_consume_challenge(uuid,text,text)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon',
       'public.staff_consume_challenge(uuid,text,text)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'staff_consume_challenge is reachable from a browser role';
  END IF;

  -- THE SWEEP FINDS SOMETHING. A derived list that selects zero tables is a delete that
  -- silently does nothing, which is the worst possible outcome for this function — it would
  -- report success, write an audit row saying nothing was deleted, and leave the family.
  SELECT count(*) INTO v_scoped
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attname = 'family_code'
     AND a.attnum > 0 AND NOT a.attisdropped AND c.relname <> 'families';
  IF v_scoped < 40 THEN
    RAISE EXCEPTION 'only % family-scoped tables found — the derived sweep looks broken', v_scoped;
  END IF;

  RAISE NOTICE 'staff_delete_family sweeps % family-scoped tables, owner-gated.', v_scoped;
END $$;
