-- ============================================================================
-- reset_families.sql — Return every family to its just-created state.
-- ----------------------------------------------------------------------------
-- *** DESTRUCTIVE — NO RECOVERY. Take a dump first if the data matters. ***
--
-- Keeps the families themselves, ONE account, and only what a family-creation
-- trigger seeds. Empties every ledger, event, election, chat, invitation and
-- document, and deletes every other account along with its member rows.
--
-- Between this and its neighbours:
--   delete_user.sql              one user, their content anonymized
--   delete_user_hard_purge.sql   one user, their content destroyed
--   delete_all_users.sql         every user; family CONFIG rows survive
--   truncate_entire_database.sql everything, families included
--   reset_families.sql (this)    families and one account survive, as if new
--
-- USAGE
--   npx supabase db query --linked -f supabase/scripts/reset_families.sql
--
--   psql works too if you have a connection string, but the CLI is what this
--   was written and run against. Unlike `db push`, `db query` does not prompt,
--   so it needs no stdin redirect from a non-TTY.
--
-- SET THE ACCOUNT TO KEEP at the top of the block below. It must exist, or the
-- script aborts rather than deleting every user in the project.
--
-- ----------------------------------------------------------------------------
-- WHAT "JUST CREATED" MEANS HERE — taken from the triggers on `families`, not
-- from a guess. A newly inserted family gets exactly two things:
--
--   families_seed_permission_templates -> permission_templates,
--                                         template_permissions,
--                                         resource_visibility
--   families_seed_system_funds         -> funds WHERE system_key IS NOT NULL
--                                         (the 'donations' fund)
--
-- Both are therefore KEPT, and so is the one account named below, along with
-- its people row in each family. Everything else is user data and goes. If a
-- later migration seeds something new on family creation, it belongs in that
-- list and in the assertions at the end — this script is only as correct as
-- that inventory.
--
-- Note what is NOT restored: a permission grid an administrator has since
-- edited stays edited. The templates are kept as they are rather than dropped
-- and re-seeded, because people.permission_template_id is ON DELETE RESTRICT
-- and the kept account is an administrator through it — re-seeding means
-- detaching every member from their template first, and getting that wrong
-- locks the last administrator out of the family. Wipe the data here; reset a
-- grid from Members & Access, where the screen shows what changed.
--
-- TWO TRIGGERS HAVE TO BE STOOD DOWN, AND ONLY TWO
--   dues_payments and fund_disbursements are append-only ledgers
--   (20260806000002). Their DELETE guards permit exactly one case: the parent
--   person or fund is already gone, i.e. an RI cascade. The kept account's
--   people rows survive this script by design, so its ledger rows are not
--   reachable by any cascade and the guard refuses them. Disabling the two
--   guards for the duration is the deliberate act the migration intends such a
--   thing to be.
--
--   funds_protect_system is NOT disabled. Nothing here deletes a system fund —
--   `WHERE system_key IS NULL` is what keeps the built-in Donations fund, and
--   leaving its guard armed is what proves that rather than asserting it.
--
--   session_replication_role = 'replica' would have been the one-liner and is
--   wrong: it stands down referential-integrity triggers too, so the cascades
--   this script relies on would silently not fire and the deletes would leave
--   dangling references behind.
--
-- WHY A DO BLOCK AND NOT BEGIN/COMMIT: this runs through the Management API,
-- whose transaction wrapping is not something to take on trust for a
-- destructive script. A plpgsql block is atomic by construction, DDL included
-- — any exception rolls back every statement here, the two ALTER TABLEs among
-- them, so a failure cannot leave a ledger guard switched off. That is not
-- theoretical: the first run of this script aborted on the dues_payments guard
-- with all 8 payments still in place, and both guards came back armed.
--
-- WHY people IS DELETED EXPLICITLY: people.user_id is ON DELETE SET NULL, not
-- CASCADE. Deleting auth.users alone leaves the member row behind with a NULL
-- user_id — a family member nobody can log in as, which is exactly the state
-- this script exists to remove. delete_all_users.sql gets the same thing right
-- by deleting people first; its comment claiming the rows cascade does not.
-- ============================================================================

DO $$
DECLARE
  -- ── THE ONE ACCOUNT THAT SURVIVES ─────────────────────────────────────────
  v_keep_email CONSTANT text := 'charlesclaj@gmail.com';

  v_keep  uuid;
  v_funds int;
  v_armed int;
  v_orphan int;
  v_leftover text;
