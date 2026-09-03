-- ═══════════════════════════════════════════════════════════════════════════════════════
-- TWO CHANGES TO A DUES SCHEDULE: three answers about the bloodline, and a direct fund.
--
-- ═══ A. `bloodline_only` BECOMES `bloodline_scope`, WITH THREE VALUES ══════════════════
--
-- `bloodline_only BOOLEAN` could say two things — everybody owes this, or only the
-- bloodline does — and a family asked for the third: only relatives who are NOT in the
-- bloodline. That is a real case rather than a curiosity. A family that levies a dues on
-- descendants and a smaller one on the relatives who married in cannot express the second
-- half at all today: the only way to build it is a schedule everybody owes, which then bills
-- the bloodline twice.
--
-- ── ONE COLUMN WITH A CHECK, NOT A SECOND BOOLEAN ───────────────────────────────────────
-- `non_bloodline_only BOOLEAN` beside the first was the cheap version and is the `is_minor`
-- trap in a new costume (AGENTS.md §4b): two columns describing one fact, which can be set
-- to disagree, and every reader would then have to decide what `true`/`true` means. A single
-- three-valued column cannot be inconsistent, and the CHECK is what makes a fourth value a
-- write error rather than a silent fall-through in `duesEligibility`.
--
-- 'all' | 'bloodline' | 'non-bloodline'. NOT NULL DEFAULT 'all', which preserves the
-- direction of the old default exactly: a schedule nobody has narrowed is owed by everybody.
--
-- ── AND THE OLD COLUMN COMES BACK AS A GENERATED ONE, FOR ONE DEPLOY ────────────────────
-- This is the part worth reading before simplifying it.
--
-- AGENTS.md's deployment argument — migrations apply from CI BEFORE Vercel aliases the new
-- build — holds only for an ADDITIVE migration: "the old code serves while migrations are
-- applied, which is the safe direction, because a migration this repo ships is additive and
-- the running code does not use it yet". A DROP COLUMN inverts it. `app/actions/dues.ts`
-- selects `bloodline_only` by name in two places, and PostgREST answers 42703 by killing the
-- WHOLE query — so a bare drop would empty the Accounting dues screens for the length of the
-- alias window.
--
-- `20260902000000` took exactly that trade twelve days ago and said it was admissible because
-- "no family is using this product yet". **That is no longer true** — there are four families
-- on hosted with real names and real people in them — so the trade is not available and the
-- window has to be covered instead.
--
--     bloodline_only BOOLEAN GENERATED ALWAYS AS (bloodline_scope = 'bloodline') STORED
--
-- A GENERATED column is NOT a second fact, which is the whole reason this does not
-- reintroduce the trap it just avoided: Postgres derives it, nothing can write it, and it
-- cannot come to disagree with the column it is derived from. Old READS keep working through
-- the window. Old WRITES to it fail — which is one administrator creating a dues schedule
-- during a window of minutes, failing loudly with an error rather than silently recording the
-- wrong thing, and is the right way for that to go wrong.
--
-- **IT IS OWED A DROP.** Once this deploy is out, nothing reads it. TODO.md carries it. The
-- drop is then additive in the safe direction, because by then no running code names it.
--
-- ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────────────────
-- No policy consults either column and none may start to — `bloodline_scope` decides WHO
-- OWES, which is arithmetic in `lib/dues-utils.ts`, not row visibility. Asserted below.
--
-- ═══ B. A DUES SCHEDULE MAY NAME ONE FUND, AND THEN THE WATERFALL IS SKIPPED ═══════════
--
-- `dues_schedules.fund_id`. NULL is the existing behaviour and stays the default: a paid
-- dues payment is split across the family's active funds by priority, minimum and allocation
-- percentage — the routing table on Accounting. Set, and the whole payment goes into that one
-- fund and nothing else.
--
-- ── THE MECHANISM ALREADY EXISTS AND IS PROVEN ──────────────────────────────────────────
-- This is exactly what a DONATION has done since `20260807000003`: it goes whole into the
-- family's Donations fund rather than through the waterfall, and `routePaidPayment` has a
-- branch for it. The header of that branch argues why, and the argument generalises without
-- change:
--
--   > Before that fund existed a gift went through the dues waterfall, so money given to the
--   > Scholarship Drive was divided between the Reunion fund and whatever else the routing
--   > table happened to say, and there was no pot whose balance answered "what have we been
--   > given?".
--
-- A building-fund levy has the same problem. So `fund_id` is the general form of the special
-- case, and the donation branch is left alone rather than rewritten in terms of it: a
-- donation's destination is a SYSTEM fund the family cannot delete, and this one is a fund
-- they chose and can.
--
-- ── WHICH IS WHY THE FK IS `ON DELETE SET NULL` ─────────────────────────────────────────
-- Not RESTRICT and not CASCADE. A family deleting a fund a schedule pointed at must not be
-- refused (they may well be deleting it BECAUSE they are done with that levy), and must
-- certainly not lose the schedule. Setting it null returns the schedule to the waterfall,
-- which is the behaviour it had before anybody named a fund — the one fallback that is
-- already correct rather than invented for this case.
--
-- **THE SCREEN HAS TO SAY SO**, because a schedule silently rejoining the waterfall is money
-- going somewhere nobody chose. `funds_protect_system` already refuses deleting a system
-- fund, so the Donations destination cannot vanish this way.
--
-- ── AND §4: THE ID IS VERIFIED BEFORE IT IS WRITTEN ─────────────────────────────────────
-- `fund_id` arrives from a client on create and on update, and the row it lands on carries
-- the caller's own `family_code` — so every policy is satisfied while the schedule points at
-- another family's fund, which is §4 exactly. `belongsToFamily('funds', …)` in the action is
-- the check, and the guard trigger below is the layer under it, because those actions run on
-- the ADMIN client where no policy is underneath them at all.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master. See AGENTS.md, "How migrations reach the
--   hosted project".
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══ A. THE THREE-VALUED COLUMN ════════════════════════════════════════════════════════
ALTER TABLE public.dues_schedules
  ADD COLUMN IF NOT EXISTS bloodline_scope TEXT NOT NULL DEFAULT 'all';

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dues_schedules'::regclass
       AND conname = 'dues_schedules_bloodline_scope_check'
  ) THEN
    ALTER TABLE public.dues_schedules
      ADD CONSTRAINT dues_schedules_bloodline_scope_check
      CHECK (bloodline_scope IN ('all', 'bloodline', 'non-bloodline'));
  END IF;
