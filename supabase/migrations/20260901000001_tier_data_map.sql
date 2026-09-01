-- ═══════════════════════════════════════════════════════════════════════════════════════
-- WHICH DATA BELONGS TO WHICH TIER, AND THE ONE PATH THAT DELETES IT
--
-- Decided 2026-08-23 and built 2026-09-01. A downgrade withholds a tier's data for sixty days
-- and then deletes it; day 60 of the delinquency ladder moves a family to Free and deletes
-- everything Free does not include. Both need the same two things, and this file is them: a map
-- from tier to tables, and ONE function that acts on it.
--
-- ── §A. THIS INVERTS A DOCUMENTED INVARIANT, AND THAT IS THE POINT OF THE CAUTION ─────
-- Until today a downgrade deleted NOTHING, and removing a family — the largest destructive act
-- in the product — destroyed no rows at all. After this, a downgrade is the one operation that
-- does: a mis-clicked plan change can destroy a family tree, and a lapsed card eventually does
-- the same.
--
-- The sixty-day window and the four reminders are not decoration. **They are the whole of the
-- safety argument**, which is why `sweep_platform_data_retention()` in the next migration
-- REFUSES TO DELETE unless the notices it owed were actually sent — the emails are wired into
-- the mechanism rather than promised in prose.
--
-- No family is using this product yet, which is what makes the decision cheap to take now and
-- expensive to take later — the same ground `20260819000006` retired Events on.
--
-- ── §B. THE MAP IS A TABLE, NOT A LIST IN TYPESCRIPT, AND NOT DERIVED ────────────────
-- `staff_delete_family` DERIVES its targets (every `public` table with a `family_code`) and
-- says why: a table added next year is deleted with no edit here. **That is not available for
-- this one.** "Standard's data" is a JUDGEMENT — `permission_table_map` maps keys to tables for
-- POLICY purposes and answers a different question, and `lib/features.ts` maps ROUTES to tiers
-- and says nothing about tables. Somebody has to decide, per table, and be reviewed.
--
-- So it is written down, in SQL, once. Not in TypeScript, because the deletion happens in a
-- `pg_cron` job with no Node anywhere near it; a second copy for the screens to read would be
-- the `is_minor` trap with a family tree attached.
--
-- ── §C. AND WHAT MAKES A HAND-WRITTEN LIST SURVIVABLE IS THE ASSERTION ──────────────
-- §7 below is the `reset_families.sql` §11 shape: every family-scoped table in `public` must be
-- EITHER on the tier map OR on the keep-list, and a table on neither fails the migration by
-- name. So the list cannot go stale silently — which is exactly how
-- `truncate_entire_database.sql` emptied four global lookups.
--
-- ── §D. FOUR TABLES ARE KEPT THAT A NAIVE READING OF THE TIERS WOULD DELETE ─────────
-- Each is a decision, and the first would have been catastrophic:
--
--   `permission_templates`   Members & Access is Standard, so the tier says delete. **The tier
--                            sells the EDITOR, not the grid.** `people.permission_template_id`
--                            points here and `auth_permission()` resolves through it — deleting
--                            them would leave every member's access unresolvable, on a Free
--                            family that still has to work. Nothing in this product is more
--                            load-bearing and less visible.
--   `resource_visibility`    The same argument one level down: the family's own show/hide
--                            decisions, which every `auth_permission` fall-through consults.
--   `sms_consent_events`     A CONSENT RECORD. Deleting it destroys the evidence that somebody
--                            agreed to be texted, which is the one row a regulator would ask
--                            for. It survives every tier change and every deletion here.
--   `platform_payments`      GENORRA's own ledger. AGENTS.md's "MONEY HAS TWO DIRECTIONS": a
--                            family's plan history is our revenue record, not their data, and
--                            deleting it on their downgrade would erase what they paid us.
--
-- ── §E. STORAGE IS NOT REACHED, AND `photos` IS THE ONE THAT MATTERS ────────────────
-- SQL cannot delete the bytes — `storage.protect_delete()` refuses a direct DELETE and the
-- objects live in a backend no migration touches. `staff_delete_family` has the same limit and
-- its action deletes the objects FIRST, because afterwards nothing can enumerate which
-- belonged to whom. **A `pg_cron` job has no such action**, so a Plus family whose photographs
-- are deleted here keeps its FILES in the `photos` bucket with no rows pointing at them.
--
-- That is recorded rather than solved: the bucket is `public: true`, so those objects stay
-- fetchable by URL to anybody who already has one. TODO.md carries it, and the honest options
-- are a Node-side reaper on the notice-drain path or `pg_net` from the sweep.
--
-- ── §F. TWO TRIGGERS REFUSE THE PURGE, AND THEY GET DIFFERENT ANSWERS ───────────────
-- Both were found by the verify block below rather than by reading, which is the way round to
-- want — and the two answers differ because the two refusals mean different things:
--
--   `dues_payments_immutable`  The ledger is append-only for everyone. §3 gives it a narrow,
--                              asserted exemption, because deleting a family's ledger is
--                              exactly what "delete Standard's data" MEANS and there is no
--                              version of this feature that leaves it behind.
--   `funds_protect_system`     A fund with a `system_key` is built in — every family gets one
--                              at creation and the routing waterfall names it. Deleting it
--                              would leave a family that comes BACK to Standard with no
--                              Donations fund and a broken waterfall. So the purge asks for
--                              less (`where_extra`) rather than the trigger being weakened.
--
-- The general rule: **a trigger that refuses a delete is a decision somebody made about the
-- data, and the purge does not get to overrule it by default.** An exemption needs the
-- argument the first one has; where the row is genuinely structural, narrow the purge.
--
-- IDEMPOTENT. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. THE MAP ────────────────────────────────────────────────────────────────────────
-- `min_tier` is the LOWEST tier that includes this table's data. A family on a tier BELOW it
-- has the data withheld, and sixty days later deleted.
CREATE TABLE IF NOT EXISTS public.tier_data_tables (
  table_name TEXT PRIMARY KEY,
  min_tier   TEXT NOT NULL CHECK (min_tier IN ('standard','plus','premium')),
  -- Why this table belongs to this tier. Prose, and required: a bare table name is not a
  -- decision anybody can review, which is the whole complaint §B makes about deriving it.
  note       TEXT NOT NULL,
  -- ── AN EXTRA PREDICATE, FOR A TABLE THE SCHEMA WILL NOT LET US EMPTY ────────────
  -- ANDed into the DELETE. It exists for exactly one row today and it was not designed in — it
  -- was found by the verify block, which is the way round to want: `funds_protect_system()`
  -- refuses to delete a fund with a `system_key` for EVERY caller including the service role,
  -- and it is right to (see §F), so the purge has to ask for less rather than the trigger for
  -- less.
  --
  -- NULL means "every row of this family", which is the ordinary case and all 38 others.
  where_extra TEXT
);

