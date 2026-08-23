-- ═══════════════════════════════════════════════════════════════════════════════════════
-- A FAMILY MUST ALWAYS HAVE SOMEBODY WHO CAN PAY.
--
-- ── THE HOLE THIS CLOSES, AND IT IS A DEAD END RATHER THAN A LEAK ─────────────────────
-- Decided 2026-08-23, out of the delinquency ladder. Every dunning email goes to whoever holds
-- `admin/settings:edit` — the exact grant that opens the Billing panel and can settle the debt.
-- A family with none of them is in a state nothing can recover:
--
--   day 5    the email is sent to nobody.
--   day 10   members are locked out. The people who could unlock it do not exist.
--   day 30   the only screen left open is one nobody may reach.
--   day 60   the family's records are deleted, irreversibly, in silence.
--
-- Nothing leaks and nothing is exposed. It is a family walking into deletion with no route out,
-- and it is reachable today in three ordinary clicks — move the last administrator onto the
-- General template, or take the grant off the Administrators template, or switch the last
-- administrator off.
--
-- ── WHY A TRIGGER AND NOT JUST A CHECK IN THE ACTION ─────────────────────────────────
-- Both, and the trigger is the boundary. `applyTemplate`, `setTemplatePermission` and
-- `setMemberEnabled` all write through `createAdminClient()`, so there is no policy underneath
-- any of them (AGENTS.md §3) — a check in the action is the only thing standing there, and
-- "the only thing standing there" is precisely what this codebase has learned to put in the
-- database as well. The actions get the readable message; this makes the state unreachable.
--
-- ── IT FIRES ON UPDATE AND NOT ON DELETE, WHICH IS A DELIBERATE NARROWING ────────────
-- The transitions that can remove the last holder in the PRODUCT are all updates: a member
-- moved to another template, a member switched off, or the grant taken off a template. A
-- `people` DELETE is a teardown — `reset_families.sql` removes every member but one, and this
-- product disables members rather than deleting them (`setMemberEnabled`, not a delete).
--
-- Firing on DELETE would therefore break maintenance rather than protect anybody: the reset
-- keeps one account, asserts only that it is approved and on SOME template, and a run where
-- that account happened to be on General would abort the whole script. Measured against that
-- possibility rather than discovered by it.
--
-- **THE GAP THIS LEAVES, STATED:** deleting the last administrator's `people` row directly, in
-- SQL, is not refused. Nothing in the product does that, and a script that does is a person
-- who has decided to. It is the honest boundary rather than a complete one.
--
-- ── AND IT ONLY COMPLAINS WHEN THERE IS SOMEBODY LEFT TO STRAND ──────────────────────
-- `EXISTS (approved member)` is the first conjunct. A family with no approved members has not
-- lost its last administrator — it is being created, or torn down, and raising there would make
-- both impossible. Every family is created by a founder who lands on Administrators, so the
-- invariant holds from the first row rather than needing a grace period.
--
-- IDEMPOTENT. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. Who can pay ────────────────────────────────────────────────────────────────────
--
-- ONE DEFINITION, so the trigger, the actions and any future report cannot disagree about who
-- an "administrator" is for billing purposes. It is deliberately NOT "on the Administrators
-- template" and NOT "holds any admin/* grant": it is the single grant that opens the screen
-- with the Pay button on it, which is the only thing that resolves a delinquency.
--
-- SCOPE MUST BE 'any'. `admin/settings:edit` is resolved with `canAny` by every caller —
-- `requireEdit` is `requireScope(resource, 'edit')`, which is `canAny` — because a family has
-- one settings row and nobody's personal copy of it. A template granting scope `'own'` confers
-- nothing here, so counting it would count somebody who cannot pay.
--
-- AND ABSENCE IS NOT A GRANT. A template with no row for this key falls back to the family's
-- `resource_visibility`, which since 20260817000004 resolves an `admin/` key to `'none'` where
-- there is no row — it fails CLOSED. So counting explicit `'any'` rows is the whole answer and
-- there is no fall-through to chase.
CREATE OR REPLACE FUNCTION public.family_billing_admin_count(p_family_code TEXT)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::int
    FROM public.people p
    JOIN public.template_permissions tp ON tp.template_id = p.permission_template_id
   WHERE p.family_code = p_family_code
     AND p.membership_status = 'approved'
     AND tp.resource_key = 'admin/settings'
     AND tp.action = 'edit'
     AND tp.scope = 'any';
$$;

-- GRANTED TO `authenticated`, unlike every other function in this feature. It reads no row a
-- caller could not already reach — `people` and `template_permissions` are both readable by an
-- approved member through their own policies — and it returns a COUNT, not a roster. The
-- actions call it on the user client to render a readable refusal before attempting a write, so
-- an administrator is told "this is the last person who can pay" instead of meeting a
-- constraint violation logged as "could not save".
GRANT EXECUTE ON FUNCTION public.family_billing_admin_count(TEXT) TO authenticated;

/**
 * Does ONE `people` row contribute to that count?
 *
 * The same two conditions the count applies, factored out so the trigger can ask them of a
 * transition-table row — which is not in `people` any more and so cannot be joined to it. It
 * takes the two columns rather than a row type so the caller can ask about the BEFORE and the
 * AFTER state of the same row, which is the whole mechanism.
 *
 * `template_permissions` is read as it stands NOW, which is correct for the `people` trigger:
 * within one statement on `people`, the grants have not moved.
 */
