-- ============================================================================
-- reset_families.sql — Return every family to its just-created state.
-- ----------------------------------------------------------------------------
-- *** DESTRUCTIVE — NO RECOVERY. Take a dump first if the data matters. ***
--
-- Keeps the families themselves, ONE account, and only what a family-creation
-- trigger seeds. Empties every ledger, gathering, election, chat, invitation and
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
  DELETE FROM documents;

  -- ── 3. Events: THIRTEEN DELETES WERE HERE AND THE TABLES ARE DROPPED ──────
  -- `20260819000006` dropped the whole Events product. This section listed every
  -- one of its tables, child before parent; a `DELETE FROM` a table that does not
  -- exist aborts the script, and this script is one atomic DO block — so leaving
  -- them would have made the purge roll itself back forever, which is exactly the
  -- failure AGENTS.md records `truncate_entire_database.sql` §6b having.
  --
  -- The Gatherings section below is what replaced it.

  -- ── 3b. Gatherings ────────────────────────────────────────────────────────
  -- IT REPLACED EVENTS (20260819000006) and it is not a part of it: a
  -- family authors a `gathering_templates` row and its steps, schedules a
  -- `gatherings` row from one or more of them, every step becomes a
  -- `gathering_tasks` row handed to a named relative, and each answer is a
  -- `gathering_task_submissions` row. All six are family data and all six go.
  -- Nothing here is seeded by a `families` trigger, so none of them belongs in the
  -- inventory at the top or in §11's keep-list.
  --
  -- THIS BLOCK MUST STAY ABOVE §4, AND THAT IS MEASURED RATHER THAN TIDY.
  -- `gatherings.fund_id` is ON DELETE SET NULL, and `gatherings_budget_needs_fund`
  -- (a CHECK: a budget may not exist without a fund behind it) is enforced on the
  -- ordinary UPDATE the internal RI trigger performs — so for any family that has
  -- a budget set on a gathering drawing on a non-system fund, §4's
  -- `DELETE FROM funds WHERE system_key IS NULL` is REFUSED with a 23514 naming a
  -- constraint on a table §4 does not mention. Reproduced on this Postgres before
  -- this block was written. Move these six lines below §4 and the script aborts on
  -- exactly the families that have used the feature, with an error nothing in §4
  -- explains.
  --
  -- CHILDREN BEFORE PARENTS, and `gathering_template_uses` before
  -- `gathering_templates` specifically: that foreign key is NO ACTION, which is the
  -- whole reason a template a gathering was built from cannot be deleted at all
  -- (the product offers archiving instead of a bare 23503). Every other reference
  -- among the six is CASCADE or SET NULL, so the three parent deletes would clear
  -- most of this on their own — naming all six is what makes an omission visible
  -- when a seventh table arrives, which is the same reason §5 names
  -- donation_beneficiaries.
  DELETE FROM gathering_task_submissions;
  DELETE FROM gathering_tasks;
  DELETE FROM gathering_template_uses;
  DELETE FROM gatherings;
  DELETE FROM gathering_template_steps;
  DELETE FROM gathering_templates;

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

  -- ── 6b. The Library, and the record of what the family decided ────────────
  --
  -- ELEVEN TABLES ADDED 2026-08-22, AND NINE OF THEM WERE OWED BEFORE THIS COMMIT. That is
  -- the point of writing this block out rather than appending two lines: Meeting Minutes
  -- (20260822000019), Officer Notes (20260821000005, 20260822000001) and Bylaws
  -- (20260822000020) all shipped without a DELETE here, so §11's dynamic check found rows in
  -- tables nothing had emptied and RAISEd — **which rolls the whole script back.** This
  -- script has therefore been unrunnable against any database holding minutes, officer notes
  -- or bylaws, in exactly the way the `adults`/`kids` note further down records for an
  -- earlier era. §11 did its job; nobody had run it.
  --
  -- THE ORDER IS BY WHICH PARENT CASCADES WHAT, never by habit — the rule the deleted
  -- `event_*` block left behind. Two of these are not obvious:
  --
  --   `meeting_votes` IS ABSENT AND MUST STAY ABSENT. `meeting_votes_are_final` refuses a
  --   direct DELETE for EVERY role, including this one, and admits it only at
  --   `pg_trigger_depth() > 1` — i.e. inside a cascade. So the only way a vote row goes is
  --   the cascade from `meeting_topics` below, and a line for it would abort the script with
  --   a 42501 rather than a missing row. (`tests/rls/seed.mjs` omits it for the same reason
  --   and says so.)
  --
  --   `position_journal_entries` COMES BEFORE `family_roles` in §7. Its `role_id` cascades
  --   from that table, so listed after it these rows would already be gone — and the day
  --   somebody makes that foreign key SET NULL, the entries would survive with nothing here
  --   removing them and §11 would start failing again.
  DELETE FROM meeting_topic_notes;
  DELETE FROM meeting_topics;
  DELETE FROM meeting_attendees;
  DELETE FROM meeting_sessions;
  DELETE FROM position_journal_notes;
  DELETE FROM position_journal_entries;
  DELETE FROM bylaws;

  -- ── 6c. Email distributions ───────────────────────────────────────────────
  -- Child first. `distribution_recipients` does cascade from `distributions`, so the second
  -- line alone would clear it today; both are written because the row also references
  -- `people`, which §8 empties, and a table left to a cascade is one that starts leaving
  -- rows behind the day somebody changes a foreign key to SET NULL.
  --
  -- NEITHER IS KEPT. A distribution is a record of mail the family sent, so it is family
  -- data by every test in this script — and unlike a dues payment there is nothing
  -- append-only about it: `20260822000025` writes no trigger refusing a DELETE.
  DELETE FROM distribution_recipients;
  DELETE FROM distributions;

  -- ── 6d. Safety check-ins ──────────────────────────────────────────────────
  -- Child first, for §6c's reason exactly: `safety_check_in_people` cascades from
  -- `safety_check_ins`, and both lines are written because the child also references
  -- `people`, which §8 empties.
  --
  -- NEITHER IS KEPT, and on this one the argument is worth stating rather than assumed.
  -- A completed check-in is the family's record of an emergency — who was asked, who
  -- answered, who nobody could reach — so it is family data by every test in this script.
  -- It is ALSO the sharpest contact-data surface in the product (a roster of relatives
  -- with their whereabouts and their reachability), which if anything argues harder for
  -- deleting it than for keeping it: a reset that left one behind would leave that list in
  -- a database somebody had asked to be emptied.
  DELETE FROM safety_check_in_people;
  DELETE FROM safety_check_ins;

  -- ── 6e. Text-message settings ─────────────────────────────────────────────
  -- The number and any outstanding challenge go. Both are settings a member can re-establish
  -- in a minute, and a phone number is not something a reset should leave lying about.
  DELETE FROM phone_verifications;
  DELETE FROM person_sms;
  --
  -- `sms_consent_events` IS DELIBERATELY NOT DELETED HERE, and it is on §11's keep-list. Two
  -- reasons, and the first one makes the second unavoidable:
  --
  --   IT CANNOT BE. `sms_consent_events_are_final` (20260823000002) refuses a direct DELETE for
  --   every role INCLUDING `service_role`, allowing one only inside a cascade
  --   (`pg_trigger_depth() > 1`). A line here would abort this whole DO block, permanently.
  --
  --   AND IT SHOULD NOT BE. It is the record of when somebody agreed to be texted and how — the
  --   thing that would be produced in answer to a TCPA complaint. A record that a maintenance
  --   script can erase is not one. §8's `people` delete cascades it away for every member this
  --   script removes; what survives belongs to the ONE account it keeps, alongside that
  --   account's own profile row.
  --
  -- So the rows for everybody else go with their `people` row, and the survivor keeps their own.

  -- ── 7. Everything else family-scoped ──────────────────────────────────────
  DELETE FROM announcements;
  DELETE FROM notifications;
  DELETE FROM family_invitations;
  DELETE FROM person_relationships;
  -- ADDED 2026-08-22, and it was the LAST table §11 was reporting once §6b and §6c landed.
  -- `family_removal_challenges` (20260817000006) is keyed on `family_code` with no foreign key
  -- to `families`, and its `requested_by` is ON DELETE SET NULL — so nothing above removes it
  -- and nothing ever would have. `tests/rls/seed.mjs` lists it in its own reset sweep with the
  -- same observation, which is where the shape was borrowed from.
  --
  -- DELETED RATHER THAN KEPT, and it is not a close call: a row here is a 15-minute one-shot
  -- hash for a removal somebody started before the reset. Keeping it would leave a live
  -- challenge against a family whose members have just been deleted.
  DELETE FROM family_removal_challenges;
  -- `family_role_exclusions` WAS DELETED HERE and the table is gone: it recorded
  -- which of the 25 built-in board positions a family did not use, and
  -- 20260819000004 retired the built-ins along with the table.
  -- THE WHOLE TABLE, since 20260819000004.
  --
  -- `family_code` is NOT NULL now and every row belongs to one family, so the product
  -- decision inverts with the schema: A RESET FAMILY ARRIVES WITH NO BOARD POSITIONS AT
  -- ALL, which is what "just created" means for a real family now. It configures the
  -- offices it actually keeps under /admin/boardpositions.
  --
  -- IT WAS `WHERE family_code IS NOT NULL` FOR TWO DAYS, and the paragraph that stood here
  -- explained why: `family_roles` was a hybrid, its 25 built-in board positions were GLOBAL
  -- (`family_code IS NULL`, `is_global`), deleting the lot emptied a global lookup only a
  -- migration could restore, and §11's keep-list named the table for that reason. Every
  -- clause of that is now false — the built-ins are retired, `is_global` is dropped, and
  -- this same commit removed the keep-list entry — so it is replaced rather than left
  -- standing above a statement that says the opposite.
  DELETE FROM family_roles;
  DELETE FROM user_roles;
  -- `adults` AND `kids` WERE DELETED HERE AND COULD NOT BE, which is why this whole script
  -- has been unrunnable rather than merely stale. 20260602000003 dropped both tables;
  -- plpgsql resolves a name when the statement RUNS, so the DO block reached this line and
  -- raised 42P01, rolling back every DELETE above it. Nothing reported it because nothing
  -- runs this script on a schedule — and 20260819000003, which deletes the `adults` row
  -- from `permission_table_map`, asserts the table's absence as its own premise. Found
  -- 2026-08-19 by review.

  -- ── 8. Members: keep only the surviving account's rows ────────────────────
  -- IS DISTINCT FROM so a NULL user_id (an orphan member row) is caught too.
  DELETE FROM people WHERE user_id IS DISTINCT FROM v_keep;

  -- ── 8b. The family's geography, AFTER the members who point at it ─────────
  --
  -- THESE TWO WERE ABOVE §8 AND COULD NOT RUN THERE. `people.chapter_id` REFERENCES
  -- `chapters(id)` with no ON DELETE action at all, so `DELETE FROM chapters` while any
  -- member row still names a chapter raises 23503 and rolls the whole script back:
  --
  --   ERROR: update or delete on table "chapters" violates foreign key constraint
  --          "people_chapter_id_fkey" on table "people"
  --
  -- Measured 2026-08-22 against the local stack, and it is the SECOND reason this script was
  -- unrunnable — the first being the nine missing tables in §6b. Both were found the same way
  -- the `adults`/`kids` note above records: by running it, which nothing does on a schedule.
  --
  -- MOVING THEM IS NOT ENOUGH ON ITS OWN, because the KEPT account's own `people` row
  -- survives §8 and may itself name a chapter. So the pointer is cleared first. That is a
  -- correct reset rather than a workaround: a just-created family has no chapters, so nobody
  -- in it can be in one — the same reasoning that puts `family_roles` on §7 rather than in
  -- the keep-list.
  --
  -- NOTHING ELSE POINTS HERE BY THIS LINE. `user_roles` (chapter_id, region_id) is emptied in
  -- §7 above; `dues_schedules` in §5; `distributions` in §6c — and that one is ON DELETE SET
  -- NULL anyway, so it would not have blocked. The order below is child before parent:
  -- `chapters.region_id` REFERENCES `regions`.
  UPDATE people SET chapter_id = NULL WHERE chapter_id IS NOT NULL;
  DELETE FROM chapters;
  DELETE FROM regions;

  -- ── 8b. Marketing attribution and the conversion send ledger ──────────────
  -- 20260823000000. Both are cleared OUTRIGHT rather than kept, and neither is on §11's
  -- keep-list, because neither is seeded or global configuration: they accumulate from real
  -- visits and real conversion sends.
  --
  -- The cascade from §9 below would take most of `marketing_attribution` anyway, and that is
  -- precisely why the DELETE is here and explicit — it would leave the KEPT account's own
  -- row behind, and `marketing_conversion_events.user_id` is ON DELETE SET NULL, so every
  -- row of that table would survive the account purge entirely and trip §11.
  --
  -- Clearing the ledger is also the CORRECT reset rather than a tidy-up: its rows say "this
  -- conversion has already been reported to Meta", and after a reset the accounts and
  -- families those events described no longer exist.
  DELETE FROM marketing_conversion_events;
  DELETE FROM marketing_attribution;

  -- ── 9. The other auth accounts ────────────────────────────────────────────
  -- Every public FK to auth.users that is NO ACTION (chapters, chat_rooms,
  -- regions, user_roles) was emptied above, so nothing here can hit a
  -- constraint. `events` and `event_*` were on that list until 20260819000006
  -- dropped them. GoTrue's own children (identities, sessions,
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
           --
           -- `family_roles` WAS ON THIS LIST between 2026-08-17 and 2026-08-19 and
           -- is not any more, and the reason it needed explaining is the reason to
           -- keep the paragraph: it was a HYBRID, kept for its 25 global board
           -- positions (`family_code IS NULL`) while §7 deleted its per-family
           -- rows. That is why it went unnoticed for so long — every "is this a
           -- global lookup?" test asks whether the table has a `family_code`
           -- column, and that one did. 20260819000004 retired the built-ins, so it
           -- is ordinary family data that §7 now deletes outright, and a leftover
           -- row in it is something this section SHOULD report.
           'permission_resources', 'permission_table_map', 'relationship_types',
           -- The kept account's active-family pointer.
           'user_family_settings',
           -- AND THE KEPT ACCOUNT'S OWN CONSENT RECORD. On this list rather than in §6e for two
           -- reasons: `sms_consent_events_are_final` (20260823000002) refuses a direct DELETE for
           -- every role including `service_role`, so it CANNOT be deleted here; and it should not
           -- be, because it is the record of when somebody agreed to be texted and how. Every
           -- other member's rows go with their `people` row in §8, which is a cascade and is what
           -- that trigger allows.
           'sms_consent_events')
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