-- Everything a tier purge must NEVER touch, and the reason. Read §D first — the four
-- interesting ones are argued there rather than here.
CREATE TABLE IF NOT EXISTS public.tier_data_keep (
  table_name TEXT PRIMARY KEY,
  note       TEXT NOT NULL
);

-- Added separately so this file is safe to replay against a database that already has the
-- table from an earlier form of it — `CREATE TABLE IF NOT EXISTS` adds no column.
ALTER TABLE public.tier_data_tables ADD COLUMN IF NOT EXISTS where_extra TEXT;

ALTER TABLE public.tier_data_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_data_keep   ENABLE ROW LEVEL SECURITY;
-- ZERO POLICIES, deliberately. Per AGENTS.md §2c a table with no policy for a command denies it
-- to both browser roles — and this one is a map of what the product will destroy, which is
-- nobody's business but the service role's. It carries no `family_code` and belongs to no
-- family, which is why §7 excuses it from its own completeness sweep.

COMMENT ON TABLE public.tier_data_tables IS
  'Which tier each family-scoped table''s data belongs to. HAND-WRITTEN AND REVIEWED — there is '
  'no derivation available; see the header. Read by delete_family_data_above_tier() and by '
  'nothing else. A family-scoped table on neither this nor tier_data_keep fails the migration.';

