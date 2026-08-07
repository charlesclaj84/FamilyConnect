-- ============================================================================
-- Every manually entered transaction names the person who entered it, and a
-- disbursement can no longer be deleted.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ATTRIBUTION IS REQUIRED ON INSERT — AND STILL NULLABLE AFTERWARDS
--
-- `recorded_by` existed on all four money tables and was nullable on all four, so
-- "who took the funds" was a convention rather than a guarantee. Three of the write
-- paths honoured it; recordDisbursement wrote `myPerson?.id ?? null` and
-- recordEventExpense went through a helper that resolves `people` by user_id with no
-- family scoping — which for a member of two families matches two rows, makes
-- maybeSingle() fail, and lands NULL. Both of those are money going OUT.
--
-- The column CANNOT simply become NOT NULL, and the reason is worth stating because
-- it is the whole shape of this migration: every recorded_by foreign key is
-- ON DELETE SET NULL. Deleting a treasurer nulls their name out of every row they
-- ever entered, and a NOT NULL column would turn that into a foreign-key failure —
-- "you cannot delete this person" for anyone who has ever recorded a payment.
--
-- So the rule is enforced where it actually belongs: at INSERT. A row must arrive
-- attributed; what happens to that attribution when the person is later deleted is a
-- separate question, and one this migration deliberately does not change.
--
-- WHY A TRIGGER RATHER THAN THE ACTIONS ALONE
--   Same reason as 20260806000002 and 20260807000001. Every accounting write in this
--   application runs through createAdminClient(); the service role bypasses RLS, so a
--   CHECK-in-the-action is the only guard, and it is exactly the guard that was already
--   silently absent in two of the four paths. The service role does not bypass triggers.
--
-- WHICH ROWS, AND WHY NOT ALL OF THEM
--   Machine-originated rows have no person to name, and demanding one would either
--   block a future automated path or invite a fake id to satisfy the trigger:
--
--     dues_payments       source = 'manual'  → required.  Anything else is a processor
--                                              settling a payment nobody keyed in, which
--                                              is the shape 20260806000002 keeps open.
--     fund_contributions  source IN ('admin_manual','member_contribution') → required.
--                                              'dues_routing' and 'reversal' are written
--                                              BY the app from another row; they do carry
--                                              the originating recorder today, and pinning
--                                              that here would freeze an implementation
--                                              detail of routePaidPayment.
--     fund_disbursements  always required.     There is no automated path. Money leaves
--                                              the family because a person decided it.
--     event_expenses      always required.     Same.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DISBURSEMENTS ARE APPEND-ONLY
--
-- Modelled on dues_payments (20260806000002), including the `NOT EXISTS` discriminator
-- that keeps referential integrity working: all four of this table's foreign keys act
-- on delete, and a naive trigger breaks every one of them.
--
--   fund_disbursements.fund_id      REFERENCES funds(id)            ON DELETE CASCADE
--   fund_disbursements.person_id    REFERENCES people(id)           ON DELETE CASCADE
--   fund_disbursements.milestone_id REFERENCES fund_milestones(id)  ON DELETE SET NULL
--   fund_disbursements.recorded_by  REFERENCES people(id)           ON DELETE SET NULL
--
-- Those RI actions run as AFTER triggers on the PARENT row, so by the time the child
-- statement runs the parent is already gone — which makes `NOT EXISTS` against the
-- parent an exact discriminator between the RI action and a direct write.
--
-- THE HONEST COST, recorded because nobody should discover it from a support ticket:
-- there is no reversal mechanism for a disbursement. dues_payments has one — post an
-- equal and opposite row — and fund_disbursements does not, so a mis-keyed payout is
-- now permanent and correcting it means a compensating fund_contribution with a note.
-- That is a real gap and the right fix is a reversal path mirroring reversePayment;
-- this migration does what was asked and leaves that gap visible rather than
-- pretending deletion was the answer to it.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 3. THE PERMISSION MODEL AGREES
--
-- 'transactions/fund-disbursements' declared actions {view,create,delete}, so Members &
-- Access still offered a Delete column for it — a grant an administrator could hand out
-- that now does nothing. Narrowed to {view,create}, the stale template rows removed, and
-- the RLS DELETE policy dropped, so the code, the grid and the database all say the same
-- thing. 20260806000000's seed array is edited in the same change: its insert is
-- ON CONFLICT DO UPDATE ... SET actions = EXCLUDED.actions and would otherwise put the
-- delete action back on replay (AGENTS.md §6).
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

