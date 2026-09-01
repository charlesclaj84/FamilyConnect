-- ═══════════════════════════════════════════════════════════════════════════════════════
-- THE DELINQUENCY LADDER, AND THE SIXTY DAYS A DOWNGRADE WITHHOLDS BEFORE IT DELETES
--
-- Both decided 2026-08-23, both blocked on a scheduler until `20260823000006` installed
-- `pg_cron`, and both built here on `20260901000001`'s one hard-delete path.
--
-- ── §A. THE LADDER, DAY COUNTED FROM `delinquent_since` ─────────────────────────────
--
--    0   `invoice.payment_failed`. The date is stamped. Nothing else.
--    5   Email every administrator. Full access continues.
--   10   MEMBERS ARE LOCKED OUT. Only administrators can use the app; a member is told to
--        contact their family administrator about an accounting issue and nothing more.
--   30   ADMINISTRATORS LOSE EVERYTHING EXCEPT THE SCREEN THAT TAKES A PAYMENT.
--   45   Email: the account will be deleted in 15 days.
--   59   Email: tomorrow, unless payment is received.
--   60   The family drops to FREE and everything Free does not include is deleted.
--
-- ── §B. DAY 60 IS A DROP TO FREE, NOT A DELETION OF THE FAMILY ──────────────────────
-- Realigned 2026-09-01. The brief said the family's records are deleted; the decision taken is
-- narrower and better: **move them to Free and delete only what Free does not include.** A
-- family that stops paying is a family that stopped paying — they keep their relatives, their
-- directory, their announcements, their chat and their calendar, which is what every family
-- gets without paying anything. What they lose is what they were paying for.
--
-- It also makes the two features ONE mechanism rather than two that resemble each other: day 60
-- of the ladder and day 60 of a downgrade's withholding window both call
-- `delete_family_data_above_tier`, at the tier the family is on afterwards.
--
-- **THE SIXTY DAYS ARE NOT SERVED TWICE.** A family reaching day 60 delinquent has already had
-- sixty days and five emails, two of which say in terms that the data cannot be recovered — so
-- the drop to Free deletes immediately rather than starting a second withholding clock. Any
-- other reading makes the day-45 and day-59 wording ("in 15 days", "tomorrow") false.
--
-- ── §C. THE LOCKOUT IS A GUARD, NOT A TIER, AND `families.tier` IS NOT TOUCHED ──────
-- Until day 60 nothing about the family's plan changes. A family that pays on day 29 finds
-- everything exactly where it was, which is only true if the lockout was never a tier.
-- `requireFamilyBillingAccess` sits beside `requireFamilyActive` inside `requireView`, which is
-- where the removed-family check already lives and where a page cannot forget it. No RLS policy
-- consults `delinquent_since` and none may — the same rule `families.status` and `families.tier`
-- both keep.
--
-- ── §D. THE EMAILS ARE WIRED INTO THE MECHANISM, NOT PROMISED IN PROSE ──────────────
-- The window and the reminders are the whole safety argument for a feature that destroys data,
-- so a sweep that could delete without them would be the argument deleted. Both deletion paths
-- REFUSE unless the notices they owed are recorded as `sent`. A mail outage therefore delays a
-- deletion indefinitely, which is the correct direction to fail.
--
-- ── §E. TWO CLOCKS, AND EACH DOES WHAT ONLY IT CAN ──────────────────────────────────
-- `pg_cron` cannot send email — that needs `http` or `pg_net`, neither installed, and TODO.md
-- argues both. Node cannot be trusted to run on a schedule inside this database. So:
--
--   pg_cron, hourly        STATE. Enqueue due notices, drop a tier, delete data. No network.
--   the drain endpoint     MAIL. Claims pending notices and sends them. No decisions.
--
-- They are not two answers to one question: neither can do the other's half, and the queue
-- between them is `platform_billing_notices` — the `distribution_recipients` design, for the
-- reason that one states: *"this product has nowhere to run background work."*
--
-- IDEMPOTENT. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. THE RETENTION CLOCK ────────────────────────────────────────────────────────────
-- `withheld_since` is stamped when a downgrade LANDS, and the four reminders count from it —
-- never from `scheduled_tier_on`, which is cleared the moment the change applies and would
-- leave the clock with nothing to measure.
ALTER TABLE public.platform_billing_accounts
  ADD COLUMN IF NOT EXISTS withheld_since     DATE;