COMMENT ON TABLE public.tier_data_keep IS
  'Family-scoped tables a tier purge must never delete, each with its reason. Four of them are '
  'kept AGAINST what their tier would say — permission_templates above all, which every '
  'member''s access resolves through.';

-- ── §2. THE ROWS ───────────────────────────────────────────────────────────────────────
-- Replayable: cleared and re-seeded, so an edit to this file reaches a fresh database and a
-- later migration can move a table by rewriting its row rather than by remembering to delete
-- the old one.
DELETE FROM public.tier_data_tables;
DELETE FROM public.tier_data_keep;

INSERT INTO public.tier_data_tables (table_name, min_tier, note, where_extra) VALUES
  -- ── STANDARD ──────────────────────────────────────────────────────────────────────
  ('person_relationships',      'standard', 'The family tree. /community/family-tree is Standard, and this is the whole of its data — the single most valuable thing a downgrade can destroy, which is what the sixty-day window is for.', NULL),
  ('dues_schedules',            'standard', 'What the family charges. /admin/accounting is Standard.', NULL),
  ('dues_payments',             'standard', 'The ledger. APPEND-ONLY (20260806000002), so deleting it needs the narrow exemption in §4 — see the argument there.', NULL),
  ('dues_payment_fees',         'standard', 'What a card payment cost, per payment. Meaningless once its payment is gone.', NULL),
  ('dues_member_plans',         'standard', 'Which cadence each member chose.', NULL),
  ('dues_autopay',              'standard', 'Standing card arrangements. NOTE: these exist at STRIPE too, and this deletes only our record — cancelling them is the disconnect path''s job, not this one.', NULL),
  ('stripe_charge_fees',        'standard', 'Measured card fees on the family''s OWN dues. The family''s side of the processing, not GENORRA''s revenue.', NULL),
  ('funds',                     'standard', 'The family''s own funds. CUSTOM ONES ONLY — see where_extra and §F: the built-in Donations fund is scaffolding every family has from creation and a returning family without it has a broken routing waterfall. What is left after a purge is an empty shelf, because every movement row above and below this line is gone.', 'system_key IS NULL'),
  ('fund_allocations',          'standard', 'The routing waterfall.', NULL),
  ('fund_contributions',        'standard', 'Money into a fund.', NULL),
  ('fund_disbursements',        'standard', 'Money out of one.', NULL),
  ('fund_transfers',            'standard', 'Money between two.', NULL),
  ('fund_milestones',           'standard', 'Award thresholds on a fund.', NULL),
  ('donation_beneficiaries',    'standard', 'Who a donation drive is for.', NULL),
  ('gathering_templates',       'standard', 'The planning half of Gatherings. The DATE is Free and stays; the list of steps is Standard.', NULL),
  ('gathering_template_steps',  'standard', 'The steps themselves.', NULL),
  ('gathering_template_uses',   'standard', 'Which templates a gathering was scheduled from. Provenance for tasks that are also going.', NULL),
  ('gathering_tasks',           'standard', 'Who was asked to do what. /gatherings/my-tasks is Standard.', NULL),
  ('gathering_task_submissions','standard', 'Their answers, and the notes an organizer sent back.', NULL),

  -- ── PLUS ──────────────────────────────────────────────────────────────────────────
  ('chapters',                  'plus',     'The family''s geography. /admin/members/organization is Plus. `people.chapter_id` goes NULL with it, which loses which chapter each relative said they were in — real loss, and what the tier means.', NULL),
  ('regions',                   'plus',     'The other half of the geography.', NULL),
  ('family_roles',              'plus',     'The offices a family defines. Per-family since 20260819000004, so there is nothing global here to protect.', NULL),
  ('user_roles',                'plus',     'Who holds them. Deleting this empties the board.', NULL),
  ('elections',                 'plus',     'Every election. Its positions, nominations and votes have no family_code and cascade from here.', NULL),
  ('photo_collections',         'plus',     'Albums. /community/gallery is Plus.', NULL),
  ('photos',                    'plus',     'The photograph ROWS. **The bytes are not reached** — see §E, which is the one honest gap in this file.', NULL),
  ('documents',                 'plus',     'The family''s filings. /library/documents is Plus.', NULL),
  ('bylaws',                    'plus',     'The bylaws and their search index.', NULL),
  ('meeting_sessions',          'plus',     'Meetings. /library/meeting-minutes is Plus.', NULL),
  ('meeting_topics',            'plus',     'What was discussed.', NULL),
  ('meeting_topic_notes',       'plus',     'The minutes themselves.', NULL),
  ('meeting_votes',             'plus',     'How the room voted. `meeting_votes_are_final` refuses UPDATE for every role and permits DELETE only inside a cascade — so these go with their topics rather than directly. See §4.', NULL),
  ('meeting_attendees',         'plus',     'Who was in the room.', NULL),
  ('position_journal_entries',  'plus',     'An officer''s notebook. /library/officer-notes is Plus.', NULL),
  ('position_journal_notes',    'plus',     'The notes in it.', NULL),

  -- ── PREMIUM ───────────────────────────────────────────────────────────────────────
  ('distributions',             'premium',  'Email sent to the whole family. /community/distributions is Premium.', NULL),
  ('distribution_recipients',   'premium',  'Who each one reached, and what happened. Every relative''s address with a delivery outcome beside it.', NULL),
  ('safety_check_ins',          'premium',  'Check-ins raised. /community/safety-check-ins is Premium.', NULL),
  ('safety_check_in_people',    'premium',  'Who was asked and who answered.', NULL);

