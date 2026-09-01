-- ═══════════════════════════════════════════════════════════════════════════════════════
-- A PURGE DELETES ROWS. THIS IS WHAT FINALLY STOPS THE CHARGES
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 2026-09-01, and it is `20260901000006` one layer over. That migration's opening sentence was
-- *"a purge deletes rows and structurally cannot touch storage"*; this one is the same sentence
-- about money:
--
--   **A STRIPE SUBSCRIPTION IS NOT A ROW IN THIS DATABASE.** `delete_family_data_above_tier`
--   deletes `dues_autopay` at `standard`, so a family dropped to Free on day 60 lost the only
--   record it had of every relative's standing card arrangement — **and every one of those
--   arrangements went on charging a card, monthly, indefinitely, with nothing left in the
--   product able to say what the charge was for.**
--
-- `tier_data_tables` SAID SO on that table's own row — *"these exist at STRIPE too, and this
-- deletes only our record — cancelling them is the disconnect path's job, not this one"* —
-- which was a true statement of scope when it was written and became the whole of what
-- remained. TODO.md carried it.
--
-- ── IT IS WORSE THAN THE BYTES, WHICH IS WHY IT IS ITS OWN MIGRATION ───────────────────
-- An orphaned photograph is fetchable by somebody who already has a URL. An orphaned
-- subscription TAKES A RELATIVE'S MONEY every month and cannot be refunded (AGENTS.md's rule 2
-- about plans). And nobody discovers it from inside the product, because the screen that would
-- have shown it is the one the purge took away.
--
-- ── THE ORDER PROBLEM, AND WHY A REAPER CANNOT WORK THE WAY THE BYTES' ONE DOES ────────
-- `reapPurgedStorage` runs AFTER the purge and works out what to delete by listing the bucket
-- and subtracting the surviving rows. **There is no equivalent here.** Once `dues_autopay` is
-- deleted there is nothing in this database that names the subscriptions, and no way to ask
-- Stripe "which of this account's subscriptions belonged to a family you have never heard of".
--
-- So the ids have to be captured BEFORE the delete, by the only thing that is present at that
-- moment: **the purge itself.** §3 enqueues, and Node drains — which is the same split
-- `family_action_challenges` makes for a different reason (the plaintext must exist in the Node
-- process) and the same one `platform_billing_notices` makes for this one (`pg_cron` has no
-- network, and an outbound HTTP call inside a transaction that deletes a family tree is not a
-- thing to add casually).
--
-- ── §1 IS DERIVED, IN BOTH DIRECTIONS, WHICH IS WHAT MAKES A HAND-WRITTEN MAP SURVIVABLE ──
-- `tier_data_tables` gains `stripe_subscription_kind` exactly as `20260901000006` gave it
-- `storage_bucket`, and §6 fails the deploy if a purgeable table has a `stripe_subscription_id`
-- column and no kind named, or names a kind and lacks the columns the enqueue reads. A table
-- that starts holding subscriptions next year cannot be silently un-reaped.
--
-- ── WHAT THIS DELIBERATELY DOES NOT REACH ─────────────────────────────────────────────
-- **The family's GENORRA plan.** `platform_billing_accounts` is on `tier_data_keep` — the purge
-- never deletes it, deliberately, because it is the clock that scheduled the purge — so a
-- family being dropped to Free is not a family leaving, and cancelling their plan here would be
-- this migration deciding they had. A family that IS ending is `staff/destroy.ts`, which calls
-- `cancelEveryFamilySubscription` in Node and stops both directions itself.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. WHICH PURGED TABLES HOLD SUBSCRIPTIONS ─────────────────────────────────────────
ALTER TABLE public.tier_data_tables
  ADD COLUMN IF NOT EXISTS stripe_subscription_kind TEXT
    CHECK (stripe_subscription_kind IN ('dues'));

