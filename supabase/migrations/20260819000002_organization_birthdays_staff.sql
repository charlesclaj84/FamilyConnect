-- ============================================================================
-- ONE RELEASE, THREE UNRELATED CHANGES: Organization, Birthdays, and who may grant
-- staff access.
--
-- ── WHY THEY SHARE A FILE, SAID PLAINLY ─────────────────────────────────────
-- They have nothing to do with each other. They are here together because they ship
-- together, and splitting them would be three files whose only distinguishing feature is
-- the timestamp — three versions to reason about in `supabase_migrations.schema_migrations`,
-- three chances for one of them to be applied and the others not, and three headers
-- repeating the same "how this reaches a database" paragraph. The sections are NUMBERED so
-- a reader looking for one of them can find it, and each carries its own argument in full:
--
--   §A  `/admin/chapters` stops being a rail item of its own and becomes the ORGANIZATION
--       pane of Members & Access. Label, sub-section and sort order — AND NOT THE KEY.
--   §B  `announcements/birthdays` is registered: the second pane of /announcements, which
--       lists every approved relative whose birthday falls in the next sixty days.
--   §C  every `genorra_staff` row that exists becomes `'owner'`, because the staff console
--       is about to start READING that column and today it reads nothing.
--
-- ============================================================================
-- §A — `admin/chapters` BECOMES "ORGANIZATION", AND THE KEY MUST NOT CHANGE
-- ============================================================================
-- Regions & Chapters was its own item in the admin rail. It is now a PANE of
-- `/admin/users` (Members & Access) captioned **Organization**, beside the members table,
-- the pending-approval queue and the permission templates — which is where a family
-- actually goes to arrange who is who. `/admin/chapters` stays a `FEATURES` entry and
-- becomes a redirect, so old links keep working and `viewableResources()` still has a nav
-- answer for a member whose only grant is this one.
--
-- The grid caption IS the rail caption (AGENTS.md, "One rail item, one permission
-- resource"), so this file moves three columns on one row: `label` → 'Organization',
-- `subsection` → 'Members', `sort_order` → 167, one past `admin/users/templates`.
--
-- WHICH MEANS THIS FILE ALONE MAKES THE CAPTIONS DISAGREE, and the other half is named here
-- the way 20260817000006 names the TypeScript it depends on. This migration reaches hosted from
-- CI on merge to master; the screens are a separate phase's files, so if that phase slips, the
-- grid says "Organization" while four surfaces still say "Regions & Chapters" and nothing
-- anywhere reports it — which is precisely the Dues Schedules/Dues mismatch AGENTS.md's
-- "Captions come from the screen" rule was written about. Owed by the same commit:
--
--     components/layout/Sidebar.tsx      remove the `/admin/chapters` item from `adminItems`
--     lib/features.ts                    label → 'Organization'; add 'admin/chapters' to
--                                        TAB_RESOURCES; the route becomes a redirect to
--                                        /admin/users?tab=organization
--     app/(protected)/admin/chapters/    the h1 and the metadata, or the redirect replacing them
--     lib/help/content.ts                the chapter title and its prose
--
-- IF THIS FILE HAS TO MERGE FIRST, revert 20260618000000's seed edit with it — that insert is
-- `ON CONFLICT DO UPDATE SET label, category, sort_order`, so the pair have to move together or
-- a `db reset` and hosted will disagree about the caption in the other direction.
--
-- ── AND NOTHING ELSE. THE KEY STAYS `admin/chapters` ────────────────────────
-- THIS IS THE DECISION A LATER READER WILL TRY TO "FIX", so the whole argument is here
-- rather than in a commit message. The instinct is sound and the conclusion is wrong: a
-- pane of `/admin/users` "should" be keyed `admin/users/organization`, the way
-- `admin/users/templates` is, and AGENTS.md §1 does say the resource key is the route
-- without its leading slash. But §1 is a rule about ROUTES. A pane takes a sub-key BY
-- CONVENTION, not by law — and `20260815000000` is the REVERSE direction (three panes that
-- grew routes, so their keys had to move to match) rather than a precedent for this one.
--
-- What makes re-keying expensive here, and different from every other rename in this
-- chain, is that THIS KEY IS EVALUATED BY LIVE RLS POLICIES:
--
--   * `permission_table_map` maps BOTH `regions` AND `chapters` onto `admin/chapters`
--     (20260618000001 §…, the two rows next to each other), and that migration COMPOSED
--     the policies on those tables out of those rows. So what actually protects them is a
--     string that exists in no file anybody reviewed:
--         perm:family members can read chapters   ON public.chapters
--         perm:family members can read regions    ON public.regions
--     Both read `auth_permission('admin/chapters'::text, 'view')`. §D asserts they are
--     still there, by count, for exactly this reason.
--
--   * A RENAME IS NECESSARILY DELETE-AND-INSERT. `template_permissions.resource_key`,
--     `resource_visibility.resource_key` and `permission_table_map.resource_key` are all
--     foreign keys to `permission_resources(key)` with `ON DELETE CASCADE` and no
--     `ON UPDATE` clause — so `UPDATE … SET key = …` is REFUSED while any grant exists,
--     and the only way through is a delete that cascades every grant, every visibility row
--     and both map rows away.
--
--   * AND THEN THE POLICIES NAME A KEY THE CATALOGUE DOES NOT. `auth_permission()` finds no
--     template row, so it answers from a DEFAULT — and which default depends on the shape
--     of the name somebody chose, which is the part that makes this quietly dangerous
--     rather than loudly broken:
--       – renamed to something still shaped `admin/…` (`admin/users/organization`): since
--         20260817000004 an unregistered `admin/…` key resolves view to **'none'**. Every
--         grant is gone too, so `regions` and `chapters` become unreadable to EVERYBODY,
--         administrators included — and PostgREST does not error, it returns no rows. The
--         Organization pane renders empty, `getDuesScopeOptions()` offers National alone,
--         and a schedule scoped to a region prints a blank region name. Silent, in the one
--         direction AGENTS.md §8 is entirely about.
--       – renamed to anything NOT shaped `admin/…` (`organization`, `members/regions`):
--         the same fall-through answers 'everyone', so view resolves **'any'** for every
--         approved member of every family and two tables quietly OPEN.
--     One defect, two costumes. Whichever way it lands, it lands without an error.
--
-- So a re-key means the `pg_policies` TEXT SURGERY of `20260807000000:328-383` —
-- enumerate every live policy naming the old string, `DROP` and re-`CREATE` each with the
-- new one, BEFORE the resource row moves — plus carrying every family's grants across, as
-- `20260815000000` does for its three panes. That is a real migration with a real risk, and
-- it buys a tidier key. Not this file's business, and the file says so in a
-- `COMMENT ON`-shaped place: the assertions in §D are what hold the decision in place.
--
-- THE ROUTE AND THE KEY ARE ALLOWED TO DISAGREE, and there is a precedent in the tree:
-- `account-summary/funds` is a sub-key with no route at all, and `gatherings/budget` gates
-- a band on two screens. A key names a CAPABILITY a family delegates. This one delegates
-- "may arrange the family's regions and chapters", which is exactly as true on a pane as it
-- was on a page.
--
-- ── AND ONE RESOLVER READS THE ROUTE *OUT OF* THE KEY. THAT IS THE TIER ───────
-- THIS IS THE HALF THE ARGUMENT ABOVE DOES NOT COVER, AND IT IS THE ONE THAT COSTS MONEY.
-- Keeping the key is right; keeping the key and doing nothing else is not, because
-- `requireTier(userId, resource)` in lib/auth/permissions.ts derives the plan from the KEY:
--
--     const route = `/${resource}`        -- '/admin/chapters'
--     const need  = requiredTier(route)   -- 'plus', per lib/features.ts
--
-- Regions & Chapters is a PLUS feature. /pricing sells "Split a large family into chapters
-- with their own leadership" on the Plus card and /features prints the same, and
-- lib/features.ts says in terms that shipping it Free "would leave a paid bullet describing a
-- free feature". While it was its own PAGE, `requireView('admin/chapters')` folded
-- `requireTier` in and a Free family was redirected to /upgrade. That is the whole enforcement
-- and it lived in the page guard.
--
-- `/admin/users` IS `tier: 'free'`, AND ITS PAGE RESOLVES EACH PANE WITH `can()` ALONE. So the
-- Organization pane inherits NO tier check by existing there, and
-- `seed_family_permission_templates()` already grants the system Administrators template every
-- action on every `admin/` key regardless of plan — which means a Free family's administrator
-- ALREADY HOLDS `admin/chapters: view/create/edit/delete = any` today. Ship the pane on the
-- grant alone and every Free family gets region and chapter CRUD.
--
-- AND IT WOULD BE INVISIBLE, WHICH IS WHAT MAKES IT WORSE THAN A SIMPLE MISTAKE.
-- `getResources()` tier-filters the grid, so a Free family would see NO Organization switch on
-- Members & Access while using the pane — a capability nobody sold, nobody can restrict, and
-- nothing on any screen reports.
--
-- THIS FILE CANNOT CLOSE IT AND MUST NOT TRY. No RLS policy consults `families.tier` and none
-- may start to: a family that lapses to Free keeps every record it ever entered and loses only
-- the pages that read them, which is why there is no `auth_family_tier()` to match
-- `auth_family_code()`. The tier is an app-layer gate, so the fix is app-layer, and it is
-- OWED BY THE COMMIT THAT LANDS THE PANE:
--
--     app/(protected)/admin/users/page.tsx  — resolve the Organization tab on the PLAN as well
--     as the grant, `tierMeets(await getMyFamilyTier(user.id), requiredTier('/admin/chapters'))`
--     beside `can(user.id, 'admin/chapters', 'view')`, and SKIP the regions/chapters fetch when
--     it is false (§5: not fetched, rather than fetched and hidden).
--
-- A page gets this folded in and a PANE has to ask. That asymmetry is not a wart in
-- `requireTier` — it is what "the two gates live in different places" means: `status` is a fact
-- about the build and is decided at the edge with no session, `tier` is a fact about the FAMILY
-- and is decided in the page guard where a round trip is already being made. A pane below a
-- Free page is simply outside the one guard that asks.
--
-- The alternative AGENTS.md names for "a tier boundary running THROUGH a page" is a sub-key with
-- its own `FEATURES` entry and its own `tier: 'plus'`. It was considered and rejected here for
-- this file's whole argument: a sub-key means a NEW key, and a new key beside this one means
-- deciding which of them the two composed RLS policies evaluate — which is the text surgery this
-- section exists to avoid. One line in a page guard against `pg_policies` surgery is not a close
-- call.
--
-- ── WHAT §A DOES NOT TOUCH ─────────────────────────────────────────────────
-- `actions` (still all four — the pane creates, edits and deletes regions and chapters),
-- `category` (still `admin`, which is what keeps the fail-closed default and what
-- 20260817000004's invariant is about), the two `permission_table_map` rows, the two
-- policies, every family's `resource_visibility` row and every grant. A plain `UPDATE`
-- naming three columns is used rather than an `INSERT … ON CONFLICT DO UPDATE`, and that
-- is deliberate: an upsert would have to name the key in its VALUES list, which is the one
-- thing this section is about not doing, and it could CREATE the row on a database where
-- 20260618000000's seed has not run. §D asserts the row is there with its actions intact,
-- which is what catches the UPDATE having matched nothing.
--
-- ============================================================================
-- §B — `announcements/birthdays`, THE SECOND PANE OF /announcements
-- ============================================================================
-- `/announcements` gains a `MainRail` with two panes: **General**, today's board, keyed on
-- the existing `announcements` resource; and **Birthdays**, every approved person in the
-- family whose next birthday falls within sixty days, soonest first.
--
-- One rail item, one permission resource. So:
--
--   announcements/birthdays   community  'Announcements'  61  ARRAY['view']  everyone
--
-- ── `view` AND NOTHING ELSE ────────────────────────────────────────────────
-- Nothing writes a birthday. The pane is derived from `people.date_of_birth` by
-- `lib/birthdays.ts`, and the birthday itself is edited where it always was — on a
-- member's own profile, under the rules `people` already has. A `create`, `edit` or
-- `delete` switch here would be a control an administrator can move that nothing consults,
-- which AGENTS.md is explicit about and which 20260808000000 §6 spent a section removing
-- from `transactions` and `account-summary`. Before adding one, name the policy, the
-- `permission_table_map` row or the `can*()` call that will read it.
--
-- ── IT GATES A PANE AND NO TABLE ───────────────────────────────────────────
-- No `permission_table_map` row, and §D asserts the absence rather than describing it
-- (20260819000000 §8i's move). The roster it reads is `people`, which is governed by
-- `members` and always has been — so this key decides whether the pane is FETCHED, exactly
-- the standing `account-summary/funds` has: "the sub-key is an app-layer gate on whether
-- the section is fetched, and the map row is still what decides which rows come back".
-- Adding a map row would compose an RLS policy over `people` from this key, which is the
-- shape 20260808000001 dismantled for the old `dues` key.
--
-- The policy half of that assertion matches on the RENDERED literal —
-- `auth_permission('announcements/birthdays'::text` — following `20260815000000:319-330`:
-- `announcements` is a live key that legitimately appears in policies, so a `LIKE
-- '%announcements%'` test would report every one of them and the assertion would be
-- decoration.
--
-- ── DEFAULT VISIBILITY IS 'everyone', WHICH IS WHY THERE IS NO BACKFILL ─────
-- A family knowing its own birthdays is the point of the pane. It is a NON-admin key, so
-- `auth_permission()` falls through to `resource_visibility` for view and answers
-- 'everyone' where there is no row — which is the answer wanted, so this file writes no
-- `resource_visibility` row at all. That is the OPPOSITE of `gatherings/budget`
-- (20260819000000 §6a), which is also a non-admin key and needed a restriction written for
-- every family precisely because nothing else would withhold it. Neither is a default to
-- copy from the other; each is a decision about one pane.
--
-- ── AND `seed_family_permission_templates()` IS DELIBERATELY NOT TOUCHED ────
-- NOT TOUCHING IT IS THE DECISION, not an omission, and it is worth stating because every
-- recent resource migration in this chain has had to widen that function.
--
-- It does not need widening HERE. Its `v_restricted` array is the list of NON-ADMIN keys
-- that still start restricted, and this key does not: `announcements/birthdays` must be
-- readable by a family the day it is created. Every other loop in that function reads
-- `permission_resources` DYNAMICALLY — the `resource_visibility` insert takes
-- `category = 'admin' OR key = ANY(v_restricted)`, the Administrators grid is
-- `CROSS JOIN LATERAL unnest(pr.actions)`, and the General grid is the same with a CASE
-- that asks `resource_visibility` — so the family created tomorrow gets this key, at view
-- 'any' for General and view 'any' for Administrators, with no edit to the function.
--
-- And a needless `CREATE OR REPLACE` of it is not free. That body carries TWO gates worth
-- more than this file: gate 1 refuses a browser role unless the call arrived through the
-- `families` trigger (`pg_trigger_depth() > 0`), which exists because an ANONYMOUS call to
-- `seed_family_system_groups()` once restored an Administrators grant an admin had deleted
-- (AGENTS.md §2b); gate 2 refuses a `p_family_code` naming no family, which is the write
-- amplification guard. Replacing a function to change nothing is a chance to lose one of
-- them, and 20260806000016 exists because that is not hypothetical.
--
-- ── THE TWO-STEP WITH 20260618000000's SEED ────────────────────────────────
-- AGENTS.md §6 asks for the row in a new migration AND in that seed, and the seed's insert
-- names only `(key, label, category, sort_order)` — `subsection` and `actions` do not exist
-- that early in the chain (20260806000000 and 20260806000010 add them), so naming either
-- there aborts a fresh `db reset` with 42703 at the first permissions migration. The row is
-- therefore created there as a FOUR-column tuple with the DEFAULT four actions, and §B2
-- below narrows it to `ARRAY['view']` and deletes the create/edit/delete grants the
-- intervening materialization loops handed out. `20260807000000` §7 is the loop in question:
-- it writes a row per template per resource per declared action, so on a fresh chain this
-- key arrives here with four rows per template instead of one. Same two-step as
-- `20260812000000` §1, `20260817000006` §4 and `20260819000000` §5/§5b.
--
-- 20260618000000's seed also carries §A's label and sort order, for the reason that file
-- states about ten other rows: its insert is `ON CONFLICT DO UPDATE SET label, category,
-- sort_order`, so leaving 'Regions & Chapters'/180 there would have a `db reset` land on
-- the old caption at that point in the chain and only reach 'Organization'/167 when this
-- file runs. It cannot carry the `subsection`, which is why THIS file is what sets it.
--
-- ============================================================================
-- §C — EVERY EXISTING `genorra_staff` ROW BECOMES `'owner'`
-- ============================================================================
-- `genorra_staff.role` has been `support | engineer | owner` since 20260817000005, and that
-- migration's own column comment is explicit that it is "carried now, consumed by nothing
-- yet": the console's first pass is read-only, so every staff member has identical access
-- and a check on this column would have been a control nothing reads. The same comment
-- defines `owner` as "the above, plus granting staff access — which today is SQL".
--
-- TODAY IS WHEN THAT STOPS BEING TRUE, and here is exactly what "that" is, by file, so this
-- paragraph is a record rather than a claim:
--
--     lib/auth/staff.ts              `requireStaffOwner()` — the role-aware guard. 404s, never
--                                    a denial, so the owner-only screen inside the console does
--                                    not advertise itself either.
--     app/actions/staff/access.ts    `listStaffTeam`, `grantStaffAccess`, `setStaffRole`,
--                                    `revokeStaffAccess` — all four `owner`-gated INCLUDING THE
--                                    READ, all four on the service role, a grant taking an
--                                    EMAIL and never a user_id, a required note, no self-edit,
--                                    and a last-owner refusal.
--     /staff/access                  the screen, a third item in StaffNav.
--
-- So the column goes from decoration to authority in one deploy, and the question this section
-- answers is what everybody who already has access should be.
--
-- THE PROMOTION AND ITS CONSUMER MUST SHIP TOGETHER, in that order within one commit. This
-- UPDATE is the irreversible half — `db push` records a version and never runs the file again,
-- so there is no walking it back through the chain — while the guard is the reversible half.
-- Landing this alone would promote every staff row with no screen able to review it and no
-- screen able to revoke it, leaving `psql` as the only route back: the exact thing this whole
-- release is retiring. The `note` append below is what makes even that survivable.
--
-- THE ANSWER IS `owner`, AND IT IS THE STATUS-QUO-PRESERVING CHOICE RATHER THAN THE
-- GENEROUS ONE. Every staff member today can do everything the console offers, because the
-- column governs nothing. Promoting them changes NOTHING about what any of them can already
-- do. Leaving them `'support'` would silently DEMOTE people who currently have everything —
-- and, worse, would leave the console with NOBODY able to grant, on a screen whose only
-- purpose is granting, reachable by nobody, repairable only from SQL. The default for NEW
-- grants stays `'support'`, which is where the caution belongs: least privilege for the
-- person who has not been given anything yet, not a demotion for the person who has.
--
-- THIS IS A ONE-TIME RECONCILIATION, AND THE APP IS NOW WHAT MOVES THIS COLUMN.
-- `setStaffRole` in `app/actions/staff/access.ts` is the only thing that should ever write
-- it again — the deliberate exception being `supabase/scripts/grant_staff.sql`, which is
-- how the FIRST owner exists on a database with no console access at all. Nothing here
-- should be read as "staff are owners"; it is "the people who had everything keep
-- everything, once".
--
-- AND THE ONE HAZARD IN IT, SAID OUT LOUD: this UPDATE is unconditional, so REPLAYING this
-- file after the console has deliberately created a `'support'` staffer would promote them.
-- That is a hand-replay hazard and not a deploy one — `db push` records the version and
-- refuses it a second time, `npm run db:check` reports a hand-applied file, and AGENTS.md
-- forbids `psql -f` for exactly this class of reason. Two narrowings were considered and
-- rejected:
--   * `WHERE NOT EXISTS (… role = 'owner')` — promote only when nobody can grant. It is
--     idempotent and it does the wrong thing on the real deploy: `grant_staff.sql` already
--     writes `'owner'` for the founder, so an owner exists on hosted TODAY and the guard
--     would skip the promotion — leaving every other staff member demoted, which is the
--     one outcome this section is written to prevent.
--   * testing `supabase_migrations.schema_migrations` for this version — couples a
--     migration to the CLI's own bookkeeping, whose insert ordering relative to the file's
--     transaction is an implementation detail, and errors outright on a database where that
--     schema does not exist.
-- So the UPDATE is plain, and it REPORTS how many rows it moved (§C's NOTICE), which is
-- what makes a replay visible in a log rather than silent.
--
-- §D asserts the two things that can be asserted without a fixture: the column DEFAULT is
-- still `'support'`, and the table is either empty or holds at least one owner. It CANNOT
-- probe the promotion, and says so rather than skipping quietly — `genorra_staff.user_id`
-- is `ON DELETE CASCADE` from `auth.users`, a local `db reset` empties that table, so on
-- every laptop this table is legitimately EMPTY (that is why
-- `audit_global_lookups.sql` lists it as allowed-empty) and there is nothing to promote.
-- Creating an `auth.users` row to make a probe possible is a line no migration in this
-- chain crosses, and would be a large amount of fixture for a one-line UPDATE. The
-- mutation notes below record how §C was measured instead.
--
-- ============================================================================
-- ── CHECKED BY MUTATION, 2026-08-19 — OBSERVED RESULTS ─────────────────────
-- AGENTS.md §7: a green run is not evidence until it has been seen to fail. Nine
-- mutations, one at a time, each recorded with the error it actually produced.
--
-- HOW EACH WAS APPLIED, because it decides what a pass means (20260819000000's header
-- records the general lesson):
--   [A] on top of the real run, with the closing `COMMIT` swapped for `ROLLBACK`.
--   [B] as a real `npx supabase db reset` with the mutated file standing in for this one.
--   [C] as [A], but with one `genorra_staff` row seeded first against an existing
--       `auth.users` id — the only way to exercise §C at all on a laptop, since a reset
--       leaves that table empty by construction.
-- The §A and §B mutations are all group A: every statement in them is an `UPDATE` or an
-- `ON CONFLICT` upsert over rows that already exist, so re-running on top of the real chain
-- genuinely re-executes them. Nothing in this file is `IF NOT EXISTS`, which is what makes
-- that true here and not in 20260819000001.
--
--   m1  §A's UPDATE deleted entirely                                         [A] TRIPS
--         → ERROR: ROLLBACK: admin/chapters is not 'Organization' / 'Members' / 167
--           (found 'Organization', <null>, 167)
--         RE-MEASURED 2026-08-19 AND THE RECORD CORRECTED, twice over — by putting the row
--         back to its pre-§A state on a freshly reset database and running §D1 as it ships,
--         which is group [A] by another route. The first
--         transcription quoted slash separators where §D1's `format` prints commas, and it
--         quoted the label and sort order this row had BEFORE 20260618000000's seed was
--         edited. With that seed edit in place a fresh chain reaches this file already
--         carrying 'Organization'/167 — the four-column tuple can set those two and cannot set
--         `subsection` — so deleting §A's UPDATE now trips on the NULL SUB-SECTION alone, which
--         is the only one of the three this file is the sole writer of. Worth knowing before
--         reading the message: it is thinner evidence than it looks, and the label-and-sort
--         half of the assertion is carried by the seed rather than by §A on a fresh database.
--         Measured the other way too, with the seed edit reverted:
--         → ERROR: … (found 'Regions & Chapters', <null>, 180), all three columns wrong.
--   m2  §A's UPDATE also sets `key = 'admin/users/organization'`             [A] TRIPS
--         → ERROR: update or delete on table "permission_resources" violates foreign key
--           constraint "group_permissions_resource_key_fkey" on table "template_permissions"
--         THE DATABASE ITSELF REFUSES THE RE-KEY, which is the header's second bullet
--         measured rather than argued: the FK has no `ON UPDATE` clause, so the rename
--         cannot happen as an UPDATE at all while a single grant exists. Recorded because
--         it is the cheapest possible demonstration for the next reader who tries it.
--   m3  §A's sort_order set to 166 (colliding with admin/users/templates)     [A] TRIPS
--         → ROLLBACK: 1 duplicate sort_order value(s) in the admin category
--   m4  §B's resource insert deleted                                         [A] TRIPS
--         → ROLLBACK: announcements/birthdays is not registered with ARRAY['view']
--   m5  §B declares all four actions (the `actions` narrowing removed)       [A] TRIPS
--         → ROLLBACK: announcements/birthdays is not registered with ARRAY['view']
--         and with the catalogue assertion relaxed to ignore `actions`, so the grant
--         assertion was reached:
--         → ROLLBACK: 3 grant(s) name an action announcements/birthdays does not declare
--   m6  §B2's DELETE of orphaned grants removed                              [B] TRIPS
--         → ROLLBACK: 3 grant(s) name an action announcements/birthdays does not declare
--         GROUP B ON PURPOSE. On a database meeting this key for the first time in this
--         file there are no orphans to delete, so the DELETE is a no-op and removing it
--         changes nothing — a false pass. Only a fresh chain, where 20260618000000's seed
--         registers the key with the default four actions and 20260807000000 §7
--         materializes a row per action per template, has anything for it to clear. That is
--         the whole reason §B2 exists.
--   m7  §B's Administrators grant moved AFTER the computed default           [A] does NOT
--       (both are ON CONFLICT DO NOTHING, so the first writer wins)              trip
--         → clean run, and the file says so rather than pretending otherwise. With
--           visibility 'everyone' the computed default writes view 'any' for EVERY
--           template, Administrators included, so the two writers agree and the ordering
--           cannot be observed from the outcome. It is kept in the order 20260819000000 §6c
--           uses because the ordering is the INVARIANT, not the outcome: the day somebody
--           restricts this key, the computed default becomes 'none' and an Administrators
--           grant written after it would never land. Recorded as a non-trip so nobody reads
--           the ordering as load-bearing-and-tested.
--   m8  §C's UPDATE predicate inverted to `WHERE role = 'owner'` (a no-op)    [C] TRIPS
--         → ROLLBACK: genorra_staff holds 1 row(s) and none of them is an owner. The
--           staff console's access screen is owner-gated, so nobody could grant access
--   m8b §C's `note` append removed, the UPDATE left setting `role` alone        [C] does NOT
--         → clean run, and it is recorded rather than left looking covered. Nothing in this      trip
--           file asserts the note and nothing should: the append is a RECORD for a person to
--           read on /staff/access, not an invariant. An assertion over it would have to know
--           which rows were promoted, which is exactly the fact the append exists BECAUSE the
--           table does not hold — so the assertion would have to be written against the thing
--           it was checking. What checks it instead is reading the row, which is what [C] does.
--         MEASURED, on a fixture of one `auth.users` row and one `genorra_staff` row inserted
--         at the column DEFAULT — which is what a hand-written grant takes, and is the case
--         §C's header names as the one that gets silently elevated. Before:
--             support | ticket 4412, read-only
--         After §C exactly as shipped (NOTICE: promoted 1 row(s)):
--             owner   | ticket 4412, read-only [20260819000002 promoted this row from support
--                       to owner: the role column became authoritative and every staff member
--                       already had every capability the console offered.]
--         AND THE REPLAY WAS MEASURED TOO, because an appending UPDATE is the shape that
--         doubles up: running §C a second time in the same transaction reported
--         `replay promoted 0 row(s)` and left zero rows carrying the sentence twice. `WHERE
--         role <> 'owner'` is what makes that true — a row this file has already promoted is
--         not matched again — so the hazard §C's header names is limited to a row somebody
--         deliberately created as 'support' AFTER the deploy, which is the one case where the
--         appended sentence is the finding rather than the noise.
--   m9  §C also changes the column DEFAULT to 'owner'                        [A] TRIPS
--         → ROLLBACK: genorra_staff.role no longer defaults to 'support' (default is
--           'owner'::text). A NEW grant must start least-privileged
--
-- IDEMPOTENT. §A is an `UPDATE` to fixed values, §B is `ON CONFLICT DO UPDATE` plus two
-- `ON CONFLICT DO NOTHING` inserts and a derived `DELETE`, §C is an `UPDATE` to a fixed
-- value. Applies to an empty database: §A's UPDATE and §B's inserts find 20260618000000's
-- seeded rows, §B's grant loops find no templates and write nothing, and §C finds no staff.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How migrations
--   reach the hosted project".
-- ============================================================================

BEGIN;

-- ── A. Regions & Chapters becomes the Organization pane of Members & Access ──
-- Three columns, and the key is conspicuously not among them. See §A of the header for the
-- whole argument; the short version is that two live RLS policies evaluate
-- `auth_permission('admin/chapters'::text, 'view')` and both `regions` and `chapters` are
-- mapped onto this key, so moving it is text surgery over `pg_policies` rather than an
-- UPDATE — and getting it wrong is silent in both directions.
--
-- 167 is one past `admin/users/templates` (166), inside the Members block that starts at
-- `admin/users` (160) with `admin/approvals` (165) between them. The grid emits a
-- sub-section header the moment `subsection` changes as it walks `sort_order`
-- (`groupResources` in components/admin/resource-groups.ts), so the value has to be
-- contiguous with the other two 'Members' rows or the heading appears twice. §D asserts no
-- duplicate rather than trusting the number typed here — 20260819000000 §8c's reason: a
-- copied list of what is free was wrong in two places the last time one was written down.
UPDATE public.permission_resources
   SET label      = 'Organization',
       subsection = 'Members',
       sort_order = 167
 WHERE key = 'admin/chapters';

-- ── B. `announcements/birthdays` ────────────────────────────────────────────
-- B1. The resource. `subsection` is 'Announcements' — named for the RAIL ITEM it hangs
-- off, the same rule `transactions/*`, `account-summary/funds` and `gatherings/my-tasks`
-- follow, so the grid reads Community › Announcements › Birthdays. 61 sits it directly
-- under `announcements` (60) and before `members` (70).
--
-- The label is the caption the rail prints. Not "Upcoming Birthdays" and not "Birthdays
-- (60 days)": the horizon is `BIRTHDAY_HORIZON_DAYS` in `lib/birthdays.ts` and a number
-- typed into a permission label is a second copy of it that goes stale silently, which is
-- the same argument AGENTS.md makes about restating a tier in help prose.
--
-- ON CONFLICT DO UPDATE on every display column, because on a fresh chain
-- 20260618000000's seed has already created this row with four columns and the default four
-- actions — this is where `subsection` and the narrowed `actions` arrive.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('announcements/birthdays', 'Birthdays', 'community', 'Announcements', 61,
   ARRAY['view']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- B2. The grants that narrowing orphans.
--
-- Only reachable on a fresh chain, where 20260618000000's seed registers this key with the
-- DEFAULT four actions — the `actions` column does not exist that early — and
-- 20260807000000 §7 then materializes a `template_permissions` row per template per
-- resource per declared action. Narrowing to `ARRAY['view']` above leaves create/edit/delete
-- rows naming actions their resource no longer declares, which 20260808000000 §6c and
-- 20260815000000 §5f both assert against globally and which §D re-asserts for this key. A
-- no-op on a database meeting this key for the first time in this file.
--
-- Derived from `permission_resources.actions` rather than naming the three actions, so this
-- statement stays correct if the declared set ever changes.
DELETE FROM public.template_permissions tp
 USING public.permission_resources pr
 WHERE pr.key = tp.resource_key
   AND tp.resource_key = 'announcements/birthdays'
   AND NOT (tp.action::text = ANY (pr.actions));

-- B3. Administrators FIRST, on every action the key declares.
--
-- BEFORE B4's computed default, which is `ON CONFLICT DO NOTHING` — first writer wins. With
-- this key at 'everyone' the two agree today and the ordering cannot be observed (the
-- mutation notes record m7 as a deliberate non-trip), but the ordering is the invariant
-- rather than the outcome: the day a family restricts this key the computed default is
-- 'none', and an Administrators row written after it would never land. That is
-- 20260808000000's "restricted with nobody granted is a screen that exists and cannot be
-- opened", and in the worst ordering the screen that just locked is the one that could
-- unlock it.
--
-- ONLY the system Administrators template, on the `is_system = true` + name test the rest
-- of the chain uses — not the name alone, which a family may rename, and not "every
-- template that can already edit some other community key", which would widen access on
-- deploy. `unnest(pr.actions)` so no grant is written for an action the resource does not
-- declare, which is B2's job asserted from the other end.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, pr.key, a::public.permission_action, 'any', NOW()
  FROM public.permission_templates t
 CROSS JOIN public.permission_resources pr
 CROSS JOIN LATERAL unnest(pr.actions) AS a
 WHERE t.name = 'Administrators' AND t.is_system = true
   AND pr.key = 'announcements/birthdays'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- B4. Every other template states the answer rather than falling through.
--
-- 20260807000000 §7 materialized every grid so Members & Access can show the whole answer
-- without a reader having to know about fall-through, and it notes that a resource
-- registered by a LATER migration is the one case that survives on the default. This writes
-- that default down, with exactly the CASE `seed_family_permission_templates()` uses — view
-- resolves to 'any' unless the family has restricted the key, everything else to 'none' —
-- so the row written here and the row a new family is born with cannot disagree.
--
-- For this key that means view 'any' for every template in every family, because nothing
-- restricts it and nothing should: a family knowing its own birthdays is the point. The
-- CASE is kept in its general form anyway rather than hard-coding 'any', so that a family
-- which has ALREADY restricted the key by hand — possible the moment the grid renders it —
-- is not overwritten by a replay.
--
-- The visibility test is on `t.family_code`, the TEMPLATE's family. A template only counts
-- for the family it belongs to; joining on anything else would let one family's restriction
-- decide another's grid.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, pr.key, a::public.permission_action,
       CASE
         WHEN a = 'view' AND NOT EXISTS (
                SELECT 1 FROM public.resource_visibility rv
                 WHERE rv.family_code = t.family_code
                   AND rv.resource_key = pr.key
                   AND rv.visibility = 'restricted')
           THEN 'any'::public.permission_scope
         ELSE 'none'::public.permission_scope
       END
  FROM public.permission_templates t
 CROSS JOIN public.permission_resources pr
 CROSS JOIN LATERAL unnest(pr.actions) AS a
 WHERE pr.key = 'announcements/birthdays'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- NO `resource_visibility` ROW IS WRITTEN, and that is the decision rather than an
-- omission. `announcements/birthdays` is a non-admin key, so `auth_permission()` falls
-- through to 'everyone' for view where there is no row — which is the answer wanted. See
-- §B of the header for why this is the opposite of `gatherings/budget`, which is also a
-- non-admin key and needed the restriction written for every family that exists.

-- ── C. Every existing staff row becomes an owner ────────────────────────────
-- Wrapped in a DO block for one reason: to REPORT the count. §C of the header explains why
-- the UPDATE is unconditional and what the hand-replay hazard is; a number in the deploy
-- log is what makes a replay that promoted somebody visible instead of silent.
DO $mig$
DECLARE
  v_promoted int;
BEGIN
  -- THE PRIOR ROLE IS APPENDED TO `note`, AND THAT IS NOT DECORATION.
  -- `genorra_staff` has no history: no `role_changed_at`, no previous value, no audit table. So
  -- this UPDATE DESTROYS the fact it overwrites, and afterwards a row deliberately created as
  -- 'support' cannot be told from one that was always 'owner'. That matters more than it looks:
  -- `supabase/scripts/grant_staff.sql` hard-codes 'owner', so on hosted this is probably a
  -- no-op — but AGENTS.md's own position is that staff rows are inserted BY HAND with SQL, and
  -- a hand-inserted row takes the column DEFAULT, which is 'support'. Any such row is silently
  -- elevated to "may grant cross-family access" by this statement, and §D4's assertion that
  -- nothing is left below owner LOCKS THAT IN rather than catching it.
  --
  -- `note` is the right place because the table's own comment already says what it is for: "Why
  -- this account has staff access, in words. The table is an audit record and a bare uuid is
  -- not one." A promotion nobody asked for is exactly the kind of thing that record exists to
  -- hold, and /staff/access prints the column, so an owner reviewing the list SEES it.
  --
  -- It is also what makes the hand-replay hazard below visible instead of silent: a replay
  -- after the console has deliberately created a 'support' staffer promotes them AND writes the
  -- sentence saying so, on the screen whose job is to be read.
  --
  -- The CASE rather than `COALESCE(note, '') || …` so a row with no note does not come out with
  -- a leading space, and a row that has one keeps it followed by a separator.
  UPDATE public.genorra_staff
     SET role = 'owner',
         note = CASE WHEN note IS NULL OR btrim(note) = '' THEN '' ELSE note || ' ' END
                || '[20260819000002 promoted this row from ' || role || ' to owner: the role '
                || 'column became authoritative and every staff member already had every '
                || 'capability the console offered.]'
   WHERE role <> 'owner';
  GET DIAGNOSTICS v_promoted = ROW_COUNT;

  IF v_promoted = 0 THEN
    RAISE NOTICE
      'genorra_staff: no row needed promoting (the table holds % row(s)). On a laptop this '
      'is expected — user_id cascades from auth.users and a db reset empties it.',
      (SELECT COUNT(*) FROM public.genorra_staff);
  ELSE
    RAISE NOTICE
      'genorra_staff: promoted % row(s) to owner. One-time reconciliation — every staff '
      'member already had every capability the console offers, because role was consumed by '
      'nothing; /staff/access now reads it. New grants still default to support.', v_promoted;
  END IF;
END $mig$;

-- ── D. Verify ───────────────────────────────────────────────────────────────
-- Catalogue reads only, and every one of them unconditional, so this cannot report success
-- by skipping (AGENTS.md: "a verify block that can skip must not be the only check").
--
-- THERE IS NO BEHAVIOURAL PROBE IN THIS FILE, and that is stated rather than left as a
-- gap. Nothing here creates a constraint, a trigger, a policy or a function — the three
-- sections move a catalogue row, register a catalogue row and reconcile one column — so
-- there is no name resolution deferred to a first caller and no expression that can be
-- quietly weakened. What CAN go wrong is that a row is not where this file says it is, that
-- a grant names an action nothing declares, or that something has been dragged along with
-- the change; all of those are catalogue facts. §C is the one section with behaviour worth
-- probing and the one that cannot be probed without an `auth.users` fixture — see §C of the
-- header, and the [C] mutation notes for how it was measured instead.
DO $mig$
DECLARE
  v_bad     int;
  v_policies int;
  v_names   text;
  v_missing text;
  v_label   text;
  v_sub     text;
  v_sort    int;
  v_default text;
BEGIN
  -- ── D1. §A: the row moved, and nothing else about it did ──
  SELECT label, subsection, sort_order INTO v_label, v_sub, v_sort
    FROM public.permission_resources WHERE key = 'admin/chapters';
  IF v_label IS DISTINCT FROM 'Organization'
     OR v_sub IS DISTINCT FROM 'Members'
     OR v_sort IS DISTINCT FROM 167
  THEN
    RAISE EXCEPTION
      'ROLLBACK: admin/chapters is not ''Organization'' / ''Members'' / 167 (found %, %, %)',
      COALESCE(quote_literal(v_label), 'absent'), COALESCE(quote_literal(v_sub), '<null>'),
      COALESCE(v_sort::text, '<null>');
  END IF;

  -- The key still declares all four actions and is still category 'admin'. This is what
  -- catches a "while I am here" narrowing: the Organization pane creates, edits and deletes
  -- regions and chapters, and `category` is what gives the key its fail-closed default
  -- (20260817000004) and what that migration's invariant is about.
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE key = 'admin/chapters' AND category = 'admin'
       AND actions = ARRAY['view','create','edit','delete']::TEXT[]
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: admin/chapters is no longer category ''admin'' with all four actions — the '
      'pane still creates, edits and deletes regions and chapters';
  END IF;

  -- THE TWO MAP ROWS, BY NAME. This is the first half of why the key may not move: both
  -- `regions` and `chapters` are governed by it (20260618000001), and that migration
  -- COMPOSED their policies out of these rows.
  SELECT string_agg(t.tbl, ', ' ORDER BY t.tbl) INTO v_missing
    FROM (VALUES ('regions'), ('chapters')) AS t(tbl)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.permission_table_map m
      WHERE m.table_name = t.tbl AND m.resource_key = 'admin/chapters'
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: table(s) no longer mapped to admin/chapters: %. Renaming this key means '
      'the pg_policies text surgery of 20260807000000 first — see §A of the header.',
      v_missing;
  END IF;

  -- AND AT LEAST ONE LIVE POLICY STILL EVALUATES IT. The second half, and the one a
  -- catalogue read of `permission_table_map` cannot answer: what protects those two tables
  -- is a composed string that exists in no file. Matched on the RENDERED literal
  -- `auth_permission('admin/chapters'::text` per 20260815000000:319-330 — the bare word
  -- `chapters` appears in `admin/chapters`, in the table name and in
  -- `dues_schedules.chapter_id`'s policies, so a `LIKE '%chapters%'` test would match
  -- things that are not this key. Asserted as "at least one" rather than "exactly two":
  -- two is what is there today, and a third policy legitimately keyed on this resource is
  -- somebody doing the right thing, not a regression.
  SELECT COUNT(*) INTO v_policies
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '')       LIKE '%auth_permission(''admin/chapters''::text%'
       OR COALESCE(with_check, '') LIKE '%auth_permission(''admin/chapters''::text%');
  IF v_policies = 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: no live policy evaluates admin/chapters. Either the key has been moved '
      'without the pg_policies surgery, or regions and chapters have lost their policies '
      'altogether — both are silent in the app (PostgREST returns no rows, not an error).';
  END IF;

  -- ── D2. §B: the key is registered, view-only, with its parent and no table ──
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE key = 'announcements/birthdays'
       AND category = 'community' AND subsection = 'Announcements'
       AND actions = ARRAY['view']::TEXT[]
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: announcements/birthdays is not registered with ARRAY[''view''] under '
      'community / Announcements';
  END IF;

  -- Its parent row exists — 20260808000000 §6b's invariant, which matters because
  -- `getResources()` longest-prefix-matches and the grid groups on the parent. A sub-key
  -- whose parent is missing vanishes from both with no error.
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'announcements') THEN
    RAISE EXCEPTION 'ROLLBACK: announcements/birthdays has no parent resource row';
  END IF;

  -- IT GATES A PANE AND NO TABLE. A map row here would put this key into a composed RLS
  -- policy over `people` — the shape 20260808000001 dismantled for the old `dues` key. The
  -- roster stays governed by `members`; this key decides whether the pane is FETCHED, which
  -- is exactly `account-summary/funds`'s standing.
  IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE resource_key = 'announcements/birthdays') THEN
    RAISE EXCEPTION
      'ROLLBACK: announcements/birthdays must not map to a table — it gates a pane, and the '
      'roster it reads is governed by `members`';
  END IF;

  -- Matched on the RENDERED literal, because `announcements` is a live key that
  -- legitimately appears in policies and a `LIKE '%announcements%'` test would report
  -- every one of them (20260815000000:319-330's argument, one key across).
  SELECT COUNT(*), string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename, policyname)
    INTO v_bad, v_names
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '')       LIKE '%auth_permission(''announcements/birthdays''::text%'
       OR COALESCE(with_check, '') LIKE '%auth_permission(''announcements/birthdays''::text%');
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % policy(ies) evaluate announcements/birthdays, which gates a pane rather '
      'than rows: %', v_bad, v_names;
  END IF;

  -- No grant names an action this resource does not declare — B2's job, asserted. On a
  -- fresh chain this is the assertion that proves the narrowing and the sweep both took.
  SELECT COUNT(*) INTO v_bad
    FROM public.template_permissions tp
    JOIN public.permission_resources pr ON pr.key = tp.resource_key
   WHERE tp.resource_key = 'announcements/birthdays'
     AND NOT (tp.action::text = ANY (pr.actions));
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % grant(s) name an action announcements/birthdays does not declare', v_bad;
  END IF;

  -- And somebody can still reach it: no system Administrators template is left without the
  -- view grant B3 writes. Vacuous on an empty database and load-bearing on every other one.
  SELECT COUNT(*) INTO v_bad
    FROM public.permission_templates t
   WHERE t.name = 'Administrators' AND t.is_system = true
     AND NOT EXISTS (
       SELECT 1 FROM public.template_permissions tp
        WHERE tp.template_id = t.id AND tp.resource_key = 'announcements/birthdays'
          AND tp.action = 'view' AND tp.scope = 'any');
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % Administrators template(s) cannot view the Birthdays pane', v_bad;
  END IF;

  -- NO FAMILY HAS BEEN GIVEN A RESTRICTION FOR IT. The default is 'everyone' and this file
  -- writes no `resource_visibility` row; asserting the absence is what stops a later author
  -- copying `gatherings/budget`'s backfill across on the grounds that it is "also a
  -- non-admin key with a slash in it".
  SELECT COUNT(*) INTO v_bad
    FROM public.resource_visibility
   WHERE resource_key = 'announcements/birthdays' AND visibility = 'restricted';
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % family(ies) have announcements/birthdays restricted. This file writes no '
      'visibility row — a family knowing its own birthdays is the point of the pane.', v_bad;
  END IF;

  -- ── D3. The two catalogue invariants both sections could have broken ──
  -- No duplicate sort_order in either category this file writes to. 20260806000005's
  -- invariant: the grid emits a sub-section header the moment `subsection` changes, so a
  -- tie puts a row inside a block it does not belong to. DERIVED from the table rather than
  -- checked against a copied list of what is free, for 20260819000000 §8c's reason.
  SELECT COUNT(*) INTO v_bad FROM (
    SELECT category, sort_order FROM public.permission_resources
     WHERE category IN ('admin', 'community')
     GROUP BY category, sort_order HAVING COUNT(*) > 1
  ) d;
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % duplicate sort_order value(s) in the admin or community category', v_bad;
  END IF;

  -- 20260817000004's equivalence, in BOTH directions, and it is not a formality here: this
  -- file adds a key WITH A SLASH IN IT that must NOT be admin (`announcements/birthdays`)
  -- and moves an `admin/…` key into a sub-section, which is the shape most likely to tempt
  -- somebody into "tidying" the category. The prefix is what an UNREGISTERED key is judged
  -- by, in `auth_permission()`, in `resolveScope()` and in `scopeInFamilies()`, and that is
  -- only sound while the two signals coincide.
  SELECT string_agg(format('%s (category=%s)', key, category), ', ' ORDER BY key) INTO v_names
    FROM public.permission_resources
   WHERE (category = 'admin') IS DISTINCT FROM (key LIKE 'admin/%');
  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: category and key shape disagree for: %', v_names;
  END IF;

  -- ── D4. §C: the reconciliation, and the default it must not have moved ──
  -- The DEFAULT is where the caution belongs. A NEW grant — from `/staff/access` or from
  -- `supabase/scripts/grant_staff.sql` — must start least-privileged, and 'owner' is the
  -- one value that hands the newcomer the power to grant. §C promotes rows that EXIST; if
  -- it had also moved the default, every future grant would be an owner and the role
  -- vocabulary would be decoration again.
  SELECT column_default INTO v_default
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'genorra_staff' AND column_name = 'role';
  IF v_default IS DISTINCT FROM '''support''::text' THEN
    RAISE EXCEPTION
      'ROLLBACK: genorra_staff.role no longer defaults to ''support'' (default is %). A NEW '
      'grant must start least-privileged.', COALESCE(v_default, '<none>');
  END IF;

  -- Empty, or holding an owner. The console's access screen is owner-gated on all four of
  -- its operations INCLUDING the read, so a populated table with no owner is a console
  -- nobody can administer and a screen only SQL can repair. Phrased as "if there is any row
  -- at all" because an empty table is the correct state of every laptop: `user_id` cascades
  -- from `auth.users` and a `db reset` empties it, which is why
  -- `supabase/scripts/audit_global_lookups.sql` lists this table as legitimately empty.
  IF EXISTS (SELECT 1 FROM public.genorra_staff)
     AND NOT EXISTS (SELECT 1 FROM public.genorra_staff WHERE role = 'owner')
  THEN
    RAISE EXCEPTION
      'ROLLBACK: genorra_staff holds % row(s) and none of them is an owner. The staff '
      'console''s access screen is owner-gated, so nobody could grant access.',
      (SELECT COUNT(*) FROM public.genorra_staff);
  END IF;

  -- AND THE VACUITY IS SAID OUT LOUD, because a vacuous assertion is a skip by another name.
  -- §D's header claims every check here is unconditional "so this cannot report success by
  -- skipping", and that is true of D1–D3 and of the DEFAULT check above. It is NOT true of the
  -- two staff assertions: `genorra_staff.user_id` cascades from `auth.users`, a `db reset`
  -- empties that table, so on every laptop and in every `verify.yml` run this table is EMPTY —
  -- the owner test never fires and the count below is trivially 0. A green reset log would
  -- otherwise read as verification of the one statement in this file that changes data. It is
  -- not; the [C] mutation notes are, and they were measured against a hand-seeded row.
  IF NOT EXISTS (SELECT 1 FROM public.genorra_staff) THEN
    RAISE NOTICE
      'genorra_staff is empty, so §D4''s owner assertions were VACUOUS on this run. Expected on '
      'any database whose auth.users has been emptied (every db reset). The promotion in §C was '
      'measured by mutation against a hand-seeded row — see the [C] entries in the header — not '
      'by this block.';
  END IF;

  -- And nothing was left half-reconciled. Vacuous on a laptop and the direct statement of
  -- what §C did on hosted; a replay after `/staff/access` has deliberately created a
  -- support staffer would promote them, which is the hazard §C of the header names and the
  -- reason its NOTICE prints a count.
  SELECT COUNT(*) INTO v_bad FROM public.genorra_staff WHERE role <> 'owner';
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % genorra_staff row(s) were left below owner. Every staff member already '
      'had every capability the console offers, so leaving one behind is a DEMOTION.', v_bad;
  END IF;

  RAISE NOTICE
    'verified: admin/chapters is Organization under Members at 167 with its key, category, '
    'four actions, two permission_table_map rows and % live policy(ies) intact; '
    'announcements/birthdays registered view-only under Announcements with its parent, no '
    'map row, no policy, no orphaned grant, no family restriction and every system '
    'Administrators template able to view it; no duplicate sort_order in admin or '
    'community; the admin category/prefix equivalence holds in both directions; and '
    'genorra_staff still defaults to support with no row left below owner.', v_policies;
END $mig$;

COMMIT;