INSERT INTO public.tier_data_keep (table_name, note) VALUES
  ('families',                   'The family itself. A tier purge is not a removal.'),
  ('people',                     'A relative is not a tier''s data. The Directory is Free.'),
  ('permission_templates',       'WHO MAY DO WHAT. See §D — the tier sells the editor, not the grid, and deleting these leaves every member''s access unresolvable.'),
  ('resource_visibility',        'The family''s own show/hide decisions, consulted by every auth_permission fall-through.'),
  ('family_invitations',         'An outstanding invitation is a person waiting to join, not a feature.'),
  ('notifications',              'The bell. Free.'),
  ('person_notification_prefs',  'A member''s own settings.'),
  ('person_sms',                 'A member''s own number.'),
  ('phone_verifications',        'Short-lived, and deleting one mid-flight breaks a verification somebody is in the middle of.'),
  ('sms_consent_events',         'A CONSENT RECORD. See §D.'),
  ('announcements',              'Free.'),
  ('announcement_unpins',        'Free, and it hangs off announcements.'),
  ('birthday_greetings',         'Free.'),
  ('chat_rooms',                 'Free. Messages and participants cascade from here and have no family_code of their own.'),
  ('gatherings',                 'FREE — the date, the place and the description on the calendar. Only the PLANNING is Standard, which is why the tier boundary runs through this feature rather than around it.'),
  ('gathering_occurrences',      'The dates a gathering falls on. Part of the Free calendar half.'),
  ('platform_billing_accounts',  'GENORRA''s billing state for this family. Deleting it would lose the very clock that scheduled the deletion.'),
  ('platform_payments',          'OUR revenue record. See §D.'),
  ('family_stripe_accounts',     'The family''s own merchant connection — an acct_ id, theirs, and reconnecting must find it.'),
  ('family_action_challenges',   'Six-digit codes with a fifteen-minute life. Deleting one mid-flight breaks an action somebody is completing.'),
  ('genorra_staff_challenges',   'The staff console''s own codes. Not family data.'),
  ('genorra_staff_deletions',    'The staff console''s audit row. It must outlive everything, which is its whole purpose.');

