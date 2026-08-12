-- ============================================================================
-- My Summary and Transactions stop sharing a key. `dues` ("Dues Records") retires.
--
-- WHY
--   They are two different screens answering two different questions, and one
--   permission resource sat under both:
--
--     My Summary        what *I* owe and what *I* have paid. Own-only by
--                       construction — getMyDuesSummary() and getMyPaymentHistory()
--                       both filter `.eq('person_id', myPersonId)` in the action,
--                       before RLS is consulted at all.
--     Transactions      what the FAMILY has paid. getAllDuesPayments() has no person
--                       filter and leans entirely on the policy.
--
--   `dues` governed the `dues_payments` SELECT that both of them pass through, so the
--   grid carried a row named for a table rather than for anything on screen, sitting
--   between the two blocks and appearing to belong to each. 20260808000000 gave every
--   rail item its own key; this removes the last one that had no rail item at all.
--
--   THE SPLIT IS ONLY ABOUT WHOSE ROWS, and it always was: every policy below keeps an
--   unconditional `person_id = auth_person_id()` clause, so a member sees their own
--   dues at any scope, including none. That clause is why My Summary was never
--   affected by `dues:view` and is not affected by this migration either. What moves
--   is the answer to "may I see OTHER people's", which is a Transactions question and
--   now lives on the Transactions keys.
--
-- BEHAVIOUR-PRESERVING, and checked rather than assumed. `dues` is category
-- 'accounting', which 20260618000000 does not restrict, so `dues:view` resolves to
-- 'any' for every template that does not state otherwise — and 20260807000000 §7
-- materialized exactly that onto General. 20260808000000 then backfilled
-- `transactions/*:view` from `transactions:view`, which is 'any' on the same
-- templates for the same reason. Same scope, same callers, different key.
--
-- WHY THE RESOURCE CANNOT SIMPLY BE DELETED
--   Deleting a resource does not rewrite the policies that name it — it changes what
--   auth_permission() RETURNS for the key. For 'view' that is 'any' (the default for a
--   key with no resource_visibility row), so dropping `dues` on its own would turn
--   both tables' SELECT policies into tautologies and publish every member's payment
--   history and payment plan to the whole family. 20260806000006 documents the same
--   trap and had to rebuild person_relationships before it could delete family-tree.
--   So the policies are rewritten FIRST, in §1 and §2, and the resource goes in §3.
--
-- IDEMPOTENT. Policies are dropped by name and recreated; the deletes are unfiltered
-- by state. Safe on an empty database, where the tables exist and hold no rows.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. dues_payments SELECT moves to the ledger keys ────────────────────────
-- Two permissive SELECT policies are collapsed into one. They were OR-ed anyway —
-- "perm:family can view dues payments" and "perm:admins can manage dues payments:select"
-- differ only by a `true` conjunct that 20260618000001 composed from an empty
-- self_expr — so one policy says the same thing and says it once.
--
-- EITHER ledger grant admits the row, rather than each grant admitting only its own
-- kind. dues_payments holds both kinds, split by dues_schedules.kind, and a policy
-- cannot ask that question here: dues_schedules is itself mapped to `admin/account`,
-- so a subquery against it evaluates under the CALLER's RLS and returns nothing for
-- anyone without an Accounting grant — the policy would then quietly file every
-- donation as a due. (That is TODO item 1, and this migration deliberately does not
-- try to fix it sideways.) The kind-level split is done where it can be done
-- correctly, in the page, which drops the rows for a ledger the caller cannot see
-- before they reach the browser.
--
-- 'any', not `<> 'none'`: components/admin/resource-groups.ts drops the 'own' button
-- for every `transactions/` key, because these ledgers have no coherent per-row owner
-- to scope to. Matching the INSERT policy 20260806000003 wrote, for the same reason.
DROP POLICY IF EXISTS "perm:family can view dues payments"        ON public.dues_payments;
DROP POLICY IF EXISTS "perm:admins can manage dues payments:select" ON public.dues_payments;
DROP POLICY IF EXISTS "perm:dues_payments:select"                 ON public.dues_payments;

CREATE POLICY "perm:dues_payments:select"
  ON public.dues_payments FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND (
      -- Always your own. This is the clause that makes My Summary independent of
      -- every grant below it, and it must not be removed.
      person_id = public.auth_person_id()
      OR public.auth_permission('transactions/dues-payments',     'view'::public.permission_action) = 'any'
      OR public.auth_permission('transactions/donation-payments', 'view'::public.permission_action) = 'any'
    )
  );