BEGIN
  SELECT id INTO v_keep FROM auth.users WHERE email = v_keep_email;
  IF v_keep IS NULL THEN
    RAISE EXCEPTION 'ABORT: % not found — refusing to delete every user', v_keep_email;
  END IF;

  ALTER TABLE dues_payments      DISABLE TRIGGER dues_payments_immutable;
  ALTER TABLE fund_disbursements DISABLE TRIGGER fund_disbursements_immutable;

  -- ── 1. Elections ──────────────────────────────────────────────────────────
  DELETE FROM election_votes;
  DELETE FROM election_nominations;
  DELETE FROM election_positions;
  DELETE FROM elections;

  -- ── 2. Photos and documents ───────────────────────────────────────────────
  DELETE FROM photo_tags;
  DELETE FROM photos;
  DELETE FROM photo_collections;
  DELETE FROM event_photos;
  DELETE FROM documents;

  -- ── 3. Events, and everything hanging off one ─────────────────────────────
  DELETE FROM event_rsvp_attendees;
  DELETE FROM event_rsvp;
  DELETE FROM event_expenses;
  DELETE FROM event_budget_items;
  DELETE FROM event_assignments;
  DELETE FROM event_hotel_price_estimates;
  DELETE FROM event_hotel_booking_details;
  DELETE FROM event_hotel_bookings;
  DELETE FROM events;
  DELETE FROM event_type_sub_templates;
  DELETE FROM event_blueprint_items;
  DELETE FROM event_types;

  -- ── 4. Fund ledgers, then the non-system funds ────────────────────────────
  -- Contributions first: fund_contributions.dues_payment_id is ON DELETE
  -- CASCADE, so a dues payment deleted in §5 would take a contribution with it
  -- either way — doing it here keeps the order readable rather than implicit.
  DELETE FROM fund_contributions;
  DELETE FROM fund_disbursements;
  DELETE FROM fund_allocations;
  DELETE FROM fund_milestones;
  DELETE FROM funds WHERE system_key IS NULL;

  -- ── 5. Dues ───────────────────────────────────────────────────────────────
  -- donation_beneficiaries (20260811000000) is ON DELETE CASCADE from both
  -- people and dues_schedules, so it would empty either way. Named anyway: a
  -- table this script does not mention is a table nobody notices it missed,
  -- and §11 exists because that is not a risk worth carrying twice.
  DELETE FROM donation_beneficiaries;
  DELETE FROM dues_payments;
  DELETE FROM dues_member_plans;
  DELETE FROM dues_schedules;

  -- ── 6. Chat ───────────────────────────────────────────────────────────────
  DELETE FROM chat_messages;
  DELETE FROM chat_participants;
  DELETE FROM chat_rooms;

  -- ── 7. Everything else family-scoped ──────────────────────────────────────
  DELETE FROM announcements;
  DELETE FROM notifications;
  DELETE FROM family_invitations;
  DELETE FROM person_relationships;
  DELETE FROM family_role_exclusions;
  DELETE FROM family_roles;
  DELETE FROM user_roles;
  DELETE FROM chapters;
  DELETE FROM regions;
  DELETE FROM adults;   -- pre-redesign legacy tables
  DELETE FROM kids;

  -- ── 8. Members: keep only the surviving account's rows ────────────────────
  -- IS DISTINCT FROM so a NULL user_id (an orphan member row) is caught too.
  DELETE FROM people WHERE user_id IS DISTINCT FROM v_keep;

  -- ── 9. The other auth accounts ────────────────────────────────────────────
  -- Every public FK to auth.users that is NO ACTION (chapters, chat_rooms,
  -- events, event_*, regions, user_roles) was emptied above, so nothing here
  -- can hit a constraint. GoTrue's own children (identities, sessions,
  -- refresh_tokens, mfa factors) cascade.
  DELETE FROM auth.users WHERE id <> v_keep;

  ALTER TABLE dues_payments      ENABLE TRIGGER dues_payments_immutable;
  ALTER TABLE fund_disbursements ENABLE TRIGGER fund_disbursements_immutable;

  -- ── 10. Assert the end state before committing ────────────────────────────
  -- Checked here rather than in a follow-up query, so a wrong answer rolls the
  -- whole thing back instead of being reported after the fact.

  -- One system fund per family, and no others.
  SELECT count(*) INTO v_funds FROM funds;
  IF v_funds <> (SELECT count(*) FROM families) THEN
    RAISE EXCEPTION 'ROLLBACK: % funds left for % families — expected one system fund each',
      v_funds, (SELECT count(*) FROM families);
  END IF;

  -- Both ledger guards armed again.
  SELECT count(*) INTO v_armed FROM pg_trigger
   WHERE tgname IN ('dues_payments_immutable', 'fund_disbursements_immutable')
     AND tgenabled <> 'D';
  IF v_armed <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK: % of 2 ledger guards re-armed', v_armed;
  END IF;

  -- Every surviving member is the kept account, approved, on a real template.
  -- The point of §8, restated as a check: a people row with a NULL user_id is
  -- the failure this script exists to avoid, and it is invisible on the page.
  SELECT count(*) INTO v_orphan FROM people
   WHERE user_id IS DISTINCT FROM v_keep
      OR membership_status <> 'approved'
      OR permission_template_id IS NULL;
  IF v_orphan > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % people row(s) are orphaned, unapproved or template-less', v_orphan;
  END IF;

  -- EVERY FAMILY STILL HAS A MEMBER. The one invariant the assertions above
  -- cannot express, and the only one that catches this script being run against
  -- a database that has moved on since somebody read it.
  --
  -- Deleting accounts is the whole job here, so nothing in §9 can tell a stale
  -- account from a new one — but a family created by an account this script then
  -- deletes is left with no members and, because families.created_by is ON DELETE
  -- SET NULL, no founder either. It is not merely empty: it is unreachable, since
  -- every page resolves the caller through a people row, and no one can be added
  -- to it because no one can administer it. There is no route back to it from the
  -- application at all.
  --
  -- Not theoretical, and the reason this check exists: a second, supposedly
  -- no-op run of this script deleted an account that had registered four hours
  -- earlier and created a family of its own, leaving exactly that wreck behind.
  -- With this assertion the run aborts and the new account survives.
  SELECT count(*) INTO v_orphan FROM families f
   WHERE NOT EXISTS (SELECT 1 FROM people p WHERE p.family_code = f.family_code);
  IF v_orphan > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % family/families would be left with no members — a family created by '
      'an account this script deletes is unreachable afterwards. Re-read the database '
      'before running this again.', v_orphan;
  END IF;

  -- ── 11. NOTHING ELSE HOLDS ROWS ───────────────────────────────────────────
  -- The deletes above are a hand-written list, and a hand-written list of
  -- tables goes stale the moment a migration adds one. donation_beneficiaries
  -- (20260811000000) landed between this script being written and being run;
  -- it happened to be empty and to cascade from two tables that are emptied
  -- anyway, so it cost nothing — the next one will not be so kind.
  --
  -- So the end state is asserted against the catalogue rather than the list:
  -- every base table in public must be empty except the ones named here, which
  -- are the only rows a just-created family (and the account that survives)
  -- legitimately has. A new table therefore fails this run loudly, and the fix
  -- is to classify it — add a DELETE above, or add it to this list — rather
  -- than to discover months later that a ledger was never cleared.
  --
  -- Same reasoning as truncate_entire_database.sql being dynamic on purpose;
  -- this script cannot be dynamic in its deletes, because it keeps things, so
  -- it is dynamic in its check instead.
  SELECT string_agg(t.table_name || '(' ||
           (xpath('/row/c/text()', query_to_xml(
              format('select count(*) as c from public.%I', t.table_name),
              false, true, '')))[1]::text || ')', ', ' ORDER BY t.table_name)
    INTO v_leftover
    FROM information_schema.tables t
   WHERE t.table_schema = 'public'
     AND t.table_type = 'BASE TABLE'
     AND t.table_name NOT IN (
           -- Seeded per family by the two `families` triggers, plus the
           -- surviving account's own rows.
           'families', 'people', 'funds',
           'permission_templates', 'template_permissions', 'resource_visibility',
           -- Global configuration, not family data.
           'permission_resources', 'permission_table_map', 'relationship_types',
           -- The kept account's active-family pointer.
           'user_family_settings')
     AND (xpath('/row/c/text()', query_to_xml(
            format('select count(*) as c from public.%I', t.table_name),
            false, true, '')))[1]::text::bigint > 0;

  IF v_leftover IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: table(s) still hold rows after the reset: %. A migration has '
      'added a table this script does not delete from — add a DELETE for it, or '
      'add it to the keep-list in §11 if it is seeded or global config.', v_leftover;
  END IF;

  RAISE NOTICE 'reset complete; kept % and % system funds', v_keep_email, v_funds;
END $$;