-- ── §3. THE APPEND-ONLY LEDGER'S ONE EXEMPTION ─────────────────────────────────────────
-- `dues_payments` is append-only for EVERYONE including the service role (20260806000002), and
-- its DELETE branch permits exactly one origin: the CASCADE from a `people` row that is already
-- gone. A tier purge keeps `people` — a relative is not a tier's data — so there is no cascade
-- to hang this on and the ledger could not otherwise be deleted at all.
--
-- ── WHY NOT THE `meeting_votes_are_final` SHAPE, WHICH TODO.md ASKED FOR ─────────────
-- That trigger admits a delete at `pg_trigger_depth() > 1`, i.e. only inside a real cascade,
-- and it is the right answer THERE because a vote genuinely does go with the topic it answered.
-- It is not available here: a depth test can only be satisfied by an actual cascade, and there
-- is no parent to cascade FROM. Making one — a nullable FK to some purge row — would need every
-- payment stamped first, which is an UPDATE the same trigger forbids.
--
-- ── SO IT IS A GUC, AND THE OBJECTION TO ONE IS ANSWERED BY AN ASSERTION ────────────
-- AGENTS.md's warning about `storage.allow_delete_query` is that *"a hatch is a thing any
-- future action can set"*. Two things make this one different, and the second is the load-
-- bearing half:
--
--   1. NOTHING IN THE APP CAN SET IT. PostgREST executes no arbitrary SQL and supabase-js has
--      no transaction control, so there is no path from a browser OR from the service-role
--      client to `SET LOCAL`. The only setter is a SECURITY DEFINER function in this chain.
--   2. §7 ASSERTS THAT NO OTHER FUNCTION IN `public` MENTIONS THE NAME. A second setter is a
--      failed deploy rather than a discovery, which is the property the storage hatch lacks.
--
-- `SET LOCAL`, so it dies with the transaction and cannot leak into the next statement on a
-- pooled connection.
CREATE OR REPLACE FUNCTION public.dues_payments_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  -- ── DELETE ────────────────────────────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN
    -- 1. The CASCADE from a people row that is already gone. Unchanged since 20260806000002:
    --    RI actions run as AFTER triggers on the PARENT, so by the time this fires the parent
    --    really is absent — an exact discriminator, and the reason it is used instead of
    --    pg_trigger_depth().
    IF NOT EXISTS (SELECT 1 FROM public.people WHERE id = OLD.person_id) THEN
      RETURN OLD;
    END IF;
    -- 2. A TIER PURGE. See the header above for why this is a GUC and what makes that
    --    admissible. `delete_family_data_above_tier` is the only thing that sets it, asserted.
    IF current_setting('genorra.tier_purge', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'dues_payments is append-only: payment % cannot be deleted', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- ── UPDATE ────────────────────────────────────────────────────────────────
  -- UNCHANGED, and deliberately not widened. The purge DELETES; it never edits. A row's amount
  -- stays frozen for everybody right up to the moment the row ceases to exist.
  IF NEW.id            IS DISTINCT FROM OLD.id
     OR NEW.family_code   IS DISTINCT FROM OLD.family_code
     OR NEW.person_id     IS DISTINCT FROM OLD.person_id
     OR NEW.amount_cents  IS DISTINCT FROM OLD.amount_cents
     OR NEW.payment_date  IS DISTINCT FROM OLD.payment_date
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.notes         IS DISTINCT FROM OLD.notes
     OR NEW.source        IS DISTINCT FROM OLD.source
     OR NEW.created_at    IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'dues_payments is immutable: payment % cannot be altered', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'pending' AND NEW.status = 'paid')
  THEN
    RAISE EXCEPTION 'dues_payments.status may only settle pending -> paid (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.processor_ref IS DISTINCT FROM OLD.processor_ref
     AND OLD.processor_ref IS NOT NULL
  THEN
    RAISE EXCEPTION 'dues_payments.processor_ref is write-once (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.schedule_id IS DISTINCT FROM OLD.schedule_id
     AND NOT (NEW.schedule_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.dues_schedules WHERE id = OLD.schedule_id))
  THEN
    RAISE EXCEPTION 'dues_payments.schedule_id is immutable (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
     AND NOT (NEW.recorded_by IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.people WHERE id = OLD.recorded_by))
  THEN
    RAISE EXCEPTION 'dues_payments.recorded_by is immutable (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
     AND NOT (NEW.plan_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.dues_member_plans WHERE id = OLD.plan_id))
  THEN
    RAISE EXCEPTION 'dues_payments.plan_id is immutable (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $fn$;

