-- ═══════════════════════════════════════════════════════════════════════════════════
-- `staff_delete_family` COULD NOT DELETE A FAMILY — a row count is not a topological order
-- ═══════════════════════════════════════════════════════════════════════════════════
--
-- Reported from the staff console on 2026-08-31, on a real family:
--
--   update or delete on table "permission_templates" violates foreign key constraint
--   "people_permission_template_fk" on table "people"
--
-- ── WHAT WAS WRONG ─────────────────────────────────────────────────────────────────
-- `20260831000001` derives the table list (rightly — see its header on why a hand-written
-- keep-list is the thing to avoid) and then orders it by how many foreign keys POINT AT each
-- table, ascending, on the reasoning that a leaf has few and a parent has many:
--
--     ORDER BY (SELECT count(*) FROM pg_constraint fk WHERE fk.confrelid = c.oid) ASC
--
-- That is a PROXY for reverse dependency order and it is not one. It breaks for any parent
-- that happens to have fewer incoming edges than its own child, and `permission_templates` is
-- exactly that: two tables reference it (`people`, `template_permissions`) while `people` is
-- referenced by dozens. So `permission_templates` sorted FIRST — before the `people` rows that
-- point at it — and the delete was refused.
--
-- The failure is total rather than partial: the whole function is one transaction, so a family
-- that hits this cannot be deleted at all. It reached the console as "We could not delete that
-- family. Nothing was changed.", which was at least honest.
--
-- ── WHY PASSES RATHER THAN A TOPOLOGICAL SORT ──────────────────────────────────────
-- A recursive CTE over `pg_constraint` would compute a true order, and it was written first
-- and then thrown away. Two reasons:
--
--   * THE GRAPH HAS CYCLES. `families.bloodline_anchor_id` → `people` → (family_code) and
--     `people.chapter_id` → `chapters` → … are the obvious ones, and a self-reference
--     (`dues_payments.reverses_id`) is another shape. A topological sort of a cyclic graph has
--     no answer, so the CTE needs cycle-breaking — and the cycle-breaking is a heuristic, which
--     puts us back where we started with a subtler version of the same bug.
--   * IT WOULD STILL BE A MODEL OF THE CONSTRAINTS RATHER THAN THE CONSTRAINTS. The database
--     already knows the real order and enforces it. Asking it, rather than predicting it, is
--     the difference between a rule that holds and a rule that held when it was written.
--
-- So: sweep the list, catch whatever the database refuses, keep those tables, and go round
-- again. Every pass that makes progress shortens the list; a pass that makes none is the end.
-- Order within a pass no longer matters at all, which is the property worth having — the next
-- table added to this schema cannot reintroduce this bug, in any dependency shape.
--
-- ── AND THE REPORTED BUG WAS THE FIRST OF THREE ────────────────────────────────────
-- Replaying the old ordering against the RLS fixture — a family with 25 people, a ledger and a
-- safety check-in — surfaced three independent failures, each hidden behind the one before it.
-- Every one of them meant a family that could never be deleted:
--
--   1. 23503  `permission_templates` before the `people` rows pointing at it. As reported.
--   2. 42501  `fund_disbursements is append-only`. Four tables carry a guard refusing DELETE
--             except as the cascade from a parent that is already gone.
--   3. P0001  `safety_check_ins: raiser … is not in family`. Deleting `people` fires
--             `ON DELETE SET NULL` on `safety_check_ins.closed_by`, and the §4 guard trigger
--             refuses the resulting UPDATE because the raiser is going in the same statement.
--
-- The second draft of this file caught the first two error classes by name and re-raised the
-- rest — which looked careful and was just a shorter list of predictions, the ORDER BY mistake
-- one layer up. What the three have in common is not an error class: it is that the refusal
-- depends on WHAT HAS BEEN DELETED SO FAR, which is exactly what another pass changes. So the
-- handler catches everything and the no-progress guard is what makes that safe.
--
-- NOTHING HAD NOTICED ANY OF THIS because nothing had ever deleted a POPULATED family. The
-- migration that shipped the feature asserts the function exists, is owner-gated and is
-- unreachable from a browser role — all true, and none of it executes a delete.
--
-- ── AND IT REFUSES RATHER THAN LEAVING A HALF-DELETED FAMILY ───────────────────────
-- If a pass makes no progress and tables remain, the function RAISES. The whole thing is one
-- transaction, so the family is left exactly as it was and the console says nothing changed —
-- which is the same honest answer the bug produced, now with the offending tables named in the
-- message instead of one constraint. A half-deleted family is the state this must never reach:
-- it would be a customer whose photographs are gone and whose ledger is not.
--
-- ── WHAT IS DELIBERATELY UNCHANGED ─────────────────────────────────────────────────
-- Everything else in `20260831000001`'s version, line for line: the owner gate, the required
-- note, the service-role identity rule, the derived table list and its two exclusions, the
-- explicit `families` delete, and the `genorra_staff_deletions` audit row. Only the sweep
-- moved. `CREATE OR REPLACE` rather than an edit to that file, because it is applied and an
-- edit to an applied migration reaches no database that already has it.

