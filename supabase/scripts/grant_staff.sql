-- ============================================================================
-- grant_staff.sql — give one account access to the GENORRA staff console.
-- ----------------------------------------------------------------------------
-- NOT DESTRUCTIVE, and the only way in. `genorra_staff` rows are inserted by hand,
-- deliberately: there is no UI to grant staff access and there must not be one
-- until something can say what would stop it granting access to a stranger
-- (20260817000005's own COMMENT ON TABLE says so).
--
-- USAGE
--   Set the two values in the block below, then:
--
--     npx supabase db query --local  -f supabase/scripts/grant_staff.sql
--     npx supabase db query --linked -f supabase/scripts/grant_staff.sql
--
--   `psql "$DATABASE_URL" -f …` works too.
--
-- WHY A SCRIPT RATHER THAN A MIGRATION, and this is the whole reason this file
-- exists in `supabase/scripts/` instead of `supabase/migrations/`:
--
--   * WHO is staff is not schema. It differs per environment, it changes when
--     somebody joins or leaves, and it is nobody's business but the operator's.
--   * A migration naming a person would apply that grant to EVERY database the
--     chain ever runs on — including a contributor's laptop and any future
--     environment — and `db push` records it as applied so it could not be undone
--     by editing the file. AGENTS.md is explicit that editing an applied migration
--     reaches fresh databases only.
--   * And it would put a real email address in the repository, permanently, in a
--     file that is read by everyone who clones it.
--
-- WHY IT IS SAFE TO RE-RUN. `ON CONFLICT DO UPDATE` on the primary key, so running
-- it twice updates the role and the note rather than failing. It never inserts a row
-- for an address that has no account — the SELECT simply finds nothing, and §2 below
-- says so out loud rather than reporting success over a no-op.
--
-- ── ON LOCAL, THIS DOES NOT SURVIVE `db reset` ──────────────────────────────
-- `genorra_staff.user_id` is ON DELETE CASCADE from `auth.users`, and a reset empties
-- that table — so the grant goes with the account and both need recreating. That is
-- also why `audit_global_lookups.sql` lists `genorra_staff` as legitimately EMPTY
-- rather than treating it as a purged lookup: a database where nobody has been granted
-- staff access is correct, not damaged.
--
-- ── REVOKING ───────────────────────────────────────────────────────────────
-- `DELETE FROM public.genorra_staff WHERE user_id = (SELECT id FROM auth.users WHERE
-- email = '…');`  — one row, and it takes the console away on the caller's next
-- request. It leaves no trail, which is a real gap: if an audit of removals is ever
-- wanted, this table needs a `revoked_at` rather than a delete.
-- ============================================================================

DO $$
DECLARE
  -- ── SET THESE TWO ─────────────────────────────────────────────────────────
  v_email CONSTANT text := 'charlesclaj@gmail.com';

  -- support   answer a ticket: look, do not touch
  -- engineer  the same, plus the operations the console offers (restore a family)
  -- owner     the above, plus granting staff access — which today is this file
  --
  -- CONSULTED BY NOTHING YET. The console's first pass is read-only over families
  -- and accounts, so every staff member has the same access and a check on this
  -- column would be a control that only looks like one. It is recorded now so the
  -- vocabulary is agreed once, and so the day something reads it there is a value
  -- to read rather than a backfill to guess at.
  v_role  CONSTANT text := 'owner';
  v_note  CONSTANT text := 'Founder — initial grant';
  -- ──────────────────────────────────────────────────────────────────────────

  v_user   uuid;
  v_before boolean;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE email = v_email;

  -- ── 1. Refuse rather than silently do nothing ─────────────────────────────
  -- An address with no account is the commonest way to run this and achieve
  -- nothing: the person has not registered yet, or the email differs by a
  -- character, or this is the wrong database. All three look identical to a
  -- successful run that inserted zero rows, which is why this raises.
  IF v_user IS NULL THEN
    RAISE EXCEPTION
      'No account for %. Register it first, or check you are pointed at the right '
      'database — `supabase db query --local` and `--linked` are different projects.',
      v_email;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.genorra_staff WHERE user_id = v_user) INTO v_before;

  INSERT INTO public.genorra_staff (user_id, role, note, granted_by)
  -- `granted_by` is the grantee on a first grant, because there is nobody else to
  -- name: somebody has to be first, and recording that honestly is better than
  -- leaving the column NULL and pretending the trail starts later. It is a plain
  -- uuid rather than a foreign key precisely so this record outlives the account.
  VALUES (v_user, v_role, v_note, v_user)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        note = EXCLUDED.note;

  -- ── 2. Say which of the two things just happened ──────────────────────────
  RAISE NOTICE '% staff access for % (role %)',
    CASE WHEN v_before THEN 'UPDATED' ELSE 'GRANTED' END, v_email, v_role;

  -- ── 3. Assert it, through the function the app actually asks ───────────────
  -- Not `EXISTS (SELECT 1 FROM genorra_staff …)`, which would only prove the INSERT
  -- landed. `is_genorra_staff(uuid)` is what `lib/auth/staff.ts` consults, so this
  -- checks the thing the console will check — including that the function still
  -- exists and still reads this table.
  IF NOT public.is_genorra_staff(v_user) THEN
    RAISE EXCEPTION
      'ROLLBACK: the row was written but is_genorra_staff() still answers false for %. '
      'The function and the table have come apart — see 20260817000005.', v_email;
  END IF;
END $$;
