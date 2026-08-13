-- ============================================================================
-- Money moves between funds. `fund_transfers` is the ledger that records it.
--
-- ── WHY A TABLE AND NOT A PAIR OF EXISTING ROWS ─────────────────────────────
--   The obvious shortcut is a fund_disbursements row on the source and a
--   fund_contributions row on the destination. Both refuse it, and for the right
--   reason in each case:
--
--     fund_disbursements.person_id is NOT NULL — it is money leaving the FAMILY, to
--       a named member. A transfer leaves no one; there is no recipient to name and
--       naming one would put a payout on that member's record that never happened.
--     fund_contributions needs a giver (a member, or free text) and a payment method
--       and reference — 20260805000000 made all three the point of the row, because
--       nothing sits behind a hand-recorded contribution. A transfer has no giver and
--       no instrument; the money is already the family's.
--
--   Faking either would also break the P&L: the family's income and expenses would
--   both rise by an amount that never crossed its boundary. A transfer is internal and
--   nets to zero family-wide, which only a row that names BOTH funds can express.
--
-- ── WHAT THIS DOES NOT CHANGE, AND MUST NOT ─────────────────────────────────
--   Once dues are routed, they belong to the fund they landed in. A disbursement out
--   of Fund A reduces A and touches nothing else, and the next dues payment refills A
--   toward its minimum ahead of everything below it — because a fund's balance is
--   `contributions − disbursements − expenses`, computed per fund, and the routing
--   engine reads that same figure (getActiveFundsForRouting in app/actions/dues.ts).
--   Nothing re-runs the waterfall over history; reversePayment says so in as many
--   words.
--
--   This migration adds ONE term to that sum — transfers in, transfers out — and the
--   two readers of it (fund_balance_cents below, and getFunds/getActiveFundsForRouting
--   in the app) are updated in the same change. A transfer is the ONLY way money moves
--   between funds after routing, which is exactly the property the ledger is here to
--   keep true: the money is gone from A and present in B, both permanently recorded.
--
-- ── THE ROW ─────────────────────────────────────────────────────────────────
--   `reason` is REQUIRED and is the only free-text field. The other three money
--   tables require a check number or reference because something outside the system
--   moved; a transfer has no instrument to point at and no counterparty to describe.
--   The one thing worth capturing is WHY the money moved, and splitting that across a
--   required "reason" and an optional "notes" only invites half the answer in each.
--
--   No `person_id`. See above — that field is what makes a disbursement a payout.
--
-- ── APPEND-ONLY, LIKE EVERY OTHER MONEY TABLE ───────────────────────────────
--   Same shape as 20260807000002 gave fund_disbursements, and with a better story
--   than that table has: a mis-keyed transfer IS correctable, by transferring back.
--   Both rows then stand, which is what a ledger is for. So there is no delete, no
--   edit, and no reversal mechanism to build — the inverse operation already exists.
--
--   The `NOT EXISTS` discriminator in the DELETE branch is 20260807000002's, for its
--   reason: both fund foreign keys are ON DELETE CASCADE and recorded_by is ON DELETE
--   SET NULL, those RI actions run after the parent row is already gone, and a naive
--   trigger would break all three.
--
-- ── AND THE ONE GUARD RLS STRUCTURALLY CANNOT GIVE (AGENTS.md §4) ───────────
--   A transfer row carries TWO fund ids, and a policy is a predicate over the row it
--   is writing. A row stamped with the caller's own family_code satisfies every policy
--   there is while pointing at another family's fund — the exact shape §4 describes.
--   transferBetweenFunds() re-scopes both ids before writing, as it must; the trigger
--   in §4 below states the rule where the service role cannot step around it, because
--   every accounting write in this app runs through createAdminClient().
--
-- IDEMPOTENT. Every insert is ON CONFLICT, every backfill is DO NOTHING, every policy
-- and trigger is dropped and recreated. Safe on an empty database, where §6 and §7
-- find no families and only the resource row is written.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fund_transfers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code      TEXT        NOT NULL,
  from_fund_id     UUID        NOT NULL REFERENCES public.funds(id)  ON DELETE CASCADE,
  to_fund_id       UUID        NOT NULL REFERENCES public.funds(id)  ON DELETE CASCADE,
  -- Strictly positive. A zero-amount transfer records nothing and a negative one is
  -- a transfer the other way wearing a disguise, which no ledger should have to read.
  amount_cents     INT         NOT NULL CHECK (amount_cents > 0),
  transferred_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  reason           TEXT        NOT NULL CHECK (btrim(reason) <> ''),
  recorded_by      UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Money cannot be moved to where it already is. Cheap to state here, and it stops
  -- the one entry that would look like activity and change nothing.
  CONSTRAINT fund_transfers_distinct_funds CHECK (from_fund_id <> to_fund_id)
);

