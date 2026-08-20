-- ═══════════════════════════════════════════════════════════════════════════════════
-- RETIRE THE EVENTS PRODUCT — AND DROP IT
--
-- Gatherings replaced it. `/events`, `/event-planning`, `/admin/events` and
-- `/admin/event-types` are deleted — the routes, the six action modules behind them and
-- every component — and this is the database half of the same commit.
--
-- ── THIS MIGRATION DROPS THIRTEEN TABLES, AND THAT IS THE INSTRUCTION ──────────────
-- The first draft of this file did the opposite: it dropped every POLICY and left every ROW,
-- on the argument that retiring a feature is not authority to empty a family's RSVPs and
-- hotel bookings. That argument turns entirely on there being a family whose records they
-- are, and there is not — **no family is using this product yet**, which was stated
-- explicitly, so the caution was protecting nothing and the cost of it was real: thirteen
-- tables nothing reads, a money column in `fund_balance_cents()` that could never change
-- again, and `funds.event_id` and `photo_collections.event_id` pointing into all of it.
--
-- A HALF-RETIREMENT IS THE EXPENSIVE STATE, which is why this is worth stating rather than
-- just doing. Frozen tables are the thing AGENTS.md's "Three tables in `public` are product
-- data" section is really about: rows that no code reads and no test covers, still carrying
-- grants, still in every `\d` listing, and answering nobody's question. The Events tables
-- were already the oldest and least-reviewed in the schema — created with bare
-- `CREATE POLICY` reading a spoofable `user_metadata` claim, rewritten by three separate
-- sweeps since. Keeping them unreachable-but-present would have meant every future sweep
-- has to reason about them forever.
--
-- **THIS IS IRREVERSIBLE.** A migration a database has recorded as applied never runs
-- again, so nothing in the chain, the app or a `db reset` will ever put these rows back.
-- That is the intended outcome and not a risk being accepted quietly.
--
-- ── `event_expenses` WAS MONEY, AND ITS TERM COMES OUT OF THE BALANCE ──────────────
-- §B rewrites `fund_balance_cents()` to
--
--     contributions − disbursements + transfers in − transfers out
--
-- which is the same formula minus one subtrahend. **Every fund's balance therefore RISES by
-- whatever event spend was charged to it**, and on an empty product that is zero for every
-- fund in existence — asserted below rather than assumed, because it is the one number in
-- this file that a reader would want checked. `app/actions/funds.ts`, `getFamilyPnL` and the
-- Reports activity feed drop the same term in the same commit, so the app and the database
-- keep agreeing about what a fund holds.
--
-- The P&L's `totalExpenseCents` was event spend and nothing else, so it becomes fund
-- DISBURSEMENTS — money that actually left a fund, which is what the statement was always
-- for and is now the only outgoing this product records.
--
-- ── WHAT ELSE HAD TO GO WITH THEM ─────────────────────────────────────────────────
--   `funds.event_id`                    the only reason a fund knew about an event
--   `photo_collections.event_id`        a gallery "per event"
--   `cancel_overdue_event_assignments`  a SECURITY INVOKER sweep with an `authenticated`
--                                       grant, no caller anywhere in the tree, and a body
--                                       that reads two dropped tables. TODO.md records the
--                                       grant as a loose end; this closes it by deletion.
--
-- Verify: `npx supabase db reset`, then `npm run test:rls`.
-- ═══════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §A. The two columns that point into `events` ───────────────────────────────────
-- Dropped BEFORE the tables, so the FK goes with the column rather than being dropped out
-- from under it by a CASCADE. `funds.event_id` was how a fund was earmarked for one event
-- — `getFamilyPnL` read it to name a gathering's backing fund — and `photo_collections
-- .event_id` was how a gallery belonged to one. Neither has a replacement: a gathering's
-- money is `gatherings.fund_id` and `gatherings.budget_cents`, which is a better answer than
-- a column on the fund, and a collection belongs to whatever its name says.
ALTER TABLE public.funds             DROP COLUMN IF EXISTS event_id;
ALTER TABLE public.photo_collections DROP COLUMN IF EXISTS event_id;

-- ── §B. The fund balance loses its event-spend term ────────────────────────────────
-- This function is the database's own answer to "what does this fund hold", and
-- `lib/gathering-budget.ts` measures a gathering's budget against it — so it has to lose the
-- term in the same transaction the table does, or the next call reads a relation that is not
-- there.
--
-- **EVERY PART OF THE SIGNATURE IS COPIED FROM `20260812000002` VERBATIM: `RETURNS INT`,
-- `LANGUAGE sql STABLE`, `SET search_path = ''`, SECURITY INVOKER (the default).** Only the
-- body changes. `CREATE OR REPLACE` refuses a changed return type outright — `cannot change
-- return type of existing function`, SQLSTATE 42P13 — which is exactly what a first draft of
-- this hunk got for writing `RETURNS bigint`, and it is the good failure: a silent widening
-- would have changed what every caller receives. If the type ever genuinely needs to move it
-- is a DROP and a CREATE, and then every grant and every dependent has to be re-stated.
--
-- INVOKER is deliberate too, and not an omission. This reads three tables the caller can
-- already read under their own policies, so DEFINER would buy nothing and would put a
-- privilege boundary inside a sum. `search_path = ''` is why every reference is
-- schema-qualified — TODO.md records this function among the seven `db advisors` flags, and
-- that half was already fixed.
CREATE OR REPLACE FUNCTION public.fund_balance_cents(p_fund_id UUID)
RETURNS INT LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT  COALESCE((SELECT SUM(amount_cents) FROM public.fund_contributions WHERE fund_id = p_fund_id), 0)
        - COALESCE((SELECT SUM(amount_cents) FROM public.fund_disbursements WHERE fund_id = p_fund_id), 0)
        + COALESCE((SELECT SUM(amount_cents) FROM public.fund_transfers WHERE to_fund_id   = p_fund_id), 0)
        - COALESCE((SELECT SUM(amount_cents) FROM public.fund_transfers WHERE from_fund_id = p_fund_id), 0);
$$;

-- ── NO GRANT. THIS FUNCTION HAS NO `authenticated` EXECUTE AND MUST NOT GAIN ONE ───
-- A first draft of this hunk added `GRANT EXECUTE … TO authenticated` on the §2b reflex that
-- "adding a function means adding its grant". That reflex is right for a function the BROWSER
-- calls and wrong here, and it silently reversed a documented decision: this function has had
-- no `authenticated` grant anywhere in the chain since `20260812000002` created it, and
-- `app/actions/admin/gatherings.ts` and `app/actions/gatherings.ts` both state at length that
-- the service role is its only caller.
--
-- That is not a permission detail. A balance recomputed on the USER client silently omits the
-- transfer term for anyone without `transactions/fund-transfers:view` — which is exactly why
-- `getGatheringFundOptions` calls this through the admin client, so two organizers cannot be
-- shown different answers to "is this gathering over its fund". Granting it to `authenticated`
-- would make the per-viewer version reachable again, from the browser, with nothing in the app
-- calling it.
--
-- `CREATE OR REPLACE` preserves the existing ACL, so saying nothing here is what keeps it as it
-- was. Default privileges revoke EXECUTE from `anon` and `authenticated` (`20260806000015`), so
-- a future `DROP … CREATE` would leave it ungranted too — which is the correct end state, not a
-- hazard.

-- ── §C. The sweep function with no caller ──────────────────────────────────────────
-- Its body reads `event_assignments` and `events`, so it could not survive §D anyway; it is
-- dropped by name rather than left to a CASCADE so this file says out loud that a function
-- disappeared. Nothing in `app/`, `lib/` or `supabase/` calls it, and it is not a trigger.
DROP FUNCTION IF EXISTS public.cancel_overdue_event_assignments();

-- ── §D. The thirteen tables ────────────────────────────────────────────────────────
-- Order is child-before-parent so the CASCADE has as little to do as possible, and CASCADE
-- is still stated on each: what it may legitimately take is an index, a policy, a trigger or
-- a constraint belonging to the table itself. The two inbound FKs from surviving tables are
-- already gone (§A), so there is nothing OUTSIDE this list for a cascade to reach — which is
-- the property that makes CASCADE safe here rather than a shrug.
DROP TABLE IF EXISTS public.event_photos                 CASCADE;
DROP TABLE IF EXISTS public.event_rsvp_attendees         CASCADE;
DROP TABLE IF EXISTS public.event_rsvp                   CASCADE;
DROP TABLE IF EXISTS public.event_expenses               CASCADE;
DROP TABLE IF EXISTS public.event_budget_items           CASCADE;
DROP TABLE IF EXISTS public.event_assignments            CASCADE;
DROP TABLE IF EXISTS public.event_hotel_price_estimates  CASCADE;
DROP TABLE IF EXISTS public.event_hotel_booking_details  CASCADE;
DROP TABLE IF EXISTS public.event_hotel_bookings         CASCADE;
DROP TABLE IF EXISTS public.events                       CASCADE;
DROP TABLE IF EXISTS public.event_type_sub_templates     CASCADE;
DROP TABLE IF EXISTS public.event_blueprint_items        CASCADE;
DROP TABLE IF EXISTS public.event_types                  CASCADE;

-- ── §E. The permission_table_map rows ──────────────────────────────────────────────
-- `20260618000001` composes RLS policies out of this table at migration time, so a row left
-- here would tell the next sweep to compose a policy for a table that does not exist —
-- which fails the whole migration rather than being ignored.
--
-- `photos → event_photos` is on this list although its key is not an `event*` one: that
-- table was part of Events, `app/actions/event-photos.ts` is deleted with the rest, and
-- `/photos` must not ship carrying a mapped table that is gone.
DELETE FROM public.permission_table_map
 WHERE resource_key IN ('events', 'event-planning', 'admin/events', 'admin/event-types')
    OR table_name LIKE 'event\_%'
    OR table_name = 'events';

-- ── §F. Per-template grants and per-family visibility ──────────────────────────────
-- `template_permissions` is MATERIALIZED — every template carries an explicit row for every
-- resource and action (`20260807000000`) — so deleting the resource without these leaves
-- rows that no screen can render and `auth_permission()` would still find. An explicit grant
-- WINS over every default in that function, so a stale row here is not inert: it is a live
-- 'any' scope on a key nothing consults today and something might name tomorrow.
DELETE FROM public.template_permissions
 WHERE resource_key IN ('events', 'event-planning', 'admin/events', 'admin/event-types');

DELETE FROM public.resource_visibility
 WHERE resource_key IN ('events', 'event-planning', 'admin/events', 'admin/event-types');

-- ── §G. The resources themselves ───────────────────────────────────────────────────
-- The grid renders from this table, so this is what takes four switches off Permission
-- Templates. AGENTS.md: "a switch nothing consults reads as a control being honoured", and
-- after §D there is nothing left for them to consult.
--
-- DELETED RATHER THAN LEFT WITH A NARROWED `actions`, which is the treatment `/admin/groups`
-- (`20260807000000`) and `/admin/announcements` (`20260813000000`) both got: these are not
-- features awaiting launch, they are pages that no longer exist.
DELETE FROM public.permission_resources
 WHERE key IN ('events', 'event-planning', 'admin/events', 'admin/event-types');

-- ── §H. The `events` CATEGORY IS ALL GATHERINGS NOW, so its sub-heading is redundant ──
-- `permission_resources.category` still reads `'events'` for the four surviving keys —
-- `gatherings`, `gatherings/my-tasks`, `gatherings/budget`, `calendar` — and it STAYS that
-- way. That column is load-bearing in SQL rather than cosmetic: `auth_permission()` reads it
-- to decide whether a key with no `resource_visibility` row fails closed (`category =
-- 'admin'`), and `20260817000004` asserts the category and the `admin/` prefix can never
-- disagree. A rename would be a migration three resolvers have to agree about, to change a
-- word nobody sees — the grid prints `CATEGORY_LABEL`, which now says "Gatherings".
--
-- The SUB-SECTION is a different matter and does need this. Two of those four carry
-- `subsection = 'Gatherings'`, which read as "Events ▸ Gatherings" and now reads as
-- "Gatherings ▸ Gatherings". Cleared, so all four sit flat under one heading — which is also
-- what the rail does with them: two member panes, the calendar, and one admin row.
UPDATE public.permission_resources
   SET subsection = NULL
 WHERE category = 'events' AND subsection = 'Gatherings';

-- ── §I. Assertions, in BOTH directions ─────────────────────────────────────────────
-- AGENTS.md, on `truncate_entire_database.sql`: "Every assertion about a purge has to run in
-- BOTH directions." So this checks that what should be gone IS gone, and — the direction that
-- catches the expensive mistake — that what must survive is untouched.
DO $$
DECLARE
  v_left int;
  v_src  text;
BEGIN
  -- Not one table, one column, one function or one policy left.
  SELECT count(*) INTO v_left FROM pg_tables
   WHERE schemaname = 'public' AND (tablename LIKE 'event\_%' OR tablename = 'events');
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'retire_events: % event table(s) still exist', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM information_schema.columns
   WHERE table_schema = 'public' AND column_name = 'event_id';
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'retire_events: % column(s) named event_id still exist', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace AND prosrc LIKE '%event\_%';
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'retire_events: % function(s) still name an event table', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.permission_resources
   WHERE key IN ('events', 'event-planning', 'admin/events', 'admin/event-types');
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'retire_events: % event resource(s) still registered', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.permission_table_map
   WHERE table_name LIKE 'event\_%' OR table_name = 'events';
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'retire_events: % event table(s) still mapped to a resource', v_left;
  END IF;

  -- The `events` category holds nothing but Gatherings keys now, which is what makes the
  -- caption change in `CATEGORY_LABEL` honest rather than a relabelling of a mixed bag.
  SELECT count(*) INTO v_left FROM public.permission_resources
   WHERE category = 'events' AND key NOT LIKE 'gatherings%' AND key <> 'calendar';
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'retire_events: % non-Gatherings key(s) still filed under the events category', v_left;
  END IF;

  -- ── THE OTHER DIRECTION ────────────────────────────────────────────────────────
  -- The balance formula is the one thing here that could go wrong QUIETLY, so it is checked
  -- for what it must NOT say and for what it must: no event term, and all four of the terms
  -- that remain. A `CREATE OR REPLACE` that dropped a transfer leg by accident would
  -- otherwise be a fund balance silently wrong in production.
  SELECT prosrc INTO v_src FROM pg_proc WHERE proname = 'fund_balance_cents';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'retire_events: fund_balance_cents is missing';
  END IF;
  IF v_src LIKE '%event%' THEN
    RAISE EXCEPTION 'retire_events: fund_balance_cents still names an event table';
  END IF;
  IF v_src NOT LIKE '%fund_contributions%' OR v_src NOT LIKE '%fund_disbursements%'
     OR v_src NOT LIKE '%to_fund_id%' OR v_src NOT LIKE '%from_fund_id%' THEN
    RAISE EXCEPTION 'retire_events: fund_balance_cents lost one of its four surviving terms';
  END IF;

  -- The RETURN TYPE, because getting it wrong is how this hunk failed the first time and
  -- because the failure mode of a silent widening is every caller receiving a different type.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'fund_balance_cents' AND prorettype = 'integer'::regtype
  ) THEN
    RAISE EXCEPTION 'retire_events: fund_balance_cents no longer RETURNS INT';
  END IF;

  -- THE GRANT IS ASSERTED ABSENT, not present — see the note above §B's function. This is
  -- `20260806000015`'s own shape of check, and unlike a `NOT has_function_privilege` assertion
  -- on a function that IS meant to be reachable (which AGENTS.md §2b warns is worthless because
  -- `seed.sql` re-grants seconds later), this one holds: `supabase/seed.sql` restores TABLE
  -- grants, not function grants, so nothing puts this back after a reset.
  IF has_function_privilege('authenticated', 'public.fund_balance_cents(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION 'retire_events: fund_balance_cents must NOT be executable by authenticated — the service role is its only caller, so a per-viewer balance cannot be reached from the browser';
  END IF;

  -- EVERY FUND'S BALANCE IS UNCHANGED, which is the claim the header makes and the only one
  -- a reader would want measured. Dropping the event-spend term can only RAISE a balance, and
  -- only for a fund that had event spend charged to it — so on a product with no families
  -- this is zero funds, and the NOTICE says so out loud rather than leaving it inferred.
  --
  -- It cannot be asserted as an EXCEPTION: by the time this block runs the table is gone, so
  -- there is nothing left to compare against. What it can do is report how many funds exist
  -- at all, which is what makes "nobody was affected" checkable at the moment of deploy.
  SELECT count(*) INTO v_left FROM public.funds;
  RAISE NOTICE 'retire_events: % fund(s) exist; their balances lose the event-spend term, which was the only outgoing this drop removes', v_left;
END $$;

COMMIT;
