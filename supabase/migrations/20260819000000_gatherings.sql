-- ============================================================================
-- GATHERINGS: a template, a schedule, a task per relative, and an answer somebody
-- approves — plus a budget drawn on a fund, and a calendar that shows the lot.
--
-- ── WHAT THIS IS, AND WHAT IT IS NOT ────────────────────────────────────────
-- A family authors a TEMPLATE: a named, ordered list of steps of mixed kinds (a line of
-- text, a paragraph, a date, a list, a yes/no, a count, an amount of money). A GATHERING
-- is scheduled FROM one or more templates, and every step of every template becomes a
-- TASK handed to a named relative. The assignee submits an answer; an organizer approves
-- it, or denies it with notes the assignee can act on. A gathering carries a budget drawn
-- on one of the family's funds and each task carries its own line against that budget.
-- One gathering may be flagged PREMIER, which is what the Dashboard puts across its top.
--
-- EVENTS IS UNTOUCHED. Every `event*` / `event_*` table, policy, route and action stays
-- exactly where it is, and nothing in this file renames, re-policies or reads one. The
-- two products answer different questions — Events answers "when is it and who is
-- coming", Gatherings answers "who is doing what, and has it been done and accepted" —
-- and unifying them would mean re-composing the policies on nine `event_*` tables, which
-- is precisely the class of change AGENTS.md's "How migrations reach the hosted project"
-- exists to make people think twice about. Three event screens are permanently empty
-- today because of assumptions about columns that do not exist; that is the cost of
-- reaching into that half of the schema casually.
--
-- ── SIX TABLES, AND EVERY ONE OF THEM HAS A SURROGATE PRIMARY KEY ───────────
-- Including `gathering_template_uses`, which is a junction over two foreign keys and is
-- the obvious candidate for a composite PK. It must not have one. PostgREST infers a
-- MANY-TO-MANY relationship exactly where a junction's two foreign-key columns ARE its
-- primary key, and it then reports a second path between the two parents — so a bare
-- `people(...)` or `gatherings(...)` embed anywhere in the app starts answering PGRST201,
-- which supabase-js hands back as `[]` with the error discarded (AGENTS.md §8).
-- `announcement_unpins` is the incident: an ordinary two-column join table made every
-- announcement query on every page answer empty. Pairs are enforced with `UNIQUE (…)`
-- here, which is the same constraint without the inference.
--
-- ── `family_code TEXT NOT NULL`, WITH NO FOREIGN KEY TO `families` ──────────
-- Three reasons, all of them load-bearing rather than stylistic:
--   1. It makes AGENTS.md §3's obligation a `.eq('family_code', …)` FILTER rather than an
--      `!inner` join. The three permanently-empty event screens are what the join
--      assumption costs, and an action that has to join to scope is an action whose
--      scoping can be lost by a `select` string.
--   2. `supabase/scripts/audit_global_lookups.sql` puts any relation carrying a
--      `family_code` attribute into its SCOPED base set, so an empty Gatherings table on
--      hosted is never mistaken for an emptied global lookup and never fails a deploy.
--   3. Nothing in this schema points back at `families`, which is what lets the verify
--      block at the foot create a throwaway family, exercise every guard for real, and
--      remove it inside its own transaction — no `families` row, so no permission
--      templates and no system Donations fund to clean up afterwards.
--
-- ── THE ONE DECISION THAT MATTERS MOST: A TASK IS A COPY ────────────────────
-- `gathering_tasks.label`, `.help_text`, `.kind` and `.required` are COPIED from the
-- template step at instantiation and are never read back through `step_id`. A task is a
-- thing a named relative was ASKED to do; editing the template afterwards must not
-- rewrite what they were asked or invalidate what they answered. `step_id` and
-- `template_id` are kept for provenance and go NULL if the step or template is deleted.
--
-- ── NO WRITE POLICIES, ON ANY OF THE SIX ───────────────────────────────────
-- SELECT only, which is the shape `fund_disbursements` and `fund_transfers` keep and for
-- the same stated reason: every write in this feature runs through `createAdminClient()`
-- in a server action that re-applies family scoping by hand (§3) and lands on the guard
-- triggers in §2. The actions and the triggers ARE the write boundary; the browser has
-- none. See the comment where the missing policies would be.
--
-- ── AND NO OVER-FUND TRIGGER, DELIBERATELY ─────────────────────────────────
-- A budget that exceeds the balance of the fund behind it is a state this product must be
-- able to HOLD and SHOW — the requirement is a red line on the screen, not a refusal.
-- Refusing it in the database would make the feature impossible to use in the one
-- situation a family most needs to see: they have promised more than they have. The
-- arithmetic lives in `lib/gathering-budget.ts` and the marker is `--destructive`.
--
-- ── THE PERMISSION MODEL: SIX KEYS, THREE OF THEM RESTRICTED ───────────────
-- The keys are the routes without their leading slash (AGENTS.md §1), plus one that is
-- not a route at all:
--
--   gatherings                  events  91  view create               everyone
--   gatherings/my-tasks         events  92  view                      everyone
--   gatherings/budget           events  93  view                      RESTRICTED
--   calendar                    events  94  view                      everyone
--   admin/gatherings            admin  231  view create edit delete   restricted (admin)
--   admin/gathering-templates   admin  232  view create edit delete   restricted (admin)
--
-- SIX, not seven. `/gatherings/[id]` and `/admin/gatherings/[id]` inherit their parent's
-- key and contribute none, so an assertion counting seven would abort this file. §9
-- therefore asserts each key BY NAME rather than counting anything — a count drifts from
-- the insert above it and a per-key assertion cannot.
--
-- `gatherings/budget` IS THE ONE THAT NEEDS THIS FILE. It is a NON-ADMIN key, so nothing
-- makes it restricted by default: `auth_permission()` falls through to
-- `resource_visibility` for view and answers 'everyone' where there is no row, and
-- `20260817000004`'s fail-closed rule covers `admin/…` keys only. Left alone, every
-- approved member of every family would resolve view 'any' on the money band — the fund,
-- the balance, the budget and every task's line. §6 writes the restriction for every
-- family that exists and §7 widens `seed_family_permission_templates()` for the family
-- created tomorrow; either half alone is the defect `20260817000000` §3b describes,
-- "because the first family to be affected is the one nobody is watching".
--
-- AND IT WITHHOLDS A SCREEN BAND, NOT THE FIGURES. Say this plainly, because the paragraph
-- above reads like confidentiality and is not: the money lives in COLUMNS on `gatherings`
-- (`budget_cents`, `fund_id`) and on `gathering_tasks` (`budget_cents`), and those two tables'
-- SELECT policies key on `gatherings:view`, which every family has at 'everyone' by default.
-- With `GRANT SELECT ON public.gatherings TO authenticated` and the anon key in the browser
-- bundle, `GET /rest/v1/gatherings?select=title,budget_cents,fund_id` answers for any approved
-- member of the family whatever `gatherings/budget` says. So this key has exactly the standing
-- AGENTS.md gives `account-summary/funds`: "the sub-key is an app-layer gate on whether the
-- section is FETCHED, and the map row is still what decides which rows come back". It is what
-- stops the band being fetched and rendered (§5's rule, gate the fetch not the band); it is not
-- a row-level secret, and 8i's assertion that no policy may ever evaluate it is what fixes that
-- division in place.
--
-- Only the fund BALANCE is genuinely withheld, and by something else: `funds` maps to
-- `family-finances` and `fund_balance_cents()` has no `authenticated` EXECUTE, which is why the
-- admin actions compute it on the admin client.
--
-- COLUMN-LEVEL GRANTS ARE NOT THE MISSING PIECE, AND THE REASON IS STRONGER THAN THE ONE THIS
-- PARAGRAPH USED TO GIVE. It said only that `supabase/seed.sql` issues
-- `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated` after every reset, so a
-- narrowing here would be undone within seconds LOCALLY — which is true, and which a reader can
-- dismiss with "but seed.sql never runs on hosted". It was dismissed exactly that way in review
-- on 2026-08-19, and what came back was a concrete proposal: replace §3b's blanket
-- `GRANT SELECT ON public.gatherings TO authenticated` with a column list omitting
-- `budget_cents` and `fund_id`, do the same for `gathering_tasks.budget_cents`, and assert the
-- absence with `has_column_privilege`. Two measurements refuse it, and the first is fatal.
--
-- 1. IT NARROWS NOTHING, ON HOSTED EITHER. `pg_default_acl` for schema `public`, object type
--    `r`, reads `anon=arwdDxtm/postgres` and `authenticated=arwdDxtm/postgres` — so a table
--    created in this schema is BORN holding table-level SELECT, INSERT, UPDATE and DELETE for
--    both browser roles, before a single GRANT in this file runs. Measured on a fresh table in
--    a rolled-back transaction, and `relacl` on `public.gatherings` after a clean `db reset` is
--    exactly that default and nothing else — which is to say §3b's grants below are already
--    no-ops on any Supabase database, hosted included. A GRANT is ADDITIVE and cannot narrow
--    one: issuing the proposed column list on the real table leaves
--    `has_column_privilege('authenticated', 'public.gatherings', 'budget_cents', 'SELECT')`
--    TRUE, so the assertion asked for would abort this migration on its first `db reset`. That
--    is AGENTS.md's own warning about asserting `NOT has_..._privilege(...)` and calling it
--    protection, one object type across.
--
-- 2. MAKING IT BITE NEEDS THE TABLE-LEVEL REVOKE §3b FORBIDS, and here that breaks a shipped
--    screen rather than merely reading as a protection that is not there.
--    `getMyGatheringTasks` selects `gathering_tasks.budget_cents` on the USER client
--    UNCONDITIONALLY and by design — "you have $200 for the flowers" is what makes a task
--    actionable, and the argument is beside `TASK_COLUMNS_WITH_MONEY` in
--    `app/actions/gatherings.ts` — while `getGatheringDetail` selects it on the user client
--    whenever the caller holds the grant. Measured with the revoke and the column list in
--    place: `permission denied for table gathering_tasks`, which supabase-js RETURNS rather
--    than throws, so `/gatherings/my-tasks` would report "nothing is assigned to you" over a
--    member's real tasks — on hosted only, with every local check green because seed.sql had
--    put the table grant back. The worst available shape.
--
-- So the paragraph above is the whole truth and this key is an app-layer gate, which is what
-- 8i fixes in place. Making it govern ROWS means moving the two money columns onto their own
-- table with their own `permission_table_map` row, which is a schema decision and not a comment
-- fix; it is not being smuggled in here. What must not happen is a reader taking the paragraph
-- above as a promise the database keeps — or taking a column grant for one.
--
-- THE POSITIVE GRANT IS DERIVED FROM AN ADMIN KEY, and that is not a preference. It
-- follows `admin/account:view = any` — whoever already runs the family's money.
-- `20260817000000` §3 derived the equivalent grant from `transactions/dues-payments`, a
-- NON-admin key, and `seed_family_permission_templates()` gives the General template view
-- 'any' on every non-admin resource — so the grant went to every member of every family
-- and undid, in the same file, the restriction two sections above it. `20260817000001`
-- had to be written to take it back. Never derive from a non-admin key.
--
-- ── THE SEED IN 20260618000000 CARRIES THESE KEYS TOO, IN FOUR COLUMNS ──────
-- AGENTS.md §6 asks for the row in a new migration AND in that seed, and the seed's
-- insert names only `(key, label, category, sort_order)` — `subsection` and `actions` do
-- not exist that early in the chain (20260806000000 and 20260806000010 add them), so
-- naming either there aborts a fresh `db reset` at the first permissions migration. The
-- six rows are therefore added there as four-column tuples, created with the DEFAULT four
-- actions, and §5 below narrows the three view-only keys and deletes the create/edit/
-- delete grants the intervening materialization loops handed out. That two-step is
-- `20260812000000` §1 and `20260817000006` §4 exactly.
--
-- ── §8 EMBED ANALYSIS, DONE BEFORE WRITING RATHER THAN AFTER ───────────────
-- New foreign keys, by pair:
--   gathering_templates        → people ×1 (created_by)
--   gatherings                 → people ×1 (created_by), funds ×1 (fund_id)
--   gathering_tasks            → people ×2 (assignee_id, decided_by), and ×1 each to
--                                gatherings, gathering_templates, gathering_template_steps
--   gathering_task_submissions → people ×2 (submitted_by, reviewed_by), tasks ×1
--   gathering_template_uses    → gatherings ×1, gathering_templates ×1
--   gathering_template_steps   → gathering_templates ×1
--
-- Two consequences, and the second is the one AGENTS.md warns arrives by accident:
--   * `gathering_tasks` and `gathering_task_submissions` each have TWO paths to `people`,
--     so every `people` embed on either MUST name its constraint —
--     `people!gathering_tasks_assignee_id_fkey(first_name, last_name)`. `gatherings` and
--     `gathering_templates` have one each and are unambiguous today; if a second actor
--     column is ever added to either, every embed in the feature gets constraint-named in
--     the same commit.
--   * NO EXISTING EMBED BREAKS, and the reason is the surrogate PK above. PostgREST
--     infers a many-to-many only through a junction whose two foreign-key columns are its
--     primary key; every table here is keyed on `id`, so `people`, `funds` and `events`
--     gain no new path from anything in this file. That is a PREDICTION and the spec is
--     right to say so — run AGENTS.md §8's `pg_constraint` detector after applying this,
--     and re-check the bare embeds in `app/actions/documents.ts`, `event-photos.ts`,
--     `funds.ts`, `photos.ts` and `admin/events.ts` against the live stack rather than
--     trusting this paragraph. `dues_schedules` gained two foreign keys in
--     `20260817000008` and its author measured the same claim instead of reasoning it.
--
-- ── CHECKED BY MUTATION, 2026-08-19 — OBSERVED RESULTS ─────────────
-- AGENTS.md §7's rule is that a green run is not evidence until it has been seen to fail. An
-- earlier draft of this header said that run was OWED. It is not owed any more.
--
-- The file applied CLEAN on the first `npx supabase db reset`, with no repair of any kind. It
-- re-applies as a NO-OP: every table and index skips, the six resource rows and six map rows
-- re-UPSERT to identical values, all four backfill inserts report `INSERT 0 0`, and the verify
-- block runs a second time and passes. FOURTEEN mutations were then applied one at a time and
-- the error each produced is recorded verbatim below. ALL FOURTEEN TRIP.
--
-- HOW EACH WAS APPLIED, because it decides what a pass means.
--   [A] on top of the real run, with the closing `COMMIT` swapped for `ROLLBACK`, so no
--       mutation survived its own run.
--   [B] as a real `db reset` with the mutated file standing in for this one.
--
-- THE SPLIT IS NOT A CONVENIENCE — IDEMPOTENCY HIDES MUTATIONS. `CREATE TABLE IF NOT EXISTS`
-- skips an existing table and `CREATE OR REPLACE FUNCTION` preserves existing privileges, so a
-- constraint or grant mutation applied on top of the real run changes nothing in the database
-- and reports a false pass. Every group-B entry below would read as "does not trip" if it were
-- run the group-A way. Anybody re-running this list must keep the split, and anybody ADDING an
-- entry has to decide which group it belongs in before believing its result.
--
--   m1  drop `AND public.auth_membership_approved()` from one SELECT policy   [A] TRIPS
--         → ROLLBACK: policy on gathering_tasks does not test membership approval, or is
--           not named perm:<table>:select
--   m2  `gatherings_dates_ordered` never created                             [B] TRIPS
--         → ROLLBACK: named CHECK constraint(s) not created:
--           gatherings.gatherings_dates_ordered
--   m3  `gatherings_budget_needs_fund` created but vacuous (CHECK (true))     [B] TRIPS
--         → ROLLBACK: a budget was accepted with no fund behind it
--         20260817000008's m5b exactly: the constraint is PRESENT, so the catalogue read over
--         `pg_constraint` passes, and only the probe's real UPDATE catches it. This is the case
--         that justifies the probe existing at all, and the reason the catalogue half and the
--         behavioural half are both kept for all eleven CHECKs.
--   m4  tg_gathering_same_family()'s fund test inverted to
--       `IS NOT DISTINCT FROM`                                              [A] TRIPS,
--       BUT NOT AT THE ASSERTION THIS LIST NAMES, and that is worth keeping.
--         → gatherings: fund <uuid> belongs to family ZZGATHER, not ZZGATHER — a gathering
--           may only draw on its own family's money
--         An INVERTED guard refuses the LEGITIMATE row first, so the abort arrives from the
--         trigger itself on the probe's positive control (`SET fund_id = v_fund,
--         budget_cents = 500000`) rather than from the cross-family assertion below it. That
--         is the positive control doing its job, and it is NOT evidence that the cross-family
--         half works — so it was re-run with the test DELETED instead, which is the shape a
--         careless edit actually produces:
--   m4a tg_gathering_same_family()'s fund test deleted entirely (vacuous)     [A] TRIPS
--         → ROLLBACK: gatherings accepted another family's fund
--   m5  the `step belongs to the template` conjunct deleted from §2d          [A] TRIPS
--         → ROLLBACK: gathering_tasks accepted a step from another template
--   m6  the `UNIQUE (gathering_id, template_id)` dropped                      [B] TRIPS
--         → ROLLBACK: the same template was linked to one gathering twice
--   m7  `set_updated_at` not attached to `gatherings` (the `CREATE TRIGGER`
--       removed, the `DROP TRIGGER IF EXISTS` above it kept)                  [A] TRIPS
--         → ROLLBACK: set_updated_at is not attached to: gatherings
--         Caught by the catalogue assertion over all six tables, one step before the
--         behavioural probe would have reached it. Both halves are kept: the probe proves the
--         trigger FIRES, and the catalogue half is what covers the tables the probe does not
--         write to.
--   m8  `gatherings/budget` left out of §6a's visibility backfill              [B] TRIPS
--         → ROLLBACK: gatherings/budget is not restricted in 2 family(ies)
--         The two are MIGTEST8 and MIGTEST8B — §6b's leak arriving from the other side, and
--         a live demonstration that the three-table UNION is what finds a family neither
--         `families` nor `people` knows about.
--   m9  the `v_restricted` array in §7 reverted to ARRAY['dues-projections'],
--       the explanatory comment above it LEFT IN PLACE                        [A] TRIPS
--         → ROLLBACK: seed_family_permission_templates() would give a new family
--           gatherings/budget
--         THIS IS THE MUTATION THAT FAILED TO TRIP against an earlier draft of §8l, and it is
--         why that assertion now strips comments before matching. `pg_get_functiondef` returns
--         `prosrc` verbatim, comments included, and §7's own paragraph names
--         `gatherings/budget` in prose — so a bare `LIKE '%gatherings/budget%'` was satisfied
--         by the key's EXPLANATION rather than by the array, and the ONE assertion covering
--         the family created tomorrow was decoration. Measured before the fix: the literal
--         occurred twice in the stored body, at character 617 (the comment) and 1051 (the
--         array). Exactly the class AGENTS.md warns about — "do not assert … and call it
--         protection unless you have checked what runs after".
--   m9a as m9, and the §7 comment reworded so the literal is gone entirely     [A] TRIPS
--         → same message. Kept as m9's control: it is what m9 produced BEFORE §8l was
--           strengthened, so the pair is what shows the fix is real rather than incidental. If
--           §8l is ever rewritten, run both — m9 alone cannot tell a working assertion from a
--           comment-satisfied one.
--   m10 an INSERT policy added to `gathering_tasks`                           [A] TRIPS
--         → ROLLBACK: 1 table(s) carry an INSERT/UPDATE/DELETE policy:
--           gathering_tasks.perm:gathering_tasks:insert
--   m11 §6b's DELETE removed                                                  [B] TRIPS
--         → ROLLBACK: 2 template(s) can view the gathering budget band without
--           administering the family's money
--         AND THIS ONE CONFIRMS §6b IS LOAD-BEARING RATHER THAN PARANOID. It fires on an
--         otherwise unmutated fresh `db reset` the moment the DELETE is taken out, which is
--         how the leak was found. Confirmed on a clean reset with §6b in place:
--         20260813000008's verify block leaves MIGTEST8 and MIGTEST8B behind with four
--         permission templates and 22 visibility rows each, and both their General templates
--         sit on `gatherings/budget` view 'none' while both Administrators sit on 'any'.
--   m12 §2b's step/template test deleted entirely (vacuous guard)              [A] TRIPS
--         → ROLLBACK: a step was attached to another family's template
--
-- ── AND WHAT ELSE THE LIVE STACK ANSWERED, where this header was only predicting ──
--   * AGENTS.md §8's `pg_constraint` detector reports 19 multi-FK pairs, of which exactly TWO
--     are new and both are internal to this feature — `gathering_tasks → people` and
--     `gathering_task_submissions → people`, the two the embed analysis above names. NO table
--     outside this feature gained a path, and THE SURROGATE-PK CLAIM HOLDS: PostgREST answers
--     200 for `gathering_template_uses?select=*,gatherings(title),gathering_templates(name)`
--     and for a nested embed through the junction, so no many-to-many was inferred anywhere.
--   * Every bare embed this file could have broken still resolves 200 against live PostgREST:
--     documents→people, event_photos→people, fund_disbursements and fund_contributions as
--     shipped, photo_collections→events, events→event_types, event_expenses. `gatherings` and
--     `gathering_templates` take a BARE `people(...)` embed at 200, and the bare embed on the
--     two task tables answers 300/PGRST201 — the constraint-naming obligation in the embed
--     analysis, measured rather than asserted.
--   * ONE PRE-EXISTING PGRST201 turned up and is NOT this file's doing: `photos` with
--     `photo_tags(person_id, people(...))` answers 300, because `photo_tags` has carried two
--     foreign keys to `people` since 20260610000001. Proved independent by dropping all six
--     tables here, reloading the PostgREST schema cache and re-asking: still 300.
--   * `anon` and `authenticated` can read, change and delete NOTHING on the six, and RLS is the
--     whole of why. With a real row present both roles see 0 rows, UPDATE and DELETE affect 0
--     rows, and INSERT is refused 42501 — while the table PRIVILEGE is there for both of them,
--     on hosted as much as locally. THIS BULLET USED TO SAY hosted gets "anon none,
--     authenticated SELECT, service_role ALL", measured by revoking the grants and re-applying
--     only this file's. That measured what §3b's grants ADD, not what a database HAS, and the
--     difference matters: `pg_default_acl` hands every new `public` table `anon=arwdDxtm` and
--     `authenticated=arwdDxtm` at CREATE TABLE time, and `relacl` on all six is exactly that
--     and nothing more — the grants below wrote no privilege that was not already held. So do
--     not read the SELECT-only grant as a write boundary; §3's ABSENT write policies are the
--     write boundary, and the header's paragraph on column-level grants is the same fact from
--     the reading side.
--   * All six tables sit inside audit_global_lookups.sql's `family_code` transitive closure,
--     so an empty Gatherings table on hosted can never be reported as an emptied global
--     lookup. That script and audit_policy_shadowing.sql both exit 0 against local, as do
--     `db:check --local --expect-applied` and `audit:people`, and the pre-existing
--     `npm run test:rls` suite is unaffected (189 actions, 378/378).
--   * §5b's narrowing was checked from the other end: no grant anywhere names an action its
--     resource does not declare, `gatherings` included now that it declares `view` and
--     `create` only.
--   * `supabase/scripts/reset_families.sql` NAMED NONE OF THESE SIX and now does, in its §3b —
--     submissions, tasks, uses, gatherings, steps, templates, children before parents and
--     `gathering_template_uses` before `gathering_templates` because that FK is NO ACTION. Its
--     §11 catalogue assertion would have aborted the script the first time it ran against a
--     database holding gathering rows, which is the loud failure that assertion exists to be.
--     ONE THING ABOUT THE PLACEMENT IS LOAD-BEARING AND WAS MEASURED: the block has to sit
--     ABOVE that script's §4 `DELETE FROM funds WHERE system_key IS NULL`, because
--     `gatherings.fund_id` is ON DELETE SET NULL and `gatherings_budget_needs_fund` is enforced
--     on the UPDATE the RI trigger performs — so with a budget set, §4 is refused with a 23514
--     naming a constraint on a table §4 does not mention. `truncate_entire_database.sql` needed
--     NOTHING, confirmed by reading it rather than assumed: it truncates every base table in
--     `public` except a four-name keep-list of GLOBAL LOOKUPS, and its "everything that should
--     be empty is empty" assertion derives its candidates the same way, so all six are covered
--     with no edit and none of them is a lookup to be kept.
--
-- IDEMPOTENT. Every DDL statement is `IF NOT EXISTS` / `CREATE OR REPLACE` /
-- `DROP … IF EXISTS` first, and every write is `ON CONFLICT`. Safe on an empty database,
-- where the backfills find no families and no templates.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How migrations
--   reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The tables ───────────────────────────────────────────────────────────
-- `set_updated_at()` is REUSED on all six rather than reimplemented. It has existed since
-- 20260602000001 and 19 tables fire it; a second copy is how two tables come to disagree
-- about what `updated_at` means. It is written `public.set_updated_at()` here — the
-- function was created unqualified and therefore lives in `public`, and naming the schema
-- is what AGENTS.md asks of every reference in this chain.

-- 1a. gathering_templates — the step list a gathering is built FROM.
CREATE TABLE IF NOT EXISTS public.gathering_templates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code      TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  description      TEXT,
  who_may_schedule TEXT        NOT NULL DEFAULT 'admin'
                     CONSTRAINT gathering_templates_scheduler_valid
                     CHECK (who_may_schedule IN ('admin', 'family')),
  is_archived      BOOLEAN     NOT NULL DEFAULT false,
  created_by       UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_code, name)
);

COMMENT ON TABLE public.gathering_templates IS
  'A reusable, ordered list of steps a gathering can be built from. Family configuration, '
  'like a dues schedule — which is why its policy keys on admin/gathering-templates and not '
  'on the member-facing gatherings key.';
COMMENT ON COLUMN public.gathering_templates.who_may_schedule IS
  '''admin'' = only a holder of admin/gatherings:create may schedule from this template; '
  '''family'' = any approved member holding gatherings:create may. It says NOTHING about who '
  'may EDIT the template, which is always admin/gathering-templates.';
COMMENT ON COLUMN public.gathering_templates.is_archived IS
  'Hides the template from the schedule-from picker without deleting it. Needed because '
  'gathering_template_uses.template_id is NO ACTION on delete, so a template a gathering was '
  'built from cannot be deleted at all — deleteGatheringTemplate counts the uses and offers '
  'archiving instead of surfacing a bare 23503.';

CREATE INDEX IF NOT EXISTS gathering_templates_family_idx
  ON public.gathering_templates (family_code, is_archived);

DROP TRIGGER IF EXISTS gathering_templates_updated_at ON public.gathering_templates;
CREATE TRIGGER gathering_templates_updated_at
  BEFORE UPDATE ON public.gathering_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.gathering_templates ENABLE ROW LEVEL SECURITY;

-- 1b. gathering_template_steps — one step of one template.
CREATE TABLE IF NOT EXISTS public.gathering_template_steps (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code          TEXT        NOT NULL,
  template_id          UUID        NOT NULL REFERENCES public.gathering_templates(id) ON DELETE CASCADE,
  position             INT         NOT NULL DEFAULT 0,
  label                TEXT        NOT NULL,
  help_text            TEXT,
  kind                 TEXT        NOT NULL DEFAULT 'text'
                         CONSTRAINT gathering_template_steps_kind_valid
                         CHECK (kind IN ('text', 'long_text', 'date', 'list', 'yes_no', 'number', 'money')),
  required             BOOLEAN     NOT NULL DEFAULT false,
  budget_default_cents INT
                         CONSTRAINT gathering_template_steps_budget_non_negative
                         CHECK (budget_default_cents IS NULL OR budget_default_cents >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.gathering_template_steps.kind IS
  'What an assignee enters, and therefore the shape of gathering_tasks.answer: text/long_text '
  '{"text"}, date {"date":"YYYY-MM-DD"}, list {"items":[]}, yes_no {"yes":bool}, number '
  '{"number":n}, money {"cents":n}. There is deliberately NO ''members'' kind: '
  'event_blueprint_items stores DISPLAY NAMES in a JSON array, so a rename orphans the answer '
  'and two relatives with one name are one answer. If a step must name people it is a list '
  'today; a people kind storing people.id values is a later migration, not an improvisation.';
COMMENT ON COLUMN public.gathering_template_steps.budget_default_cents IS
  'A SUGGESTION the template carries. The real money is gathering_tasks.budget_cents, copied '
  'from here at instantiation and editable per gathering.';

-- NO UNIQUE ON (template_id, position), deliberately. Reordering under a unique constraint
-- needs a temporary shuffle through values that violate it — the classic "swap two rows"
-- problem — for no benefit here: every read is `ORDER BY position, created_at`, so a tie is
-- a stable and harmless outcome rather than an ambiguity anybody sees. The index is for the
-- read, not for uniqueness.
CREATE INDEX IF NOT EXISTS gathering_template_steps_template_idx
  ON public.gathering_template_steps (template_id, position);

CREATE INDEX IF NOT EXISTS gathering_template_steps_family_idx
  ON public.gathering_template_steps (family_code);

DROP TRIGGER IF EXISTS gathering_template_steps_updated_at ON public.gathering_template_steps;
CREATE TRIGGER gathering_template_steps_updated_at
  BEFORE UPDATE ON public.gathering_template_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.gathering_template_steps ENABLE ROW LEVEL SECURITY;

-- 1c. gatherings — the thing on the calendar.
CREATE TABLE IF NOT EXISTS public.gatherings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  summary      TEXT,
  location     TEXT,
  starts_on    DATE        NOT NULL,
  ends_on      DATE,
  status       TEXT        NOT NULL DEFAULT 'planning'
                 CONSTRAINT gatherings_status_valid
                 CHECK (status IN ('planning', 'scheduled', 'complete', 'cancelled')),
  is_premier   BOOLEAN     NOT NULL DEFAULT false,
  fund_id      UUID        REFERENCES public.funds(id) ON DELETE SET NULL,
  budget_cents INT
                 CONSTRAINT gatherings_budget_non_negative
                 CHECK (budget_cents IS NULL OR budget_cents >= 0),
  created_by   UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gatherings_dates_ordered
    CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT gatherings_budget_needs_fund
    CHECK (budget_cents IS NULL OR fund_id IS NOT NULL)
);

COMMENT ON TABLE public.gatherings IS
  'One gathering: dates, status, an optional budget drawn on a fund, and the premier flag the '
  'Dashboard reads. ONE foreign key to people (created_by) and ONE to funds, so a bare '
  'people(...) embed on this table is unambiguous — keep it that way, or constraint-name every '
  'embed in the feature in the same commit (AGENTS.md §8).';
COMMENT ON COLUMN public.gatherings.ends_on IS
  'NULL means a single day. No time of day and no timezone column anywhere in this schema: '
  'events.event_date is a bare DATE, nothing records a family timezone, and a TIME here would '
  'be a time in no particular zone — two facts that disagree, which is the trap AGENTS.md §4b '
  'records for is_minor.';
COMMENT ON COLUMN public.gatherings.status IS
  'STORED, not derived. A gathering can be cancelled without its dates moving, and ''complete'' '
  'is an organizer''s statement rather than a fact about the calendar. Anything the calendar '
  'derives — past, today, upcoming — is derived from the dates in lib/gatherings.ts.';
COMMENT ON COLUMN public.gatherings.is_premier IS
  'No uniqueness, deliberately. Several gatherings may be flagged; the Dashboard renders the '
  'SOONEST upcoming one and both the admin screen and /help say so. A partial unique index '
  'would let last year''s premier reunion block this year''s.';
COMMENT ON COLUMN public.gatherings.fund_id IS
  'ON DELETE SET NULL, and NO partial unique index — several gatherings may legitimately draw '
  'on one Family Reunion fund, unlike funds.event_id which is 1:1. The SET NULL is carried out '
  'as an ordinary UPDATE by an internal RI trigger, so gatherings_budget_needs_fund is enforced '
  'on it: with a budget set, deleting the fund is REFUSED with a bare 23514, and with no budget '
  'set the link is severed silently. lib/money-attached.ts counts gatherings against a fund for '
  'both reasons — to put a sentence in front of the refusal, and to notice the silent one. Both '
  'directions are probed in this file''s verify block.';

CREATE INDEX IF NOT EXISTS gatherings_family_starts_idx
  ON public.gatherings (family_code, starts_on);

-- Partial: the Dashboard's one read is "the soonest upcoming premier gathering of this
-- family", and almost no row is premier. A full index on a boolean would be a scan wearing
-- an index's clothes.
CREATE INDEX IF NOT EXISTS gatherings_family_premier_idx
  ON public.gatherings (family_code, starts_on) WHERE is_premier;

DROP TRIGGER IF EXISTS gatherings_updated_at ON public.gatherings;
CREATE TRIGGER gatherings_updated_at
  BEFORE UPDATE ON public.gatherings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.gatherings ENABLE ROW LEVEL SECURITY;

-- 1d. gathering_template_uses — which templates this gathering was built from.
CREATE TABLE IF NOT EXISTS public.gathering_template_uses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT        NOT NULL,
  gathering_id UUID        NOT NULL REFERENCES public.gatherings(id) ON DELETE CASCADE,
  template_id  UUID        NOT NULL REFERENCES public.gathering_templates(id),
  position     INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NOT the primary key. See the surrogate-PK paragraph in the header: a composite PK over
  -- these two columns is what makes PostgREST report a many-to-many between `gatherings` and
  -- `gathering_templates`, and every bare embed on either parent then answers PGRST201.
  UNIQUE (gathering_id, template_id)
);

COMMENT ON COLUMN public.gathering_template_uses.template_id IS
  'NO ACTION on delete, which is what makes a template a gathering was built from '
  'undeletable — hence gathering_templates.is_archived and the sentence '
  'deleteGatheringTemplate produces instead of a 23503.';

CREATE INDEX IF NOT EXISTS gathering_template_uses_gathering_idx
  ON public.gathering_template_uses (gathering_id, position);

CREATE INDEX IF NOT EXISTS gathering_template_uses_template_idx
  ON public.gathering_template_uses (template_id);

CREATE INDEX IF NOT EXISTS gathering_template_uses_family_idx
  ON public.gathering_template_uses (family_code);

DROP TRIGGER IF EXISTS gathering_template_uses_updated_at ON public.gathering_template_uses;
CREATE TRIGGER gathering_template_uses_updated_at
  BEFORE UPDATE ON public.gathering_template_uses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.gathering_template_uses ENABLE ROW LEVEL SECURITY;

-- 1e. gathering_tasks — one step, handed to one relative.
CREATE TABLE IF NOT EXISTS public.gathering_tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT        NOT NULL,
  gathering_id UUID        NOT NULL REFERENCES public.gatherings(id) ON DELETE CASCADE,
  template_id  UUID        REFERENCES public.gathering_templates(id) ON DELETE SET NULL,
  step_id      UUID        REFERENCES public.gathering_template_steps(id) ON DELETE SET NULL,
  label        TEXT        NOT NULL,
  help_text    TEXT,
  kind         TEXT        NOT NULL
                 CONSTRAINT gathering_tasks_kind_valid
                 CHECK (kind IN ('text', 'long_text', 'date', 'list', 'yes_no', 'number', 'money')),
  required     BOOLEAN     NOT NULL DEFAULT false,
  position     INT         NOT NULL DEFAULT 0,
  assignee_id  UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  due_on       DATE,
  budget_cents INT
                 CONSTRAINT gathering_tasks_budget_non_negative
                 CHECK (budget_cents IS NULL OR budget_cents >= 0),
  status       TEXT        NOT NULL DEFAULT 'open'
                 CONSTRAINT gathering_tasks_status_valid
                 CHECK (status IN ('open', 'submitted', 'approved', 'denied')),
  answer       JSONB,
  decided_at   TIMESTAMPTZ,
  decided_by   UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.gathering_tasks IS
  'TWO foreign keys to people (assignee_id, decided_by), so every people embed on this table '
  'MUST name its constraint — people!gathering_tasks_assignee_id_fkey(first_name, last_name) — '
  'or PostgREST answers PGRST201 and supabase-js hands back [] (AGENTS.md §8).';
COMMENT ON COLUMN public.gathering_tasks.label IS
  'COPIED from the template step at instantiation, never read through step_id. A task is what a '
  'named relative was ASKED to do; editing the template afterwards must not rewrite the question '
  'or invalidate the answer. Same for help_text, kind and required.';
COMMENT ON COLUMN public.gathering_tasks.assignee_id IS
  'people.id, NEVER auth.users.id. event_assignments keys on an auth id and carries no '
  'family_code: one auth id is identical across every family the account belongs to, so every '
  'query needs an !inner join and an account-less relative (a recorded grandmother, AGENTS.md '
  '§4b) can never hold a task. A people.id key makes family scoping structural and lets a '
  'recorded relative be given a job.';
COMMENT ON COLUMN public.gathering_tasks.answer IS
  'The CURRENT answer, and the APPROVED one when status = ''approved''. The audit trail is '
  'gathering_task_submissions, one row per submission; a denial keeps its review_notes there and '
  'the member resubmits as a NEW row rather than editing the refused one.';

CREATE INDEX IF NOT EXISTS gathering_tasks_assignee_idx
  ON public.gathering_tasks (family_code, assignee_id, status);

CREATE INDEX IF NOT EXISTS gathering_tasks_gathering_idx
  ON public.gathering_tasks (gathering_id, position);

DROP TRIGGER IF EXISTS gathering_tasks_updated_at ON public.gathering_tasks;
CREATE TRIGGER gathering_tasks_updated_at
  BEFORE UPDATE ON public.gathering_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.gathering_tasks ENABLE ROW LEVEL SECURITY;

-- 1f. gathering_task_submissions — the audit trail, and how a denial reaches somebody.
CREATE TABLE IF NOT EXISTS public.gathering_task_submissions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT        NOT NULL,
  task_id      UUID        NOT NULL REFERENCES public.gathering_tasks(id) ON DELETE CASCADE,
  answer       JSONB       NOT NULL,
  note         TEXT,
  submitted_by UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  decision     TEXT        NOT NULL DEFAULT 'pending'
                 CONSTRAINT gathering_task_submissions_decision_valid
                 CHECK (decision IN ('pending', 'approved', 'denied')),
  review_notes TEXT,
  reviewed_by  UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.gathering_task_submissions IS
  'One row per submission, which is what makes a denial actionable: the notes survive, the member '
  'resubmits as a new row, and the history of what was sent and what was said about it stays. TWO '
  'foreign keys to people (submitted_by, reviewed_by) — every embed names its constraint.';
COMMENT ON COLUMN public.gathering_task_submissions.note IS
  'The MEMBER''s note sent with their answer. review_notes is the ORGANIZER''s, and is what a '
  'denial tells them — which is the whole feedback loop this table exists for.';

CREATE INDEX IF NOT EXISTS gathering_task_submissions_task_idx
  ON public.gathering_task_submissions (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gathering_task_submissions_family_idx
  ON public.gathering_task_submissions (family_code);

DROP TRIGGER IF EXISTS gathering_task_submissions_updated_at ON public.gathering_task_submissions;
CREATE TRIGGER gathering_task_submissions_updated_at
  BEFORE UPDATE ON public.gathering_task_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.gathering_task_submissions ENABLE ROW LEVEL SECURITY;

-- ── 2. The guard triggers — the service role's boundary ─────────────────────
-- AGENTS.md §4 stated in the database. RLS is a predicate over the ROW being written, so a
-- gathering stamped with the caller's own family_code satisfies every policy on this table
-- while its `fund_id` points at another family's money — and nothing in the database
-- objects, because nothing is asked. The same shape covers every id these tables carry.
--
-- TRIGGERS RATHER THAN POLICIES, because every write in this feature runs through
-- createAdminClient() and the service role does not consult RLS. It does not bypass
-- triggers. Same reasoning as 20260806000002, 20260807000001, 20260807000002 and
-- tg_fund_transfer_same_family, whose shape these four copy.
--
-- SECURITY DEFINER with an empty search_path on all five: they read `funds`, `people` and
-- each other's rows the calling role may not be able to see, and the answer must not depend
-- on that.
-- ERRCODE 23514 with a DISTINCTIVE message on every one — 23514 is also what the table
-- CHECKs raise, so a verify block that cannot tell them apart is one that passes for the
-- wrong reason. A trigger function needs no GRANT: EXECUTE is checked at CREATE TRIGGER
-- time, not at fire time.
--
-- The actions verify these ids too (belongsToFamily), and this is the half that cannot be
-- forgotten at a call site.

-- 2a. A gathering's fund, and the person recorded as having created it.
--
-- THE SPEC FOR THIS FILE NAMED `fund_id` ONLY, and `created_by` is checked as well. It is
-- the same shape — a client-suppliable id written onto a row whose family_code is the
-- caller's own — and leaving it out would mean this table's two people-shaped columns were
-- guarded to two different standards while `gathering_tasks` below checks all four of its
-- own. In practice `created_by` always arrives from the guard's own `personId`, so this
-- refuses nothing a legitimate call makes.
CREATE OR REPLACE FUNCTION public.tg_gathering_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fund_family   text;
  v_person_family text;
BEGIN
  IF NEW.fund_id IS NOT NULL THEN
    SELECT f.family_code INTO v_fund_family FROM public.funds f WHERE f.id = NEW.fund_id;
    IF v_fund_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gatherings: fund % belongs to family %, not % — a gathering may only draw on its own family''s money',
        NEW.fund_id, COALESCE(v_fund_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.created_by IS NOT NULL THEN
    SELECT p.family_code INTO v_person_family FROM public.people p WHERE p.id = NEW.created_by;
    IF v_person_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gatherings: created_by % belongs to family %, not %',
        NEW.created_by, COALESCE(v_person_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_gathering_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS gatherings_same_family ON public.gatherings;
CREATE TRIGGER gatherings_same_family
  BEFORE INSERT OR UPDATE ON public.gatherings
  FOR EACH ROW EXECUTE FUNCTION public.tg_gathering_same_family();

-- 2b. A step's template.
--
-- THE ONE ID ON THESE SIX TABLES THAT NOTHING CHECKED. `gathering_template_steps.template_id`
-- had no trigger and there is no INSERT policy on any table here, so it was AGENTS.md §4 in its
-- purest form: `addTemplateStep({ templateId })` writes a row stamped with the CALLER's own
-- `family_code` — satisfying every predicate that exists — while `template_id` points into
-- another family's template. Two directions of harm, and the second is the one a family cannot
-- repair:
--
--   * ALPHA's administrator attaches a step to BRAVO's template. A step editor reads by
--     `template_id`, so ALPHA-authored label and help text render inside BRAVO's admin screen
--     and are copied into BRAVO's tasks at the next instantiation.
--   * The row is stamped ALPHA, so `perm:gathering_template_steps:select` — which scopes on the
--     step's OWN `family_code` — means BRAVO cannot see it to remove it. And `template_id` is
--     ON DELETE CASCADE, so BRAVO deleting their own template silently destroys ALPHA's row,
--     which `deleteGatheringTemplate` does not refuse because it counts
--     `gathering_template_uses`, not steps.
--
-- Guarded here rather than left to the action for §2's stated reason: the action checks it too
-- with `belongsToFamily`, and this is the half that cannot be forgotten at a call site. Its
-- absence was also invisible to the verify block, because there was no trigger to probe.
CREATE OR REPLACE FUNCTION public.tg_gathering_template_step_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_template_family text;
BEGIN
  SELECT t.family_code INTO v_template_family
    FROM public.gathering_templates t WHERE t.id = NEW.template_id;
  IF v_template_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'gathering_template_steps: template % belongs to family %, not % — a step may only be added to its own family''s template',
      NEW.template_id, COALESCE(v_template_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_gathering_template_step_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS gathering_template_steps_same_family ON public.gathering_template_steps;
CREATE TRIGGER gathering_template_steps_same_family
  BEFORE INSERT OR UPDATE ON public.gathering_template_steps
  FOR EACH ROW EXECUTE FUNCTION public.tg_gathering_template_step_same_family();

-- 2c. Both ends of a template link.
CREATE OR REPLACE FUNCTION public.tg_gathering_template_use_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gathering_family text;
  v_template_family  text;
BEGIN
  SELECT g.family_code INTO v_gathering_family
    FROM public.gatherings g WHERE g.id = NEW.gathering_id;
  SELECT t.family_code INTO v_template_family
    FROM public.gathering_templates t WHERE t.id = NEW.template_id;

  IF v_gathering_family IS DISTINCT FROM NEW.family_code
     OR v_template_family IS DISTINCT FROM NEW.family_code
  THEN
    RAISE EXCEPTION
      'gathering_template_uses: gathering and template must both belong to family % (gathering %, template %)',
      NEW.family_code, COALESCE(v_gathering_family, 'missing'), COALESCE(v_template_family, 'missing')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_gathering_template_use_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS gathering_template_uses_same_family ON public.gathering_template_uses;
CREATE TRIGGER gathering_template_uses_same_family
  BEFORE INSERT OR UPDATE ON public.gathering_template_uses
  FOR EACH ROW EXECUTE FUNCTION public.tg_gathering_template_use_same_family();

-- 2d. A task carries five ids. Every one of them is checked, and the step must additionally
-- belong to the template the task claims it came from — otherwise a task could record
-- provenance pointing at a step of a template it was never built from, which is a lie the
-- organizer console would then print.
CREATE OR REPLACE FUNCTION public.tg_gathering_task_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gathering_family text;
  v_template_family  text;
  v_step_family      text;
  v_step_template    uuid;
  v_assignee_family  text;
  v_decider_family   text;
BEGIN
  SELECT g.family_code INTO v_gathering_family
    FROM public.gatherings g WHERE g.id = NEW.gathering_id;
  IF v_gathering_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'gathering_tasks: gathering % belongs to family %, not %',
      NEW.gathering_id, COALESCE(v_gathering_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  IF NEW.template_id IS NOT NULL THEN
    SELECT t.family_code INTO v_template_family
      FROM public.gathering_templates t WHERE t.id = NEW.template_id;
    IF v_template_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_tasks: template % belongs to family %, not %',
        NEW.template_id, COALESCE(v_template_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.step_id IS NOT NULL THEN
    SELECT s.family_code, s.template_id INTO v_step_family, v_step_template
      FROM public.gathering_template_steps s WHERE s.id = NEW.step_id;
    IF v_step_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_tasks: step % belongs to family %, not %',
        NEW.step_id, COALESCE(v_step_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
    IF NEW.template_id IS NOT NULL AND v_step_template IS DISTINCT FROM NEW.template_id THEN
      RAISE EXCEPTION
        'gathering_tasks: step % is not a step of template % (it belongs to %)',
        NEW.step_id, NEW.template_id, COALESCE(v_step_template::text, 'nothing')
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.assignee_id IS NOT NULL THEN
    SELECT p.family_code INTO v_assignee_family
      FROM public.people p WHERE p.id = NEW.assignee_id;
    IF v_assignee_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_tasks: assignee % belongs to family %, not %',
        NEW.assignee_id, COALESCE(v_assignee_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.decided_by IS NOT NULL THEN
    SELECT p.family_code INTO v_decider_family
      FROM public.people p WHERE p.id = NEW.decided_by;
    IF v_decider_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_tasks: decided_by % belongs to family %, not %',
        NEW.decided_by, COALESCE(v_decider_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_gathering_task_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS gathering_tasks_same_family ON public.gathering_tasks;
CREATE TRIGGER gathering_tasks_same_family
  BEFORE INSERT OR UPDATE ON public.gathering_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_gathering_task_same_family();

-- 2e. A submission: its task, its author, and whoever ruled on it.
CREATE OR REPLACE FUNCTION public.tg_gathering_task_submission_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task_family     text;
  v_author_family   text;
  v_reviewer_family text;
BEGIN
  SELECT t.family_code INTO v_task_family
    FROM public.gathering_tasks t WHERE t.id = NEW.task_id;
  IF v_task_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'gathering_task_submissions: task % belongs to family %, not %',
      NEW.task_id, COALESCE(v_task_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  IF NEW.submitted_by IS NOT NULL THEN
    SELECT p.family_code INTO v_author_family
      FROM public.people p WHERE p.id = NEW.submitted_by;
    IF v_author_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_task_submissions: submitted_by % belongs to family %, not %',
        NEW.submitted_by, COALESCE(v_author_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.reviewed_by IS NOT NULL THEN
    SELECT p.family_code INTO v_reviewer_family
      FROM public.people p WHERE p.id = NEW.reviewed_by;
    IF v_reviewer_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_task_submissions: reviewed_by % belongs to family %, not %',
        NEW.reviewed_by, COALESCE(v_reviewer_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_gathering_task_submission_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS gathering_task_submissions_same_family ON public.gathering_task_submissions;
CREATE TRIGGER gathering_task_submissions_same_family
  BEFORE INSERT OR UPDATE ON public.gathering_task_submissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_gathering_task_submission_same_family();

-- ── 3. Row Level Security: one SELECT policy per table, hand-written ────────
-- 20260618000001's sweep WRAPS existing policies and never creates one, and it is a
-- one-shot DO block that cannot reach a table added a year later. So every policy here is
-- written by hand — and each one reproduces `_perm_predicate()`'s rendering EXACTLY, so the
-- hand-written policy and the permission_table_map row in §4 cannot disagree, and a future
-- sweep re-composing from that row would produce the identical predicate:
--
--     ((<self_expr>) OR auth_permission(k,a) = 'any' OR (auth_permission(k,a) = 'own' AND (<own_expr>)))
--
-- The literal `(false)` is therefore written out rather than dropped where a table has no
-- self or own expression. It reads oddly and it is the point: it is what makes the policy
-- diff-able against the model.
--
-- `auth_membership_approved()` on every one, as every policy has carried since
-- 20260806000011. auth_permission() already denies a non-approved caller through
-- auth_person_id(), so it is belt and braces — written out rather than assumed, because a
-- policy dropped and recreated without it quietly re-admits an applicant.
--
-- NO INSERT, UPDATE OR DELETE POLICY ON ANY OF THE SIX TABLES, and this comment is where
-- they would be. The same shape fund_disbursements and fund_transfers keep: every write in
-- this feature is a server action on createAdminClient() that re-applies family scoping by
-- hand (§3) and lands on §2's triggers. The browser has no write path to these tables at
-- all, and adding one would create a second, weaker boundary beside the one the actions and
-- the triggers already form.

DROP POLICY IF EXISTS "perm:gathering_templates:select" ON public.gathering_templates;
CREATE POLICY "perm:gathering_templates:select"
  ON public.gathering_templates FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      (false)                                                                              -- self_expr
      OR public.auth_permission('admin/gathering-templates', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('admin/gathering-templates', 'view'::public.permission_action) = 'own'
          AND (created_by = public.auth_person_id()))                                       -- own_expr
    )
  );

-- A TEMPLATE KEYS ON THE ADMIN RESOURCE, and that is a decision rather than an accident of
-- where the screen lives. A template is family CONFIGURATION, like a dues schedule
-- (dues_schedules → admin/account). Members never read the template library; they read the
-- TASKS instantiated from it, and those key on `gatherings`.
--
-- SO AN ORDINARY MEMBER CANNOT READ THESE TWO TABLES ON THE USER CLIENT AT ALL, and two
-- member-facing surfaces need a field from them anyway. The answer is written here rather than
-- left for whoever writes the action to discover, because the discovery has a wrong turning
-- that looks like the obvious one:
--
--   * `getGatheringDetail` returns `templates: {id, name}[]` and groups the task list by
--     template name; `getSchedulableTemplates` offers the `who_may_schedule = 'family'` subset
--     to a member who holds `gatherings:create` and not the admin key — which is the entire
--     point of that column. BOTH read through `createAdminClient()` with
--     `.eq('family_code', familyCode)` applied by hand: §3's ordinary bargain, and what every
--     accounting read in this app already does. What crosses the wire is a name.
--   * DO NOT "fix" it by keying either policy on `gatherings:view`. That publishes the whole
--     library — archived drafts, suggested budgets, every step's help text — to every member of
--     every family, and it still could not express `getSchedulableTemplates`, which filters on
--     `who_may_schedule` and no policy can say that.
--   * The third option is the one that happens by accident: a user-client read here returns no
--     rows and no error (AGENTS.md §8), so the screen renders "no templates" over templates
--     that exist. Whichever way a future author goes, the grouping has to degrade DELIBERATELY.
DROP POLICY IF EXISTS "perm:gathering_template_steps:select" ON public.gathering_template_steps;
CREATE POLICY "perm:gathering_template_steps:select"
  ON public.gathering_template_steps FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      (false)                                                                              -- self_expr
      OR public.auth_permission('admin/gathering-templates', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('admin/gathering-templates', 'view'::public.permission_action) = 'own'
          AND (false))                                                                      -- own_expr
    )
  );

-- `gatherings` CARRIES `self_expr = (false)`, AND THAT IS A DECISION SOMEBODY MADE THE OTHER WAY
-- ONCE AND BACKED OUT. Written down here because the literal `(false)` is a statement with no
-- argument attached, and the next reader's reflex — the last reader's was — is that a member
-- holding a task on this gathering obviously has a "self" claim on the gathering itself.
--
-- A GATHERING IS FAMILY-WIDE CONFIGURATION, like a dues schedule. The member's OWN thing is the
-- TASK: `gathering_tasks` and `gathering_task_submissions` each carry a real `self_expr`
-- (`assignee_id` / `submitted_by` = `auth_person_id()`) and this table deliberately does not,
-- because being handed a job at the reunion is not ownership of the reunion. `own_expr` is
-- `created_by = auth_person_id()`, which is the one genuine personal claim on this row — and it
-- is a SCOPE an administrator grants, not a self-branch that no grid switch can withhold.
--
-- THE COST, STATED SO NOBODY PAYS IT TWICE. In a family that has restricted `gatherings:view`,
-- an assignee cannot read the gathering row their task belongs to on the user client at all. So
-- `getMyGatheringTasks` reads the gathering TITLE and START DATE on the ADMIN client, scoped by
-- `family_code` and by the task ids RLS has already released to that caller — the same bargain,
-- in the same module, that it already makes for template names and for assignee names, and §3's
-- obligation discharged by hand.
--
-- THE ALTERNATIVE WAS A POLICY HELPER, AND IT IS THE THING NOT TO RE-ADD. A SECURITY DEFINER
-- `auth_person_holds_gathering_task(gathering_id)` in the self-branch here would let the policy
-- release the row — and a function in `public` is a public HTTP endpoint the moment it is granted
-- EXECUTE to `authenticated`, which naming it in a policy REQUIRES: policy expressions are
-- evaluated as the QUERYING role (AGENTS.md §2b, and `auth_family_code()` is the worked example).
-- That is a new `POST /rest/v1/rpc/auth_person_holds_gathering_task`, reachable with the anon key
-- in the browser bundle, taking a gathering id and answering yes-or-no about the caller — bought
-- to save one admin-client read the module was already making twice over. It was written during
-- this feature's build and backed out for exactly that reason, and nothing in the tree or the
-- history carries it now.
--
-- The inline version needs no function and is worse, not better: widening this `self_expr` to a
-- correlated `EXISTS` over `gathering_tasks` works — the assignee's own task rows are released to
-- them by that table's own `self_expr`, so the subquery is satisfiable under RLS — and it hands
-- every task-holder a read of the WHOLE gathering row, `budget_cents` and `fund_id` included, in
-- precisely the family that restricted the screen. See the paragraph above
-- `perm:gathering_tasks:select` for the reading half of this, and 5c for the map row that has to
-- move with it.
DROP POLICY IF EXISTS "perm:gatherings:select" ON public.gatherings;
CREATE POLICY "perm:gatherings:select"
  ON public.gatherings FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      (false)                                                                              -- self_expr
      OR public.auth_permission('gatherings', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('gatherings', 'view'::public.permission_action) = 'own'
          AND (created_by = public.auth_person_id()))                                       -- own_expr
    )
  );

DROP POLICY IF EXISTS "perm:gathering_template_uses:select" ON public.gathering_template_uses;
CREATE POLICY "perm:gathering_template_uses:select"
  ON public.gathering_template_uses FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      (false)                                                                              -- self_expr
      OR public.auth_permission('gatherings', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('gatherings', 'view'::public.permission_action) = 'own'
          AND (false))                                                                      -- own_expr
    )
  );

-- `self_expr` ON THE TWO TASK TABLES IS WHAT MAKES /gatherings/my-tasks WORK — the ROWS of it.
-- An assignee must be able to read their own task and their own submissions even in a family
-- that has restricted `gatherings` view — the same argument `people` makes for a member's own
-- profile row. Without it a family that narrowed the Gatherings screen would have taken away
-- the page members were told to go and answer their tasks on.
--
-- IT DOES NOT MAKE THE WHOLE SCREEN WORK, AND THE MISSING HALF IS NOT A DEFECT IN THESE
-- POLICIES. `gatherings` above carries `self_expr = (false)` deliberately, so the same family
-- that restricted `gatherings:view` gives an assignee their task and NOT the gathering it
-- belongs to. A `gatherings(...)` embed on the my-tasks read would therefore answer `null` —
-- not PGRST201, not an error, just absent (AGENTS.md §8 in its quietest costume) — and every
-- row would render with an empty title and no date.
--
-- So `getMyGatheringTasks` does not embed it: `gathering_id` is a plain column and the title
-- and date come from a separate read on the ADMIN client, family-scoped by hand. That is the
-- same bargain the two template tables take three paragraphs up, and it is why widening this
-- table's `self_expr` is not the fix it looks like — it would hand every task-holder a read of
-- the gathering row, its budget columns included, to spare one admin-client query the feature
-- already makes elsewhere. An earlier draft of this file did exactly that and it was backed
-- out; if it is ever reconsidered, the three paragraphs in `app/actions/gatherings.ts` that
-- explain the admin-client read have to move in the same commit.
DROP POLICY IF EXISTS "perm:gathering_tasks:select" ON public.gathering_tasks;
CREATE POLICY "perm:gathering_tasks:select"
  ON public.gathering_tasks FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      (assignee_id = public.auth_person_id())                                               -- self_expr
      OR public.auth_permission('gatherings', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('gatherings', 'view'::public.permission_action) = 'own'
          AND (assignee_id = public.auth_person_id()))                                      -- own_expr
    )
  );

DROP POLICY IF EXISTS "perm:gathering_task_submissions:select" ON public.gathering_task_submissions;
CREATE POLICY "perm:gathering_task_submissions:select"
  ON public.gathering_task_submissions FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      (submitted_by = public.auth_person_id())                                              -- self_expr
      OR public.auth_permission('gatherings', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('gatherings', 'view'::public.permission_action) = 'own'
          AND (submitted_by = public.auth_person_id()))                                     -- own_expr
    )
  );

-- ── 3b. Table grants, stated ────────────────────────────────────────────────
-- Following 20260811000000. `supabase/seed.sql` re-grants every table locally and hosted
-- carries a legacy full ACL, so this works either way today — which is exactly the silent
-- dependency worth removing: on a database with neither, an unstated grant means
-- "permission denied for table" for the service role and a green RLS suite testing nothing.
--
-- SELECT ONLY for `authenticated`, matching §3's policies: there is no browser write path.
-- NEVER a table-level REVOKE — seed.sql undoes one within seconds of a reset, and it would
-- read as a protection that is not there.
GRANT SELECT ON public.gathering_templates        TO authenticated;
GRANT SELECT ON public.gathering_template_steps   TO authenticated;
GRANT SELECT ON public.gatherings                 TO authenticated;
GRANT SELECT ON public.gathering_template_uses    TO authenticated;
GRANT SELECT ON public.gathering_tasks            TO authenticated;
GRANT SELECT ON public.gathering_task_submissions TO authenticated;

GRANT ALL ON public.gathering_templates        TO service_role;
GRANT ALL ON public.gathering_template_steps   TO service_role;
GRANT ALL ON public.gatherings                 TO service_role;
GRANT ALL ON public.gathering_template_uses    TO service_role;
GRANT ALL ON public.gathering_tasks            TO service_role;
GRANT ALL ON public.gathering_task_submissions TO service_role;

-- ── 4. Which resource key governs which table ───────────────────────────────
-- The record, not the mechanism: nothing reads permission_table_map at run time, and §3's
-- policies are already 'perm:'-prefixed so a sweep skips them. It matters because migrations
-- compute their sweep lists from this table, and because the code and the database must never
-- disagree about who may do what (AGENTS.md §2).
--
-- Deliberately AFTER §5 would be wrong: resource_key is a foreign key to
-- permission_resources, so the keys have to exist first — which on a fresh chain they do,
-- from 20260618000000's seed, and on a database meeting them here for the first time they
-- do not. §5 therefore runs before this block. (Kept as one numbered section per idea, with
-- the insert below §5's, so the file reads in the order it must run.)

-- ── 5. The resource catalogue ───────────────────────────────────────────────
-- Six keys. `subsection` is NULL for the two top-level member routes and the two admin rail
-- items, and 'Gatherings' for the two sub-keys — the same rule `transactions/*` and
-- `account-summary/funds` follow, where the sub-heading is named for the RAIL ITEM it hangs
-- off so the grid reads Events › Gatherings › My Gathering Tasks.
--
-- CAPTIONS COME FROM THE SCREEN (AGENTS.md, "One rail item, one permission resource"): each
-- label here is the caption on the rail item and the page's own h1. `gatherings/budget` has
-- no screen of its own — it is the money band on /gatherings/[id] and /admin/gatherings/[id]
-- — so its caption names the band an administrator is switching off.
--
-- ACTIONS: only what something reads, and every one of these was traced to its reader before
-- being declared. `gatherings` declares `view` and `create` — `view` is the SELECT policies on
-- four of the six tables plus `requireRead('gatherings')`, and `create` is
-- `requireScope('gatherings', 'create')` in `scheduleGathering`, which is what lets a member
-- schedule from a `who_may_schedule = 'family'` template. The two admin keys declare all four:
-- `requireScope(…, 'view'|'create')`, `requireEdit` and `requireDelete` in the two admin action
-- modules, one call site each. `gatherings/my-tasks`, `gatherings/budget` and `calendar` declare
-- `view` alone, being read-only screens or a band over records owned by other resources.
--
-- `gatherings` DELIBERATELY DOES NOT DECLARE `edit` OR `delete`. It did, and nothing read
-- either: there is no UPDATE or DELETE policy on any of the six tables by design (§3), so no
-- SQL evaluates them, and every mutation of a gathering — `updateGathering`, `deleteGathering`,
-- `setGatheringPremier`, `setGatheringBudget`, `assignGatheringTask`, `reviewGatheringTask` —
-- gates on `admin/gatherings`. Two switches on Members & Access that an administrator could
-- move and which granted nothing, which AGENTS.md is explicit about ("a switch nothing consults
-- reads as a control being honoured") and which 20260808000000 §6 narrowed `transactions` and
-- `account-summary` for the same reason. Before adding one back, name the policy, the
-- `permission_table_map` row or the `can*()` call that will read it. §5b is what clears the
-- grants the fresh-chain materialization hands out for them.
--
-- The `permission_table_map` row for `gatherings` does not rescue them: a map row is only ever
-- READ when a policy is composed from it, and §3 composes SELECT only.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('gatherings',                'Gatherings',            'events', NULL,         91,
   ARRAY['view','create']::TEXT[]),
  ('gatherings/my-tasks',       'My Gathering Tasks',    'events', 'Gatherings', 92,
   ARRAY['view']::TEXT[]),
  ('gatherings/budget',         'Gathering Budget',      'events', 'Gatherings', 93,
   ARRAY['view']::TEXT[]),
  ('calendar',                  'Calendar',              'events', NULL,         94,
   ARRAY['view']::TEXT[]),
  ('admin/gatherings',          'Gathering Management',  'admin',  NULL,        231,
   ARRAY['view','create','edit','delete']::TEXT[]),
  ('admin/gathering-templates', 'Gathering Templates',   'admin',  NULL,        232,
   ARRAY['view','create','edit','delete']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- 5b. The grants those narrowings orphan.
--
-- Only reachable on a fresh chain, where 20260618000000's seed registers all six keys with
-- the DEFAULT four actions — the `actions` column does not exist that early — and every
-- materializing loop between there and here hands out a grant per action. Narrowing three of
-- them to ARRAY['view'] above leaves create/edit/delete grants naming actions their resource
-- no longer declares, which 20260808000000 §6c and 20260815000000 §5f both assert against. A
-- no-op on a database meeting these keys for the first time in this file. Same two-step as
-- 20260812000000 §3c and 20260817000006 §4.
DELETE FROM public.template_permissions tp
 USING public.permission_resources pr
 WHERE pr.key = tp.resource_key
   AND tp.resource_key IN ('gatherings', 'gatherings/my-tasks', 'gatherings/budget', 'calendar',
                           'admin/gatherings', 'admin/gathering-templates')
   AND NOT (tp.action::text = ANY (pr.actions));

-- 5c. The map rows §4 describes.
--
-- `gatherings` CARRIES `self_expr = 'false'` HERE FOR THE REASON IT CARRIES `(false)` IN §3's
-- POLICY, and the two have to be read together: `20260618000001` COMPOSES a policy out of these
-- expressions, so an author who "corrected" this row by giving the table a self test would be
-- recomposing `perm:gatherings:select` from it — which is the change the paragraph above that
-- policy spends five paragraphs refusing. In short, and the long version is up there: a gathering
-- is family-wide configuration, the member's OWN thing is the TASK (which is why the two task
-- rows below carry a real `self_expr` and this one does not), and the price of the missing branch
-- is one admin-client read of the title and date in `getMyGatheringTasks` rather than a new
-- publicly-reachable SECURITY DEFINER function in `public` (AGENTS.md §2b). The row and the
-- policy move together or not at all.
INSERT INTO public.permission_table_map (table_name, resource_key, own_expr, self_expr) VALUES
  ('gathering_templates',        'admin/gathering-templates', 'created_by = public.auth_person_id()',   'false'),
  ('gathering_template_steps',   'admin/gathering-templates', 'false',                                 'false'),
  ('gatherings',                 'gatherings',                'created_by = public.auth_person_id()',   'false'),
  ('gathering_template_uses',    'gatherings',                'false',                                 'false'),
  ('gathering_tasks',            'gatherings',                'assignee_id = public.auth_person_id()',  'assignee_id = public.auth_person_id()'),
  ('gathering_task_submissions', 'gatherings',                'submitted_by = public.auth_person_id()', 'submitted_by = public.auth_person_id()')
ON CONFLICT (table_name) DO UPDATE
  SET resource_key = EXCLUDED.resource_key,
      own_expr     = EXCLUDED.own_expr,
      self_expr    = EXCLUDED.self_expr;

-- `self_write_expr` is 'false' on all six, stated explicitly. The column defaults to 'false'
-- since 20260806000001 — but that migration SET it from `self_expr` for the rows that
-- existed, and being explicit is what stops a future sweep reading "it is my task" as
-- authority to WRITE it. An assignee submits an answer through an action that checks
-- ownership; they do not get an UPDATE policy on the row.
UPDATE public.permission_table_map
   SET self_write_expr = 'false'
 WHERE table_name IN ('gathering_templates', 'gathering_template_steps', 'gatherings',
                      'gathering_template_uses', 'gathering_tasks', 'gathering_task_submissions');

-- ── 6. What each family may see, and who can grant it ───────────────────────

-- 6a. The three restricted keys, for every family that exists.
--
-- THE SOURCE IS THREE TABLES UNIONed, and that is the whole lesson of 20260817000001:
-- 20260817000000 keyed its backfill off `people.family_code` alone, and two family codes that
-- hold templates and visibility rows while appearing in neither `families` nor `people` are
-- missing its restriction to this day. A code carried only on `people` is a real family (it is
-- what tests/rls seeds); a code carried only on `permission_templates` is a real family too,
-- and is reached by neither of the other two.
--
-- For the two `admin/` keys this is no longer what makes them SAFE — since 20260817000004 an
-- admin key with no visibility row denies — it is what makes the grid render a switch an
-- administrator can move. For `gatherings/budget` it is the ONLY thing that restricts the key
-- at all: nothing else withholds a non-admin one.
--
-- "Restricts the key", and not "hides the money" — the header's own paragraph on this says why
-- at length. The budget and every task's line are columns on tables governed by `gatherings`,
-- so what this row withholds is the FETCH of the band on the two screens, not the figures from
-- PostgREST. An administrator moving this switch is choosing who the product shows the money
-- to, which is a real decision and a narrower one than it sounds.
--
-- Nothing is written for `gatherings`, `gatherings/my-tasks` or `calendar`. Those default to
-- 'everyone' and should: a family that has said nothing has not restricted anything, and these
-- are the family's own gatherings, the member's own tasks and a calendar of both.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT f.code, k.key, 'restricted'
  FROM (
    SELECT family_code AS code FROM public.families
    UNION
    SELECT DISTINCT family_code FROM public.people
     WHERE family_code IS NOT NULL AND family_code <> ''
    UNION
    SELECT DISTINCT family_code FROM public.permission_templates
     WHERE family_code IS NOT NULL AND family_code <> ''
  ) f
 CROSS JOIN (VALUES
   ('admin/gatherings'),
   ('admin/gathering-templates'),
   ('gatherings/budget')
 ) AS k(key)
 WHERE f.code IS NOT NULL AND f.code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- 6b. TAKE THE BUDGET BAND OFF ANYBODY WHO WAS NEVER MEANT TO HAVE IT.
--
-- This looks like a paranoid no-op and it is not: a FRESH DATABASE arrives here with the
-- over-grant already written, and the whole restriction would ship defeated on every
-- `db reset` and in every `npm run test:rls` run.
--
-- The path, traced rather than guessed. `20260813000008`'s verify block creates two probe
-- families (MIGTEST8, MIGTEST8B) to exercise the bloodline-anchor trigger and deletes only
-- their `people` and `families` rows — their permission TEMPLATES, grants and visibility rows
-- are still there. That is the documented leak `20260817000004` and `20260817000006` both
-- point at ("two family codes that hold templates and visibility rows while appearing in
-- neither `families` nor `people`"), and it is why §6a unions three tables. On a fresh chain
-- those templates are materialized by the version of `seed_family_permission_templates()` in
-- force at THAT point — `20260807000000`'s, whose General grid reads
-- `WHEN a = 'view' AND pr.category <> 'admin' THEN 'any'` — and `gatherings/budget` is
-- category `events`. So General is handed view 'any' on the money band, the row is never
-- cleaned up, and §6e's ON CONFLICT DO NOTHING cannot correct it.
--
-- Hosted is not affected, and the difference is worth stating: the key does not exist there
-- until §5 registers it, and `template_permissions.resource_key` is a foreign key — so no
-- grant for it can exist before this file runs. This repairs the artifact of the CHAIN.
--
-- NARROWED BY THE SAME RULE §6d GRANTS BY, not a blanket delete of the key, which is
-- `20260817000001` §1's shape and its warning: once a family has had time to adjust the grid,
-- deleting rows by inference is deleting somebody's decision. Nothing but this file has
-- written this key, so the window is minutes wide — and narrowing it anyway means a hand
-- replay cannot undo a deliberate grant made afterwards.
--
-- `scope <> 'none'` IS LOAD-BEARING. Without it this deletes the materialized DENIALS too,
-- and those are not the defect — they are what lets Members & Access render the whole answer
-- instead of a blank cell (§6e).
DELETE FROM public.template_permissions tp
 WHERE tp.resource_key = 'gatherings/budget'
   AND tp.scope <> 'none'
   AND NOT EXISTS (
     SELECT 1 FROM public.template_permissions g
      WHERE g.template_id = tp.template_id
        AND g.resource_key = 'admin/account'
        AND g.action = 'view' AND g.scope = 'any')
   AND NOT EXISTS (
     SELECT 1 FROM public.permission_templates t
      WHERE t.id = tp.template_id AND t.name = 'Administrators' AND t.is_system = true);

-- 6c. Administrators FIRST, on every action each key declares.
--
-- "Restricted with nobody granted is a screen that exists and cannot be opened"
-- (20260808000000), and in the worst ordering the screen that just locked is the one that
-- could unlock it. 20260817000004 §3 sweeps every admin key onto every system Administrators
-- template — but it ran before these keys existed, and a migration a database has already
-- applied never runs again, so its sweep cannot reach hosted on their behalf.
--
-- BEFORE 6e's computed default, which is ON CONFLICT DO NOTHING and would otherwise leave
-- Administrators sitting on a computed 'none' forever.
--
-- ONLY the system Administrators template, on the `is_system = true` + name test the rest of
-- the chain uses — not the name alone, which a family may rename, and not "every template that
-- can already edit some other admin key", which would widen access on deploy.
--
-- `unnest(pr.actions)` so no grant is written for an action a resource does not declare.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, pr.key, a::public.permission_action, 'any', NOW()
  FROM public.permission_templates t
 CROSS JOIN public.permission_resources pr
 CROSS JOIN LATERAL unnest(pr.actions) AS a
 WHERE t.name = 'Administrators' AND t.is_system = true
   AND pr.key IN ('gatherings', 'gatherings/my-tasks', 'gatherings/budget', 'calendar',
                  'admin/gatherings', 'admin/gathering-templates')
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- 6d. And whoever already runs the family's money can see the money band.
--
-- DERIVED FROM AN ADMIN KEY — `admin/account:view = any`, the Accounting screen where funds,
-- schedules and routing are configured. 20260817000000 §3 derived the equivalent grant from
-- `transactions/dues-payments` and had to be corrected by 20260817000001, because
-- seed_family_permission_templates() gives the General template view 'any' on every non-admin
-- resource: the grant reached every member of every family and undid the restriction in the
-- same file. An admin key is the only kind that actually distinguishes an administrator.
--
-- SCOPE 'any' ON BOTH SIDES, written rather than copied from tp.scope: an own-scoped
-- accounting grant is not a claim on a gathering's budget, and `gatherings/budget` has
-- own_expr 'false' — which is why it belongs in NO_OWNER_KEYS in
-- components/admin/resource-groups.ts, where an 'own' switch would light up as a grant and
-- grant nothing.
--
-- BEFORE 6e, for the same reason 6c is: DO NOTHING means the first writer wins, and the
-- computed default would otherwise pin every non-Administrators template at 'none'.
--
-- DO NOTHING rather than DO UPDATE, so a re-run never stamps over a grant an administrator has
-- since adjusted, and a family that deliberately removed this keeps it removed.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT DISTINCT tp.template_id, 'gatherings/budget', 'view'::public.permission_action,
       'any'::public.permission_scope, NOW()
  FROM public.template_permissions tp
 WHERE tp.resource_key = 'admin/account'
   AND tp.action = 'view'
   AND tp.scope = 'any'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- 6e. Every other template states the answer rather than falling through.
--
-- 20260807000000 §7 materialized every grid so Members & Access can show the whole answer
-- without a reader having to know about fall-through, and it notes that a resource registered
-- by a LATER migration is the one case that survives on the default. This writes that default
-- down, with exactly the CASE seed_family_permission_templates() uses — view resolves to 'any'
-- unless the family has restricted the key, everything else to 'none' — so the row written
-- here and the row a new family is born with cannot disagree.
--
-- The visibility test is on `t.family_code`, the TEMPLATE's family. A template only counts for
-- the family it belongs to; joining on anything else would let one family's restriction decide
-- another's grid.
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
 WHERE pr.key IN ('gatherings', 'gatherings/my-tasks', 'gatherings/budget', 'calendar',
                  'admin/gatherings', 'admin/gathering-templates')
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 7. THE FAMILY CREATED TOMORROW ─────────────────────────────────────────
-- §6a covers every family that exists. It does NOT cover the next one, and without this the
-- restriction on `gatherings/budget` would hold for today's families and silently fail for
-- every family created afterwards — the worst shape a permission default can have, "because
-- the first family to be affected is the one nobody is watching" (20260817000000 §3b).
--
-- The mechanism is that function's own `v_restricted` array, which its resource_visibility
-- insert unions with `category = 'admin'` and which its General grid then ASKS rather than
-- re-deriving. Widening the array by one key is the whole change:
--
--     ARRAY['dues-projections']  →  ARRAY['dues-projections','gatherings/budget']
--
-- THE TWO `admin/` KEYS NEED NOTHING HERE, and 20260817000006 §5d explains why: that insert
-- already reads `pr.category = 'admin'`, the Administrators insert is
-- `CROSS JOIN LATERAL unnest(pr.actions)` over every resource, and the General insert asks
-- what the family has restricted. Adding them to `v_restricted` would be a second, weaker
-- statement of a rule the category already makes.
--
-- REPRODUCED VERBATIM FROM 20260817000000:174-284 with only that array changed, because
-- CREATE OR REPLACE takes a whole body. BOTH anon-callability gates are kept exactly as they
-- are: this function was callable with the ANON key before 20260806000016, and its
-- ON CONFLICT DO NOTHING inserts made an unauthenticated call a way to RESTORE an
-- administrative grant somebody had deleted. A change to one array is not a reason to reopen
-- that, and a needless CREATE OR REPLACE is a chance to lose a gate — which is why the two
-- admin keys above are deliberately left alone.
CREATE OR REPLACE FUNCTION public.seed_family_permission_templates(p_family_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admins  uuid;
  v_general uuid;
  v_claims  jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_jwt     text  := COALESCE(v_claims ->> 'role', '');
  v_guc     text  := COALESCE(NULLIF(current_setting('role', true), 'none'), '');
  -- Non-admin resources that still start restricted. Everything family-wide about other
  -- members' money belongs here; a page of the family's own records does not.
  --
  -- `gatherings/budget` joined it in 20260819000000: it gates the money band on a gathering —
  -- the budget, the fund behind it and every task's line — and it is not an `admin/` key, so
  -- nothing else in this function would withhold THE KEY. (The key, and not the figures: the
  -- amounts are columns on tables `gatherings:view` governs, and the header of that migration
  -- has the whole of why a column-level grant is not available to change that.) `gatherings`,
  -- `gatherings/my-tasks` and `calendar` deliberately stay out: those are the family's own
  -- gatherings, the member's own tasks, and a calendar of both.
  v_restricted text[] := ARRAY['dues-projections', 'gatherings/budget'];
BEGIN
  IF p_family_code IS NULL OR p_family_code = '' THEN
    RETURN;
  END IF;

  -- Gate 1: not callable from a browser, except by arriving through the trigger.
  IF pg_trigger_depth() = 0
     AND (v_jwt IN ('anon', 'authenticated') OR v_guc IN ('anon', 'authenticated'))
  THEN
    RAISE EXCEPTION
      'seed_family_permission_templates() is not callable by % — templates are seeded by the families trigger',
      COALESCE(NULLIF(v_jwt, ''), v_guc)
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Gate 2: the write amplification. permission_templates.family_code has no foreign
  -- key, so without this any string is a valid target for a few hundred rows.
  IF NOT EXISTS (SELECT 1 FROM public.families f WHERE f.family_code = p_family_code)
     AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.family_code = p_family_code)
  THEN
    RAISE EXCEPTION 'seed_family_permission_templates(): no such family %', p_family_code
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  INSERT INTO public.permission_templates (family_code, name, description, is_system) VALUES
    (p_family_code, 'Administrators',
     'Full access to every page and action, including who else may do what.', true),
    (p_family_code, 'General',
     'Everyone else. Reads the family, manages only their own records.', true)
  ON CONFLICT (family_code, name) DO NOTHING;

  SELECT id INTO v_admins  FROM public.permission_templates
   WHERE family_code = p_family_code AND name = 'Administrators';
  SELECT id INTO v_general FROM public.permission_templates
   WHERE family_code = p_family_code AND name = 'General';

  -- Admin pages start restricted, and so does anything in v_restricted. This is what
  -- makes the General grid below deny them, and it stays the default for any resource a
  -- later migration adds.
  INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
  SELECT p_family_code, pr.key, 'restricted'
    FROM public.permission_resources pr
   WHERE pr.category = 'admin' OR pr.key = ANY(v_restricted)
  ON CONFLICT (family_code, resource_key) DO NOTHING;

  -- Administrators: 'any' on every action each resource actually declares.
  -- unnest(pr.actions) rather than the full enum, so a section that cannot be created
  -- does not carry a create grant nobody can use.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_admins, pr.key, a::public.permission_action, 'any'
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;

  -- General: the family-facing pages, and only their own records. Stated for every
  -- resource and action rather than left to fall through, because the grid on the
  -- screen is now the whole answer and a blank cell would be a lie.
  --
  -- The EXISTS guard on the literal list is load-bearing: resource_key is a foreign
  -- key, so naming one a later migration renamed would abort the INSERT and — through
  -- the trigger — the family creation that called it.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, t.k, t.act, t.sc
    FROM (VALUES
      ('account-summary', 'view'::public.permission_action, 'own'::public.permission_scope),
      ('chat',            'create', 'any'),
      ('chat',            'edit',   'own'),
      ('chat',            'delete', 'own'),
      ('photos',          'create', 'any'),
      ('photos',          'edit',   'own')
    ) AS t(k, act, sc)
   WHERE EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = t.k)
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;

  -- The view default asks what the family has restricted rather than re-deriving it from the
  -- category (20260817000000 §3b). Same answer for every key that existed before, and 'none'
  -- for the ones named in v_restricted.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, pr.key, a::public.permission_action,
         CASE
           WHEN a = 'view' AND NOT EXISTS (
                  SELECT 1 FROM public.resource_visibility rv
                   WHERE rv.family_code = p_family_code
                     AND rv.resource_key = pr.key
                     AND rv.visibility = 'restricted')
             THEN 'any'::public.permission_scope
           ELSE 'none'::public.permission_scope
         END
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;
END $$;

-- The grant is restated because CREATE OR REPLACE does not change privileges and this must
-- stay unreachable from a browser — 20260806000015 made grants the primary control, and
-- `service_role` keeps EXECUTE by default. Stated rather than assumed, because the one thing
-- this function must never become again is anon-callable.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── 8. Verify ───────────────────────────────────────────────────────────────
-- Catalogue reads FIRST and unconditionally, so this cannot report success by skipping
-- (AGENTS.md: "a verify block that can skip must not be the only check"). Then a REAL
-- BEHAVIOUR probe: plpgsql does not resolve names in a function body until the body runs, so
-- a trigger asserted only to EXIST is a trigger that may throw for its first real caller —
-- which is exactly what 20260806000012 shipped. And a catalogue-only assertion passes over a
-- constraint that has been quietly weakened, which is the commoner failure and what
-- 20260817000008's m5/m5b pair demonstrates.
--
-- NO `families` ROW IS CREATED. Every table this probe touches carries `family_code` as free
-- text with no foreign key, so a throwaway family needs no `families` row — which also means
-- no permission templates and no system Donations fund to unpick afterwards. `created_by` is
-- left NULL on the two rows that could carry it: nothing here needs a founder, and requiring
-- an `auth.users` row is what let 20260806000012's verify block skip itself into a false pass.
DO $mig$
DECLARE
  v_code    CONSTANT text := 'ZZGATHER';
  v_other   CONSTANT text := 'ZZGATH2';
  v_bad     int;
  v_names   text;
  v_missing text;
  v_person  uuid;
  v_alien   uuid;
  v_fund    uuid;
  v_alien_f uuid;
  v_tmpl    uuid;
  v_tmpl2   uuid;
  v_alien_t uuid;
  v_step    uuid;
  v_step2   uuid;
  v_g       uuid;
  v_alien_g uuid;
  v_task    uuid;
  v_alien_k uuid;
  v_refused boolean;
  v_stamped timestamptz;
BEGIN
  -- 8a. The six keys, each BY NAME with the actions it must declare. Asserted per key rather
  -- than counted: a count is a second statement of the insert above and drifts from it, and
  -- the count for this feature is six rather than the seven a route table suggests (two
  -- routes inherit their parent's key).
  SELECT string_agg(format('%s (%s)', k.key, k.actions), ', ' ORDER BY k.key) INTO v_missing
    FROM (VALUES
      ('gatherings',                ARRAY['view','create']::TEXT[]),
      ('gatherings/my-tasks',       ARRAY['view']::TEXT[]),
      ('gatherings/budget',         ARRAY['view']::TEXT[]),
      ('calendar',                  ARRAY['view']::TEXT[]),
      ('admin/gatherings',          ARRAY['view','create','edit','delete']::TEXT[]),
      ('admin/gathering-templates', ARRAY['view','create','edit','delete']::TEXT[])
    ) AS k(key, actions)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.permission_resources pr
      WHERE pr.key = k.key AND pr.actions = k.actions
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: resource(s) not registered with the stated actions: %', v_missing;
  END IF;

  -- 8b. The invariant that licenses `key LIKE 'admin/%'` as the test an UNREGISTERED key is
  -- judged by, in SQL and in lib/auth/permissions.ts. 20260817000004 asserts it and rolls
  -- back otherwise; re-asserted here in BOTH directions because this file adds keys on both
  -- sides of it — two `admin/` keys in the admin category, and one key with a slash in it
  -- (`gatherings/budget`) that must NOT be admin.
  SELECT string_agg(format('%s (category=%s)', key, category), ', ' ORDER BY key) INTO v_names
    FROM public.permission_resources
   WHERE (category = 'admin') IS DISTINCT FROM (key LIKE 'admin/%');
  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: category and key shape disagree for: %', v_names;
  END IF;

  -- 8c. No duplicate sort_order in either category this file writes to. 20260806000005's
  -- invariant: the grid emits a sub-section header the moment `subsection` changes, so a tie
  -- puts a row inside a block it does not belong to. DERIVED from the table rather than
  -- checked against a copied list of what is free — that list was wrong in two places when
  -- this file was planned (155 had moved to 260, and 260/261 were missing), and a list is
  -- exactly what goes stale.
  SELECT COUNT(*) INTO v_bad FROM (
    SELECT category, sort_order FROM public.permission_resources
     WHERE category IN ('events', 'admin')
     GROUP BY category, sort_order HAVING COUNT(*) > 1
  ) d;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % duplicate sort_order value(s) in the events or admin category', v_bad;
  END IF;

  -- 8d. Every sub-key has its parent row — 20260808000000 §6b's invariant, which matters here
  -- because `gatherings/my-tasks` and `gatherings/budget` are the first sub-keys outside
  -- accounting. Without the parent, getResources()'s longest-prefix matching and the grid's
  -- grouping both answer for a row that is not there.
  SELECT string_agg(pr.key, ', ' ORDER BY pr.key) INTO v_names
    FROM public.permission_resources pr
   WHERE pr.key IN ('gatherings/my-tasks', 'gatherings/budget')
     AND NOT EXISTS (SELECT 1 FROM public.permission_resources p2 WHERE p2.key = 'gatherings');
  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: sub-resource(s) with no parent row: %', v_names;
  END IF;

  -- 8e. No grant names an action its resource does not declare — 5b's job, asserted.
  SELECT COUNT(*) INTO v_bad
    FROM public.template_permissions tp
    JOIN public.permission_resources pr ON pr.key = tp.resource_key
   WHERE tp.resource_key IN ('gatherings', 'gatherings/my-tasks', 'gatherings/budget', 'calendar',
                             'admin/gatherings', 'admin/gathering-templates')
     AND NOT (tp.action::text = ANY (pr.actions));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % grant(s) name an action their resource does not declare', v_bad;
  END IF;

  -- 8f. The three restricted keys really are restricted, in every family this database knows
  -- about — asked of the SAME three-table union §6a writes from, so what it catches is a
  -- family the backfill missed, which is exactly the bug 20260817000001 had to repair (two
  -- codes carried only on templates are missing 20260817000000's restriction to this day).
  -- On an empty database the union is empty and this passes: there is nobody to withhold a
  -- screen from, and the fresh-database half of the answer is §7's function, asserted at 8l.
  FOR v_names IN
    SELECT k FROM (VALUES ('admin/gatherings'), ('admin/gathering-templates'), ('gatherings/budget')) AS t(k)
  LOOP
    SELECT COUNT(*) INTO v_bad
      FROM (
        SELECT family_code AS code FROM public.families
        UNION
        SELECT DISTINCT family_code FROM public.people
         WHERE family_code IS NOT NULL AND family_code <> ''
        UNION
        SELECT DISTINCT family_code FROM public.permission_templates
         WHERE family_code IS NOT NULL AND family_code <> ''
      ) f
     WHERE f.code IS NOT NULL AND f.code <> ''
       AND NOT EXISTS (
         SELECT 1 FROM public.resource_visibility rv
          WHERE rv.family_code = f.code AND rv.resource_key = v_names
            AND rv.visibility = 'restricted');
    IF v_bad > 0 THEN
      RAISE EXCEPTION 'ROLLBACK: % is not restricted in % family(ies)', v_names, v_bad;
    END IF;
  END LOOP;

  -- 8g. And somebody can still reach every one of them: no system Administrators template is
  -- left unable to open a screen this file has just locked.
  SELECT COUNT(*) INTO v_bad
    FROM public.permission_templates t
   CROSS JOIN (VALUES ('admin/gatherings'), ('admin/gathering-templates'), ('gatherings/budget')) AS k(key)
   WHERE t.name = 'Administrators' AND t.is_system = true
     AND NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                      WHERE tp.template_id = t.id AND tp.resource_key = k.key
                        AND tp.action = 'view' AND tp.scope = 'any');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % (template, key) pair(s) leave Administrators unable to view a restricted Gatherings screen', v_bad;
  END IF;

  -- 8h. The IMPLICATION behind 6b and 6d, not a count: nothing GRANTS `gatherings/budget` without
  -- holding `admin/account:view = any`. A count would be wrong on an empty database and wrong
  -- again the first time a family adjusts the grid. `scope <> 'none'` matches 20260817000001:
  -- a materialized denial is not a grant, and an assertion that counted one would fail on
  -- exactly the rows 6e deliberately writes.
  SELECT COUNT(*) INTO v_bad
    FROM public.template_permissions tp
   WHERE tp.resource_key = 'gatherings/budget'
     AND tp.scope <> 'none'
     AND NOT EXISTS (
       SELECT 1 FROM public.template_permissions g
        WHERE g.template_id = tp.template_id
          AND g.resource_key = 'admin/account'
          AND g.action = 'view' AND g.scope = 'any')
     AND NOT EXISTS (
       SELECT 1 FROM public.permission_templates t
        WHERE t.id = tp.template_id AND t.name = 'Administrators' AND t.is_system = true);
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % template(s) can view the gathering budget band without administering the family''s money', v_bad;
  END IF;

  -- 8i. The three view-only keys gate SCREENS (and one BAND), never a table. A map row would
  -- put the key into a composed RLS policy, which is the shape 20260808000001 dismantled for
  -- the old `dues` key.
  --
  -- THIS ASSERTION IS ALSO WHAT FIXES `gatherings/budget` AS AN APP-LAYER GATE, PERMANENTLY,
  -- and that is deliberate rather than incidental — see the header. It is the same standing
  -- `account-summary/funds` has: the key decides whether the band is fetched, and `gatherings`
  -- decides which rows come back. Anyone who later wants this key to withhold the figures from
  -- PostgREST has to move `gatherings.budget_cents` / `.fund_id` and
  -- `gathering_tasks.budget_cents` onto a table of their own with its own map row, and narrow
  -- this loop to the five tables that are not it. Adding a map row for this key without moving
  -- the columns would compose a policy over a table the money is not in.
  --
  -- Matched on the RENDERED literal for the policy half —
  -- `auth_permission('gatherings/budget'::text` — because `gatherings` is a live key that
  -- shares the prefix and MUST match six policies, so a `LIKE '%gatherings%'` test would
  -- report every one of them.
  FOR v_names IN
    SELECT k FROM (VALUES ('gatherings/my-tasks'), ('gatherings/budget'), ('calendar')) AS t(k)
  LOOP
    IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE resource_key = v_names) THEN
      RAISE EXCEPTION 'ROLLBACK: % must not map to a table — it gates a screen', v_names;
    END IF;
    SELECT COUNT(*), string_agg(tablename || '.' || policyname, ', ') INTO v_bad, v_missing
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '') LIKE '%auth_permission(''' || v_names || '''::text%'
         OR COALESCE(with_check, '') LIKE '%auth_permission(''' || v_names || '''::text%');
    IF v_bad > 0 THEN
      RAISE EXCEPTION 'ROLLBACK: % policy(ies) evaluate %, which gates a screen rather than rows: %',
        v_bad, v_names, v_missing;
    END IF;
  END LOOP;

  -- 8j. Six tables, RLS on, exactly one SELECT policy each, named perm:<table>:select, and no
  -- write policy anywhere. The name matters as much as the count: `perm:` is what
  -- 20260618000001's sweep skips and what audit_policy_shadowing.sql tests, so an unprefixed
  -- policy here would be re-wrapped into a second, permissive way in.
  SELECT string_agg(t.name, ', ' ORDER BY t.name) INTO v_missing
    FROM (VALUES
      ('gathering_templates'), ('gathering_template_steps'), ('gatherings'),
      ('gathering_template_uses'), ('gathering_tasks'), ('gathering_task_submissions')
    ) AS t(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t.name AND c.relrowsecurity
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: row level security is not enabled on: %', v_missing;
  END IF;

  SELECT string_agg(t.name, ', ' ORDER BY t.name) INTO v_missing
    FROM (VALUES
      ('gathering_templates'), ('gathering_template_steps'), ('gatherings'),
      ('gathering_template_uses'), ('gathering_tasks'), ('gathering_task_submissions')
    ) AS t(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.name AND cmd = 'SELECT'
        AND policyname = 'perm:' || t.name || ':select'
        AND COALESCE(qual, '') LIKE '%auth_membership_approved()%'
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: policy on % does not test membership approval, or is not named perm:<table>:select', v_missing;
  END IF;

  SELECT COUNT(*), string_agg(tablename || '.' || policyname, ', ') INTO v_bad, v_names
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('gathering_templates', 'gathering_template_steps', 'gatherings',
                       'gathering_template_uses', 'gathering_tasks', 'gathering_task_submissions')
     AND cmd <> 'SELECT';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % table(s) carry an INSERT/UPDATE/DELETE policy: %', v_bad, v_names;
  END IF;

  -- SIX SELECT POLICIES, NOT SIX-OR-MORE. Permissive policies are OR-ed, so a second SELECT
  -- policy on one of these tables is another way IN and would decide every read — the exact
  -- shape audit_policy_shadowing.sql exists for, which cannot see a duplicate whose name also
  -- begins `perm:`. The count is what catches that.
  SELECT COUNT(*), string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename, policyname)
    INTO v_bad, v_names
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('gathering_templates', 'gathering_template_steps', 'gatherings',
                       'gathering_template_uses', 'gathering_tasks', 'gathering_task_submissions')
     AND cmd = 'SELECT';
  IF v_bad <> 6 THEN
    RAISE EXCEPTION 'ROLLBACK: expected exactly 6 SELECT policies across the six gatherings tables, found %: %',
      v_bad, COALESCE(v_names, 'none');
  END IF;

  -- 8k. EVERY named CHECK on ALL SIX TABLES exists — eleven of them, not the four on
  -- `gatherings` this asserted first. Names, because §8m exercises them and a rename would
  -- otherwise look like a missing constraint at the wrong end of the file; and (table,
  -- constraint) pairs, because `conrelid` is what makes the assertion say which table lost one.
  --
  -- The four this used to omit were the four with no probe either — `gathering_tasks_kind_valid`,
  -- the two `budget_non_negative`s off `gatherings`, and
  -- `gathering_task_submissions_decision_valid` — so dropping any of them passed the verify block
  -- twice over, silently. §8m now exercises those four as well, which is the pairing the file's
  -- own header asks for: a catalogue assertion says a constraint EXISTS and a probe says it still
  -- means something (m5/m5b).
  SELECT string_agg(format('%s.%s', c.tbl, c.name), ', ' ORDER BY c.tbl, c.name) INTO v_missing
    FROM (VALUES
      ('gathering_templates',        'gathering_templates_scheduler_valid'),
      ('gathering_template_steps',   'gathering_template_steps_kind_valid'),
      ('gathering_template_steps',   'gathering_template_steps_budget_non_negative'),
      ('gatherings',                 'gatherings_dates_ordered'),
      ('gatherings',                 'gatherings_budget_needs_fund'),
      ('gatherings',                 'gatherings_status_valid'),
      ('gatherings',                 'gatherings_budget_non_negative'),
      ('gathering_tasks',            'gathering_tasks_kind_valid'),
      ('gathering_tasks',            'gathering_tasks_status_valid'),
      ('gathering_tasks',            'gathering_tasks_budget_non_negative'),
      ('gathering_task_submissions', 'gathering_task_submissions_decision_valid')
    ) AS c(tbl, name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_constraint
      WHERE conrelid = ('public.' || c.tbl)::regclass AND conname = c.name
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: named CHECK constraint(s) not created: %', v_missing;
  END IF;

  -- And `set_updated_at` is attached to all six, not only to the one §8m happens to probe
  -- behaviourally. Removing `gathering_tasks_updated_at` left a green run and a table whose
  -- `updated_at` was whatever a caller last wrote — the column then says something false about
  -- every row, which is worse than not having it.
  SELECT string_agg(t.name, ', ' ORDER BY t.name) INTO v_missing
    FROM (VALUES
      ('gathering_templates'), ('gathering_template_steps'), ('gatherings'),
      ('gathering_template_uses'), ('gathering_tasks'), ('gathering_task_submissions')
    ) AS t(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
      JOIN pg_proc p ON p.oid = tg.tgfoid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t.name
       AND p.proname = 'set_updated_at' AND NOT tg.tgisinternal
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: set_updated_at is not attached to: %', v_missing;
  END IF;

  -- 8l. §7 actually took. Reading the function's own source is the only check available: the
  -- alternative is creating a family to see what it seeds, and a migration must not.
  --
  -- THE COMMENTS ARE STRIPPED FIRST, AND THAT IS THE WHOLE POINT OF THIS ASSERTION.
  -- `pg_get_functiondef` returns `prosrc` VERBATIM, comments included — and the paragraph
  -- §7 puts directly above `v_restricted` names `gatherings/budget` in prose, which is one of
  -- the two occurrences the stored body carries (m9's note below has the measurement, and this
  -- line said "three times" until it was counted).
  -- So a bare `LIKE '%gatherings/budget%'` was satisfied by the key's own EXPLANATION: m9
  -- (revert the array to ARRAY['dues-projections'] and leave the comment, which is exactly
  -- the edit a future author makes) could not fail it, and this — the only assertion covering
  -- the family created tomorrow — was decoration. Same class as 20260806000012's skippable
  -- verify block, and as AGENTS.md's "do not assert … and call it protection unless you have
  -- checked what runs after".
  --
  -- Stripping `--` to end of line can only ever REMOVE text, so it can produce a false
  -- FAILURE and never a false pass, which is the safe direction for a gate. The pattern then
  -- requires the QUOTED literal, positioned after the `v_restricted` declaration, so what is
  -- asserted is an array element rather than a word appearing somewhere in the body.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'seed_family_permission_templates'
       AND regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
             LIKE '%v_restricted%''gatherings/budget''%'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: seed_family_permission_templates() would give a new family gatherings/budget';
  END IF;

  -- And that no browser role can call it. A CREATE OR REPLACE that silently widened this
  -- would be the second time this function was reachable with the anon key.
  IF has_function_privilege('anon', 'public.seed_family_permission_templates(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.seed_family_permission_templates(text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'ROLLBACK: seed_family_permission_templates() is executable by a browser role';
  END IF;

  -- ── 8m. THE PROBE: every constraint and every trigger, for real ──────────
  -- Two throwaway families, because the guards under test are precisely the ones that need a
  -- second family to exercise. By the migration role, which holds every privilege there is —
  -- nothing weaker than the trigger can produce these refusals.
  INSERT INTO public.people (family_code, first_name, last_name)
  VALUES (v_code, 'Probe', 'Member') RETURNING id INTO v_person;
  INSERT INTO public.people (family_code, first_name, last_name)
  VALUES (v_other, 'Elsewhere', 'Member') RETURNING id INTO v_alien;

  INSERT INTO public.funds (family_code, name, active) VALUES (v_code,  'Probe Fund', true)
    RETURNING id INTO v_fund;
  INSERT INTO public.funds (family_code, name, active) VALUES (v_other, 'Other Fund', true)
    RETURNING id INTO v_alien_f;

  INSERT INTO public.gathering_templates (family_code, name) VALUES (v_code, 'Probe Template')
    RETURNING id INTO v_tmpl;
  INSERT INTO public.gathering_templates (family_code, name) VALUES (v_code, 'Second Template')
    RETURNING id INTO v_tmpl2;
  INSERT INTO public.gathering_templates (family_code, name) VALUES (v_other, 'Other Template')
    RETURNING id INTO v_alien_t;

  INSERT INTO public.gathering_template_steps (family_code, template_id, position, label, kind)
  VALUES (v_code, v_tmpl, 0, 'Bring the cake', 'text') RETURNING id INTO v_step;
  INSERT INTO public.gathering_template_steps (family_code, template_id, position, label, kind, budget_default_cents)
  VALUES (v_code, v_tmpl2, 0, 'Hire the hall', 'money', 25000) RETURNING id INTO v_step2;

  -- The legitimate row: one day, no budget, no fund.
  INSERT INTO public.gatherings (family_code, title, starts_on) VALUES (v_code, 'Probe Gathering', '2026-09-01')
    RETURNING id INTO v_g;
  INSERT INTO public.gatherings (family_code, title, starts_on) VALUES (v_other, 'Other Gathering', '2026-09-01')
    RETURNING id INTO v_alien_g;

  -- ends_on before starts_on.
  BEGIN
    UPDATE public.gatherings SET ends_on = '2026-08-31' WHERE id = v_g;
    RAISE EXCEPTION 'ROLLBACK: a gathering was accepted ending before it starts';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- ends_on == starts_on and ends_on after it are both legitimate.
  UPDATE public.gatherings SET ends_on = '2026-09-01' WHERE id = v_g;
  UPDATE public.gatherings SET ends_on = '2026-09-03' WHERE id = v_g;

  -- A budget with no fund behind it, written by hand. This is the CHECK lib/money-attached.ts
  -- exists to keep satisfiable — and the interaction it is actually about, deleting the fund out
  -- from under a budgeted gathering, is probed separately at the foot of this block, because
  -- proving the CHECK refuses a hand-written state says nothing about what the RI SET NULL does
  -- with it.
  BEGIN
    UPDATE public.gatherings SET budget_cents = 50000 WHERE id = v_g;
    RAISE EXCEPTION 'ROLLBACK: a budget was accepted with no fund behind it';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A negative budget.
  BEGIN
    UPDATE public.gatherings SET fund_id = v_fund, budget_cents = -1 WHERE id = v_g;
    RAISE EXCEPTION 'ROLLBACK: a negative budget was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- And the legitimate pair. Note this is NOT refused for exceeding the fund's balance — the
  -- fund holds nothing at all here. That is the red line, computed in lib/gathering-budget.ts
  -- and rendered; a database that refused it would make the feature impossible.
  UPDATE public.gatherings SET fund_id = v_fund, budget_cents = 500000 WHERE id = v_g;

  -- Trigger 1: another family's fund.
  v_refused := false;
  BEGIN
    UPDATE public.gatherings SET fund_id = v_alien_f WHERE id = v_g;
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%may only draw on its own family''s money%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gatherings accepted another family''s fund';
  END IF;

  -- Trigger 1, second half: another family's person as the creator.
  v_refused := false;
  BEGIN
    UPDATE public.gatherings SET created_by = v_alien WHERE id = v_g;
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gatherings: created_by%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gatherings accepted another family''s person as created_by';
  END IF;
  UPDATE public.gatherings SET created_by = v_person WHERE id = v_g;

  -- set_updated_at fires. Testing `updated_at > created_at` CANNOT work here: NOW() is the
  -- transaction timestamp, so both are the same instant inside one migration. What proves the
  -- trigger ran is that a value written by hand does not survive.
  --
  -- Only `gatherings` is probed HERE, because it is the only one of the six with a row yet; the
  -- other five are swept at the foot of this block, once they all have one. Both are needed:
  -- this one proves `set_updated_at()` resolves and runs (plpgsql defers name resolution to the
  -- first call, so a trigger asserted only to exist may throw for its first real caller), and
  -- the sweep proves it is attached everywhere.
  UPDATE public.gatherings SET updated_at = '2000-01-01T00:00:00Z' WHERE id = v_g;
  SELECT updated_at INTO v_stamped FROM public.gatherings WHERE id = v_g;
  IF v_stamped <> NOW() THEN
    RAISE EXCEPTION 'ROLLBACK: set_updated_at did not fire on gatherings (updated_at is %)', v_stamped;
  END IF;

  -- Trigger 2 (§2b): a step may only be attached to its own family's template. Cross-family
  -- first, then the legitimate row — which the two steps inserted above have already proved,
  -- so this half is the guard not refusing what it must accept.
  v_refused := false;
  BEGIN
    INSERT INTO public.gathering_template_steps (family_code, template_id, label, kind)
    VALUES (v_code, v_alien_t, 'Injected step', 'text');
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_template_steps: template%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: a step was attached to another family''s template';
  END IF;

  -- The other direction, which is the one that destroys a row rather than showing one: the
  -- step is stamped with the OTHER family while its template is this one's.
  v_refused := false;
  BEGIN
    INSERT INTO public.gathering_template_steps (family_code, template_id, label, kind)
    VALUES (v_other, v_tmpl, 'Injected step', 'text');
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_template_steps: template%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: a step of one family''s template was stamped with another''s code';
  END IF;

  -- And a legitimate move between two templates OF THIS FAMILY is still allowed — the guard is
  -- about the family, not about reparenting.
  UPDATE public.gathering_template_steps SET template_id = v_tmpl2 WHERE id = v_step;
  UPDATE public.gathering_template_steps SET template_id = v_tmpl  WHERE id = v_step;

  -- Trigger 3: the legitimate link, then both cross-family shapes, then the UNIQUE.
  INSERT INTO public.gathering_template_uses (family_code, gathering_id, template_id, position)
  VALUES (v_code, v_g, v_tmpl, 0);

  v_refused := false;
  BEGIN
    INSERT INTO public.gathering_template_uses (family_code, gathering_id, template_id)
    VALUES (v_code, v_g, v_alien_t);
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_template_uses: gathering and template must both belong%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_template_uses accepted another family''s template';
  END IF;

  v_refused := false;
  BEGIN
    INSERT INTO public.gathering_template_uses (family_code, gathering_id, template_id)
    VALUES (v_code, v_alien_g, v_tmpl);
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_template_uses: gathering and template must both belong%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_template_uses accepted another family''s gathering';
  END IF;

  v_refused := false;
  BEGIN
    INSERT INTO public.gathering_template_uses (family_code, gathering_id, template_id, position)
    VALUES (v_code, v_g, v_tmpl, 1);
  EXCEPTION WHEN unique_violation THEN
    v_refused := true;
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: the same template was linked to one gathering twice';
  END IF;

  -- Trigger 4: the legitimate task carries its provenance, then each id in turn.
  INSERT INTO public.gathering_tasks (family_code, gathering_id, template_id, step_id,
                                      label, kind, position, assignee_id, budget_cents)
  VALUES (v_code, v_g, v_tmpl, v_step, 'Bring the cake', 'text', 0, v_person, 4000)
  RETURNING id INTO v_task;

  v_refused := false;
  BEGIN
    UPDATE public.gathering_tasks SET assignee_id = v_alien WHERE id = v_task;
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_tasks: assignee%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_tasks accepted another family''s assignee';
  END IF;

  v_refused := false;
  BEGIN
    UPDATE public.gathering_tasks SET decided_by = v_alien WHERE id = v_task;
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_tasks: decided_by%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_tasks accepted another family''s decider';
  END IF;

  v_refused := false;
  BEGIN
    UPDATE public.gathering_tasks SET template_id = v_alien_t WHERE id = v_task;
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_tasks: template%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_tasks accepted another family''s template';
  END IF;

  -- The step is this family's and belongs to a DIFFERENT template of it. Family scoping alone
  -- admits this row; only the provenance conjunct refuses it.
  v_refused := false;
  BEGIN
    UPDATE public.gathering_tasks SET step_id = v_step2 WHERE id = v_task;
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%is not a step of template%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_tasks accepted a step from another template';
  END IF;

  v_refused := false;
  BEGIN
    INSERT INTO public.gathering_tasks (family_code, gathering_id, label, kind)
    VALUES (v_code, v_alien_g, 'Cross-family task', 'text');
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_tasks: gathering%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_tasks accepted another family''s gathering';
  END IF;

  -- Trigger 5: the legitimate submission, then its two people-shaped ids and its task.
  INSERT INTO public.gathering_task_submissions (family_code, task_id, answer, note, submitted_by)
  VALUES (v_code, v_task, '{"text":"Ordered, collecting Saturday"}'::jsonb, 'from the bakery on 5th', v_person);

  INSERT INTO public.gathering_tasks (family_code, gathering_id, label, kind)
  VALUES (v_other, v_alien_g, 'Other family task', 'text') RETURNING id INTO v_alien_k;

  v_refused := false;
  BEGIN
    INSERT INTO public.gathering_task_submissions (family_code, task_id, answer)
    VALUES (v_code, v_alien_k, '{"text":"not mine"}'::jsonb);
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_task_submissions: task%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_task_submissions accepted another family''s task';
  END IF;

  v_refused := false;
  BEGIN
    INSERT INTO public.gathering_task_submissions (family_code, task_id, answer, submitted_by)
    VALUES (v_code, v_task, '{"text":"forged"}'::jsonb, v_alien);
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_task_submissions: submitted_by%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_task_submissions accepted another family''s author';
  END IF;

  v_refused := false;
  BEGIN
    INSERT INTO public.gathering_task_submissions (family_code, task_id, answer, reviewed_by, decision, reviewed_at)
    VALUES (v_code, v_task, '{"text":"reviewed elsewhere"}'::jsonb, v_alien, 'approved', NOW());
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gathering_task_submissions: reviewed_by%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_task_submissions accepted another family''s reviewer';
  END IF;

  -- The vocabularies are closed. One word from each is enough: they are ordinary CHECKs and
  -- the point is that the columns are not free text.
  BEGIN
    UPDATE public.gatherings SET status = 'postponed' WHERE id = v_g;
    RAISE EXCEPTION 'ROLLBACK: the gathering status vocabulary accepted a word that is not one of the four';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.gathering_tasks SET status = 'maybe' WHERE id = v_task;
    RAISE EXCEPTION 'ROLLBACK: the task status vocabulary accepted a word that is not one of the four';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.gathering_template_steps SET kind = 'members' WHERE id = v_step;
    RAISE EXCEPTION 'ROLLBACK: the step kind vocabulary accepted a kind that does not exist';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.gathering_templates SET who_may_schedule = 'anyone' WHERE id = v_tmpl;
    RAISE EXCEPTION 'ROLLBACK: who_may_schedule accepted a word that is neither admin nor family';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- The task's own kind, which is a SEPARATE constraint from the step's and was the one with
  -- neither a probe nor a catalogue assertion. `kind` is COPIED onto the task rather than read
  -- through `step_id`, so weakening this column would let a task carry a kind no form can draw
  -- and no `parseAnswer` branch can read, on the one table a member actually answers.
  BEGIN
    UPDATE public.gathering_tasks SET kind = 'members' WHERE id = v_task;
    RAISE EXCEPTION 'ROLLBACK: the task kind vocabulary accepted a kind that does not exist';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A submission's decision.
  BEGIN
    UPDATE public.gathering_task_submissions SET decision = 'maybe' WHERE family_code = v_code;
    RAISE EXCEPTION 'ROLLBACK: a submission decision accepted a word that is not one of the three';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- And the two money floors off `gatherings`. Both are `>= 0` on a column that arrives from a
  -- form, and both were unasserted and unprobed: a negative line would subtract from a total
  -- the family is being shown as committed, which is the one arithmetic error in this feature
  -- that reads as a smaller number rather than as an error.
  BEGIN
    UPDATE public.gathering_tasks SET budget_cents = -1 WHERE id = v_task;
    RAISE EXCEPTION 'ROLLBACK: a negative budget line was accepted on a task';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.gathering_template_steps SET budget_default_cents = -1 WHERE id = v_step;
    RAISE EXCEPTION 'ROLLBACK: a negative suggested budget was accepted on a template step';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- set_updated_at on the OTHER FIVE, now that every table has a row. Set-based rather than a
  -- loop over captured ids: the two rows this probe never named (the template use and the
  -- submission) have no variable, and `family_code` reaches all of them. The catalogue
  -- assertion at 8k says the trigger is attached; this says it fires.
  UPDATE public.gathering_templates      SET updated_at = '2000-01-01T00:00:00Z' WHERE family_code IN (v_code, v_other);
  UPDATE public.gathering_template_steps SET updated_at = '2000-01-01T00:00:00Z' WHERE family_code IN (v_code, v_other);
  UPDATE public.gathering_template_uses  SET updated_at = '2000-01-01T00:00:00Z' WHERE family_code IN (v_code, v_other);
  UPDATE public.gathering_tasks          SET updated_at = '2000-01-01T00:00:00Z' WHERE family_code IN (v_code, v_other);
  UPDATE public.gathering_task_submissions SET updated_at = '2000-01-01T00:00:00Z' WHERE family_code IN (v_code, v_other);

  SELECT string_agg(d.name, ', ' ORDER BY d.name) INTO v_missing FROM (
    SELECT 'gathering_templates' AS name
     WHERE EXISTS (SELECT 1 FROM public.gathering_templates
                    WHERE family_code IN (v_code, v_other) AND updated_at <> NOW())
    UNION ALL
    SELECT 'gathering_template_steps'
     WHERE EXISTS (SELECT 1 FROM public.gathering_template_steps
                    WHERE family_code IN (v_code, v_other) AND updated_at <> NOW())
    UNION ALL
    SELECT 'gathering_template_uses'
     WHERE EXISTS (SELECT 1 FROM public.gathering_template_uses
                    WHERE family_code IN (v_code, v_other) AND updated_at <> NOW())
    UNION ALL
    SELECT 'gathering_tasks'
     WHERE EXISTS (SELECT 1 FROM public.gathering_tasks
                    WHERE family_code IN (v_code, v_other) AND updated_at <> NOW())
    UNION ALL
    SELECT 'gathering_task_submissions'
     WHERE EXISTS (SELECT 1 FROM public.gathering_task_submissions
                    WHERE family_code IN (v_code, v_other) AND updated_at <> NOW())
  ) d;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: set_updated_at did not fire on: %', v_missing;
  END IF;

  -- ── The fund-delete interaction, both directions, MEASURED before being asserted ──
  -- Three comments used to describe this the same wrong way — lib/money-attached.ts twice, its
  -- test once, and `gatherings.fund_id`'s own COMMENT — all saying that deleting the fund leaves
  -- a FROZEN gathering whose next update raises 23514 about a column nobody touched. It does
  -- not. `ON DELETE SET NULL` is carried out by an internal RI trigger as an ordinary UPDATE, and
  -- every constraint on the referencing table is enforced on that UPDATE — the same reason a
  -- NOT NULL column with SET NULL raises at PARENT-DELETE time. Measured on this Postgres before
  -- this probe was written: with a budget set, `DELETE FROM funds` is REFUSED with 23514 naming
  -- `gatherings_budget_needs_fund`; with no budget set, it succeeds and severs the link silently.
  --
  -- Which is why BOTH halves are here. The refusal is why `moneyAttachedTo` has to run FIRST —
  -- to produce a sentence a treasurer can act on instead of a bare constraint name — and the
  -- silent severing is why a gathering that names a fund and has NO amount typed in is counted
  -- too. Neither was exercised before: the probe proved the CHECK refuses a hand-written budget
  -- with no fund, and never once deleted a fund out from under a budgeted gathering, which is
  -- the one interaction all three comments were about.
  v_refused := false;
  BEGIN
    DELETE FROM public.funds WHERE id = v_fund;
  EXCEPTION WHEN check_violation THEN
    v_refused := (SQLERRM LIKE '%gatherings_budget_needs_fund%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: deleting a fund left a budget with nothing behind it';
  END IF;

  UPDATE public.gatherings SET budget_cents = NULL WHERE id = v_g;
  DELETE FROM public.funds WHERE id = v_fund;
  IF (SELECT fund_id FROM public.gatherings WHERE id = v_g) IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: ON DELETE SET NULL did not sever the gathering from its deleted fund';
  END IF;

  -- ── Cleanup ──
  -- CHILDREN BEFORE PARENTS, and `gathering_template_uses` before `gathering_templates`
  -- specifically: `template_id` there is NO ACTION, which is the whole reason a used template
  -- cannot be deleted. Deleting the gatherings would cascade the uses and tasks away anyway;
  -- doing it explicitly is what makes the omission visible if a table is added later.
  DELETE FROM public.gathering_task_submissions WHERE family_code IN (v_code, v_other);
  DELETE FROM public.gathering_tasks            WHERE family_code IN (v_code, v_other);
  DELETE FROM public.gathering_template_uses    WHERE family_code IN (v_code, v_other);
  DELETE FROM public.gatherings                 WHERE family_code IN (v_code, v_other);
  DELETE FROM public.gathering_template_steps   WHERE family_code IN (v_code, v_other);
  DELETE FROM public.gathering_templates        WHERE family_code IN (v_code, v_other);
  DELETE FROM public.funds                      WHERE family_code IN (v_code, v_other);
  DELETE FROM public.people                     WHERE family_code IN (v_code, v_other);
  -- Belt and braces: this probe creates no `families` row, so nothing seeded a visibility row
  -- or a permission template for either code, and §6a's backfill ran before these two families
  -- existed. The line is here so that a future probe which DOES create a family cannot leave
  -- rows behind by inheriting a cleanup that never had to think about it.
  DELETE FROM public.resource_visibility        WHERE family_code IN (v_code, v_other);

  SELECT COUNT(*) INTO v_bad FROM (
    SELECT 1 FROM public.gathering_task_submissions WHERE family_code IN (v_code, v_other)
    UNION ALL SELECT 1 FROM public.gathering_tasks          WHERE family_code IN (v_code, v_other)
    UNION ALL SELECT 1 FROM public.gathering_template_uses  WHERE family_code IN (v_code, v_other)
    UNION ALL SELECT 1 FROM public.gatherings               WHERE family_code IN (v_code, v_other)
    UNION ALL SELECT 1 FROM public.gathering_template_steps WHERE family_code IN (v_code, v_other)
    UNION ALL SELECT 1 FROM public.gathering_templates      WHERE family_code IN (v_code, v_other)
    UNION ALL SELECT 1 FROM public.funds                    WHERE family_code IN (v_code, v_other)
    UNION ALL SELECT 1 FROM public.people                   WHERE family_code IN (v_code, v_other)
  ) d;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: the gatherings probe left % row(s) behind', v_bad;
  END IF;

  RAISE NOTICE 'gatherings verified: 6 resources registered (3 restricted, Administrators granted), '
    '6 tables with exactly one perm:<table>:select policy each and no write policy, all 11 named '
    'CHECKs present and every one of them exercised (the four on gatherings in both directions), '
    '5 same-family triggers refusing 13 cross-family ids and one step from the wrong template '
    'while accepting every legitimate row, the (gathering, template) UNIQUE, '
    'set_updated_at attached to all 6 and firing on all '
    '6, the fund-delete interaction in both directions, and seed_family_permission_templates() '
    'naming gatherings/budget in its v_restricted array rather than only in a comment. Probe '
    'families % and % removed.',
    v_code, v_other;
END $mig$;

COMMIT;