CREATE INDEX IF NOT EXISTS fund_transfers_family_idx ON public.fund_transfers(family_code);
CREATE INDEX IF NOT EXISTS fund_transfers_from_idx   ON public.fund_transfers(from_fund_id);
CREATE INDEX IF NOT EXISTS fund_transfers_to_idx     ON public.fund_transfers(to_fund_id);

COMMENT ON TABLE public.fund_transfers IS
  'Money moved from one of the family''s funds to another. Internal: nets to zero '
  'family-wide, so it is neither income nor expense. Append-only — a mistake is '
  'corrected by transferring back, and both rows stand.';

-- ── 2. The balance helper learns the new term ───────────────────────────────
-- Nothing in the app calls this today (the balance is summed in TypeScript, in
-- getFunds and getActiveFundsForRouting), but it is the database's own statement of
-- what a fund balance IS, and leaving it saying something the app contradicts is how
-- the two come to disagree without anyone choosing it.
CREATE OR REPLACE FUNCTION public.fund_balance_cents(p_fund_id UUID)
RETURNS INT LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT  COALESCE((SELECT SUM(amount_cents) FROM public.fund_contributions WHERE fund_id = p_fund_id), 0)
        - COALESCE((SELECT SUM(amount_cents) FROM public.fund_disbursements WHERE fund_id = p_fund_id), 0)
        - COALESCE((SELECT SUM(amount_cents) FROM public.event_expenses     WHERE fund_id = p_fund_id), 0)
        + COALESCE((SELECT SUM(amount_cents) FROM public.fund_transfers WHERE to_fund_id   = p_fund_id), 0)
        - COALESCE((SELECT SUM(amount_cents) FROM public.fund_transfers WHERE from_fund_id = p_fund_id), 0);
$$;

-- `search_path = ''` added with the rewrite, which is why every reference above is
-- schema-qualified: this function is one of the seven TODO.md records as carrying a
-- mutable search_path. It is SECURITY INVOKER, so this is tidiness rather than a hole
-- being closed — but a function being rewritten anyway is the cheapest time to do it.