END $mig$;

-- The backfill. Every existing row means one of the two things the boolean could say, so
-- nothing is invented here and no family's bill moves.
UPDATE public.dues_schedules
   SET bloodline_scope = CASE WHEN bloodline_only THEN 'bloodline' ELSE 'all' END
 WHERE bloodline_scope = 'all';

-- ── AND `bloodline_only` COMES BACK DERIVED ─────────────────────────────────────────────
-- Dropped and re-added inside this transaction, so it is never absent at COMMIT and no
-- reader sees a gap. See the header for why a generated column is not a second fact.
--
-- A DONATION IS ALWAYS 'all', AND THAT IS NOT ENFORCED HERE. `bloodline_scope` is meaningless
-- on a drive — a gift is not owed by anybody — and the create/update actions already force
-- the old flag false for `kind = 'donation'`. A CHECK tying the two would be a fourth thing
-- to remember on every insert for a column no donation screen renders; the actions keep it,
-- as they keep `goal_cents` and `amount_cents` kind-specific.
ALTER TABLE public.dues_schedules DROP COLUMN bloodline_only;
ALTER TABLE public.dues_schedules
  ADD COLUMN bloodline_only BOOLEAN
  GENERATED ALWAYS AS (bloodline_scope = 'bloodline') STORED;

COMMENT ON COLUMN public.dues_schedules.bloodline_scope IS
  'Who owes this schedule: all | bloodline | non-bloodline. Read by duesEligibility() in '
  'lib/dues-utils.ts and by nothing else — it decides WHO rather than HOW MUCH. NOT NULL '
  'DEFAULT ''all'', so a schedule nobody has narrowed is owed by everybody. Replaced the '
  'two-valued bloodline_only in 20260903000001.';

COMMENT ON COLUMN public.dues_schedules.bloodline_only IS
  'DERIVED from bloodline_scope, and DEPRECATED. It exists only so code deployed before '
  '20260903000001 keeps reading through the alias window — PostgREST answers 42703 for a '
  'missing column and kills the whole query. Nothing writes it (it is GENERATED) and nothing '
  'in the app reads it. Owed a DROP; TODO.md carries it.';