COMMENT ON COLUMN public.tier_data_tables.stripe_subscription_kind IS
  'What kind of live Stripe subscription this table''s rows point at, or NULL for a table with '
  'none. Read by delete_family_data_above_tier(), which enqueues those subscriptions for '
  'cancellation BEFORE deleting the rows that name them. §6 of 20260901000008 asserts this '
  'agrees with which purgeable tables actually carry a stripe_subscription_id, in BOTH '
  'directions.';

-- 'dues' is the only value the CHECK admits and the only one that exists: a relative paying
-- their family, on the family's own connected account. A platform subscription would be the
-- second, and there will never be one here — `platform_billing_accounts` is kept by the purge.
UPDATE public.tier_data_tables
   SET stripe_subscription_kind = 'dues'
 WHERE table_name = 'dues_autopay';

-- ── §2. THE QUEUE ──────────────────────────────────────────────────────────────────────
-- `distribution_recipients`' shape, and its reason stated one more time: **this product has
-- nowhere to run background work.** `sendEmail` takes one recipient per call and
-- `stripe.subscriptions.cancel` takes one subscription; a family with a hundred and forty
-- relatives enrolled is a hundred and forty provider calls at a rate limit, which does not fit
-- a request and cannot be attempted from `pg_cron` at all. So the table IS the worker.
CREATE TABLE IF NOT EXISTS public.platform_subscription_cancellations (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- IT CARRIES A `family_code`, so `staff_delete_family`'s derived sweep takes it and
  -- `reset_families.sql` §11 demands a verdict on it. Both are correct: a family that has been
  -- permanently deleted had its subscriptions cancelled in Node by the action that deleted it
  -- (`staff/destroy.ts`), so a queue row for it is spent work rather than owed work.
  family_code            TEXT        NOT NULL,

  -- The account the subscription lives on, captured from the row rather than resolved later.
  -- `family_stripe_accounts` may be gone or disconnected by the time this is drained, and a
  -- subscription addressed on the wrong account is a 404 that reads as "already cancelled".
  stripe_account_id      TEXT        NOT NULL,

  -- UNIQUE, which is what makes the enqueue idempotent across replays. `dues_autopay
  -- .stripe_subscription_id` is already globally unique, so this cannot collide across
  -- families — and a purge that somehow ran twice enqueues once.
  stripe_subscription_id TEXT        NOT NULL UNIQUE,

  -- Mirrors `tier_data_tables.stripe_subscription_kind`; carried so the drain knows whether to
  -- set `Stripe-Account` at all. Today every row is 'dues' and every row needs it.
  kind                   TEXT        NOT NULL CHECK (kind IN ('dues')),

  -- WHY it is owed. 'purge' is the only writer today; a second one is a second sentence
  -- somebody reading this table a year later needs.
  source                 TEXT        NOT NULL DEFAULT 'purge' CHECK (source IN ('purge')),

  -- ── FOUR STATES, AND THE LAST TWO ARE THE POINT ─────────────────────────────────
  -- `distribution_recipients`' argument: `pending | done | failed` is not sufficient, because
  -- each of the others is a fact that would otherwise be filed as one of those three and be
  -- wrong.
  --
  --   `cancelled`  we stopped it. The outcome.
  --   `gone`       Stripe no longer has it, or already had it as cancelled. ALSO the outcome
  --                we wanted, and filed apart from `cancelled` because "we stopped 40 charges"
  --                and "38 were already stopped" are different sentences.
  --   `failed`     five attempts spent. It needs a person, and filing it as `gone` would be
  --                the false reassurance this whole migration exists to remove.
  state                  TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (state IN ('pending','cancelled','gone','failed')),

  -- Five, matching `finish_platform_billing_notice`. A transient Stripe failure recovers inside
  -- five days; a permanent one stops retrying and says so rather than being retried forever.
  attempts               INT         NOT NULL DEFAULT 0,

  -- Recoverable after fifteen minutes, exactly as a notice's claim and a reap's are. Without it
  -- a drain killed mid-flight leaves the row claimed forever and the charge is stranded by the
  -- mechanism that exists to stop it.
  claimed_at             TIMESTAMPTZ,

  note                   TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS platform_subscription_cancellations_due_idx
  ON public.platform_subscription_cancellations (created_at)
  WHERE state = 'pending';

CREATE INDEX IF NOT EXISTS platform_subscription_cancellations_family_idx
  ON public.platform_subscription_cancellations (family_code);

COMMENT ON TABLE public.platform_subscription_cancellations IS
  'Stripe subscriptions a tier purge deleted our record of, waiting to be cancelled at Stripe. '
  'Written by delete_family_data_above_tier() BEFORE it deletes the rows that name them — '
  'afterwards nothing in this database could identify them — and drained by '
  'lib/billing/subscription-reaper.ts on the daily notice route, because pg_cron has no '
  'network. RLS on with zero policies: no browser role reads or writes it.';

-- §2c: a new table in `public` is born readable AND WRITABLE by both browser roles, and RLS
-- with zero policies is the whole gate. It matters more than usual here: a row in this table is
-- an instruction to cancel a subscription, so an `authenticated` INSERT would be a way to stop
-- another family's members paying their dues.
ALTER TABLE public.platform_subscription_cancellations ENABLE ROW LEVEL SECURITY;

-- It carries a `family_code`, so `20260901000001`'s completeness assertion demands a verdict.
INSERT INTO public.tier_data_keep (table_name, note)
VALUES ('platform_subscription_cancellations',
        'Work a purge left owing. A purge that deleted its own cancellation queue would leave '
        'the charges running forever — it would erase the instruction created by the very '
        'deletion that made it necessary.')
ON CONFLICT (table_name) DO UPDATE SET note = EXCLUDED.note;

-- ── §3. THE PURGE ENQUEUES BEFORE IT DELETES ───────────────────────────────────────────
-- ══════════════════════════════════════════════════════════════════════════════════════
-- REDEFINING AN EXISTING FUNCTION MEANS COPYING IT, NOT DESCRIBING IT. AGENTS.md records what
-- happened the last time somebody retyped one from a reading: `20260901000003`'s first draft
-- silently changed two refusal messages and a success branch of
-- `consume_family_action_challenge`, neither of which would have failed a migration.
--
-- So the body below is `20260901000001` §4's, VERBATIM, with exactly one block added — the
-- `FOR v_sub_tbl` loop — and nothing else altered. Diff it against that file before changing
-- anything here.
-- ══════════════════════════════════════════════════════════════════════════════════════
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
  -- ADDED 2026-09-01 for the enqueue below. Nothing above this line changed.
  v_sub_tbl  TEXT;
  v_sub_kind TEXT;
  v_sub_where TEXT;
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

  -- ── THE ONE ADDED BLOCK: CAPTURE THE SUBSCRIPTIONS BEFORE THEY BECOME UNFINDABLE ──
  -- 20260901000008. It runs BEFORE the delete loop, and that is the whole of the design: after
  -- those rows are gone nothing in this database names the subscriptions and no query to Stripe
  -- can recover which family they belonged to.
  --
  -- NOT ON A DRY RUN. `p_dry_run` promises to count and change nothing, and the screen that
  -- warns a family calls it — enqueuing there would cancel a family's dues for showing them a
  -- confirmation dialog.
  --
  -- `cancelled_at IS NULL` — only LIVE arrangements. A row already cancelled at Stripe is a
  -- record of what was agreed (that is why the unique index on `dues_autopay` is partial), and
  -- re-cancelling it would spend an attempt on a subscription that is already stopped. It is
  -- also what lets a Node caller cancel first and leave this loop nothing to do:
  -- `startFresh` does exactly that, and the two compose rather than duplicating.
  IF NOT p_dry_run THEN
    FOR v_sub_tbl, v_sub_kind, v_sub_where IN
      SELECT m.table_name, m.stripe_subscription_kind, COALESCE(m.where_extra, 'true')
        FROM public.tier_data_tables m
        JOIN pg_class c     ON c.relname = m.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
       WHERE m.stripe_subscription_kind IS NOT NULL
         AND CASE m.min_tier WHEN 'standard' THEN 1 WHEN 'plus' THEN 2 ELSE 3 END > v_rank
       ORDER BY m.table_name
    LOOP
      -- `%s` for `v_sub_where` and `$1`/`$2` for the values, exactly as the delete loop below
      -- does it and safe for the same stated reason: `where_extra` is a SQL FRAGMENT on a table
      -- with no policy and no grant, so the only writer is a migration and there is no path
      -- from any caller to put a string in it. If that ever stops being true, so does this.
      EXECUTE format(
        'INSERT INTO public.platform_subscription_cancellations '
        '  (family_code, stripe_account_id, stripe_subscription_id, kind) '
        'SELECT t.family_code, t.stripe_account_id, t.stripe_subscription_id, $2 '
        '  FROM public.%I t '
        ' WHERE t.family_code = $1 AND t.cancelled_at IS NULL AND (%s) '
        'ON CONFLICT (stripe_subscription_id) DO NOTHING',
        v_sub_tbl, v_sub_where)
        USING v_code, v_sub_kind;
    END LOOP;
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
  'deleted photo row leaves its bytes in the bucket — see 20260901000001 §E and the reaper in '
  '20260901000006. Cannot reach Stripe either, so since 20260901000008 it ENQUEUES every live '
  'subscription it is about to delete our record of, into '
  'platform_subscription_cancellations, and Node cancels them.';

-- ── §4. CLAIMING AND FINISHING, IN ONE STATEMENT EACH ──────────────────────────────────
-- `claim_platform_billing_notices`' shape and its reason: a read-then-write from Node lets two
-- concurrent drains both decide they are first. Here that would mean two `cancel` calls for one
-- subscription — harmless at Stripe, which reports the second as already gone, and still worth
-- one statement because the house pattern is one statement and a second shape is a second thing
-- to reason about.
CREATE OR REPLACE FUNCTION public.claim_subscription_cancellations(p_limit INT DEFAULT 25)
RETURNS TABLE (
  id UUID, family_code TEXT, stripe_account_id TEXT, stripe_subscription_id TEXT,
  kind TEXT, attempts INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT c.id
      FROM public.platform_subscription_cancellations c
     WHERE c.state = 'pending'
       AND (c.claimed_at IS NULL OR c.claimed_at < NOW() - INTERVAL '15 minutes')
     ORDER BY c.created_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.platform_subscription_cancellations c
       SET claimed_at = NOW(), attempts = c.attempts + 1
      FROM due
     WHERE c.id = due.id
    RETURNING c.id, c.family_code, c.stripe_account_id, c.stripe_subscription_id,
              c.kind, c.attempts
  )
  SELECT claimed.id, claimed.family_code, claimed.stripe_account_id,
         claimed.stripe_subscription_id, claimed.kind, claimed.attempts
    FROM claimed;
END $$;

-- GRANTED TO NOBODY (§2b). The drain runs on the service role, which keeps EXECUTE by default.
REVOKE ALL ON FUNCTION public.claim_subscription_cancellations(INT)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.claim_subscription_cancellations(INT) IS
  'Claim a batch of subscriptions a tier purge left running, in one statement under FOR UPDATE '
  'SKIP LOCKED. The claim is recoverable after 15 minutes, for claim_stripe_event''s reason: a '
  'drain that dies mid-flight must not strand the charge forever. Granted to nobody.';

CREATE OR REPLACE FUNCTION public.finish_subscription_cancellation(
  p_id    UUID,
  p_state TEXT,
  p_note  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max CONSTANT INT := 5;
BEGIN
  IF p_state NOT IN ('cancelled','gone','failed') THEN
    RAISE EXCEPTION 'finish_subscription_cancellation: % is not an outcome', p_state
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── A FAILURE GOES BACK TO `pending` UNTIL THE ATTEMPTS ARE SPENT ──────────────
  -- `finish_platform_billing_notice`'s shape, and the direction is the safe one: a transient
  -- Stripe failure is retried tomorrow, and a permanent one stops and stays visible as
  -- `failed` rather than being retried until somebody notices the noise. Five attempts over
  -- five days, because the drain runs daily.
  UPDATE public.platform_subscription_cancellations c
     SET state = CASE
                   WHEN p_state <> 'failed' THEN p_state
                   WHEN c.attempts >= v_max THEN 'failed'
                   ELSE 'pending'
                 END,
         note  = p_note,
         claimed_at = NULL,
         resolved_at = CASE WHEN p_state <> 'failed' OR c.attempts >= v_max
                            THEN NOW() ELSE NULL END
   WHERE c.id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.finish_subscription_cancellation(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.finish_subscription_cancellation(UUID, TEXT, TEXT) IS
  'Record what happened to one queued cancellation. `gone` is kept apart from `cancelled` '
  'because "we stopped it" and "Stripe had already stopped it" are different facts; `failed` '
  'returns the row to pending until five attempts are spent, then stops. Granted to nobody.';

-- ── §5. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_code    TEXT := 'SUBREAPQ';
  v_person  UUID;
  v_sched   UUID;
  v_n       INT;
  v_state   TEXT;
  v_bad     TEXT;
  v_res     jsonb;
BEGIN
  -- ── 1. THE MAP AGREES WITH THE SCHEMA, IN BOTH DIRECTIONS ─────────────────────────
  -- `20260901000006` §6's assertion about `storage_bucket`, and the same argument: this is what
  -- makes a hand-written map survivable. A purgeable table that starts holding subscriptions
  -- and is not named here would be silently un-reaped, which is the defect this whole migration
  -- is fixing arriving a second time.
  SELECT string_agg(m.table_name, ', ') INTO v_bad
    FROM public.tier_data_tables m
   WHERE m.stripe_subscription_kind IS NULL
     AND EXISTS (
           SELECT 1 FROM pg_attribute a
             JOIN pg_class c ON c.oid = a.attrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
            WHERE c.relname = m.table_name AND a.attname = 'stripe_subscription_id'
              AND a.attnum > 0 AND NOT a.attisdropped
         );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: purgeable table(s) hold Stripe subscriptions and name no kind: %',
      v_bad;
  END IF;

  -- The other direction, and it asserts every column the enqueue actually READS rather than
  -- only the one that names it. A kind on a table with no `cancelled_at` would make that loop
  -- fail at CALL time — plpgsql does not resolve a name in dynamic SQL until it runs, which is
  -- the trap AGENTS.md records about `public.gen_random_bytes`.
  SELECT string_agg(m.table_name || ' (' || col || ')', ', ') INTO v_bad
    FROM public.tier_data_tables m
    CROSS JOIN unnest(ARRAY['family_code','stripe_account_id','stripe_subscription_id',
                            'cancelled_at']) AS col
   WHERE m.stripe_subscription_kind IS NOT NULL
     AND NOT EXISTS (
           SELECT 1 FROM pg_attribute a
             JOIN pg_class c ON c.oid = a.attrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
            WHERE c.relname = m.table_name AND a.attname = col
              AND a.attnum > 0 AND NOT a.attisdropped
         );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: the enqueue reads column(s) that do not exist: %', v_bad;
  END IF;

  -- Exactly one table today, and it is `dues_autopay`. Asserted so that a map edit which
  -- accidentally cleared it is caught here rather than by a family being charged.
  SELECT count(*) INTO v_n FROM public.tier_data_tables
   WHERE stripe_subscription_kind IS NOT NULL;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: expected exactly one subscription-bearing purgeable table, found %', v_n;
  END IF;

  -- ── 2. NO BROWSER ROLE MAY QUEUE A CANCELLATION ───────────────────────────────────
  -- §2c: the table's grant cannot narrow anything, so RLS with zero policies is the gate. A row
  -- here is an INSTRUCTION to stop a subscription, so an `authenticated` INSERT would be a way
  -- to stop another family's dues.
  IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'platform_subscription_cancellations'
           AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'ROLLBACK: platform_subscription_cancellations has RLS disabled';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'platform_subscription_cancellations';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: platform_subscription_cancellations has % policies; it must have none', v_n;
  END IF;

  -- The two functions, granted to nobody (§2b rule 1).
  IF has_function_privilege('authenticated', 'public.claim_subscription_cancellations(int)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_subscription_cancellations(int)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finish_subscription_cancellation(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.finish_subscription_cancellation(uuid,text,text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'ROLLBACK: a browser role can claim or finish a cancellation';
  END IF;

  -- ── 3. NO POLICY CONSULTS THE QUEUE ───────────────────────────────────────────────
  -- The rule `families.tier`, `families.status` and the delinquency clock all keep: this
  -- withholds nothing and grants nothing, and a policy reading it would make a family's access
  -- depend on a Stripe housekeeping fact.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual,'') || COALESCE(with_check,'')) ~ 'platform_subscription_cancellations';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % policies reference the cancellation queue', v_n;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════════════
  -- ── 4. EXERCISED FOR REAL, AGAINST A THROWAWAY FAMILY ─────────────────────────────
  -- `20260901000002` §8's shape. A structural assertion cannot tell whether the enqueue
  -- actually runs: the block is dynamic SQL inside a loop over a map, and plpgsql resolves
  -- neither until it executes.
  -- ══════════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.families (family_code, family_name, tier)
       VALUES (v_code, 'Subscription reaper probe', 'plus');
  INSERT INTO public.people (family_code, first_name, last_name, primary_email)
       VALUES (v_code, 'Reaper', 'Probe', 'subreap-probe@genorra.com')
    RETURNING id INTO v_person;
  -- The guard trigger on `dues_autopay` asserts the account belongs to this family, so the
  -- account row is part of the fixture rather than optional.
  INSERT INTO public.family_stripe_accounts (family_code, stripe_account_id, connected_by)
       VALUES (v_code, 'acct_subreapprobe', v_person);
  INSERT INTO public.dues_schedules (family_code, label)
       VALUES (v_code, 'Reaper probe dues')
    RETURNING id INTO v_sched;
  INSERT INTO public.dues_autopay
              (family_code, person_id, schedule_id, stripe_account_id,
               stripe_subscription_id, amount_cents)
       VALUES (v_code, v_person, v_sched, 'acct_subreapprobe', 'sub_subreapprobe', 5000);
  -- A row already cancelled at Stripe, which must NOT be enqueued: it is a record of what was
  -- agreed, and re-cancelling it would spend an attempt on something already stopped.
  INSERT INTO public.dues_autopay
              (family_code, person_id, schedule_id, stripe_account_id,
               stripe_subscription_id, amount_cents, cancelled_at)
       VALUES (v_code, v_person, v_sched, 'acct_subreapprobe', 'sub_subreapalready', 5000, NOW());

  -- 4a. A DRY RUN ENQUEUES NOTHING. It promises to count and change nothing, and the screen
  --     that warns a family calls it — so an enqueue here would cancel a relative's dues for
  --     showing somebody a confirmation dialog. Mutation check: drop the `IF NOT p_dry_run`
  --     around the added loop and this assertion goes red.
  v_res := public.delete_family_data_above_tier(v_code, 'free', true);
  SELECT count(*) INTO v_n FROM public.platform_subscription_cancellations
   WHERE family_code = v_code;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: a dry run queued % cancellation(s)', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dues_autopay
                  WHERE family_code = v_code
                    AND stripe_subscription_id = 'sub_subreapprobe'
                    AND cancelled_at IS NULL) THEN
    RAISE EXCEPTION 'ROLLBACK: a dry run changed dues_autopay';
  END IF;

  -- 4b. THE REAL PURGE ENQUEUES THE LIVE ONE AND DELETES THE ROWS. This is the assertion the
  --     migration exists for: `dues_autopay` is gone and the subscription is still named.
  v_res := public.delete_family_data_above_tier(v_code, 'free', false);
  IF EXISTS (SELECT 1 FROM public.dues_autopay WHERE family_code = v_code) THEN
    RAISE EXCEPTION 'ROLLBACK: the purge left dues_autopay standing';
  END IF;
  SELECT count(*) INTO v_n FROM public.platform_subscription_cancellations
   WHERE family_code = v_code;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: expected one queued cancellation after the purge, found %', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_subscription_cancellations
                  WHERE family_code = v_code
                    AND stripe_subscription_id = 'sub_subreapprobe'
                    AND stripe_account_id = 'acct_subreapprobe'
                    AND kind = 'dues' AND state = 'pending') THEN
    RAISE EXCEPTION 'ROLLBACK: the queued row does not name the live subscription and account';
  END IF;
  -- And the already-cancelled one was left alone.
  IF EXISTS (SELECT 1 FROM public.platform_subscription_cancellations
              WHERE stripe_subscription_id = 'sub_subreapalready') THEN
    RAISE EXCEPTION 'ROLLBACK: a subscription already cancelled at Stripe was queued again';
  END IF;

  -- 4c. THE CLAIM IS ONE-SHOT AND COUNTS THE ATTEMPT.
  SELECT count(*) INTO v_n FROM public.claim_subscription_cancellations(25);
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: the first claim took % row(s)', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.claim_subscription_cancellations(25);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: a claimed row was claimed again immediately (% rows)', v_n;
  END IF;

  -- 4d. A FAILURE RETRIES; THE FIFTH GIVES UP. The direction that matters: a transient Stripe
  --     failure must not become a permanent `failed`, and a permanent one must not be retried
  --     forever.
  PERFORM public.finish_subscription_cancellation(
    (SELECT id FROM public.platform_subscription_cancellations WHERE family_code = v_code),
    'failed', 'probe');
  SELECT state INTO v_state FROM public.platform_subscription_cancellations
   WHERE family_code = v_code;
  IF v_state <> 'pending' THEN
    RAISE EXCEPTION 'ROLLBACK: attempt 1 of 5 left the row %, not pending', v_state;
  END IF;
  UPDATE public.platform_subscription_cancellations SET attempts = 5 WHERE family_code = v_code;
  PERFORM public.finish_subscription_cancellation(
    (SELECT id FROM public.platform_subscription_cancellations WHERE family_code = v_code),
    'failed', 'probe');
  SELECT state INTO v_state FROM public.platform_subscription_cancellations
   WHERE family_code = v_code;
  IF v_state <> 'failed' THEN
    RAISE EXCEPTION 'ROLLBACK: the fifth attempt left the row %, not failed', v_state;
  END IF;

  -- 4e. AND `gone` IS AN OUTCOME, NOT A FAILURE.
  UPDATE public.platform_subscription_cancellations SET state = 'pending', attempts = 0
   WHERE family_code = v_code;
  PERFORM public.finish_subscription_cancellation(
    (SELECT id FROM public.platform_subscription_cancellations WHERE family_code = v_code),
    'gone', 'Stripe no longer has it');
  SELECT state INTO v_state FROM public.platform_subscription_cancellations
   WHERE family_code = v_code;
  IF v_state <> 'gone' THEN
    RAISE EXCEPTION 'ROLLBACK: a gone subscription was filed as %', v_state;
  END IF;

  -- THE FIXTURE GOES. A probe family left behind is a family in every count the console
  -- reports, and `20260901000002` §8 cleans up for the same reason.
  DELETE FROM public.platform_subscription_cancellations WHERE family_code = v_code;
  DELETE FROM public.dues_schedules WHERE family_code = v_code;
  DELETE FROM public.family_stripe_accounts WHERE family_code = v_code;
  DELETE FROM public.people WHERE family_code = v_code;
  DELETE FROM public.platform_data_deletions WHERE family_code = v_code;
  DELETE FROM public.families WHERE family_code = v_code;

  RAISE NOTICE '20260901000008: the purge enqueues its subscriptions, and the queue drains once.';
END $mig$;

COMMIT;