BEGIN;

-- ── 1. Attribution required on insert ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.require_recorded_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Passed by CREATE TRIGGER so one function serves all four tables. Empty means
  -- "every row of this table", which is the case for the two money-out tables.
  v_manual_sources text[] := TG_ARGV[0]::text[];
  v_source text;
BEGIN
  IF NEW.recorded_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF array_length(v_manual_sources, 1) IS NOT NULL THEN
    -- `source` is only read for the tables that have one, and those are exactly the
    -- tables given a non-empty list. to_jsonb keeps this one function generic without
    -- a per-table branch on a column that does not always exist.
    v_source := to_jsonb(NEW) ->> 'source';
    IF v_source IS NULL OR NOT (v_source = ANY (v_manual_sources)) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION
    '%: a manually recorded transaction must name who recorded it (recorded_by is null)',
    TG_TABLE_NAME
    USING ERRCODE = '23502';
END $$;

REVOKE ALL ON FUNCTION public.require_recorded_by() FROM PUBLIC;

DROP TRIGGER IF EXISTS dues_payments_require_recorded_by ON public.dues_payments;
CREATE TRIGGER dues_payments_require_recorded_by
  BEFORE INSERT ON public.dues_payments
  FOR EACH ROW EXECUTE FUNCTION public.require_recorded_by('{manual}');

DROP TRIGGER IF EXISTS fund_contributions_require_recorded_by ON public.fund_contributions;
CREATE TRIGGER fund_contributions_require_recorded_by
  BEFORE INSERT ON public.fund_contributions
  FOR EACH ROW EXECUTE FUNCTION public.require_recorded_by('{admin_manual,member_contribution}');

DROP TRIGGER IF EXISTS fund_disbursements_require_recorded_by ON public.fund_disbursements;
CREATE TRIGGER fund_disbursements_require_recorded_by
  BEFORE INSERT ON public.fund_disbursements
  FOR EACH ROW EXECUTE FUNCTION public.require_recorded_by('{}');

DROP TRIGGER IF EXISTS event_expenses_require_recorded_by ON public.event_expenses;
CREATE TRIGGER event_expenses_require_recorded_by
  BEFORE INSERT ON public.event_expenses
  FOR EACH ROW EXECUTE FUNCTION public.require_recorded_by('{}');