-- ── §4. THE ONE HARD-DELETE PATH, WITH THREE CALLERS ───────────────────────────────────
-- The sixty-day retention sweep, day 60 of the delinquency ladder, and "start fresh". Writing
-- it three times is how one of them ends up missing a table, which is TODO.md's own reason for
-- insisting on one.
--
-- ── ORDERED THE WAY `staff_delete_family` ORDERS ──────────────────────────────────────
-- Reverse dependency: a table's depth is how many family-scoped tables reference it, and the
-- deepest go first. `pg_class.oid` is not that order and never was.
--
-- ── IT RETURNS COUNTS, AND THE CALLER RECORDS THEM ────────────────────────────────────
-- A destruction nobody can account for afterwards is worse than one nobody can undo — the
-- argument `genorra_staff_deletions` already makes. The sweep writes them into
-- `platform_data_deletions` in the next migration.
--
-- ── DRY RUN IS NOT A COURTESY ─────────────────────────────────────────────────────────
-- `p_dry_run` counts without deleting, so the screen that warns a family can say exactly what
-- will go — from the same function that will go and delete it, rather than from a second query
-- that could disagree with it on the day it matters most.
CREATE OR REPLACE FUNCTION public.delete_family_data_above_tier(
  p_family_code TEXT,
  p_tier        TEXT,
  p_dry_run     BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code   TEXT := upper(btrim(COALESCE(p_family_code, '')));
  v_rank   INT;
  v_counts jsonb := '{}'::jsonb;
  v_tbl    TEXT;
  v_where  TEXT;
  v_n      BIGINT;
BEGIN
  IF v_code = '' THEN
    RAISE EXCEPTION 'delete_family_data_above_tier needs a family'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- THE TIER IS VALIDATED RATHER THAN DEFAULTED. An unrecognised value silently treated as
  -- 'free' would delete everything the family has, which is the one mistake this function must
  -- not make quietly.
  v_rank := CASE p_tier WHEN 'free' THEN 0 WHEN 'standard' THEN 1
                        WHEN 'plus' THEN 2 WHEN 'premium' THEN 3 END;
  IF v_rank IS NULL THEN
    RAISE EXCEPTION 'delete_family_data_above_tier: % is not a tier', p_tier
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.families f WHERE f.family_code = v_code) THEN
    RAISE EXCEPTION 'delete_family_data_above_tier: no family %', v_code
      USING ERRCODE = 'no_data_found';
  END IF;

  -- The ledger exemption, for this transaction only. See §3.
  IF NOT p_dry_run THEN
    PERFORM set_config('genorra.tier_purge', 'on', true);
  END IF;

  FOR v_tbl, v_where IN
    SELECT m.table_name, COALESCE(m.where_extra, 'true')
      FROM public.tier_data_tables m
      JOIN pg_class c   ON c.relname = m.table_name
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE CASE m.min_tier WHEN 'standard' THEN 1 WHEN 'plus' THEN 2 ELSE 3 END > v_rank
     ORDER BY (
       SELECT count(*) FROM pg_constraint fk
        WHERE fk.contype = 'f' AND fk.confrelid = c.oid
     ) ASC, m.table_name ASC
  LOOP
    -- `v_where` is interpolated with %s and NOT parameterised, because it is a SQL FRAGMENT
    -- rather than a value. It is safe for one reason and the reason is worth stating: the
    -- table has no policy and no grant, so the only writer is a migration — there is no path
    -- from any caller to put a string in this column. If that ever stops being true, this is
    -- an injection point.
    IF p_dry_run THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE family_code = $1 AND (%s)',
                     v_tbl, v_where)
        INTO v_n USING v_code;
    ELSE
      EXECUTE format('DELETE FROM public.%I WHERE family_code = $1 AND (%s)', v_tbl, v_where)
        USING v_code;
      GET DIAGNOSTICS v_n = ROW_COUNT;
    END IF;
    IF v_n > 0 THEN
      v_counts := v_counts || jsonb_build_object(v_tbl, v_n);
    END IF;
  END LOOP;

  RETURN v_counts;