-- ── 3. The resource ─────────────────────────────────────────────────────────
-- sort_order 120, taking the slot Payment Reversals held; §3b moves that to 121.
-- The five LEDGERS render in rail order in the grid (groupResources sorts by
-- sort_order inside a subsection), and Transfers is a tab where Reversals is not —
-- it is the Reverse button on the Dues ledger. A tab belongs beside the other tabs.
--
-- ACTIONS: view + create, exactly like Contributions and Disbursements beside it.
--   `edit`   — the table is append-only (§5). A switch for it would be a grant
--              nothing can act on, which is what 20260808000000 spent a section
--              removing.
--   `delete` — same, and for the stronger reason: deleting the record of money
--              moving is not a capability this app has.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES ('transactions/fund-transfers', 'Transfers', 'accounting', 'Transactions', 120,
        ARRAY['view','create']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 3b. Payment Reversals moves down one ────────────────────────────────────
-- 20260806000005 asserts the accounting category holds no duplicate sort_order, so
-- one of the two has to move and this is the one that is not a rail item.
-- 20260806000003's own insert is ON CONFLICT DO UPDATE ... SET sort_order, so it is
-- edited to say 121 as well — otherwise a fresh database would order them correctly
-- here and a replay of that file would put them back on top of each other
-- (AGENTS.md §6).
UPDATE public.permission_resources
   SET sort_order = 121
 WHERE key = 'transactions/reversals' AND sort_order <> 121;

-- ── 4. Both funds are this family's ─────────────────────────────────────────
-- AGENTS.md §4, stated in the database. RLS is a predicate over the row being
-- written: a transfer stamped with the caller's own family_code satisfies every
-- policy on this table while pointing `to_fund_id` at another family's fund, and
-- nothing in the database would object, because nothing was asked.
--
-- A TRIGGER, not a policy, because every accounting write in this app runs through
-- createAdminClient() and the service role does not consult RLS. It does not bypass
-- triggers. Same reasoning as 20260806000002, 20260807000001 and 20260807000002.
--
-- SECURITY DEFINER with an empty search_path: it reads `funds` rows that the calling
-- role may well not be able to see, and the answer must not depend on that.
CREATE OR REPLACE FUNCTION public.tg_fund_transfer_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from_family text;
  v_to_family   text;
BEGIN
  SELECT family_code INTO v_from_family FROM public.funds WHERE id = NEW.from_fund_id;
  SELECT family_code INTO v_to_family   FROM public.funds WHERE id = NEW.to_fund_id;

  IF v_from_family IS DISTINCT FROM NEW.family_code
     OR v_to_family IS DISTINCT FROM NEW.family_code
  THEN
    RAISE EXCEPTION
      'fund_transfers: both funds must belong to family % (source %, destination %)',
      NEW.family_code, COALESCE(v_from_family, 'missing'), COALESCE(v_to_family, 'missing')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_fund_transfer_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS fund_transfers_same_family ON public.fund_transfers;
CREATE TRIGGER fund_transfers_same_family
  BEFORE INSERT ON public.fund_transfers
  FOR EACH ROW EXECUTE FUNCTION public.tg_fund_transfer_same_family();

-- Attribution, on the same terms as the other three money tables. The empty argument
-- means "every row of this table": there is no automated path that moves money
-- between funds, so a transfer always has a person behind it.
DROP TRIGGER IF EXISTS fund_transfers_require_recorded_by ON public.fund_transfers;
CREATE TRIGGER fund_transfers_require_recorded_by
  BEFORE INSERT ON public.fund_transfers
  FOR EACH ROW EXECUTE FUNCTION public.require_recorded_by('{}');

-- ── 5. Append-only ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fund_transfers_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- ── DELETE ────────────────────────────────────────────────────────────────
  -- Permitted only as the CASCADE from a fund that is already gone. BOTH are checked
  -- because either end can be the one being deleted and RI triggers fire in an
  -- effectively arbitrary order.
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.funds WHERE id = OLD.from_fund_id)
       OR NOT EXISTS (SELECT 1 FROM public.funds WHERE id = OLD.to_fund_id)
    THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION
      'fund_transfers is append-only: transfer % cannot be deleted — transfer the money back instead',
      OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- ── UPDATE ────────────────────────────────────────────────────────────────
  IF NEW.id               IS DISTINCT FROM OLD.id
     OR NEW.family_code      IS DISTINCT FROM OLD.family_code
     OR NEW.from_fund_id     IS DISTINCT FROM OLD.from_fund_id
     OR NEW.to_fund_id       IS DISTINCT FROM OLD.to_fund_id
     OR NEW.amount_cents     IS DISTINCT FROM OLD.amount_cents
     OR NEW.transferred_date IS DISTINCT FROM OLD.transferred_date
     OR NEW.reason           IS DISTINCT FROM OLD.reason
     OR NEW.created_at       IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'fund_transfers is immutable: transfer % cannot be altered', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- recorded_by: only the ON DELETE SET NULL from a person who is already gone. This
  -- is the conjunct that keeps a treasurer deletable — see 20260807000002 §1 for why
  -- attribution is enforced on INSERT rather than with a NOT NULL column.
  IF NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
     AND NOT (NEW.recorded_by IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.people WHERE id = OLD.recorded_by))
  THEN
    RAISE EXCEPTION 'fund_transfers.recorded_by is immutable (transfer %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.fund_transfers_immutable() FROM PUBLIC;

DROP TRIGGER IF EXISTS fund_transfers_immutable ON public.fund_transfers;
CREATE TRIGGER fund_transfers_immutable
  BEFORE UPDATE OR DELETE ON public.fund_transfers
  FOR EACH ROW EXECUTE FUNCTION public.fund_transfers_immutable();

-- ── 6. Row Level Security ───────────────────────────────────────────────────
-- Written out longhand rather than left to 20260618000001's sweep, which composed the
-- policies on the older money tables. That migration ran long before this table
-- existed and skips anything already named `perm:%` on a replay, so these are what
-- protects the table in every database — fresh or hosted — and they say so in one
-- place instead of being assembled somewhere else out of a map row.
--
-- `= 'any'` rather than auth_can(), on both. auth_can() is `scope <> 'none'` and so
-- admits 'own' — and a transfer has no owner. There is no personal copy of a movement
-- between the family's pots, which is why the map row in §8 sets own_expr to 'false',
-- why scopesFor() already drops the Own button for every `transactions/` key, and why
-- the action uses canAny().
--
-- auth_membership_approved() on both, as every write policy has carried since
-- 20260806000011. auth_permission() already denies a non-approved caller through
-- auth_person_id(), so it is belt and braces — written out rather than assumed, for
-- 20260807000000 §6's reason: a policy dropped and recreated without it quietly
-- re-admits an applicant.
ALTER TABLE public.fund_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perm:fund_transfers:select" ON public.fund_transfers;
CREATE POLICY "perm:fund_transfers:select"
  ON public.fund_transfers FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_permission('transactions/fund-transfers', 'view'::public.permission_action) = 'any'
    AND public.auth_membership_approved()
  );