CREATE OR REPLACE FUNCTION public.person_row_can_bill(
  p_membership_status TEXT,
  p_template_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_membership_status = 'approved'
     AND EXISTS (
       SELECT 1 FROM public.template_permissions tp
        WHERE tp.template_id = p_template_id
          AND tp.resource_key = 'admin/settings'
          AND tp.action = 'edit'
          AND tp.scope = 'any'
     );
$$;

REVOKE ALL ON FUNCTION public.person_row_can_bill(TEXT, UUID) FROM PUBLIC;

-- ── §2. The guard, twice, because the transition tables differ ─────────────────────────
--
-- Statement-level rather than row-level, and that is load-bearing: `applyTemplate` moves one
-- person, but a bulk template change moves many, and a row-level trigger would fire mid-way
-- through and refuse a statement whose FINAL state is perfectly valid. A statement trigger sees
-- the whole change.
--
-- Two functions rather than one, because a transition table is referenced by the alias its
-- CREATE TRIGGER declares and the two triggers watch different tables. One function taking a
-- family code does the actual work.
CREATE OR REPLACE FUNCTION public.assert_family_keeps_a_billing_admin(p_family_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_family_code IS NULL THEN RETURN; END IF;

  -- Nobody left to strand. A family being created or torn down is not a family that has lost
  -- its last administrator.
  IF NOT EXISTS (
    SELECT 1 FROM public.people
     WHERE family_code = p_family_code AND membership_status = 'approved'
  ) THEN
    RETURN;
  END IF;

  IF public.family_billing_admin_count(p_family_code) = 0 THEN
    RAISE EXCEPTION
      'family % would have nobody able to manage its plan or pay for it. Give somebody else '
      'admin/settings:edit first.', p_family_code
      USING ERRCODE = '23514';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.assert_family_keeps_a_billing_admin(TEXT) FROM PUBLIC;

-- ── IT REFUSES A STATEMENT THAT *TAKES THE LAST HOLDER AWAY*, NOT ONE THAT LEAVES ─────
--     A FAMILY WITHOUT ONE. That distinction is the whole design, and getting it wrong
--     produced a bug worth recording.
--
-- The obvious rule — "after this statement, the family must have an administrator" — is wrong
-- in a way that only shows up on a family that is ALREADY without one: every subsequent write
-- to a template in that family also leaves it without one, so every write is refused and **the
-- family can never be repaired.** Granting the missing permission is itself a template write.
--
-- Measured rather than reasoned: `tests/rls` seeds each family's Administrators grants and only
-- then moves the administrator onto that template, so the grant UPSERT lands in a family whose
-- count is still zero. The first version refused it — refusing the very statement that was on
-- its way to fixing things.
--
-- So the trigger asks a narrower question: **did a row that WAS contributing stop
-- contributing?** Only then is the family's count consulted. Everything that ADDS is invisible
-- to it, which is what keeps a broken family repairable, and everything that takes away is
-- caught.
--
-- For `people` a row was contributing if it was approved AND on a template granting the key at
-- 'any'; it stops if either half goes. That covers `applyTemplate` (the template moved) and
-- `setMemberEnabled`/a rejection (approval lost), and it skips:
--
--   BECOMING approved            can only ever ADD to the count.
--   a profile save, an avatar,   touches neither half, so the check never runs — a correctness
--   `saveChapterAndPropagate`    improvement before it is a performance one.
--
-- BOTH transition tables, OLD and NEW, joined on id: a trigger with only OLD rows cannot tell
-- an approval from a rejection, which is exactly the distinction being drawn.
CREATE OR REPLACE FUNCTION public.tg_people_keeps_a_billing_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_family TEXT;
BEGIN
  FOR v_family IN
    SELECT DISTINCT n.family_code
      FROM people_after n
      JOIN people_before o ON o.id = n.id
     WHERE public.person_row_can_bill(o.membership_status, o.permission_template_id)
       AND NOT public.person_row_can_bill(n.membership_status, n.permission_template_id)
  LOOP
    PERFORM public.assert_family_keeps_a_billing_admin(v_family);
  END LOOP;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.tg_people_keeps_a_billing_admin() FROM PUBLIC;

DROP TRIGGER IF EXISTS people_keeps_a_billing_admin ON public.people;
CREATE TRIGGER people_keeps_a_billing_admin
  AFTER UPDATE ON public.people
  REFERENCING OLD TABLE AS people_before NEW TABLE AS people_after
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_people_keeps_a_billing_admin();

-- The template side of the same question. A row was contributing if it granted this exact key
-- at 'any'; the DELETE case is unconditional on the OLD row alone (a deleted grant is always a
-- removal), and the UPDATE case has to compare, because an upsert writing 'none' -> 'any' is an
-- ADDITION and must not be checked.
--
-- The family comes from the TEMPLATE, because `template_permissions` has no `family_code` of its
-- own. A template belongs to one family, so the join is exact.
CREATE OR REPLACE FUNCTION public.tg_template_perms_deleted_keeps_a_billing_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_family TEXT;
BEGIN
  FOR v_family IN
    SELECT DISTINCT t.family_code
      FROM perms_before o
      JOIN public.permission_templates t ON t.id = o.template_id
     WHERE o.resource_key = 'admin/settings' AND o.action = 'edit' AND o.scope = 'any'
  LOOP
    PERFORM public.assert_family_keeps_a_billing_admin(v_family);
  END LOOP;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.tg_template_perms_deleted_keeps_a_billing_admin() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tg_template_perms_updated_keeps_a_billing_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_family TEXT;
BEGIN
  -- JOINED ON THE COMPOSITE PRIMARY KEY, because this table has no `id`:
  -- `(template_id, resource_key, action)` is the key, and `scope` is the only column
  -- `setTemplatePermission` ever writes. That makes the comparison simpler than it looks —
  -- the key columns cannot move, so "was this row the grant, and is it still 'any'?" is the
  -- whole predicate.
  FOR v_family IN
    SELECT DISTINCT t.family_code
      FROM perms_after n
      JOIN perms_before o
        ON o.template_id = n.template_id
       AND o.resource_key = n.resource_key
       AND o.action = n.action
      JOIN public.permission_templates t ON t.id = n.template_id
     WHERE o.resource_key = 'admin/settings' AND o.action = 'edit'
       AND o.scope = 'any' AND n.scope <> 'any'
  LOOP
    PERFORM public.assert_family_keeps_a_billing_admin(v_family);
  END LOOP;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.tg_template_perms_updated_keeps_a_billing_admin() FROM PUBLIC;

-- ── TWO TRIGGERS FOR ONE FUNCTION, AND POSTGRES INSISTS ────────────────────────────────
-- `AFTER UPDATE OR DELETE … REFERENCING OLD TABLE` is refused outright: *"transition tables
-- cannot be specified for triggers with more than one event."* Measured here on the first run.
-- So the two events get a trigger each, both naming the same transition table alias and calling
-- the same function — which is why that function exists separately rather than inline.
--
-- BOTH ARE NEEDED. Taking the grant away is an UPDATE (`setTemplatePermission` writes
-- `scope = 'none'`) and removing the row is a DELETE, and a family loses its last administrator
-- either way. Covering one and not the other would leave a hole shaped exactly like whichever
-- path somebody happened not to test.
DROP TRIGGER IF EXISTS template_perms_update_keeps_a_billing_admin ON public.template_permissions;
CREATE TRIGGER template_perms_update_keeps_a_billing_admin
  AFTER UPDATE ON public.template_permissions
  REFERENCING OLD TABLE AS perms_before NEW TABLE AS perms_after
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.tg_template_perms_updated_keeps_a_billing_admin();

DROP TRIGGER IF EXISTS template_perms_delete_keeps_a_billing_admin ON public.template_permissions;
CREATE TRIGGER template_perms_delete_keeps_a_billing_admin
  AFTER DELETE ON public.template_permissions
  REFERENCING OLD TABLE AS perms_before
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.tg_template_perms_deleted_keeps_a_billing_admin();

-- ── §3. VERIFY ─────────────────────────────────────────────────────────────────────────
--
-- ASSERTED BY DOING IT, not by reading the catalogue. A trigger that exists and does not bite
-- is the failure mode AGENTS.md records twice, and here the consequence of a silent one is a
-- family deleted for non-payment with nobody who could have paid.
DO $mig$
DECLARE
  v_fam TEXT := 'ZZADMIN1';
  v_admin_tpl UUID;
  v_plain_tpl UUID;
  v_p1 UUID;
  v_p2 UUID;
  v_n INT;
BEGIN
  -- Both triggers exist and are statement-level with a transition table.
  SELECT count(*) INTO v_n FROM pg_trigger
   WHERE NOT tgisinternal
     AND tgname IN ('people_keeps_a_billing_admin',
                    'template_perms_update_keeps_a_billing_admin',
                    'template_perms_delete_keeps_a_billing_admin');
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'expected 3 billing-admin triggers, found %', v_n;
  END IF;

  -- ── A throwaway family with two members: one who can pay, one who cannot ────────────
  INSERT INTO public.families (family_code, family_name) VALUES (v_fam, 'ZZ Admin Probe');

  INSERT INTO public.permission_templates (family_code, name, is_system)
  VALUES (v_fam, 'ZZ Admins', false) RETURNING id INTO v_admin_tpl;
  INSERT INTO public.permission_templates (family_code, name, is_system)
  VALUES (v_fam, 'ZZ Members', false) RETURNING id INTO v_plain_tpl;

  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  VALUES (v_admin_tpl, 'admin/settings', 'edit', 'any');
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  VALUES (v_plain_tpl, 'admin/settings', 'edit', 'none');

  INSERT INTO public.people (family_code, first_name, last_name, primary_email, permission_template_id)
  VALUES (v_fam, 'Abe', 'Admin', 'zzadmin1-a@example.com', v_admin_tpl) RETURNING id INTO v_p1;
  INSERT INTO public.people (family_code, first_name, last_name, primary_email, permission_template_id)
  VALUES (v_fam, 'Mo', 'Member', 'zzadmin1-m@example.com', v_plain_tpl) RETURNING id INTO v_p2;

  UPDATE public.people SET membership_status = 'approved' WHERE family_code = v_fam;

  IF public.family_billing_admin_count(v_fam) <> 1 THEN
    RAISE EXCEPTION 'probe setup wrong: expected 1 billing admin, got %',
      public.family_billing_admin_count(v_fam);
  END IF;

  -- 1. Moving the ONLY administrator onto a template without the grant is refused.
  BEGIN
    UPDATE public.people SET permission_template_id = v_plain_tpl WHERE id = v_p1;
    RAISE EXCEPTION 'the last billing administrator was moved off the grant';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- 2. Switching the only administrator off is refused.
  BEGIN
    UPDATE public.people SET membership_status = 'disabled' WHERE id = v_p1;
    RAISE EXCEPTION 'the last billing administrator was disabled';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- 3. Taking the grant off the template is refused.
  BEGIN
    UPDATE public.template_permissions SET scope = 'none'
     WHERE template_id = v_admin_tpl AND resource_key = 'admin/settings' AND action = 'edit';
    RAISE EXCEPTION 'the grant was removed from the last template that carried it';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- 4. Deleting the grant row is refused too — the other half of the same statement type.
  BEGIN
    DELETE FROM public.template_permissions
     WHERE template_id = v_admin_tpl AND resource_key = 'admin/settings' AND action = 'edit';
    RAISE EXCEPTION 'the grant row was deleted from the last template that carried it';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- 5. AND THE POSITIVE CONTROL, which is the half that stops this being decoration: with a
  --    SECOND administrator in place, every one of those moves is allowed. A trigger that
  --    refused unconditionally would pass all four assertions above.
  UPDATE public.people SET permission_template_id = v_admin_tpl WHERE id = v_p2;
  IF public.family_billing_admin_count(v_fam) <> 2 THEN
    RAISE EXCEPTION 'control setup wrong: expected 2 billing admins, got %',
      public.family_billing_admin_count(v_fam);
  END IF;
  UPDATE public.people SET membership_status = 'disabled' WHERE id = v_p1;
  IF public.family_billing_admin_count(v_fam) <> 1 THEN
    RAISE EXCEPTION 'the control did not take effect';
  END IF;

  -- 6. A family with no approved members at all is left alone, so a teardown still works.
  UPDATE public.people SET membership_status = 'disabled' WHERE family_code = v_fam;
  IF public.family_billing_admin_count(v_fam) <> 0 THEN
    RAISE EXCEPTION 'expected no billing admins after disabling everybody';
  END IF;

  -- 7. APPROVING SOMEBODY IS NEVER REFUSED, even in a family with no administrator at all.
  --    Approval can only ADD to the count, and checking it would make a bulk approve depend on
  --    the order a fixture happens to do things in — which is how `tests/rls` first went red.
  UPDATE public.people SET permission_template_id = v_plain_tpl WHERE family_code = v_fam;
  UPDATE public.people SET membership_status = 'approved' WHERE family_code = v_fam;
  IF public.family_billing_admin_count(v_fam) <> 0 THEN
    RAISE EXCEPTION 'probe 7 setup wrong: expected a family with approved members and no admin';
  END IF;

  -- 8. AND AN ADMINLESS FAMILY CAN BE REPAIRED, which is the assertion that matters most and
  --    the one the first version of this trigger failed. Granting the permission is itself a
  --    template write; a trigger that refused every statement leaving the family without an
  --    administrator would refuse the statement fixing it, and the family would be stuck
  --    forever. Both halves of the repair are exercised — the grant, then the assignment.
  UPDATE public.template_permissions SET scope = 'any'
   WHERE template_id = v_plain_tpl AND resource_key = 'admin/settings' AND action = 'edit';
  UPDATE public.people SET permission_template_id = v_plain_tpl WHERE id = v_p1;
  IF public.family_billing_admin_count(v_fam) = 0 THEN
    RAISE EXCEPTION 'an adminless family could not be repaired';
  END IF;

  RAISE NOTICE 'billing admin invariant: 4 refusals, 1 control, approve/teardown/repair all allowed.';

  -- Roll the probe back and nothing else. The sentinel is compared by MESSAGE so a real
  -- failure above is not swallowed by this handler.
  RAISE EXCEPTION 'ZZ_ROLLBACK_PROBE';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM <> 'ZZ_ROLLBACK_PROBE' THEN RAISE; END IF;
END $mig$;

COMMIT;