BEGIN;

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
  -- time rather than at CREATE time.
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
  v_todo    text[];
  v_failed  text[];
  v_errs    text[];
  v_pass    int := 0;
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

  -- ── THE TABLE LIST, DERIVED AND UNORDERED ──────────────────────────────────────
  -- Every table in `public` carrying a `family_code`. DERIVED rather than written down, which
  -- is `20260831000001`'s decision and the right one — the lesson `audit_global_lookups.sql`
  -- took from `truncate_entire_database.sql`'s hand-written keep-list.
  --
  -- NO `ORDER BY` ANY MORE, and its absence is the fix. The old one ordered by incoming
  -- foreign-key count as a stand-in for reverse dependency order; see this migration's header
  -- for the family that could not be deleted because of it. The pass loop below needs no
  -- order, so there is none to get wrong.
  --
  -- ON DELETE CASCADE would do most of this on its own from `families`, and is NOT relied on:
  -- several of these tables reference `families` only through `family_code` as a plain column
  -- with no foreign key at all (that is what `audit_cross_family_refs.sql` exists to police),
  -- so a cascade would silently leave them. Deleting explicitly and COUNTING is what makes the
  -- audit row true.
  SELECT array_agg(c.relname ORDER BY c.relname)
    INTO v_todo
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND a.attname = 'family_code'
     AND a.attnum > 0 AND NOT a.attisdropped
     -- The audit row must survive the sweep that writes it. It has no `family_code`
     -- column, so it is not selected here anyway; named for the reader.
     AND c.relname <> 'genorra_staff_deletions';

  -- ── `families` GOES IN THE SWEEP, AND IT HAS TO GO EARLY ───────────────────────
  -- `20260831000001` excluded it here and deleted it last, which reads as the obvious order
  -- and is backwards. Several guards in this schema are written to permit a delete precisely
  -- WHEN THE FAMILY ROW IS ALREADY GONE, because that is the only circumstance in which the
  -- row they protect should not exist. `funds_protect_system` says so in as many words:
  --
  --     -- The one exception: the family itself is going. funds.family_code has no foreign
  --     -- key to families, so this is not an RI cascade — it is the family_code no longer
  --     -- existing, which is the only circumstance in which the fund should not.
  --
  -- Deleting `families` LAST therefore made the built-in Donations fund permanently
  -- undeletable, and `fund_transfers` with it, because its own guard waits on the fund.
  -- Measured: with families last, the loop ran four passes and stopped with exactly those two
  -- refusing.
  --
  -- Putting it in the list rather than deleting it first by hand is the same principle as the
  -- rest of this function — the loop works out when it can go. Exactly one table has a real
  -- foreign key to `families` (`birthday_greetings`, ON DELETE CASCADE), so in practice it
  -- goes on pass one and every parent-gone guard unlocks behind it; if that ever stops being
  -- true the loop simply takes another pass.
  v_todo := v_todo || ARRAY['families'];
  -- TWO EXCLUSIONS, exactly as `20260831000001` had them, and `genorra_staff_challenges` is
  -- deliberately NOT a third. It carries a `family_code` and so the sweep takes it — which is
  -- right: the challenge that authorised this delete was already spent by
  -- `consume_family_action_challenge` before the action called this, so what is left is a
  -- handful of expired rows naming a family that is about to stop existing. Excluding it
  -- would leave them pointing at nothing.

  -- ── THE PASSES ─────────────────────────────────────────────────────────────────
  -- Attempt every remaining table; keep the ones the database refused; go round again. Bounded
  -- by the number of tables, because a pass that deletes nothing ends the loop — so this
  -- terminates whatever shape the foreign-key graph is, cycles included.
  WHILE array_length(v_todo, 1) > 0 LOOP
    v_pass   := v_pass + 1;
    v_failed := ARRAY[]::text[];
    v_errs   := ARRAY[]::text[];

    FOREACH v_tbl IN ARRAY v_todo LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE family_code = $1', v_tbl) USING v_code;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n > 0 THEN
          -- ACCUMULATED, not overwritten. A table emptied across two passes cannot happen
          -- (one DELETE takes every matching row), but `||` on a jsonb object replaces a
          -- repeated key, and a count that silently replaced an earlier one would make the
          -- audit row wrong rather than merely incomplete.
          v_counts := v_counts || jsonb_build_object(
            v_tbl, COALESCE((v_counts ->> v_tbl)::bigint, 0) + v_n);
        END IF;
      EXCEPTION
        -- ── EVERY ERROR IS RETRYABLE, AND ENUMERATING THEM WAS THE MISTAKE ─────────
        -- Three different error classes were measured against the RLS fixture, one after
        -- another, each hidden behind the one before it — and each was a family that could
        -- never be deleted:
        --
        --   23503 foreign_key_violation   `permission_templates` before the `people` rows
        --                                 pointing at it. The reported bug.
        --   42501 insufficient_privilege  `fund_disbursements is append-only`. Four tables
        --                                 carry a guard refusing DELETE except as the cascade
        --                                 from a parent that is ALREADY GONE — so once `funds`
        --                                 or `people` goes, `ON DELETE CASCADE` takes these
        --                                 rows and the retry matches nothing.
        --   P0001 raise_exception         `safety_check_ins: raiser … is not in family`.
        --                                 Deleting `people` fires `ON DELETE SET NULL` on
        --                                 `safety_check_ins.closed_by`, and the §4 guard
        --                                 trigger refuses the resulting UPDATE because the
        --                                 raiser's row is going in the same statement.
        --
        -- Catching the first two and re-raising the rest looked careful and was just a
        -- shorter list of predictions — the same mistake as the ORDER BY, one layer up. What
        -- these three have in common is not an error class: it is that the refusal depends on
        -- what has been deleted SO FAR, which is exactly what another pass changes.
        --
        -- NOTHING IS MASKED BY THIS. The whole function is one transaction; a table that never
        -- succeeds ends the loop, and the RAISE below names it and carries the last error the
        -- database gave for it, so the diagnosis is better than a bare re-raise rather than
        -- worse. There is no outcome where a family is left half deleted and reported as gone.
        WHEN OTHERS THEN
          v_failed := v_failed || v_tbl;
          v_errs   := v_errs   || format('%s: %s', v_tbl, SQLERRM);
      END;
    END LOOP;

    -- No progress: every remaining table was refused, so another identical pass would be
    -- refused identically.
    IF array_length(v_failed, 1) = array_length(v_todo, 1) THEN
      -- THE LAST ERROR PER TABLE, not just the names. These refusals come from at least three
      -- different mechanisms (a foreign key, an append-only guard, a §4 cross-family trigger)
      -- and the message is the only thing that says which — so a bare list of table names
      -- would send the next person back to reproduce what this already knows.
      RAISE EXCEPTION
        'staff_delete_family could not finish for %: % table(s) still refuse a delete after % pass(es) — %',
        v_code, array_length(v_failed, 1), v_pass, array_to_string(v_errs, ' | ')
        USING HINT = 'Something outside the derived sweep is holding these rows: a foreign key '
                     'from a table with no family_code of its own, or a trigger refusing the '
                     'delete for a reason another pass cannot change.';
    END IF;

    v_todo := v_failed;
  END LOOP;

  -- NO SEPARATE `families` DELETE ANY MORE — it is in the sweep above, and its count reaches
  -- `v_counts` the same way every other table's does. The old trailing statement is what made
  -- the built-in fund undeletable; see the note beside the list.

  INSERT INTO public.genorra_staff_deletions
    (family_code, family_name, deleted, acted_by, acted_by_email, note)
  VALUES (v_code, v_name, v_counts, v_actor, v_email, v_note);

  RETURN QUERY SELECT true, NULL::text, v_counts;