-- WHICH TIER'S DATA IS BEING WITHHELD. Needed for two things a date cannot answer: the
-- "pay for the months you were away" figure is computed at the RETURNING tier's rate, and the
-- reminder has to name what is at stake.
ALTER TABLE public.platform_billing_accounts
  ADD COLUMN IF NOT EXISTS withheld_from_tier TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.platform_billing_accounts'::regclass
       AND conname = 'platform_billing_withheld_pair'
  ) THEN
    ALTER TABLE public.platform_billing_accounts
      ADD CONSTRAINT platform_billing_withheld_pair
      -- The `scheduled_tier` pair's own shape: a date with no tier is a clock measuring
      -- nothing, and a tier with no date is data withheld until the end of time.
      CHECK ((withheld_since IS NULL) = (withheld_from_tier IS NULL));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.platform_billing_accounts'::regclass
       AND conname = 'platform_billing_withheld_tier_check'
  ) THEN
    ALTER TABLE public.platform_billing_accounts
      ADD CONSTRAINT platform_billing_withheld_tier_check
      CHECK (withheld_from_tier IS NULL
             OR withheld_from_tier IN ('standard','plus','premium'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS platform_billing_withheld_idx
  ON public.platform_billing_accounts (withheld_since)
  WHERE withheld_since IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_billing_delinquent_idx
  ON public.platform_billing_accounts (delinquent_since)
  WHERE delinquent_since IS NOT NULL;

COMMENT ON COLUMN public.platform_billing_accounts.withheld_since IS
  'The day a downgrade LANDED and the tier''s data stopped being reachable. The four reminders '
  'and the sixty-day deletion count from here — never from scheduled_tier_on, which is cleared '
  'when the change applies. NULL once the family returns to the tier or the data is deleted.';

COMMENT ON COLUMN public.platform_billing_accounts.withheld_from_tier IS
  'Which tier''s data is being withheld. The returning-family quote is priced at THIS rate, and '
  'the reminders name it.';

-- ── §2. THE QUEUE ──────────────────────────────────────────────────────────────────────
-- `distribution_recipients`' design, and for the reason that table's own header gives: this
-- product has nowhere to run background work, so the queue IS the table and the state lives in
-- rows rather than in a request.
CREATE TABLE IF NOT EXISTS public.platform_billing_notices (
  id          UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  family_code TEXT NOT NULL,
  -- Which ladder. Two, and they are genuinely different messages to different people about
  -- different clocks — a `retention` notice goes to a family in good standing.
  kind        TEXT NOT NULL CHECK (kind IN ('dunning','retention')),
  -- Which rung. `day5`…`day59` for dunning; `d30`,`d15`,`d5`,`d1` days-before for retention.
  stage       TEXT NOT NULL,
  -- ── THE CYCLE KEY, WHICH IS WHAT MAKES THIS IDEMPOTENT ACROSS TIME ────────────────
  -- `delinquent_since` or `withheld_since`. A family that lapses, pays, and lapses again in
  -- March gets a NEW day-5 notice, because the cycle is a different date — while an hourly
  -- sweep re-running inside one cycle enqueues nothing. Keying on `(family, kind, stage)`
  -- alone would send the second lapse nothing at all, silently and forever.
  cycle_on    DATE NOT NULL,
  due_on      DATE NOT NULL,
  state       TEXT NOT NULL DEFAULT 'pending'
              CHECK (state IN ('pending','sending','sent','failed','cancelled')),
  attempts    INT  NOT NULL DEFAULT 0,
  claimed_at  TIMESTAMPTZ,
  sent_at     TIMESTAMPTZ,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_code, kind, stage, cycle_on)
);

ALTER TABLE public.platform_billing_notices ENABLE ROW LEVEL SECURITY;
-- ZERO POLICIES. Per §2c that denies every command to both browser roles. The Billing panel
-- reads its own family's notices through a gated action on the admin client; a family's dunning
-- history is not something to publish to every member holding a view grant.

CREATE INDEX IF NOT EXISTS platform_billing_notices_pending_idx
  ON public.platform_billing_notices (due_on)
  WHERE state IN ('pending','sending');

COMMENT ON TABLE public.platform_billing_notices IS
  'The dunning and retention mail queue. pg_cron ENQUEUES (it cannot send); the drain endpoint '
  'SENDS (it decides nothing). Unique on (family, kind, stage, cycle_on), so an hourly sweep '
  'inside one cycle adds nothing and a SECOND lapse months later starts a fresh set. Both '
  'deletion sweeps refuse to act unless the notices they owed are `sent` — the emails are the '
  'safety argument, so they are load-bearing rather than advisory.';

-- ── §3. THE AUDIT ROW ──────────────────────────────────────────────────────────────────
-- `genorra_staff_deletions`' argument: a destruction nobody can account for afterwards is worse
-- than one nobody can undo. It has no `family_code`… it does, deliberately — this one is ABOUT
-- a family that still exists, so scoping it is right and it goes on the keep-list.
CREATE TABLE IF NOT EXISTS public.platform_data_deletions (
  id          UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  family_code TEXT NOT NULL,
  -- Which of the three callers. `start_fresh` is a person; the other two are the clock.
  reason      TEXT NOT NULL CHECK (reason IN ('delinquency','retention','start_fresh')),
  -- The tier the family was left ON. What was deleted is everything above it.
  tier_kept   TEXT NOT NULL,
  -- What was withheld before it went, for the retention path. NULL for a delinquency drop.
  withheld_from_tier TEXT,
  -- `{table: count}` from `delete_family_data_above_tier`. The only record of what was there.
  deleted     JSONB NOT NULL,
  -- Whoever pressed it, for `start_fresh`. NULL for a sweep, which has no `auth.uid()`.
  acted_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_data_deletions ENABLE ROW LEVEL SECURITY;

-- It carries a `family_code`, so `20260901000001`'s completeness assertion will demand a
-- verdict on it. It is a record OF a purge and must survive every future one.
INSERT INTO public.tier_data_keep (table_name, note)
VALUES ('platform_billing_notices',
        'The dunning and retention queue. A purge that deleted its own notices would erase the '
        'evidence that the family was warned — which is the safety argument for the purge.'),
       ('platform_data_deletions',
        'The record of a purge. It must outlive every future one, which is its whole purpose — '
        'the argument genorra_staff_deletions already makes.')
ON CONFLICT (table_name) DO UPDATE SET note = EXCLUDED.note;

-- ── §4. CLAIMING NOTICES, IN ONE STATEMENT ─────────────────────────────────────────────
-- `claim_distribution_recipients`' shape and its reason: a read-then-write from the app lets
-- two concurrent drains both decide they are first, and here that means a family told twice
-- that its data is about to be deleted. `FOR UPDATE SKIP LOCKED` is what makes it one decision.
--
-- ── A `sending` CLAIM IS RECOVERABLE, LIKE A STRIPE EVENT'S ────────────────────────────
-- `claim_stripe_event` states it: without a staleness window a handler that dies mid-flight
-- leaves the row claimed forever, and the notice is lost by the mechanism meant to protect it.
-- Fifteen minutes, the same figure and for the same reason.
CREATE OR REPLACE FUNCTION public.claim_platform_billing_notices(p_limit INT DEFAULT 25)
RETURNS TABLE (
  id UUID, family_code TEXT, kind TEXT, stage TEXT, cycle_on DATE, attempts INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT n.id
      FROM public.platform_billing_notices n
     WHERE n.due_on <= CURRENT_DATE
       AND (
         n.state = 'pending'
         OR (n.state = 'sending' AND n.claimed_at < NOW() - INTERVAL '15 minutes')
       )
     ORDER BY n.due_on ASC, n.created_at ASC
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 200))
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.platform_billing_notices n
     SET state = 'sending', claimed_at = NOW(), attempts = n.attempts + 1
    FROM picked
   WHERE n.id = picked.id
  RETURNING n.id, n.family_code, n.kind, n.stage, n.cycle_on, n.attempts;
END $$;

REVOKE ALL ON FUNCTION public.claim_platform_billing_notices(INT)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finish_platform_billing_notice(
  p_id    UUID,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_error IS NULL THEN
    UPDATE public.platform_billing_notices
       SET state = 'sent', sent_at = NOW(), last_error = NULL
     WHERE id = p_id;
  ELSE
    -- BACK TO `pending`, not to `failed`, until it has been tried five times. A transient mail
    -- outage must not consume a notice — and the notice is what a deletion waits on, so a row
    -- stuck at `failed` would silently postpone a purge forever with no explanation.
    UPDATE public.platform_billing_notices
       SET state = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
           last_error = left(p_error, 500)
     WHERE id = p_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.finish_platform_billing_notice(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

-- ── §5. THE SWEEP ──────────────────────────────────────────────────────────────────────
-- One function for both ladders, called hourly, taking no arguments and safe to run forever
-- against a database where nobody has ever paid — `apply_due_platform_tier_changes`' contract,
-- deliberately, because it is scheduled the same way and for the same reasons.
--
-- ── IT ENQUEUES; IT NEVER SENDS ────────────────────────────────────────────────────────
-- See §E. There is no network here and there must not be: adding `pg_net` would put an outbound
-- HTTP call inside a database transaction that also deletes a family tree.
CREATE OR REPLACE FUNCTION public.sweep_platform_billing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r          RECORD;
  v_stage    TEXT;
  v_offset   INT;
  v_queued   INT := 0;
  v_dropped  INT := 0;
  v_purged   INT := 0;
  v_counts   jsonb;
  v_tier     TEXT;
BEGIN
  -- ── A. DUNNING NOTICES ──────────────────────────────────────────────────────────────
  -- Every rung whose day has arrived and which this cycle has not already produced. The unique
  -- constraint is what makes the hourly re-run free; `ON CONFLICT DO NOTHING` is how it is
  -- spent rather than tested for.
  FOR r IN
    SELECT b.family_code, b.delinquent_since
      FROM public.platform_billing_accounts b
      JOIN public.families f ON f.family_code = b.family_code
     WHERE b.delinquent_since IS NOT NULL
       AND f.status = 'active'
  LOOP
    FOREACH v_offset IN ARRAY ARRAY[5, 10, 30, 45, 59] LOOP
      CONTINUE WHEN r.delinquent_since + v_offset > CURRENT_DATE;
      -- Day 10 and day 30 are LOCKOUTS rather than emails in the brief — and each is also the
      -- moment the family most needs telling, so both carry a message. §A's table is the copy;
      -- `lib/platform-billing.ts` is where the wording is chosen.
      v_stage := 'day' || v_offset;
      INSERT INTO public.platform_billing_notices
                  (family_code, kind, stage, cycle_on, due_on)
           VALUES (r.family_code, 'dunning', v_stage, r.delinquent_since,
                   r.delinquent_since + v_offset)
      ON CONFLICT (family_code, kind, stage, cycle_on) DO NOTHING;
      IF FOUND THEN v_queued := v_queued + 1; END IF;
    END LOOP;
  END LOOP;

  -- ── B. DAY 60 — DROP TO FREE, THEN DELETE WHAT FREE DOES NOT INCLUDE ────────────────
  -- `FOR UPDATE OF b` for `apply_due_platform_tier_changes`' reason: two sweeps must not both
  -- decide the same family is due, and here the second one would delete nothing but would
  -- write a second audit row claiming it had.
  FOR r IN
    SELECT b.family_code, b.delinquent_since
      FROM public.platform_billing_accounts b
      JOIN public.families f ON f.family_code = b.family_code
     WHERE b.delinquent_since IS NOT NULL
       AND b.delinquent_since + 60 <= CURRENT_DATE
       AND f.status = 'active'
       -- ── THE EMAILS ARE THE GATE (§D) ──────────────────────────────────────────────
       -- Both warnings must have actually been SENT. A mail outage postpones the deletion
       -- indefinitely rather than deleting a family tree nobody was told about — which is the
       -- only direction this may fail in. MUTATION-CHECKED 2026-09-01: removing these two
       -- conjuncts turns §8's third assertion red with `dropped: 1`, which is the whole point
       -- of that assertion existing.
       AND EXISTS (SELECT 1 FROM public.platform_billing_notices n
                    WHERE n.family_code = b.family_code AND n.kind = 'dunning'
                      AND n.stage = 'day45' AND n.cycle_on = b.delinquent_since
                      AND n.state = 'sent')
       AND EXISTS (SELECT 1 FROM public.platform_billing_notices n
                    WHERE n.family_code = b.family_code AND n.kind = 'dunning'
                      AND n.stage = 'day59' AND n.cycle_on = b.delinquent_since
                      AND n.state = 'sent')
       FOR UPDATE OF b
  LOOP
    v_counts := public.delete_family_data_above_tier(r.family_code, 'free', false);

    UPDATE public.families SET tier = 'free' WHERE family_code = r.family_code;

    -- THE LADDER IS OVER, so the lockout lifts and the clock is cleared. They are an ordinary
    -- Free family from this moment — which is the whole point of §B's realignment, and it is
    -- what stops a family that has already paid the price staying locked out of what is left.
    UPDATE public.platform_billing_accounts
       SET delinquent_since = NULL,
           last_payment_failure = NULL,
           paid_tier = NULL, paid_through = NULL, mode = NULL,
           scheduled_tier = NULL, scheduled_tier_on = NULL,
           withheld_since = NULL, withheld_from_tier = NULL
     WHERE family_code = r.family_code;

    INSERT INTO public.platform_data_deletions
                (family_code, reason, tier_kept, deleted)
         VALUES (r.family_code, 'delinquency', 'free', v_counts);

    v_dropped := v_dropped + 1;
  END LOOP;

  -- ── C. RETENTION REMINDERS, COUNTED BACKWARDS FROM DAY 60 ──────────────────────────
  FOR r IN
    SELECT b.family_code, b.withheld_since
      FROM public.platform_billing_accounts b
      JOIN public.families f ON f.family_code = b.family_code
     WHERE b.withheld_since IS NOT NULL
       AND f.status = 'active'
  LOOP
    FOREACH v_offset IN ARRAY ARRAY[30, 15, 5, 1] LOOP
      -- 30 days BEFORE deletion is day 30 of the window, and 1 day before is day 59. Written
      -- as the subtraction rather than as the four resulting numbers, so the window and the
      -- reminders cannot drift apart.
      CONTINUE WHEN r.withheld_since + (60 - v_offset) > CURRENT_DATE;
      v_stage := 'd' || v_offset;
      INSERT INTO public.platform_billing_notices
                  (family_code, kind, stage, cycle_on, due_on)
           VALUES (r.family_code, 'retention', v_stage, r.withheld_since,
                   r.withheld_since + (60 - v_offset))
      ON CONFLICT (family_code, kind, stage, cycle_on) DO NOTHING;
      IF FOUND THEN v_queued := v_queued + 1; END IF;
    END LOOP;
  END LOOP;

  -- ── D. SIXTY DAYS UP — DELETE WHAT THE CURRENT TIER DOES NOT INCLUDE ───────────────
  FOR r IN
    SELECT b.family_code, b.withheld_since, b.withheld_from_tier, f.tier
      FROM public.platform_billing_accounts b
      JOIN public.families f ON f.family_code = b.family_code
     WHERE b.withheld_since IS NOT NULL
       AND b.withheld_since + 60 <= CURRENT_DATE
       AND f.status = 'active'
       -- ALL FOUR, for §D's reason. Four is not belt-and-braces here: the brief specifies four
       -- reminders and they are the safety argument, so three sent and one lost is not the
       -- warning the family was promised.
       AND NOT EXISTS (
         SELECT 1 FROM unnest(ARRAY['d30','d15','d5','d1']) AS want(stage)
          WHERE NOT EXISTS (
            SELECT 1 FROM public.platform_billing_notices n
             WHERE n.family_code = b.family_code AND n.kind = 'retention'
               AND n.stage = want.stage AND n.cycle_on = b.withheld_since
               AND n.state = 'sent'))
       FOR UPDATE OF b
  LOOP
    -- AT THE FAMILY'S CURRENT TIER, not at Free. A family that dropped from Premium to Plus
    -- loses Premium's data and keeps Plus's — deleting to Free here would take two tiers'
    -- worth on one tier's warning.
    v_tier := r.tier;
    v_counts := public.delete_family_data_above_tier(r.family_code, v_tier, false);

    UPDATE public.platform_billing_accounts
       SET withheld_since = NULL, withheld_from_tier = NULL
     WHERE family_code = r.family_code;

    INSERT INTO public.platform_data_deletions
                (family_code, reason, tier_kept, withheld_from_tier, deleted)
         VALUES (r.family_code, 'retention', v_tier, r.withheld_from_tier, v_counts);

    v_purged := v_purged + 1;
  END LOOP;

  RETURN jsonb_build_object('queued', v_queued, 'dropped', v_dropped, 'purged', v_purged);
END $$;

REVOKE ALL ON FUNCTION public.sweep_platform_billing() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.sweep_platform_billing() IS
  'The delinquency ladder and the sixty-day retention window, hourly. ENQUEUES mail and never '
  'sends it (pg_cron has no network here, deliberately); drops a delinquent family to Free on '
  'day 60 and deletes what Free does not include; deletes a withheld tier''s data at sixty days. '
  'BOTH deletions refuse unless the notices they owed are recorded as sent — the emails are the '
  'safety argument for a feature that destroys data, so they gate it.';

-- ── §6. A DOWNGRADE NOW STARTS THE CLOCK ───────────────────────────────────────────────
-- `apply_due_platform_tier_changes` is redefined rather than wrapped: it is documented as THE
-- one writer of `families.tier` from billing, and a second function moving the tier beside it
-- would be exactly the kind of second answer that rule exists to prevent.
--
-- WHAT CHANGED: two lines in each loop, stamping `withheld_since` when the new tier is LOWER
-- than the one the family was on. Everything else is `20260823000004`'s, comments included.
CREATE OR REPLACE FUNCTION public.apply_due_platform_tier_changes()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moved INT := 0;
  r       RECORD;
BEGIN
  -- ── A. Scheduled changes that have come due ─────────────────────────────────────────
  -- `f.tier` is selected as well now, because the clock below has to know what the family is
  -- moving DOWN FROM — and after the write it is too late to ask.
  FOR r IN
    SELECT b.family_code, b.scheduled_tier, f.tier AS from_tier
      FROM public.platform_billing_accounts b
      JOIN public.families f ON f.family_code = b.family_code
     WHERE b.scheduled_tier IS NOT NULL
       AND b.scheduled_tier_on IS NOT NULL
       AND b.scheduled_tier_on <= CURRENT_DATE
       FOR UPDATE OF b
  LOOP
    UPDATE public.families
       SET tier = r.scheduled_tier
     WHERE family_code = r.family_code;

    UPDATE public.platform_billing_accounts
       SET scheduled_tier    = NULL,
           scheduled_tier_on = NULL,
           paid_tier    = CASE WHEN r.scheduled_tier = 'free' THEN NULL ELSE r.scheduled_tier END,
           paid_through = CASE WHEN r.scheduled_tier = 'free' THEN NULL ELSE paid_through END,
           mode         = CASE WHEN r.scheduled_tier = 'free' THEN NULL ELSE mode END,
           -- ── THE SIXTY DAYS BEGIN HERE ──────────────────────────────────────────────
           -- Only on a move DOWN, and only if a window is not already open: a family that
           -- steps Premium → Plus → Standard inside two months must keep the FIRST clock, or
           -- the second downgrade would silently buy them another sixty days for data they
           -- were already told was going. `withheld_from_tier` keeps the highest tier for the
           -- same reason — it is what the returning quote is priced at.
           withheld_since = CASE
             WHEN public.tier_rank(r.scheduled_tier) < public.tier_rank(r.from_tier)
               THEN COALESCE(withheld_since, CURRENT_DATE)
             ELSE withheld_since END,
           withheld_from_tier = CASE
             WHEN public.tier_rank(r.scheduled_tier) < public.tier_rank(r.from_tier)
               THEN COALESCE(withheld_from_tier, r.from_tier)
             ELSE withheld_from_tier END
     WHERE family_code = r.family_code;

    v_moved := v_moved + 1;
  END LOOP;

  -- ── B. Prepaid terms that ran out with nothing renewing them ────────────────────────
  -- Unchanged in intent — see 20260823000004 for why `mode = 'prepaid'` and not merely "no
  -- live subscription". A lapsed prepaid term IS a downgrade to Free, so it starts the clock
  -- exactly as a scheduled one does; leaving it out would delete a prepaid family's data
  -- never, and a monthly family's after sixty days, for the same lapse.
  FOR r IN
    SELECT b.family_code, f.tier AS from_tier
      FROM public.platform_billing_accounts b
      JOIN public.families f ON f.family_code = b.family_code
     WHERE b.mode = 'prepaid'
       AND b.paid_through IS NOT NULL
       AND b.paid_through < CURRENT_DATE
       AND f.tier <> 'free'
       FOR UPDATE OF b
  LOOP
    UPDATE public.families SET tier = 'free' WHERE family_code = r.family_code;
    UPDATE public.platform_billing_accounts
       SET paid_tier = NULL, paid_through = NULL, mode = NULL,
           withheld_since     = COALESCE(withheld_since, CURRENT_DATE),
           withheld_from_tier = COALESCE(withheld_from_tier, r.from_tier)
     WHERE family_code = r.family_code;
    v_moved := v_moved + 1;
  END LOOP;

  RETURN v_moved;
END $$;

-- The rank, so the CASE above is readable and the order lives in one place rather than in a
-- CASE expression inside another CASE expression. IMMUTABLE, so the planner can fold it.
CREATE OR REPLACE FUNCTION public.tier_rank(p_tier TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_tier WHEN 'free' THEN 0 WHEN 'standard' THEN 1
                     WHEN 'plus' THEN 2 WHEN 'premium' THEN 3 ELSE 0 END
$$;

REVOKE ALL ON FUNCTION public.tier_rank(TEXT) FROM PUBLIC, anon, authenticated;

-- ── §7. THE CLOCK ──────────────────────────────────────────────────────────────────────
-- HOURLY at twenty past, for `platform-tier-sweep`'s stated reasons: the dates are UTC so a
-- single daily run would be exact, and hourly is chosen anyway because it is idempotent, costs
-- nothing against two partial indexes, and a missed run then delays a family's ladder by an
-- hour rather than a day. Twenty past rather than five, so it is not sharing a minute with the
-- tier sweep it depends on — that one must have moved a tier before this one measures it.
--
-- A CRON JOB IS DATABASE STATE, which `db:check` and `db:audit` are both blind to and a fresh
-- `db reset` schedules nothing. It is created HERE and asserted below, never in the dashboard.
SELECT cron.schedule(
  'platform-billing-ladder',
  '20 * * * *',
  $job$SELECT public.sweep_platform_billing()$job$
);

-- ── §8. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_code    TEXT := 'LADDERPB';
  v_person  UUID;
  v_n       INT;
  v_res     jsonb;
  v_tier    TEXT;
BEGIN
  -- 1. The job exists, once. `cron.schedule` upserts on the name, so a replay replaces.
  SELECT count(*) INTO v_n FROM cron.job WHERE jobname = 'platform-billing-ladder';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: expected exactly one platform-billing-ladder job, found %', v_n;
  END IF;

  -- 2. NO POLICY CONSULTS THE LADDER (§C). A conjunct anywhere here would make a family's
  --    access depend on a billing fact, which is the rule families.tier and families.status
  --    both keep and the one this feature is most likely to break.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual,'') || COALESCE(with_check,'')) ~ '(delinquent_since|withheld_since)';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % policies reference the delinquency or retention clock', v_n;
  END IF;

  -- ── EXERCISED FOR REAL ────────────────────────────────────────────────────────────
  INSERT INTO public.families (family_code, family_name, tier)
       VALUES (v_code, 'Ladder probe', 'plus');
  INSERT INTO public.people (family_code, first_name, last_name, primary_email)
       VALUES (v_code, 'Ladder', 'Probe', 'ladder-probe@genorra.com')
    RETURNING id INTO v_person;
  INSERT INTO public.platform_billing_accounts (family_code, delinquent_since)
       VALUES (v_code, CURRENT_DATE - 61);
  -- Something for the purge to take, and something it must leave.
  INSERT INTO public.person_relationships
              (family_code, person_id, related_person_id, relationship_type_id)
       SELECT v_code, v_person, v_person, rt.id
         FROM public.relationship_types rt LIMIT 1;

  -- 3. THE FIRST SWEEP ENQUEUES AND DELETES NOTHING. This is the assertion that matters most
  --    in the whole file: a family sixty-one days delinquent whose warnings have not been SENT
  --    keeps everything. A mail outage must postpone a deletion, never permit one.
  v_res := public.sweep_platform_billing();
  IF (v_res ->> 'dropped')::int <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: a family was dropped before its warnings were sent: %', v_res;
  END IF;
  SELECT f.tier INTO v_tier FROM public.families f WHERE f.family_code = v_code;
  IF v_tier <> 'plus' THEN
    RAISE EXCEPTION 'ROLLBACK: the tier moved before the warnings were sent (now %)', v_tier;
  END IF;
  SELECT count(*) INTO v_n FROM public.platform_billing_notices
   WHERE family_code = v_code AND kind = 'dunning';
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'ROLLBACK: expected five dunning notices at day 61, found %', v_n;
  END IF;

  -- 4. AND THE SECOND SWEEP ENQUEUES NOTHING. The unique key is what makes an hourly job free.
  v_res := public.sweep_platform_billing();
  IF (v_res ->> 'queued')::int <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: the sweep re-queued inside one cycle: %', v_res;
  END IF;

  -- 5. WITH THE WARNINGS SENT, DAY 60 LANDS.
  UPDATE public.platform_billing_notices SET state = 'sent', sent_at = NOW()
   WHERE family_code = v_code AND kind = 'dunning' AND stage IN ('day45','day59');
  v_res := public.sweep_platform_billing();
  IF (v_res ->> 'dropped')::int <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: day 60 did not drop the family: %', v_res;
  END IF;
  SELECT f.tier INTO v_tier FROM public.families f WHERE f.family_code = v_code;
  IF v_tier <> 'free' THEN
    RAISE EXCEPTION 'ROLLBACK: day 60 left the family on %', v_tier;
  END IF;
  IF EXISTS (SELECT 1 FROM public.person_relationships WHERE family_code = v_code) THEN
    RAISE EXCEPTION 'ROLLBACK: day 60 left the family tree standing';
  END IF;
  -- 6. THE PERSON SURVIVES, AND THE LOCKOUT LIFTS. §B: they are an ordinary Free family now.
  IF NOT EXISTS (SELECT 1 FROM public.people WHERE id = v_person) THEN
    RAISE EXCEPTION 'ROLLBACK: day 60 deleted a relative';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_billing_accounts
              WHERE family_code = v_code AND delinquent_since IS NOT NULL) THEN
    RAISE EXCEPTION 'ROLLBACK: the family is still locked out after being dropped';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_data_deletions
                  WHERE family_code = v_code AND reason = 'delinquency') THEN
    RAISE EXCEPTION 'ROLLBACK: nothing recorded what was deleted';
  END IF;

  -- 7. A SECOND SWEEP DOES NOT DROP THEM AGAIN. `delinquent_since` is cleared, so there is
  --    nothing to find — and an audit row claiming a second deletion would be a lie.
  v_res := public.sweep_platform_billing();
  IF (v_res ->> 'dropped')::int <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: the family was dropped twice: %', v_res;
  END IF;

  -- 8. A DOWNGRADE STARTS THE RETENTION CLOCK.
  UPDATE public.families SET tier = 'plus' WHERE family_code = v_code;
  -- `paid_through` as well as `paid_tier`, or `platform_billing_term_pair` refuses the row the
  -- apply writes — `(paid_tier IS NULL) = (paid_through IS NULL)`, from 20260823000004. Found
  -- by this block rather than by reading it, which is what a verify block that EXERCISES the
  -- function is for.
  UPDATE public.platform_billing_accounts
     SET scheduled_tier = 'standard', scheduled_tier_on = CURRENT_DATE,
         paid_tier = 'plus', paid_through = CURRENT_DATE + 30, mode = 'recurring',
         withheld_since = NULL, withheld_from_tier = NULL
   WHERE family_code = v_code;
  PERFORM public.apply_due_platform_tier_changes();
  SELECT withheld_from_tier INTO v_tier FROM public.platform_billing_accounts
   WHERE family_code = v_code;
  IF v_tier <> 'plus' THEN
    RAISE EXCEPTION 'ROLLBACK: the downgrade did not record what was withheld (%)', v_tier;
  END IF;

  -- 9. AN UPGRADE DOES NOT. The clock is for data going away, and moving UP takes nothing.
  UPDATE public.platform_billing_accounts
     SET withheld_since = NULL, withheld_from_tier = NULL,
         scheduled_tier = 'premium', scheduled_tier_on = CURRENT_DATE,
         paid_tier = 'standard', paid_through = CURRENT_DATE + 30, mode = 'recurring'
   WHERE family_code = v_code;
  PERFORM public.apply_due_platform_tier_changes();
  IF EXISTS (SELECT 1 FROM public.platform_billing_accounts
              WHERE family_code = v_code AND withheld_since IS NOT NULL) THEN
    RAISE EXCEPTION 'ROLLBACK: an UPGRADE started the retention clock';
  END IF;

  DELETE FROM public.platform_billing_notices WHERE family_code = v_code;
  DELETE FROM public.platform_data_deletions WHERE family_code = v_code;
  DELETE FROM public.platform_billing_accounts WHERE family_code = v_code;
  DELETE FROM public.people WHERE family_code = v_code;
  DELETE FROM public.families WHERE family_code = v_code;

  RAISE NOTICE 'billing ladder: the hourly job, the five dunning rungs, the day-60 drop to '
               'free, the emails-gate-the-deletion rule and the retention clock all verified';
END $mig$;

COMMIT;