-- ── AND THE FREEZE TRIGGER HAS TO BE RECOMPOSED, WHICH IS NOT OPTIONAL ─────────────────
--
-- `dues_schedules_freeze_used_terms` (`20260817000008`) compares nine columns between NEW and
-- OLD, and one of them is `bloodline_only`. **A GENERATED COLUMN IS NOT COMPUTED WHEN A
-- BEFORE-ROW TRIGGER RUNS** — `NEW.bloodline_only` is NULL there — so with the column made
-- generated and the trigger left alone, `NEW.bloodline_only IS DISTINCT FROM OLD.bloodline_only`
-- is TRUE on every single UPDATE.
--
-- The effect is not a missing guard, it is the opposite and it is worse: the trigger refuses
-- EVERY update to a schedule that has been paid against. Renaming a used due, correcting its
-- description, moving its end date — all refused, with a message naming the amount and the
-- bloodline setting.
--
-- MEASURED, and the measurement is the reason this block exists. Asking "does the freeze still
-- refuse a bloodline change" answered "yes" and proved nothing; it was the NEGATIVE control —
-- updating the LABEL, which the trigger has never frozen — that came back refused too.
-- AGENTS.md §7's positive-control argument, inverted: an assertion that everything is refused
-- passes every test written to check that something is.
--
-- So the comparison moves onto `bloodline_scope`, which is a real stored column. Recomposed by
-- reading the body out of `pg_proc` and replacing the one line, the way `20260822000022` §6
-- rewrites a policy — rather than retyping a 70-line function from a reading, which
-- `20260901000003` records having got wrong in exactly that way.
DO $mig$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'dues_schedules_freeze_used_terms';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'dues_schedules_freeze_used_terms is missing';
  END IF;
  IF position('NEW.bloodline_only IS DISTINCT FROM OLD.bloodline_only' IN v_def) = 0 THEN
    RAISE EXCEPTION
      'the freeze trigger does not compare bloodline_only — it has been rewritten since '
      '20260817000008 and this replacement would silently do nothing';
  END IF;
  v_def := replace(
    v_def,
    'NEW.bloodline_only IS DISTINCT FROM OLD.bloodline_only',
    'NEW.bloodline_scope IS DISTINCT FROM OLD.bloodline_scope');
  EXECUTE v_def;
  RAISE NOTICE 'freeze trigger recomposed onto bloodline_scope';
END $mig$;

-- ═══ B. THE DIRECT FUND ════════════════════════════════════════════════════════════════
ALTER TABLE public.dues_schedules
  ADD COLUMN IF NOT EXISTS fund_id UUID
  REFERENCES public.funds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dues_schedules_fund_id_fk_idx
  ON public.dues_schedules (fund_id);

COMMENT ON COLUMN public.dues_schedules.fund_id IS
  'When set, a paid payment on this schedule goes WHOLE into this fund and the routing '
  'waterfall is skipped — the same thing a donation has done into the Donations fund since '
  '20260807000003. NULL is the default and means the waterfall. ON DELETE SET NULL: deleting '
  'the fund returns the schedule to the waterfall rather than refusing the delete or losing '
  'the schedule, and the screen has to say so. Added 20260903000001.';

-- ── THE §4 GUARD UNDERNEATH THE ACTION ─────────────────────────────────────────────────
-- `fund_id` arrives from a client, and the row it is written onto carries the caller's own
-- family — so every policy is satisfied while the schedule points into another family. The
-- action checks it with `belongsToFamily`; this is the layer under that, and it is needed
-- because those actions run on the ADMIN client where no policy is underneath them at all.
--
-- SECURITY INVOKER, and it refuses EVERY role rather than testing `current_user`. Unlike
-- `people_guard_bloodline` — which draws a boundary around the role the BROWSER speaks as,
-- because the service role legitimately moves that column — there is no legitimate
-- cross-family `fund_id`, for anybody, ever. So the check is on the DATA and the role is not
-- consulted at all.
CREATE OR REPLACE FUNCTION public.tg_dues_schedule_guard_fund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.fund_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.funds f
     WHERE f.id = NEW.fund_id AND f.family_code = NEW.family_code
  ) THEN
    RAISE EXCEPTION
      'dues_schedules.fund_id must name a fund in the same family (§4)';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dues_schedules_guard_fund ON public.dues_schedules;
CREATE TRIGGER dues_schedules_guard_fund
  BEFORE INSERT OR UPDATE OF fund_id, family_code ON public.dues_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tg_dues_schedule_guard_fund();

-- ── Verify ──────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n INT;
  v_t TEXT;