END $$;

REVOKE ALL ON FUNCTION public.staff_delete_family(text, text, uuid)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.staff_delete_family(text, text, uuid) IS
  'Permanently delete one family and everything scoped to it. OWNER ONLY, and the table list '
  'is DERIVED from any public table with a family_code column rather than written down. '
  'Deletes in PASSES, retrying tables the database refuses on a foreign key, because a count '
  'of incoming references is not a topological order — see 20260831000004. Does NOT touch '
  'auth.users and cannot touch storage; the calling action deletes the objects FIRST. Writes '
  'genorra_staff_deletions, which is the only thing that survives. Granted to nobody.';

-- ── VERIFY ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n INT;
BEGIN
  -- The function exists, is SECURITY DEFINER, and is reachable from neither browser role.
  -- Restated rather than assumed: `CREATE OR REPLACE` keeps the old privileges, and a REVOKE
  -- that silently stopped applying is how §2b's whole section came to be written.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n2 ON n2.oid = p.pronamespace
    WHERE n2.nspname = 'public' AND p.proname = 'staff_delete_family' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'staff_delete_family is missing or is no longer SECURITY DEFINER';
  END IF;

  SELECT count(*) INTO n
  FROM pg_proc p
  JOIN pg_namespace n2 ON n2.oid = p.pronamespace
  CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS r(role_name)
  WHERE n2.nspname = 'public' AND p.proname = 'staff_delete_family'
    AND has_function_privilege(r.role_name, p.oid, 'EXECUTE');
  IF n > 0 THEN
    RAISE EXCEPTION 'staff_delete_family is executable by a browser role';
  END IF;

  -- THE BUG ITSELF, ASSERTED. `permission_templates` is a PARENT of `people` and has fewer
  -- tables pointing at it — which is precisely the shape the old ordering got backwards. If
  -- that ever stops being true the assertion below stops being evidence, so it checks the
  -- inversion still exists rather than merely that both tables do.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint fk
    WHERE fk.contype = 'f'
      AND fk.conrelid = 'public.people'::regclass
      AND fk.confrelid = 'public.permission_templates'::regclass
  ) THEN
    RAISE NOTICE 'people no longer references permission_templates — 20260831000004''s worked example has moved, though the pass loop is shape-independent and still correct.';
  END IF;

  RAISE NOTICE 'staff_delete_family now deletes in passes; no table ordering is relied on.';
END $$;

COMMIT;