DROP POLICY IF EXISTS "perm:fund_transfers:insert" ON public.fund_transfers;
CREATE POLICY "perm:fund_transfers:insert"
  ON public.fund_transfers FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    -- Attribution is not the caller's to forge. The trigger in §4 demands a value;
    -- this demands it be theirs.
    AND recorded_by = public.auth_person_id()
    AND public.auth_permission('transactions/fund-transfers', 'create'::public.permission_action) = 'any'
    AND public.auth_membership_approved()
  );

-- No UPDATE and no DELETE policy at all, matching fund_disbursements. §5 is what
-- bounds the service role; this is what bounds the browser.

-- ── 7. Restricted where its sibling is, for every existing family ───────────
-- NOT an unconditional 'restricted'. The other four ledgers inherited whatever
-- `family-finances` said when 20260806000000 re-pointed them, so a family that shares
-- its books with everyone already shares Contributions and Disbursements — and a
-- Transfers tab that alone said "restricted" would look like a decision the family
-- made rather than one this migration made for them.
--
-- Disbursements is the sibling to copy: it is the other movement of money out of a
-- fund, and a family that has narrowed who may see money leaving a pot has already
-- answered this question. Where that row is absent the key falls through to
-- 'everyone', which is what Disbursements does for that family too.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility, updated_at)
SELECT rv.family_code, 'transactions/fund-transfers', rv.visibility, NOW()
  FROM public.resource_visibility rv
 WHERE rv.resource_key = 'transactions/fund-disbursements'
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 7a. Administrators may move money ───────────────────────────────────────
-- The system Administrators template is seeded 'any' on every resource for every
-- family (seed_family_permission_templates()); this extends that standing rule to the
-- key those loops ran too early to see.
--
-- Deliberately ONLY the system template, and NOT "every template that can record a
-- disbursement" — the parallel decision 20260806000010 §3 and 20260812000000 §3a both
-- made. Moving the family's money between its own pots is a different judgement from
-- paying a member what they are owed: it re-decides what the family saved FOR, and it
-- can empty a fund with a minimum balance that dues spent a year filling. An
-- administrator can grant it to any other template from Members & Access.
--
-- FIRST, before the computed default in §7b, because that one is ON CONFLICT DO
-- NOTHING and would otherwise leave Administrators sitting on the computed 'none'.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, 'transactions/fund-transfers', a::public.permission_action, 'any', NOW()
  FROM public.permission_templates t
 CROSS JOIN (VALUES ('view'), ('create')) AS x(a)
 WHERE t.name = 'Administrators' AND t.is_system = true
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 7b. Every other template states the answer rather than falling through ──
-- 20260807000000 §7 materialized every grid so the screen can show the whole answer
-- without explaining a fall-through rule, and notes that a resource registered by a
-- LATER migration is the one case that survives on the default. This writes that
-- default down, computed exactly as auth_permission() would: view follows the
-- family's page visibility (§7), and create fails closed. Behaviour is unchanged by
-- this insert — what changes is that the grid has a row to render.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, 'transactions/fund-transfers', a::public.permission_action,
       CASE
         WHEN a = 'view' AND COALESCE(
                (SELECT rv.visibility FROM public.resource_visibility rv
                  WHERE rv.family_code = t.family_code
                    AND rv.resource_key = 'transactions/fund-transfers'),
                'everyone') = 'everyone'
         THEN 'any'::public.permission_scope
         ELSE 'none'::public.permission_scope
       END
  FROM public.permission_templates t
 CROSS JOIN (VALUES ('view'), ('create')) AS x(a)
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 7c. And nothing carries a grant this resource does not declare ──────────
-- The invariant 20260808000000 §6c asserts. A no-op against a database meeting this
-- key for the first time here; it exists because §3's insert is ON CONFLICT DO UPDATE
-- on `actions` and a future narrowing would otherwise leave orphans behind.
DELETE FROM public.template_permissions tp
 USING public.permission_resources pr
 WHERE tp.resource_key = 'transactions/fund-transfers'
   AND pr.key = tp.resource_key
   AND NOT (tp.action::text = ANY(pr.actions));