-- ── 2. fund_disbursements is append-only ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fund_disbursements_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- ── DELETE ────────────────────────────────────────────────────────────────
  -- Permitted only as the CASCADE from a parent that is already gone: the fund the
  -- money came out of, or the person it went to. Both are checked because either can
  -- be the one being deleted, and RI triggers fire in an effectively arbitrary order.
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.funds  WHERE id = OLD.fund_id)
       OR NOT EXISTS (SELECT 1 FROM public.people WHERE id = OLD.person_id)
    THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'fund_disbursements is append-only: disbursement % cannot be deleted', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- ── UPDATE ────────────────────────────────────────────────────────────────
  -- Nothing about a payout may be rewritten. There is no updateDisbursement action and
  -- there is not meant to be one; this exists so adding one is a deliberate act that
  -- has to come back through a migration.
  IF NEW.id                IS DISTINCT FROM OLD.id
     OR NEW.family_code       IS DISTINCT FROM OLD.family_code
     OR NEW.fund_id           IS DISTINCT FROM OLD.fund_id
     OR NEW.person_id         IS DISTINCT FROM OLD.person_id
     OR NEW.amount_cents      IS DISTINCT FROM OLD.amount_cents
     OR NEW.disbursed_date    IS DISTINCT FROM OLD.disbursed_date
     OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     OR NEW.notes             IS DISTINCT FROM OLD.notes
     OR NEW.created_at        IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'fund_disbursements is immutable: disbursement % cannot be altered', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- milestone_id: only the ON DELETE SET NULL from a milestone that is already gone.
  IF NEW.milestone_id IS DISTINCT FROM OLD.milestone_id
     AND NOT (NEW.milestone_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.fund_milestones WHERE id = OLD.milestone_id))
  THEN
    RAISE EXCEPTION 'fund_disbursements.milestone_id is immutable (disbursement %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- recorded_by: only the ON DELETE SET NULL from a person who is already gone. This is
  -- the conjunct that keeps a treasurer deletable, and the reason §1 enforces
  -- attribution on INSERT rather than with a NOT NULL column.
  IF NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
     AND NOT (NEW.recorded_by IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.people WHERE id = OLD.recorded_by))
  THEN
    RAISE EXCEPTION 'fund_disbursements.recorded_by is immutable (disbursement %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.fund_disbursements_immutable() FROM PUBLIC;

DROP TRIGGER IF EXISTS fund_disbursements_immutable ON public.fund_disbursements;
CREATE TRIGGER fund_disbursements_immutable
  BEFORE UPDATE OR DELETE ON public.fund_disbursements
  FOR EACH ROW EXECUTE FUNCTION public.fund_disbursements_immutable();

-- ── 3. The permission model stops offering a delete ─────────────────────────
DROP POLICY IF EXISTS "perm:fund_disbursements:delete" ON public.fund_disbursements;

UPDATE public.permission_resources
   SET actions = ARRAY['view','create']::TEXT[]
 WHERE key = 'transactions/fund-disbursements';

-- The materialized grid keeps a row per resource+action, so the delete rows would
-- linger as grants nothing reads. Removed from both the template grid and any legacy
-- per-group table that is still present in this database.
DELETE FROM public.template_permissions
 WHERE resource_key = 'transactions/fund-disbursements' AND action = 'delete';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_permissions') THEN
    DELETE FROM public.group_permissions
     WHERE resource_key = 'transactions/fund-disbursements' AND action = 'delete';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'person_permissions') THEN
    DELETE FROM public.person_permissions
     WHERE resource_key = 'transactions/fund-disbursements' AND action = 'delete';
  END IF;
END $$;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Unconditional. Everything asserted is schema or configuration, so none of it needs a
-- fixture and none of it can be skipped into a false pass.
DO $$
DECLARE
  bad text[] := '{}';
  t   text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dues_payments','fund_contributions','fund_disbursements','event_expenses'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
       WHERE tgname = t || '_require_recorded_by'
         AND tgrelid = ('public.' || t)::regclass
         AND NOT tgisinternal
    ) THEN
      bad := bad || ('attribution trigger missing on ' || t);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'fund_disbursements_immutable'
       AND tgrelid = 'public.fund_disbursements'::regclass
       AND NOT tgisinternal
  ) THEN
    bad := bad || 'fund_disbursements append-only trigger missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'fund_disbursements' AND cmd = 'DELETE'
  ) THEN
    bad := bad || 'a DELETE policy still exists on fund_disbursements';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE key = 'transactions/fund-disbursements' AND 'delete' = ANY (actions)
  ) THEN
    bad := bad || 'the disbursement resource still declares a delete action';
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: transaction attribution assertion failed:%',
      E'\n  ' || array_to_string(bad, E'\n  ');
  END IF;

  RAISE NOTICE 'transaction attribution + disbursement immutability: OK';
END $$;

COMMIT;