END $$;

REVOKE ALL ON FUNCTION public.delete_family_data_above_tier(TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.delete_family_data_above_tier(TEXT, TEXT, BOOLEAN) IS
  'Permanently delete every row a family holds that its tier does not include. THE ONE '
  'hard-delete path, with three callers: the sixty-day retention sweep, day 60 of the '
  'delinquency ladder, and "start fresh". Reads tier_data_tables, which is hand-written and '
  'reviewed because no derivation of it exists. Granted to nobody. Cannot reach storage: a '
  'deleted photo row leaves its bytes in the bucket — see the migration header §E.';

-- ── §5. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_missing TEXT;
  v_n       INT;
  v_code    TEXT := 'TIERPURGE';
  v_person  UUID;
  v_counts  jsonb;
BEGIN
  -- 1. THE COMPLETENESS ASSERTION — the reason a hand-written list is survivable at all.
  --    Every family-scoped table in `public` is either on the map or on the keep-list, and one
  --    on neither is named. This is `reset_families.sql` §11's shape, and it is what stops a
  --    table added next year being silently un-purgeable (or, worse, silently purged).
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_missing
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
   WHERE n.nspname = 'public' AND c.relkind = 'r'
     AND a.attname = 'family_code' AND a.attnum > 0 AND NOT a.attisdropped
     AND c.relname NOT IN (SELECT table_name FROM public.tier_data_tables)
     AND c.relname NOT IN (SELECT table_name FROM public.tier_data_keep);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: family-scoped table(s) on neither the tier map nor the keep-list: %. '
      'Decide which tier each belongs to, or add it to tier_data_keep with a reason.', v_missing;
  END IF;

  -- 2. AND THE OTHER DIRECTION. A row naming a table that does not exist is a map that has
  --    gone stale the other way — `audit_global_lookups.sql`'s lesson about one-way assertions.
  SELECT string_agg(t.table_name, ', ') INTO v_missing
    FROM (SELECT table_name FROM public.tier_data_tables
          UNION ALL SELECT table_name FROM public.tier_data_keep) t
   WHERE to_regclass('public.' || quote_ident(t.table_name)) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: the map names table(s) that do not exist: %', v_missing;
  END IF;

  -- 3. THE FOUR KEPT AGAINST THEIR TIER. Named individually, because each is a decision
  --    somebody could undo by "tidying" the map to agree with lib/features.ts.
  FOR v_missing IN
    SELECT unnest(ARRAY['permission_templates','resource_visibility','sms_consent_events',
                        'platform_payments'])
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.tier_data_keep k WHERE k.table_name = v_missing) THEN
      RAISE EXCEPTION
        'ROLLBACK: % must stay on the keep-list — see the migration header §D', v_missing;
    END IF;
  END LOOP;

  -- 4. THE GUC HAS EXACTLY ONE SETTER. This is what answers AGENTS.md's objection to an escape
  --    hatch: a second one is a failed deploy rather than something to discover later.
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosrc LIKE '%genorra.tier_purge%'
     AND p.proname NOT IN ('delete_family_data_above_tier', 'dues_payments_immutable');
  IF v_n > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % other function(s) reference genorra.tier_purge. The ledger exemption has '
      'exactly one setter, and that is the whole argument for it being a GUC at all', v_n;
  END IF;

  -- 5. THE TRIGGER IS STILL INSTALLED. Redefining the function does not touch the trigger, but
  --    a future edit that dropped it would leave this file looking correct and the ledger open.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.dues_payments'::regclass AND tgname = 'dues_payments_immutable'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: the dues_payments immutability trigger is missing';
  END IF;

  -- ── EXERCISED FOR REAL, because plpgsql resolves nothing until the body runs ──────
  INSERT INTO public.families (family_code, family_name) VALUES (v_code, 'Tier purge probe');
  INSERT INTO public.people (family_code, first_name, last_name, primary_email)
       VALUES (v_code, 'Purge', 'Probe', 'purge-probe@genorra.com')
    RETURNING id INTO v_person;
  INSERT INTO public.dues_payments
              (family_code, person_id, amount_cents, payment_date, payment_method, status,
               recorded_by)
       VALUES (v_code, v_person, 4000, CURRENT_DATE, 'cash', 'paid', v_person);

  -- 6. THE LEDGER IS STILL APPEND-ONLY OUTSIDE THE PURGE. Asserted BEFORE the purge is proved
  --    to work, so a mistake that opened the hatch permanently fails here rather than passing
  --    both halves.
  BEGIN
    DELETE FROM public.dues_payments WHERE family_code = v_code;
    RAISE EXCEPTION 'ROLLBACK: dues_payments was deletable without the purge GUC';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;   -- expected
  END;

  -- 7. A DRY RUN DELETES NOTHING AND COUNTS SOMETHING.
  v_counts := public.delete_family_data_above_tier(v_code, 'free', true);
  IF (v_counts ->> 'dues_payments')::int IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'ROLLBACK: the dry run did not count the payment: %', v_counts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dues_payments WHERE family_code = v_code) THEN
    RAISE EXCEPTION 'ROLLBACK: the DRY RUN deleted the payment';
  END IF;

  -- 8. A PURGE AT THE FAMILY'S OWN TIER DELETES NOTHING. The case that matters most: a Standard
  --    family whose retention window closes must lose Plus data and keep its ledger.
  v_counts := public.delete_family_data_above_tier(v_code, 'standard', false);
  IF v_counts ? 'dues_payments' THEN
    RAISE EXCEPTION 'ROLLBACK: a purge at standard took the dues ledger: %', v_counts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dues_payments WHERE family_code = v_code) THEN
    RAISE EXCEPTION 'ROLLBACK: a purge at standard removed the payment';
  END IF;

  -- 9. AND A PURGE AT FREE TAKES IT. The exemption works, once, for the one caller.
  v_counts := public.delete_family_data_above_tier(v_code, 'free', false);
  IF EXISTS (SELECT 1 FROM public.dues_payments WHERE family_code = v_code) THEN
    RAISE EXCEPTION 'ROLLBACK: the purge did not delete the ledger';
  END IF;

  -- 10. THE PERSON SURVIVES. `people` is on the keep-list and a purge is not a removal — if
  --     this ever fails, a lapsed card has started deleting relatives.
  IF NOT EXISTS (SELECT 1 FROM public.people WHERE id = v_person) THEN
    RAISE EXCEPTION 'ROLLBACK: the purge deleted a person';
  END IF;

  -- 11. AN UNRECOGNISED TIER IS REFUSED RATHER THAN TREATED AS FREE.
  BEGIN
    PERFORM public.delete_family_data_above_tier(v_code, 'gold', true);
    RAISE EXCEPTION 'ROLLBACK: an unknown tier was accepted';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;   -- expected
  END;

  DELETE FROM public.people WHERE family_code = v_code;
  DELETE FROM public.families WHERE family_code = v_code;

  SELECT count(*) INTO v_n FROM public.tier_data_tables;
  RAISE NOTICE 'tier map: % tiered table(s), % kept; purge, dry run, ledger exemption and the '
               'completeness assertion all verified',
    v_n, (SELECT count(*) FROM public.tier_data_keep);
END $mig$;

COMMIT;
