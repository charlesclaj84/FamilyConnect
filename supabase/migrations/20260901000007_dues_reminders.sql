-- ═══════════════════════════════════════════════════════════════════════════════════════
-- AUTOMATIC DUES REMINDERS: the queue, and the key that stops one being sent twice
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 2026-09-01. `premium/dues-reminders` is the last unbuilt Premium bullet, and FutureFeature.md
-- §1 records that BOTH its halves were already done elsewhere:
--
--   WHAT TO REMIND WHOM ABOUT   `duesPlanMath` in `lib/dues-utils.ts` computes the next
--                               installment, arrears included, as a pure function taking
--                               `today` as a parameter and unit-tested under `npm test`.
--   HOW TO SEND IT              `app/actions/distributions.ts` is a working resumable
--                               per-recipient fan-out with per-address delivery reporting.
--
-- *"So what is left is genuinely just the scheduler, plus one decision that feature will not
-- answer for you: a reminder must not re-send. That is a uniqueness key on (person, schedule,
-- period) and it belongs in the schema, not in the job."* This is that key.
--
-- ── THE PERIOD IS THE INSTALLMENT'S DUE DATE, NOT THE ANNUAL PERIOD ────────────────────
-- FutureFeature.md says "(person, schedule, period)" and the annual period is the wrong
-- reading: a member paying monthly has twelve installments inside one, so keying on the year
-- would send ONE reminder in January and nothing again until the following year. `due_on` is
-- the discriminator — `platform_billing_notices.cycle_on`'s role exactly, and for the same
-- reason: it is what makes the enqueue idempotent across time, so re-running today changes
-- nothing and next month's installment is a fresh row.
--
-- ── THE ARITHMETIC STAYS IN TYPESCRIPT, AND THAT IS THE LOAD-BEARING DECISION ──────────
-- The obvious shape is a `pg_cron` job that enqueues, matching the billing ladder. It is
-- wrong here. The ladder's sweep asks a question SQL can answer — has this date passed — while
-- a reminder needs `duesPlanMath`: the cadence ladder, the month-end clamp `setUTCMonth`
-- overflows on, arrears against settled cents, waivers, the age rule, the bloodline and the
-- scope. Writing that in plpgsql would be a SECOND implementation of the rule beside a tested
-- one, and AGENTS.md §7c is a list of four things the first one got wrong.
--
-- So the enqueue runs in NODE, on the notice-drain path that already runs daily with the
-- service key, and this migration ships the table, the claim and the key — not a sweep
-- function. `lib/dues/reminders.ts` is the other half.
--
-- ── NOTHING HERE DECIDES WHETHER A FAMILY GETS THEM ────────────────────────────────────
-- The tier does, in `lib/features.ts`, resolved by the job. No policy consults it and none
-- may — the rule `families.tier`, `families.status` and `delinquent_since` all keep.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. THE QUEUE ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dues_reminders (
  id           UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  family_code  TEXT NOT NULL REFERENCES public.families(family_code) ON DELETE CASCADE,
  person_id    UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  schedule_id  UUID NOT NULL REFERENCES public.dues_schedules(id) ON DELETE CASCADE,

  -- The installment this reminder is about. THE IDEMPOTENCY KEY, with the two ids.
  due_on       DATE NOT NULL,
  -- What was owed when it was enqueued. A RECORD, not a live figure: the member may pay
  -- between the enqueue and the send, which is what `cancelled` is for.
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),

  -- ── FIVE STATES, AND THE LAST TWO ARE THE FEATURE ────────────────────────────────
  -- `pending | sent | failed` is not sufficient, and each of the others is a fact that would
  -- otherwise be filed as one of those three and be wrong — the argument
  -- `distribution_recipients` makes at length.
  --
  --   unreachable  the member's address is a GENERATED placeholder. `placeholderEmail()`
  --                builds those on a REAL domain, so `sendEmail`'s reserved-TLD guard does
  --                not catch them and mailing one is a hard bounce against our own sending
  --                reputation. Filed as `failed` it would sit forever in the column somebody
  --                works through.
  --   cancelled    the installment was settled before the reminder went. Distinct from
  --                `failed` for the reason a reopened gathering task is a different bell
  --                entry from a denied one: nothing went wrong and nobody should chase it.
  --   sending      CLAIMED BY A DRAIN AND NOT YET RESOLVED. It is a state rather than a
  --                `claimed_at` timestamp alone because the claim has to be able to EXCLUDE
  --                what it just handed out: the first draft set `state = 'pending'` on claim
  --                and then selected `state = 'pending'`, so every call re-claimed its own
  --                output. The verify block caught it on the first run.
  state        TEXT NOT NULL DEFAULT 'pending'
               CHECK (state IN ('pending','sending','sent','failed','unreachable','cancelled')),
  attempts     INT  NOT NULL DEFAULT 0,
  claimed_at   TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── §2. THE KEY FutureFeature.md ASKED FOR ─────────────────────────────────────────────