-- No UPDATE or DELETE policy is rebuilt because none exists: 20260806000002 made the
-- ledger append-only and 20260806000001 removed them. INSERT already names the
-- transactions/* keys. After this, nothing on dues_payments mentions `dues`.

-- ── 2. dues_member_plans becomes self-service ───────────────────────────────
-- A payment plan is a member's own answer to "how do I want to pay this" — cadence,
-- and whether they have declined an optional due. Every read and every write of this
-- table in the entire app is `.eq('person_id', myPersonId)`: getMyDuesSummary,
-- setMyDuesPlan and setMyDuesOptOut, all of them the member acting on their own row.
-- Nothing reads another member's plan and no screen offers to.
--
-- So the permission disjunct governed nothing reachable, and what it DID do was leave
-- a family's payment plans readable through PostgREST by any member holding
-- `dues:view` — which is every member, since the key defaults to 'any'. Removing it is
-- a narrowing, and the shape 20260806000006 used for person_relationships when it
-- faced the same question.
--
-- `auth_person_id()` is the whole check because it already carries both halves: it
-- resolves the caller's person row IN THE ACTIVE FAMILY, and since 20260806000011 it
-- returns NULL unless that membership is approved. A pending, rejected or disabled
-- caller therefore matches no row here — the conjunct 20260806000011 §6 swept on is
-- preserved by construction rather than repeated.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'dues_member_plans'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.dues_member_plans', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "members read their own dues plan"
  ON public.dues_member_plans FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code() AND person_id = public.auth_person_id());

CREATE POLICY "members create their own dues plan"
  ON public.dues_member_plans FOR INSERT TO authenticated
  WITH CHECK (family_code = public.auth_family_code() AND person_id = public.auth_person_id());

CREATE POLICY "members update their own dues plan"
  ON public.dues_member_plans FOR UPDATE TO authenticated
  USING      (family_code = public.auth_family_code() AND person_id = public.auth_person_id())
  WITH CHECK (family_code = public.auth_family_code() AND person_id = public.auth_person_id());

CREATE POLICY "members delete their own dues plan"
  ON public.dues_member_plans FOR DELETE TO authenticated
  USING (family_code = public.auth_family_code() AND person_id = public.auth_person_id());

-- ── 3. The resource retires ─────────────────────────────────────────────────
-- The map rows go first and explicitly. permission_table_map.resource_key is ON DELETE
-- CASCADE, so the DELETE below would take them anyway — but a table left in that map
-- pointing at a key that no longer exists is what a future RLS sweep would re-compose
-- a policy from, and these two tables now own their rules longhand.
DELETE FROM public.permission_table_map
 WHERE table_name IN ('dues_payments', 'dues_member_plans');

-- Cascades template_permissions and resource_visibility for the key. Those grants
-- decide nothing now, and a switch on a screen that changes no behaviour is worse than
-- no switch: it reads as a control being honoured.
DELETE FROM public.permission_resources WHERE key = 'dues';

-- ── 4. Verify ───────────────────────────────────────────────────────────────
-- Unconditional. Everything asserted is schema or policy text, so none of it needs a
-- fixture and none of it can be skipped into a false pass.
DO $$
DECLARE v_bad int; v_names text;
BEGIN
  -- 4a. The resource and its map rows are gone.
  IF EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'dues') THEN
    RAISE EXCEPTION 'ROLLBACK: the dues resource survived';
  END IF;
  IF EXISTS (SELECT 1 FROM public.permission_table_map
              WHERE table_name IN ('dues_payments', 'dues_member_plans')) THEN
    RAISE EXCEPTION 'ROLLBACK: dues tables are still in permission_table_map';
  END IF;

  -- 4b. NO policy anywhere still evaluates the retired key. This is the assertion the
  -- migration exists to make: a surviving `auth_permission('dues', …)` would now
  -- resolve to 'any' for view and open the table it guards to the whole family.
  --
  -- Matched on the rendered literal `'dues'::text` rather than on the word, because
  -- 'admin/account/dues' and 'transactions/dues-payments' both contain it and both are
  -- live keys that must NOT match.
  SELECT count(*), string_agg(tablename || '.' || policyname, ', ')
    INTO v_bad, v_names
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '') LIKE '%auth_permission(''dues''::text%'
       OR COALESCE(with_check, '') LIKE '%auth_permission(''dues''::text%');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % policy(ies) still evaluate the retired dues key: %', v_bad, v_names;
  END IF;

  -- 4c. dues_payments SELECT names both ledger keys and keeps the self clause. Losing
  -- the self clause is the failure that would empty My Summary for every member who
  -- holds neither ledger grant, which is most of a family.
  SELECT count(*) INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'dues_payments' AND cmd = 'SELECT'
     AND qual LIKE '%transactions/dues-payments%'
     AND qual LIKE '%transactions/donation-payments%'
     AND qual LIKE '%auth_person_id()%';
  IF v_bad <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 1 dues_payments SELECT policy naming both ledgers and the self clause, found %', v_bad;
  END IF;

  -- 4d. dues_member_plans is self-service on all four commands, and mentions no
  -- permission resource at all.
  SELECT count(*) INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'dues_member_plans';
  IF v_bad <> 4 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 4 policies on dues_member_plans, found %', v_bad;
  END IF;

  SELECT count(*) INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'dues_member_plans'
     AND (COALESCE(qual, '') LIKE '%auth_permission%'
       OR COALESCE(with_check, '') LIKE '%auth_permission%');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % dues_member_plans policy(ies) still consult a permission grant', v_bad;
  END IF;

  -- 4e. And no template still carries a grant for the retired key.
  IF EXISTS (SELECT 1 FROM public.template_permissions WHERE resource_key = 'dues') THEN
    RAISE EXCEPTION 'ROLLBACK: template grants for the dues key were not cascaded';
  END IF;
END $$;

COMMIT;
