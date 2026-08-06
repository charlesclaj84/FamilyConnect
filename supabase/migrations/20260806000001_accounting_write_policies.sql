-- ============================================================================
-- Close the browser-side write path into the dues and disbursement ledgers.
--
-- THE HOLE
--   permission_table_map gives dues_payments and fund_disbursements a self_expr of
--   `person_id = public.auth_person_id()`, and _perm_predicate() OR-s self_expr
--   OUTSIDE the permission check (20260618000001). Meanwhile 20260618000003 rewrote
--   the legacy is_admin guard that used to sit in front of it to the literal `true`.
--   Net: "the row is mine" alone satisfies the write policies.
--
--   The anon key and URL are NEXT_PUBLIC, so a signed-in member can POST straight to
--   PostgREST and insert a dues_payments row for themselves at status 'paid' for any
--   amount — no grant, no UI, no server action involved. That is the member attesting
--   their own payment, which is exactly what R1 forbids.
--
-- THE SPLIT: self-READ stays, self-WRITE goes.
--   A member must still see their own payment history and any disbursement paying
--   them, so self_expr is left ALONE and continues to drive the SELECT policies. A new
--   `self_write_expr` column carries the write-side answer, defaulting to a copy of
--   self_expr so every genuinely self-service table (event_rsvp, election_votes,
--   chat_participants, a member's own people row) is untouched, and set to 'false'
--   for these two.
--
-- WHY LONGHAND AND NOT A SWEEP REPLAY
--   20260618000001 skips policies already named 'perm:%', so replaying it is a silent
--   no-op. And the expression SHAPE changes here — the self disjunct disappears
--   entirely — so a textual replace() would leave the hole open. These are rebuilt.
--
-- PROVENANCE IS PART OF THE POLICY
--   The INSERT policy pins source, processor_ref, routed_at and recorded_by. Without
--   that, a grant holder could POST `source='stripe'` with a forged processor_ref and
--   a pre-stamped routed_at — money that never routes into any fund, wearing the
--   attestation of a processor that never saw it. A browser insert is always manual,
--   always unrouted, and always recorded by the caller.
--
-- NOTE ON THE SERVICE ROLE: none of this binds createAdminClient(), which every
-- accounting action uses. That is what 20260806000002's trigger is for. This layer
-- closes the direct-to-PostgREST path only.
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

BEGIN;

-- ── 1. self_write_expr, defaulting to today's behaviour ─────────────────────
ALTER TABLE public.permission_table_map
  ADD COLUMN IF NOT EXISTS self_write_expr TEXT;

UPDATE public.permission_table_map
   SET self_write_expr = self_expr
 WHERE self_write_expr IS NULL;

ALTER TABLE public.permission_table_map
  ALTER COLUMN self_write_expr SET DEFAULT 'false',
  ALTER COLUMN self_write_expr SET NOT NULL;

-- The two ledgers where "it is my row" must not authorize a write.
UPDATE public.permission_table_map
   SET self_write_expr = 'false'
 WHERE table_name IN ('dues_payments', 'fund_disbursements');

-- ── 2. dues_payments: append-only, and only for a recording grant ───────────
-- SELECT is deliberately untouched — it still runs on 'dues' with self_expr, so a
-- member keeps their own history.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'dues_payments'
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.dues_payments', p.policyname);
  END LOOP;
END $$;

-- One INSERT policy accepting EITHER recording key. The dues-vs-donation split cannot
-- live here: permission_table_map.table_name is the PRIMARY KEY, one resource per
-- table, and a donation is a dues_payments row discriminated by dues_schedules.kind.
-- recordPayment() reads that kind from the schedule row (never from the client) and
-- picks the key; this policy is the coarser backstop beneath it.
CREATE POLICY "perm:dues_payments:insert"
  ON public.dues_payments FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    -- Provenance is not the caller's to assert.
    AND source        = 'manual'
    AND processor_ref IS NULL
    AND routed_at     IS NULL
    AND recorded_by   = public.auth_person_id()
    AND (
      public.auth_permission('transactions/dues-payments',     'create'::public.permission_action) = 'any'
      OR public.auth_permission('transactions/donation-payments', 'create'::public.permission_action) = 'any'
    )
  );

-- No UPDATE and no DELETE policy at all: posted payments are immutable to every
-- browser caller. routePaidPayment stamps routed_at through the service role, which
-- does not consult RLS; the trigger in 20260806000002 is what bounds that.

-- ── 3. fund_disbursements: paying money out, never to yourself by 'own' ─────
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'fund_disbursements'
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.fund_disbursements', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "perm:fund_disbursements:insert"
  ON public.fund_disbursements FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_permission('transactions/fund-disbursements', 'create'::public.permission_action) = 'any'
  );

CREATE POLICY "perm:fund_disbursements:delete"
  ON public.fund_disbursements FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_permission('transactions/fund-disbursements', 'delete'::public.permission_action) = 'any'
  );

-- ── 4. Verify ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'dues_payments' AND cmd IN ('UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: dues_payments must have no UPDATE or DELETE policy';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'dues_payments' AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: dues_payments lost its SELECT policy — members cannot see their own history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.permission_table_map
     WHERE table_name IN ('dues_payments', 'fund_disbursements') AND self_write_expr <> 'false'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: self_write_expr not closed on the ledger tables';
  END IF;
END $$;

COMMIT;