-- ── 8. The table map records which key governs this table ───────────────────
-- AGENTS.md §2: "the code and the database must never disagree about who may do
-- what". own_expr and self_expr are both 'false' and both mean it — a movement
-- between the family's pots has no owner and belongs to nobody in particular, which
-- is the same answer permission_table_map already gives for fund_disbursements'
-- own_expr (20260806000000 §6).
--
-- SAFE TO ADD despite the policies above being hand-written, on two counts, and
-- 20260811000000 is the worked precedent for both. 20260618000001's sweep runs
-- earlier in the chain than this file in every database, so it never sees this row;
-- and were it replayed, it skips policies already named `perm:%`, which these are.
-- 20260806000011 §6 selects its sweep targets on `self_expr LIKE '%auth.uid()%'`, so
-- 'false' keeps this table out of that one too — and §6 above has already written the
-- approval conjunct in by hand, which is what that sweep exists to add.
INSERT INTO public.permission_table_map (table_name, resource_key, own_expr, self_expr)
VALUES ('fund_transfers', 'transactions/fund-transfers', 'false', 'false')
ON CONFLICT (table_name) DO UPDATE
  SET resource_key = EXCLUDED.resource_key,
      own_expr     = EXCLUDED.own_expr,
      self_expr    = EXCLUDED.self_expr;

-- self_write_expr defaults to 'false' since 20260806000001, which is the answer this
-- table wants; set explicitly so a future default change cannot silently open it.
UPDATE public.permission_table_map
   SET self_write_expr = 'false'
 WHERE table_name = 'fund_transfers';

-- ── 9. Verify ───────────────────────────────────────────────────────────────
-- Unconditional, and BEHAVIOURAL where it can be. plpgsql does not resolve names in a
-- function body until the body runs, so a trigger asserted only to EXIST is a trigger
-- that may throw for its first real caller — which is exactly what 20260806000012
-- shipped. Both guards are therefore exercised for real, against a throwaway family
-- that is removed before this commits.
DO $mig$
DECLARE
  v_code    CONSTANT text := 'ZZXFER';
  v_other   CONSTANT text := 'ZZXFR2';
  v_bad     int;
  v_from    uuid;
  v_to      uuid;
  v_alien   uuid;
  v_person  uuid;
  v_refused boolean;
  v_balance int;