BEGIN
  -- ── A ──
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dues_schedules'
       AND column_name = 'bloodline_scope' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'dues_schedules.bloodline_scope is missing or nullable';
  END IF;

  -- THE CHECK IS WHAT MAKES A FOURTH VALUE A WRITE ERROR rather than a silent fall-through
  -- in `duesEligibility`. Asserted, because a column whose vocabulary is only enforced in
  -- TypeScript is a column the service role can put anything in.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dues_schedules'::regclass
       AND conname = 'dues_schedules_bloodline_scope_check'
  ) THEN
    RAISE EXCEPTION 'the bloodline_scope CHECK is missing';
  END IF;

  -- THE OLD COLUMN IS GENERATED, which is the entire reason it is allowed to still exist.
  -- A plain column here would be the second fact this migration's header refuses.
  SELECT c.is_generated INTO v_t
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'dues_schedules'
     AND c.column_name = 'bloodline_only';
  IF v_t IS DISTINCT FROM 'ALWAYS' THEN
    RAISE EXCEPTION
      'bloodline_only must be GENERATED (is_generated = %) — a plain column beside '
      'bloodline_scope is two facts about one thing', coalesce(v_t, 'MISSING');
  END IF;

  -- The backfill preserved every row's meaning: no schedule that was bloodline-only reads as
  -- open to everybody, and none that was open reads as narrowed.
  SELECT count(*) INTO v_n
    FROM public.dues_schedules
   WHERE bloodline_only IS DISTINCT FROM (bloodline_scope = 'bloodline');
  IF v_n > 0 THEN
    RAISE EXCEPTION '% row(s) where the derived flag and the scope disagree', v_n;
  END IF;

  -- ── B ──
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dues_schedules' AND column_name = 'fund_id'
  ) THEN
    RAISE EXCEPTION 'dues_schedules.fund_id was not created';
  END IF;

  -- ON DELETE SET NULL, asserted rather than assumed: RESTRICT would refuse a family
  -- deleting their own fund, and CASCADE would delete the SCHEDULE with it.
  SELECT con.confdeltype INTO v_t
    FROM pg_constraint con
   WHERE con.conrelid = 'public.dues_schedules'::regclass
     AND con.contype = 'f'
     AND con.confrelid = 'public.funds'::regclass;
  IF v_t IS DISTINCT FROM 'n' THEN
    RAISE EXCEPTION
      'dues_schedules.fund_id must be ON DELETE SET NULL (confdeltype = %)', coalesce(v_t, 'none');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.dues_schedules'::regclass
       AND tgname = 'dues_schedules_guard_fund'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'the fund guard trigger is missing';
  END IF;

  -- INVOKER, not DEFINER. A DEFINER trigger sees its own owner as `current_user` for every
  -- caller alike — which is the reason `20260806000011` chose INVOKER and asserts this — and
  -- this guard tests the DATA rather than the role, so it needs no elevation at all.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'tg_dues_schedule_guard_fund' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'tg_dues_schedule_guard_fund must be SECURITY INVOKER';
  END IF;

  -- ── AND NO POLICY CONSULTS EITHER COLUMN, IN EITHER DIRECTION ────────────────────────
  -- `bloodline_scope` decides who OWES a due, which is arithmetic; `fund_id` decides where
  -- a payment LANDS. Neither is row visibility, and a policy that started reading one would
  -- be withholding rows on a money rule — the boundary `families.tier` and
  -- `families.status` both keep.
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ') INTO v_t
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '(bloodline_scope|bloodline_only)';
  IF v_t IS NOT NULL THEN
    RAISE EXCEPTION 'policies consult the bloodline column: %', v_t;
  END IF;

  -- ── AND THE FREEZE TRIGGER NO LONGER READS THE GENERATED COLUMN ──────────────────────
  -- A BEFORE-row trigger sees NULL for a generated column, so a comparison against
  -- `bloodline_only` there is TRUE on every UPDATE and refuses every edit to a used
  -- schedule. Asserted in BOTH directions: the old comparison is gone AND the new one is
  -- there, because a replacement that silently matched nothing would leave the first
  -- condition satisfied and the trigger broken.
  SELECT pg_get_functiondef(p.oid) INTO v_t
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'dues_schedules_freeze_used_terms';
  IF v_t IS NULL THEN
    RAISE EXCEPTION 'dues_schedules_freeze_used_terms is missing';
  END IF;
  IF position('bloodline_only' IN v_t) > 0 THEN
    RAISE EXCEPTION
      'the freeze trigger still reads bloodline_only, which is NULL in a BEFORE trigger — '
      'it would refuse every update to a used schedule';
  END IF;
  IF position('NEW.bloodline_scope IS DISTINCT FROM OLD.bloodline_scope' IN v_t) = 0 THEN
    RAISE EXCEPTION 'the freeze trigger does not compare bloodline_scope';
  END IF;

  RAISE NOTICE 'dues: bloodline_scope (3 values, CHECKed), bloodline_only derived and '
    'deprecated, fund_id with its §4 guard, freeze trigger recomposed';
END $mig$;

COMMIT;