-- One reminder per member per schedule per installment, enforced by the DATABASE rather than
-- by whichever code path last wrote a row — the shape `distribution_recipients`' partial
-- unique index takes, and for the same reason: a job that runs daily will try to insert the
-- same row every day until the installment passes, and `ON CONFLICT DO NOTHING` is only safe
-- because of this line.
CREATE UNIQUE INDEX IF NOT EXISTS dues_reminders_one_per_installment
  ON public.dues_reminders (person_id, schedule_id, due_on);

CREATE INDEX IF NOT EXISTS dues_reminders_pending_idx
  ON public.dues_reminders (state, created_at) WHERE state = 'pending';

CREATE INDEX IF NOT EXISTS dues_reminders_family_idx
  ON public.dues_reminders (family_code);

COMMENT ON TABLE public.dues_reminders IS
  'The automatic dues reminder queue. Enqueued in Node from `duesPlanMath` (the arithmetic is '
  'not duplicated in SQL — see this migration''s header), drained by /api/billing/notices. '
  'Unique on (person, schedule, due_on), which is what stops one installment being reminded '
  'about twice.';

-- ── §3. RLS: READ ONLY, AND ONLY YOUR FAMILY'S ─────────────────────────────────────────
-- A SELECT policy and NO write policy at all, which per AGENTS.md §2c denies INSERT, UPDATE
-- and DELETE to the browser outright — the arrangement the six Gatherings tables and the five
-- Meeting tables both use. Every write is the job, on the service role.
--
-- IT IS KEYED ON `admin/accounting`, WHICH IS WHAT `dues_schedules` ITSELF MAPS TO — read out
-- of `permission_table_map` rather than guessed, because the code and the database must never
-- disagree about who may do what. A member's own reminder is their own business, so `self_expr`
-- admits the addressee; there is no `own_expr`, because nobody CREATES one of these.
ALTER TABLE public.dues_reminders ENABLE ROW LEVEL SECURITY;

INSERT INTO public.permission_table_map (table_name, resource_key, own_expr, self_expr)
VALUES ('dues_reminders', 'admin/accounting', 'false', 'person_id = auth_person_id()')
ON CONFLICT (table_name) DO UPDATE
  SET resource_key = EXCLUDED.resource_key,
      own_expr     = EXCLUDED.own_expr,
      self_expr    = EXCLUDED.self_expr;

DROP POLICY IF EXISTS "perm:dues_reminders:select" ON public.dues_reminders;
CREATE POLICY "perm:dues_reminders:select" ON public.dues_reminders
  FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      person_id = public.auth_person_id()
      OR public.auth_permission('admin/accounting', 'view') = 'any'
    )
  );