BEGIN
  -- 9a. The resource, with exactly the two actions something reads.
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE key = 'transactions/fund-transfers'
       AND actions = ARRAY['view','create']::TEXT[]
       AND subsection = 'Transactions'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: transactions/fund-transfers is not registered with actions view+create';
  END IF;

  -- 9b. No two accounting resources share a sort_order — the invariant 20260806000005
  -- established, and the one §3b exists to keep true.
  SELECT COUNT(*) INTO v_bad FROM (
    SELECT sort_order FROM public.permission_resources
     WHERE category = 'accounting' GROUP BY sort_order HAVING COUNT(*) > 1
  ) d;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % duplicate sort_order values in the accounting category', v_bad;
  END IF;

  -- 9c. A family whose administrators cannot reach the ledger at all.
  SELECT COUNT(*) INTO v_bad
    FROM public.permission_templates t
   WHERE t.name = 'Administrators' AND t.is_system = true
     AND NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                      WHERE tp.template_id = t.id
                        AND tp.resource_key = 'transactions/fund-transfers'
                        AND tp.action = 'create' AND tp.scope = 'any');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % Administrators templates cannot record a transfer', v_bad;
  END IF;

  -- 9d. Both policies exist and really do name this key.
  SELECT COUNT(*) INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'fund_transfers'
     AND COALESCE(qual, '') || COALESCE(with_check, '') LIKE '%transactions/fund-transfers%';
  IF v_bad <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 2 policies on fund_transfers naming the resource, found %', v_bad;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'fund_transfers' AND cmd IN ('UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: fund_transfers must have no UPDATE or DELETE policy';
  END IF;

  -- 9e. THE TRIGGERS, FOR REAL.
  --
  -- Two throwaway families, because the guard being tested is precisely the one that
  -- needs a second family to exercise. created_by is left NULL throughout: nothing
  -- here needs a founder, and requiring an auth.users row is what let 20260806000012's
  -- verify block skip itself into a false pass on an empty database.
  INSERT INTO public.families (family_code, family_name) VALUES (v_code,  'Transfer Smoke Test');
  INSERT INTO public.families (family_code, family_name) VALUES (v_other, 'Transfer Smoke Test 2');

  INSERT INTO public.people (family_code, first_name, last_name, is_minor)
  VALUES (v_code, 'Transfer', 'Recorder', false) RETURNING id INTO v_person;

  INSERT INTO public.funds (family_code, name, active) VALUES (v_code,  'Source',      true) RETURNING id INTO v_from;
  INSERT INTO public.funds (family_code, name, active) VALUES (v_code,  'Destination', true) RETURNING id INTO v_to;
  INSERT INTO public.funds (family_code, name, active) VALUES (v_other, 'Elsewhere',   true) RETURNING id INTO v_alien;

  -- Permitted: two funds of the same family. This is what proves every name in both
  -- trigger bodies resolves.
  INSERT INTO public.fund_contributions (fund_id, family_code, amount_cents, source, recorded_by)
  VALUES (v_from, v_code, 100000, 'admin_manual', v_person);

  INSERT INTO public.fund_transfers (family_code, from_fund_id, to_fund_id, amount_cents, reason, recorded_by)
  VALUES (v_code, v_from, v_to, 30000, 'smoke test', v_person);

  -- And the balance helper agrees with the row it just gained, both ways round.
  SELECT public.fund_balance_cents(v_from) INTO v_balance;
  IF v_balance <> 70000 THEN
    RAISE EXCEPTION 'ROLLBACK: source balance is % after a 30000 transfer out of 100000', v_balance;
  END IF;
  SELECT public.fund_balance_cents(v_to) INTO v_balance;
  IF v_balance <> 30000 THEN
    RAISE EXCEPTION 'ROLLBACK: destination balance is % after a 30000 transfer in', v_balance;
  END IF;

  -- Refused: the destination belongs to another family. By the migration role, which
  -- holds every privilege there is — nothing weaker than the trigger can produce this.
  v_refused := false;
  BEGIN
    INSERT INTO public.fund_transfers (family_code, from_fund_id, to_fund_id, amount_cents, reason, recorded_by)
    VALUES (v_code, v_from, v_alien, 100, 'cross-family', v_person);
  EXCEPTION WHEN check_violation THEN
    -- Matched on the message as well as the SQLSTATE: 23514 is also what the CHECK
    -- constraints on this table raise, and a verify block that cannot tell those apart
    -- is one that passes for the wrong reason.
    v_refused := (SQLERRM LIKE '%both funds must belong to family%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: fund_transfers_same_family admitted another family''s fund';
  END IF;

  -- Refused: no recorder.
  v_refused := false;
  BEGIN
    INSERT INTO public.fund_transfers (family_code, from_fund_id, to_fund_id, amount_cents, reason)
    VALUES (v_code, v_from, v_to, 100, 'unattributed');
  EXCEPTION WHEN not_null_violation THEN
    v_refused := true;
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: fund_transfers accepted a transfer naming nobody who made it';
  END IF;

  -- Refused: deleting one.
  v_refused := false;
  BEGIN
    DELETE FROM public.fund_transfers WHERE family_code = v_code;
  EXCEPTION WHEN insufficient_privilege THEN
    v_refused := (SQLERRM LIKE '%append-only%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: fund_transfers is not append-only';
  END IF;

  -- Cleanup. ORDER IS LOAD-BEARING and it is 20260812000000 §6f's: the `families` row
  -- goes FIRST, because funds_protect_system() refuses to delete the Donations fund
  -- its own trigger created and releases it on exactly one condition — that the
  -- family row is already gone. Deleting the funds then cascades the transfer and the
  -- contribution away, which is the one delete path §5 permits.
  DELETE FROM public.families             WHERE family_code IN (v_code, v_other);
  DELETE FROM public.funds                WHERE family_code IN (v_code, v_other);
  DELETE FROM public.people               WHERE family_code IN (v_code, v_other);
  DELETE FROM public.template_permissions tp
   USING public.permission_templates t
   WHERE tp.template_id = t.id AND t.family_code IN (v_code, v_other);
  DELETE FROM public.permission_templates WHERE family_code IN (v_code, v_other);
  DELETE FROM public.resource_visibility  WHERE family_code IN (v_code, v_other);

  RAISE NOTICE 'fund_transfers verified (same-family guard, attribution, append-only, balance), families % and % removed',
    v_code, v_other;
END $mig$;

COMMIT;