-- ── §4. THE TIER MAP, SO A PURGE TAKES THEM ────────────────────────────────────────────
-- `20260901000001` asserts every family-scoped table is on one list or the other, BY NAME, so
-- a table added later cannot be silently un-purgeable. A reminder queue is Premium-tier
-- working state and is worth nothing to a family that has dropped below it.
INSERT INTO public.tier_data_tables (table_name, min_tier, note)
VALUES ('dues_reminders', 'premium',
        'The automatic reminder queue. Premium working state — a family below that tier is '
        'not being reminded, so a queue of unsent reminders is worth nothing to them.')
ON CONFLICT (table_name) DO UPDATE
  SET min_tier = EXCLUDED.min_tier, note = EXCLUDED.note;

-- ── §5. CLAIMING, IN ONE STATEMENT ─────────────────────────────────────────────────────
-- `claim_platform_billing_notices`' shape, its reason and its recovery window. A
-- read-then-write from Node lets two concurrent drains both decide they are first, and here
-- that means a relative told twice that they owe money — which cannot be recalled.
CREATE OR REPLACE FUNCTION public.claim_dues_reminders(p_limit INT DEFAULT 25)
RETURNS TABLE (
  id UUID, family_code TEXT, person_id UUID, schedule_id UUID,
  due_on DATE, amount_cents INT, attempts INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH due AS (
    SELECT r.id
      FROM public.dues_reminders r
     WHERE r.state = 'pending'
        -- A failed send is retried, five times. With a DAILY drain that is five days rather
        -- than five hours, which is the safe direction: a reminder that arrives late is worth
        -- more than one that arrives twice.
        OR (r.state = 'failed' AND r.attempts < 5)
        -- A CLAIM IS RECOVERABLE. Without this a drain killed mid-batch leaves the row in
        -- `sending` forever and the reminder is lost by the mechanism meant to deliver it.
        -- `sent`, `cancelled` and `unreachable` are terminal and are never re-claimed.
        OR (r.state = 'sending' AND r.claimed_at < NOW() - INTERVAL '15 minutes')
     ORDER BY r.created_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.dues_reminders r
     SET state = 'sending', claimed_at = NOW(), attempts = r.attempts + 1
    FROM due
   WHERE r.id = due.id
  RETURNING r.id, r.family_code, r.person_id, r.schedule_id,
            r.due_on, r.amount_cents, r.attempts;
$$;

REVOKE ALL ON FUNCTION public.claim_dues_reminders(INT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finish_dues_reminder(
  p_id UUID, p_state TEXT, p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.dues_reminders
     SET state      = p_state,
         claimed_at = NULL,
         sent_at    = CASE WHEN p_state = 'sent' THEN NOW() ELSE sent_at END,
         error      = p_error
   WHERE id = p_id
$$;

REVOKE ALL ON FUNCTION public.finish_dues_reminder(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ── §6. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_code TEXT := 'REMINDPB';
  v_person UUID;
  v_sched  UUID;
  v_n INT;
  v_id UUID;
BEGIN
  -- 1. NO WRITE POLICY, which per §2c is what denies the browser those commands. A future
  --    sweep that composed one would make this queue writable from devtools.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'dues_reminders' AND cmd <> 'SELECT';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: dues_reminders has % write polic(ies); it must have none', v_n;
  END IF;

  -- 2. Neither function is reachable from a browser role (§2b).
  IF has_function_privilege('authenticated', 'public.claim_dues_reminders(int)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_dues_reminders(int)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finish_dues_reminder(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ROLLBACK: a browser role can claim or finish a dues reminder';
  END IF;

  -- 3. NO POLICY ANYWHERE CONSULTS THE TIER. The rule families.tier keeps, asserted here
  --    because this is the first table whose whole feature is tier-gated.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual,'') || COALESCE(with_check,'')) ~ 'families\.tier|auth_family_tier';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % policies consult the family tier', v_n;
  END IF;

  -- ── EXERCISED FOR REAL ────────────────────────────────────────────────────────────
  INSERT INTO public.families (family_code, family_name, tier)
       VALUES (v_code, 'Reminder probe', 'premium');
  INSERT INTO public.people (family_code, first_name, last_name, primary_email)
       VALUES (v_code, 'Remind', 'Probe', 'remind-probe@genorra.com') RETURNING id INTO v_person;
  INSERT INTO public.dues_schedules (family_code, label, amount_cents, frequency)
       VALUES (v_code, 'Probe dues', 12000, 'annual') RETURNING id INTO v_sched;

  -- 4. THE KEY, ASSERTED BY TRYING TO CROSS IT. A CHECK or an index that exists and does not
  --    bite is the failure mode AGENTS.md records twice; the subtransaction is the only way
  --    to attempt a refused write and carry on, and the sentinel is compared by MESSAGE so a
  --    different failure is not swallowed as a pass.
  INSERT INTO public.dues_reminders (family_code, person_id, schedule_id, due_on, amount_cents)
       VALUES (v_code, v_person, v_sched, DATE '2026-10-01', 1000) RETURNING id INTO v_id;
  BEGIN
    INSERT INTO public.dues_reminders (family_code, person_id, schedule_id, due_on, amount_cents)
         VALUES (v_code, v_person, v_sched, DATE '2026-10-01', 1000);
    RAISE EXCEPTION 'a second reminder for one installment was accepted';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  -- 5. A DIFFERENT INSTALLMENT IS A DIFFERENT ROW — the whole reason the key is `due_on`
  --    rather than the annual period. Without this a monthly payer is reminded once a year.
  INSERT INTO public.dues_reminders (family_code, person_id, schedule_id, due_on, amount_cents)
       VALUES (v_code, v_person, v_sched, DATE '2026-11-01', 1000);
  SELECT count(*) INTO v_n FROM public.dues_reminders WHERE family_code = v_code;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK: expected two reminders for two installments, found %', v_n;
  END IF;

  -- 6. A zero or negative amount is refused. A reminder to pay nothing is not a reminder.
  BEGIN
    INSERT INTO public.dues_reminders (family_code, person_id, schedule_id, due_on, amount_cents)
         VALUES (v_code, v_person, v_sched, DATE '2026-12-01', 0);
    RAISE EXCEPTION 'a reminder for zero was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- 7. The claim hands out both, once, and does not re-hand a fresh claim.
  SELECT count(*) INTO v_n FROM public.claim_dues_reminders(10);
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK: expected to claim two reminders, got %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.claim_dues_reminders(10);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: a freshly claimed reminder was handed out twice';
  END IF;

  -- 8. AN AGED-OUT CLAIM IS RECOVERED. A drain killed mid-batch must not strand a reminder.
  UPDATE public.dues_reminders SET claimed_at = NOW() - INTERVAL '20 minutes'
   WHERE family_code = v_code;
  SELECT count(*) INTO v_n FROM public.claim_dues_reminders(10);
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK: expected to recover two stale claims, got %', v_n;
  END IF;

  -- 9. THE THREE TERMINAL STATES ARE NEVER CLAIMED AGAIN, however stale the claim looks.
  --    `cancelled` is the one that matters: the member paid, and chasing somebody for money
  --    they have already sent is the worst thing this feature could do.
  PERFORM public.finish_dues_reminder(v_id, 'cancelled', NULL);
  UPDATE public.dues_reminders SET state = 'sent', sent_at = NOW()
   WHERE family_code = v_code AND id <> v_id;
  UPDATE public.dues_reminders SET claimed_at = NOW() - INTERVAL '20 minutes'
   WHERE family_code = v_code;
  SELECT count(*) INTO v_n FROM public.claim_dues_reminders(10);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % terminal reminder(s) were claimed for sending again', v_n;
  END IF;

  DELETE FROM public.dues_reminders WHERE family_code = v_code;
  DELETE FROM public.dues_schedules WHERE family_code = v_code;
  DELETE FROM public.people WHERE family_code = v_code;
  DELETE FROM public.families WHERE family_code = v_code;

  RAISE NOTICE 'dues reminders: queue, one-per-installment key, claim recoverable at 15 min.';
END $mig$;

COMMIT;
