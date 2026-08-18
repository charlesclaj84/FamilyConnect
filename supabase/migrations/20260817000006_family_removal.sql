-- ============================================================================
-- A family can be removed. Nothing is destroyed.
--
-- ── WHAT "REMOVED" MEANS, AND WHAT IT DELIBERATELY DOES NOT ─────────────────
-- 20260812000000 shipped renaming and recorded why deleting was not in it:
-- nothing has a foreign key to `families`, and 34 tables carry `family_code`, so
-- a DELETE removes one row and leaves every dues payment, fund, chat room and
-- member behind, belonging to a family that no longer exists. That is still true
-- and this migration does not change it. Removal here is a STATE on the family
-- row. No row is deleted anywhere, by this file or by anything it enables.
--
-- Two consequences that are not merely conservatism:
--
--   * `gen_family_code()`'s uniqueness loop reads `families`. Delete the row and
--     the code becomes re-issuable — so a stranger who wrote down a family's code
--     could one day type it and land in somebody else's family.
--   * `funds_protect_system()` releases a system fund for deletion on exactly one
--     condition: that the `families` row is already gone. Deleting the family
--     first is what makes the rest of a purge possible, and it is therefore the
--     LAST thing a reversible operation may do.
--
-- Restoration is what makes all of this safe to offer, and restoration is NOT in
-- the member-facing product — see §7 and 20260817000005. A family that can
-- un-remove itself has not been removed.
--
-- ── WHY A STATUS COLUMN AND NOT A NULLABLE TIMESTAMP ────────────────────────
-- `removed_at IS NULL` would have carried the same information in one column, and
-- it is the wrong shape for the same reason `membership_status` is not a pair of
-- booleans. A status column has a CHECK, so the vocabulary is stated once and the
-- database refuses a typo; and — the half that matters — every gate written
-- against it tests POSITIVELY for `status = 'active'`.
--
-- That discipline is what let `'disabled'` join `membership_status` without a
-- sweep (AGENTS.md §6b): every gate in the app and every policy in the database
-- already asked whether the caller was `'approved'`, so a fourth value was denied
-- by all of them on arrival. A codebase written around `<> 'removed'` admits the
-- fifth state by default, silently, in whichever gate was written first.
--
-- SO: never `<> 'removed'`, never `removed_at IS NULL`. If a third status ever
-- arrives — `'suspended'`, say — it must be refused everywhere until somebody
-- deliberately admits it. Every conjunct this file adds is written that way, and
-- the two places that cannot say `= 'active'` outright say
-- `COALESCE(f.status, 'active') = 'active'` for a stated reason (§6c).
--
-- ── THE REMOVAL TEST IS NOT IN auth_family_code(), DELIBERATELY ─────────────
-- That resolver is the obvious place and it is the one place it must not go. It is
-- `LIMIT 1` over an `ORDER BY`, so a conjunct there does not HIDE a removed family
-- — it SKIPS to the next one. A member of two families whose active selection was
-- removed would silently start acting in the other, and `lib/auth/family.ts`
-- promises the TypeScript resolver mirrors this function exactly while
-- `resolveActiveCode` has no skip of its own. The app and RLS would then disagree
-- about which family the caller is in, which is the one disagreement in this
-- schema that cannot be reasoned about from either side.
--
-- Enforcement is therefore APP-LAYER — a notice screen, in the family the member
-- actually selected — plus the specific doors in §6, each of which admits somebody
-- to a family and so has to refuse a removed one on its own account.
--
-- ── THE GUARD IS WHAT MAKES THE EMAILED CODE MEAN ANYTHING ──────────────────
-- This is the load-bearing half of §1 and §2 together, and it was not in the first
-- reading of the design.
--
-- `families` has carried an UPDATE policy since 20260812000000 that admits an
-- administrator holding `admin/family:edit = 'any'` to their own family's row. A
-- policy has no opinion about WHICH column changed. So without §2:
--
--     PATCH /rest/v1/families?family_code=eq.MINE   {"status": "removed"}
--
-- removes the family from devtools, with the rename grant, past the new
-- `admin/family/remove` grant, past the emailed confirmation code, past everything
-- this feature is. The code would be a dialog, not a gate. That is the identical
-- shape as `families_guard_tier` (20260813000003) and
-- `people_guard_permission_template` (20260807000000) — the fourth time this
-- schema has needed a guard around the role the browser speaks as rather than
-- around a column — and it is written the same way each time.
--
-- So removal and restoration both go through the SERVICE ROLE: the server action
-- verifies and consumes the code, then writes. §7's RPC is the staff half of the
-- same rule.
--
-- ── THE CODE LIVES IN ITS OWN TABLE, NEVER ON `families` ────────────────────
-- `families` is readable through PostgREST by every member of the family (the
-- SELECT policy is `family_code = auth_family_code()`), so a `removal_code` column
-- there would be a confirmation code the whole family can read with the anon key
-- and their own session. §3's table has RLS enabled and NO policy, which means the
-- browser cannot read it at all — and only the SHA-256 of the code is stored, so a
-- dump of the table cannot be used to confirm anything either. That is
-- `create_family_invitation`'s rule, applied to a shorter secret that needs it
-- more.
--
-- ── `families` NOW HAS TWO FOREIGN KEYS TO `people`. THIS IS AGENTS.md §8 ───
-- `removed_by` joins `bloodline_anchor_id`, which already points at `people(id)`.
-- PostgREST answers **PGRST201** for an ambiguous embed and supabase-js DISCARDS
-- the error, so the symptom is `[]` and a page that says "nothing here" over data
-- that exists.
--
-- Checked before writing this: nothing in `app/`, `lib/`, `components/` or
-- `tests/` embeds `people(...)` on a `families` query or `families(...)` on a
-- `people` query — every `.from('families')` in the tree selects scalar columns.
-- So nothing breaks today. From now on any such embed MUST name its constraint:
--
--     .select('*, people!families_removed_by_fkey(first_name, last_name)')
--     .select('*, people!families_bloodline_anchor_id_fkey(first_name, last_name)')
--
-- ── FIVE DOORS, ONE MESSAGE FOR A STRANGER ─────────────────────────────────
-- §6 changes four functions and records a decision about the fifth. The rule they
-- share is `redeem_family_invitation`'s: a caller who is not yet in the family is
-- told ONE thing for every way the way in can be unusable, because distinguishing
-- "this family was removed" from "there is no such family" turns the door into an
-- oracle a guesser can walk. A family code is six characters from a 30-letter
-- alphabet and is meant to be shared; "no such family" is already the answer to
-- 729 million of them and a removed family must not be the one that answers
-- differently.
--
-- ── WHAT IS NOT HERE ───────────────────────────────────────────────────────
-- The RPCs that MINT and CONSUME a challenge code. §3 creates the state they need
-- and the contract they must honour is written on the table's comments; the
-- functions themselves arrive with the server actions that call them, because the
-- code must be generated, mailed and verified in one place and the mailing is not
-- something SQL does. Two constraints on whoever writes them, both from AGENTS.md:
-- generate with rejection sampling over `extensions.gen_random_bytes` —
-- SCHEMA-QUALIFIED as `extensions.`, because every function here pins
-- `search_path = ''` and 20260806000012 shipped `public.gen_random_bytes` and
-- applied cleanly — and never `random()`, which is seeded per session and is not a
-- cryptographic source.
--
-- IDEMPOTENT. Columns and tables are IF NOT EXISTS, the constraint is guarded,
-- every backfill is ON CONFLICT DO NOTHING, functions and triggers are replaced,
-- and the verify block removes everything it creates. Safe on an empty database,
-- where the backfills find no families and only the resource row is written.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand,
--   which records nothing and can replay this file out of order. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The three columns ────────────────────────────────────────────────────
-- NOT NULL DEFAULT 'active': every family that exists is active, which is true,
-- and it is what a new family gets without `create_family()` having to say so.
--
-- The CHECK is the vocabulary. Adding a third status means editing it, and it is
-- what will refuse the write from whoever forgets — the same job
-- `families_tier_check` does for `lib/tiers.ts`.
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

-- REFERENCES people(id), NOT auth.users(id). Two reasons, and the first is the one
-- that decided it: `families` already has `created_by → auth.users`, and a second
-- foreign key into `auth` from a table in `public` is one more edge that a user
-- deletion has to be reasoned about across. The person who removed a family is a
-- MEMBER of that family — a `people` row is what the approvals queue, the
-- notification bell and every audit column in this schema already mean by "who
-- did this" — so this points where the rest of the schema points.
--
-- ON DELETE SET NULL, matching `bloodline_anchor_id`, `invited_by` and
-- `accepted_by`: losing the actor must never delete the record of the act.
--
-- NULLABLE, and it stays NULL for a removal performed by GENORRA staff through
-- §7 — a staff member has no `people` row in the family they are acting on, and
-- inventing one would be worse than an honest absence. The staff console's own
-- record is where to look for that half.
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES public.people(id) ON DELETE SET NULL;

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.families'::regclass AND conname = 'families_status_check'
  ) THEN
    ALTER TABLE public.families
      ADD CONSTRAINT families_status_check CHECK (status IN ('active', 'removed'));
  END IF;
END $mig$;

COMMENT ON COLUMN public.families.status IS
  'active | removed. A removed family is DISABLED, never deleted — no row is destroyed '
  'anywhere, and restoring one is public.staff_set_family_status() from the GENORRA staff '
  'console. EVERY GATE TESTS POSITIVELY FOR ''active'': never `<> ''removed''`, never '
  '`removed_at IS NULL`, so a status added later is refused everywhere until somebody '
  'deliberately admits it (AGENTS.md §6b). Deliberately NOT consulted by '
  'auth_family_code(), which is LIMIT 1 over an ORDER BY and would skip rather than hide. '
  'Written by the service role only; families_guard_removal refuses the authenticated '
  'role. Added 20260817000006.';

COMMENT ON COLUMN public.families.removed_at IS
  'When the family was removed. A RECORD, not the state — read families.status for that. '
  'Cleared on restore.';

COMMENT ON COLUMN public.families.removed_by IS
  'The people.id that removed the family, or NULL when GENORRA staff did it (they have no '
  'people row in that family). ON DELETE SET NULL: losing the actor must not delete the '
  'record of the act. NOTE that families now has TWO foreign keys to people — this and '
  'bloodline_anchor_id — so any PostgREST embed of people on families must name its '
  'constraint or answer PGRST201, which supabase-js discards as [] (AGENTS.md §8).';

-- ── 2. The guard ────────────────────────────────────────────────────────────
-- Refuses a change to any of the three columns made by the `authenticated` role,
-- and says nothing about the service role. The boundary is around the ROLE THE
-- BROWSER SPEAKS AS, not around the column — the same shape as
-- `families_guard_tier` and `people_guard_permission_template`, and for the same
-- reason: `tests/rls` and the server actions both need service-role writes to
-- guarded columns, and forbidding those would forbid the feature.
--
-- ALL THREE COLUMNS, not just `status`. `removed_at` and `removed_by` are the
-- record of the removal, and a record an administrator can rewrite from devtools
-- is not one. This is also why they are tested with IS DISTINCT FROM rather than
-- being ignored: a PATCH that sets `removed_by` to somebody else while leaving
-- `status` alone is a false accusation with no other symptom.
--
-- `SET search_path = ''` and every reference schema-qualified — plpgsql resolves
-- names when the body RUNS, so a bad reference here would apply cleanly and throw
-- for the first administrator who renamed their family. §8 fires it for real
-- rather than asserting it exists.
CREATE OR REPLACE FUNCTION public.families_guard_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (NEW.status     IS DISTINCT FROM OLD.status
      OR NEW.removed_at IS DISTINCT FROM OLD.removed_at
      OR NEW.removed_by IS DISTINCT FROM OLD.removed_by)
     AND COALESCE(
           (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role',
           ''
         ) = 'authenticated'
  THEN
    RAISE EXCEPTION
      'families.status is set by removing or restoring a family, not by an update from the application'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS families_guard_removal ON public.families;
CREATE TRIGGER families_guard_removal
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.families_guard_removal();

-- No GRANT. A trigger function's EXECUTE is checked at CREATE TRIGGER time, not at
-- fire time (AGENTS.md §2b), so granting it would only make it directly callable —
-- which for a function returning a trigger record is meaningless at best.

-- ── 3. The emailed confirmation code ────────────────────────────────────────
-- One row per code request. See the header for why this is a table rather than a
-- column on `families`: that table is readable by every member of the family
-- through PostgREST, so a code on it is a code the family can read.
CREATE TABLE IF NOT EXISTS public.family_removal_challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No foreign key to `families`, matching every other family-scoped table in this
  -- schema — `family_code` is the join key and nothing has an FK back to it. It is
  -- also what puts this table inside `audit_global_lookups.sql`'s reachable set, so
  -- an empty one is never mistaken for a purged lookup.
  family_code  TEXT NOT NULL,
  -- WHO ASKED, and therefore who the code was mailed to. Half of the pair a
  -- verification must resolve on (see below); the other half is family_code.
  requested_by UUID REFERENCES public.people(id) ON DELETE SET NULL,
  -- SHA-256 hex of the six digits. The code itself is never stored, for
  -- `family_invitations.token_hash`'s reason: a dump of this table must not be
  -- usable to confirm a removal.
  --
  -- DELIBERATELY NOT UNIQUE, and this is the one place copying
  -- `family_invitations` would be a bug. That column is a 32-byte token, where a
  -- collision means somebody has broken something; six digits is a space of a
  -- million, so two families holding the same live code is ordinary — and a UNIQUE
  -- index here would REFUSE a legitimate request because an unrelated family
  -- happened to be issued the same digits.
  code_hash    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  -- Counted up by the verification, never reset. A refused attempt is a record.
  attempts     INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  -- Stamped when the code is spent, whether or not the removal that spent it
  -- succeeded. Single use means single use.
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS family_removal_challenges_family_idx
  ON public.family_removal_challenges (family_code);

-- The lookup a verification makes: the newest unspent challenge for this family and
-- this person. Partial, because a spent challenge is history and there is no query
-- that wants it alongside the live one.
CREATE INDEX IF NOT EXISTS family_removal_challenges_open_idx
  ON public.family_removal_challenges (family_code, requested_by, created_at DESC)
  WHERE consumed_at IS NULL;

-- RLS enabled, and NO POLICY — the same access model as `genorra_staff`
-- (20260817000005 §1) and for a sharper reason: this table holds the hash of a
-- confirmation code, the row names the family it would remove, and its mere
-- EXISTENCE tells a reader that somebody is in the middle of removing that family.
-- None of that is a member's business, including the member who asked for it —
-- they have the code in their inbox and need nothing from here.
--
-- A policy admitting nobody would read the same and is not the same: a policy is
-- an expression, and 20260806000009 records this schema having one resurrected
-- outside the migration chain. No policy is the version that cannot drift.
ALTER TABLE public.family_removal_challenges ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.family_removal_challenges IS
  'The MFA-style code emailed to the administrator who asked to remove a family. RLS is '
  'enabled with NO POLICY: the browser can neither read a code nor learn that a removal '
  'is in progress. Only the SHA-256 is stored. THE CONTRACT the minting and verifying '
  'functions must honour: six digits from extensions.gen_random_bytes by rejection '
  'sampling (never random()); 15 minutes; at most 5 attempts; single use, stamped in '
  'consumed_at whether or not the removal succeeded; and the challenge is RESOLVED FROM '
  'auth.uid() PLUS the caller''s own family — never from an id or a hash supplied by the '
  'client, which would let a guessed code spend another family''s challenge. Added '
  '20260817000006.';

COMMENT ON COLUMN public.family_removal_challenges.code_hash IS
  'SHA-256 hex of the six digits, never the digits. NOT UNIQUE on purpose: a six-digit '
  'space is a million wide, so two families holding the same live code is ordinary, and a '
  'UNIQUE index (as family_invitations.token_hash has, correctly, for a 32-byte token) '
  'would refuse a legitimate request.';

COMMENT ON COLUMN public.family_removal_challenges.requested_by IS
  'The people.id that asked for the code, and therefore the mailbox it went to. Half of '
  'the pair a verification resolves on — the other half is family_code — because neither '
  'the challenge id nor the hash may ever arrive from the client.';

-- ── 4. The grant that admits removal is its own key ─────────────────────────
-- `admin/family/remove`, declaring the single action `delete`.
--
-- NOT a third action on `admin/family`. That resource declares view+edit and
-- 20260812000000 explains at length why it declares only those — then
-- 20260812000000's own §3c DELETEs any create/delete grant for the key, and its
-- §6d asserts none exists. Adding `delete` there would put this migration in
-- direct conflict with an assertion in an applied one, and would mean the grant to
-- rename a family is the grant to end it.
--
-- `view` IS NOT DECLARED, deliberately. There is no Remove Family SCREEN — the
-- control lives on /admin/family, which has its own view grant — so a view switch
-- here would be a control nothing reads, which is what 20260808000000 spent a
-- section removing. Before adding one, name the policy, the permission_table_map
-- row or the can*() call that will consult it.
--
-- sort_order 261 and subsection 'Settings': directly under `admin/family` (260),
-- which is the pattern `admin/account/*` (241-247, subsection 'Accounting') and
-- `admin/users/templates` (166, subsection 'Members') already set — the sub-heading
-- is named for the rail item it hangs off, so the grid reads Settings › Remove
-- Family. (The design note for this work said "beside admin/family's 155"; 155 was
-- 20260812000000's original value and 20260812000001 moved the row to 260, the
-- bottom of the admin block. 261 is what "beside" means today.)
--
-- ALSO OWED IN TYPESCRIPT, by whoever writes the app layer: this key belongs in
-- `NO_OWNER_KEYS` in components/admin/resource-groups.ts. A family has no owner —
-- there is one row and nobody's personal copy of it — so an 'own' switch would
-- light the cell up as a grant while the server, which must use canAny(), reads it
-- as a denial. `admin/family` is in that list for exactly this reason.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('admin/family/remove', 'Remove Family', 'admin', 'Settings', 261, ARRAY['delete']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- Only reachable on a fresh chain, where 20260618000000's seed registers this key
-- with the default four actions (the `actions` column does not exist that early, so
-- the row cannot name them) and the materializing loops between there and here hand
-- out a grant per action. A no-op against a database meeting the key for the first
-- time in this file. Same tidy-up and same invariant as 20260812000000 §3c and
-- 20260808000000 §5 — "no grant for an action its resource does not declare".
DELETE FROM public.template_permissions tp
 USING public.permission_resources pr
 WHERE tp.resource_key = 'admin/family/remove'
   AND pr.key = tp.resource_key
   AND NOT (tp.action::text = ANY (pr.actions));

-- ── 5a. Restricted for every existing family ────────────────────────────────
-- Since 20260817000004 an `admin/` key with no `resource_visibility` row DENIES
-- rather than being world-readable, so this backfill is no longer what makes the
-- key safe. It is what makes the GRID RENDER A SWITCH an administrator can move:
-- forgetting it now produces a capability nobody can delegate rather than one
-- everybody has, which is the right way round and is still a bug.
--
-- THE SOURCE IS THREE TABLES UNIONed, and that is the whole lesson of
-- 20260817000001. `20260817000000` keyed its backfill off `people.family_code`
-- alone and two family codes that hold templates and visibility rows while
-- appearing in neither `families` nor `people` are missing its restriction to this
-- day — MIGTEST8 is the live proof. A code carried only on `people` is a real
-- family (that is what tests/rls seeds, and what any family predating the
-- `families` table has); a code carried only on `permission_templates` is a real
-- family too, and is reached by neither of the other two.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT f.code, 'admin/family/remove', 'restricted'
  FROM (
    SELECT family_code AS code FROM public.families
    UNION
    SELECT DISTINCT family_code FROM public.people
     WHERE family_code IS NOT NULL AND family_code <> ''
    UNION
    SELECT DISTINCT family_code FROM public.permission_templates
     WHERE family_code IS NOT NULL AND family_code <> ''
  ) f
 WHERE f.code IS NOT NULL AND f.code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 5b. And somebody can still reach it ─────────────────────────────────────
-- THE HALF THAT MUST NOT BE SKIPPED: "restricted with nobody granted is a screen
-- that exists and cannot be opened" (20260808000000), and in the worst ordering the
-- capability that just locked is the one that could unlock it.
--
-- 20260817000004 §3 grants every admin key to every system Administrators template
-- — but it ran BEFORE this key existed, and a migration a database has already
-- applied never runs again. So its sweep cannot reach `admin/family/remove` on
-- hosted and this insert is genuinely required rather than defensive.
--
-- ONLY the system Administrators template, on the `is_system = true` + name test the
-- rest of the chain uses. NOT "every template that can already edit `admin/family`":
-- ending a family is a different decision from naming it, and handing it to whoever
-- holds the rename grant would widen access on deploy — which is not what a
-- migration about defaults is for. An administrator can grant it to any other
-- template from Members & Access.
--
-- NOT the template NAME alone either: 'Administrators' is a seeded default a family
-- may rename, so `is_system` is the half that actually identifies it.
--
-- FIRST, before the generic default in 5c, because that one is ON CONFLICT DO
-- NOTHING and would otherwise leave Administrators sitting on the computed 'none'.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, 'admin/family/remove', 'delete'::public.permission_action, 'any', NOW()
  FROM public.permission_templates t
 WHERE t.name = 'Administrators' AND t.is_system = true
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 5c. Every other template states the answer rather than falling through ──
-- 20260807000000 §7 materialized every grid so Members & Access can show the whole
-- answer without a reader having to know about fall-through, and §7 itself notes
-- that a resource registered by a LATER migration is the one case that survives on
-- the default. This writes that default down.
--
-- `'none'` unconditionally, and not a CASE like 20260812000000 §3b's: this resource
-- declares only `delete`, and `auth_permission()` returns 'none' for every action
-- except `view` regardless of what the family has made visible. So behaviour is
-- unchanged by this insert — what changes is that the grid has a cell to render
-- instead of a blank one, and a blank cell on this screen would be a lie.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, 'admin/family/remove', 'delete'::public.permission_action, 'none'
  FROM public.permission_templates t
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 5d. THE NEXT FAMILY NEEDS NO CHANGE, AND HERE IS WHY ────────────────────
-- 20260817000000 §3b is the standing warning about this: a default that holds for
-- today's families and silently fails for every family created afterwards is the
-- worst shape a permission default can have, "because the first family to be
-- affected is the one nobody is watching". So the question has to be asked, and for
-- this key the answer is that `seed_family_permission_templates()` already gets it
-- right — three times over, all by reading the catalogue rather than a literal list:
--
--   * its `resource_visibility` insert is
--     `WHERE pr.category = 'admin' OR pr.key = ANY(v_restricted)`, and this key is
--     category 'admin', so a new family is born with the 'restricted' row 5a
--     backfills.
--   * its Administrators insert is `CROSS JOIN LATERAL unnest(pr.actions)` over
--     every resource, so Administrators is born with `delete = 'any'`.
--   * its General insert asks what the family has restricted, so General is born
--     with 'none'.
--
-- `v_restricted` in that function is for a NON-ADMIN resource that must not be
-- family-wide by default. This one is admin, so adding it there would be a second,
-- weaker statement of a rule the category already makes — and a `CREATE OR REPLACE`
-- reproducing that whole body is a chance to lose one of the two anon-callability
-- gates it carries for nothing. THE FUNCTION IS THEREFORE DELIBERATELY UNTOUCHED.
--
-- Not asserted from prose, either: §8h creates a throwaway family and checks all
-- three of the above actually happened.

-- ── 6. The five doors ───────────────────────────────────────────────────────
-- Each of these reads `families` or admits somebody to one. All five were found by
-- asking the catalogue which functions in `public` name `public.families`, not by
-- reading the app.
--
-- Two more turned up in that sweep and are deliberately unchanged:
--   `create_family()`      only ever makes an active family.
--   `my_families()`        must keep listing a removed family, or a member has no
--                          way to see what happened to it. Its RETURNS TABLE is not
--                          widened here: the app reads `families.status` directly,
--                          and changing a function's return type means DROP +
--                          CREATE and a matching TypeScript edit, which is not this
--                          migration's business.
--
-- One is worth naming as a known gap rather than left to be discovered:
-- `create_family_invitation()` takes `p_family_code` (20260806000014, "invite to
-- any of my families") and will still MINT an invitation into a removed family. The
-- door it opens is closed — §6d refuses the redemption — so the cost is a dead
-- link rather than an entry, and the app layer is where a member is told the family
-- is gone before they get as far as inviting somebody to it.

-- 6a. Look up a code to confirm the family's name before joining.
-- Verbatim from 20260806000011 §7a plus ONE conjunct. The message a stranger sees
-- is produced by the caller and is identical for a removed family and a code that
-- was never issued — see the header.
CREATE OR REPLACE FUNCTION public.validate_family_code(p_code text)
RETURNS TABLE (family_code text, family_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT f.family_code, f.family_name
    FROM public.families f
   WHERE f.family_code = upper(btrim(COALESCE(p_code, '')))
     AND f.status = 'active'
     AND (SELECT auth.uid()) IS NOT NULL
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validate_family_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_family_code(text) TO authenticated;

-- 6b. Join by family code.
-- Verbatim from 20260813000006 §4 plus ONE conjunct, on the name lookup — which is
-- the right place rather than a separate test, because the existing
-- `IF v_name IS NULL` branch already produces the catch-all message. `family_name`
-- is NOT NULL, so v_name is NULL exactly when no ACTIVE row matched, and a removed
-- family and a nonexistent code are answered identically with no new branch to keep
-- in step.
--
-- A member who already belongs to a removed family gets that same message rather
-- than "You have already applied", and that is the right trade: this function is
-- the door for somebody on the outside, the notice screen in the app is where a
-- member is told what happened, and adding a branch here to tell them apart would
-- reintroduce the oracle for the sake of a message nobody should be reading here.
CREATE OR REPLACE FUNCTION public.join_family_by_code(p_code text)
RETURNS TABLE (ok boolean, family_code text, family_name text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user   uuid := (SELECT auth.uid());
  v_code   text := upper(btrim(COALESCE(p_code, '')));
  v_name   text;
  v_meta   jsonb;
  v_email  text;
  v_confirmed timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Not authenticated'; RETURN;
  END IF;

  IF v_code = '' THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Enter a family code'; RETURN;
  END IF;

  -- `AND f.status = 'active'` (20260817000006). A removed family is not a family
  -- anybody can join, and it must not be distinguishable here from a code that does
  -- not exist.
  SELECT f.family_name INTO v_name
    FROM public.families f WHERE f.family_code = v_code AND f.status = 'active';
  IF v_name IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text,
      'Family code not found. Check with your family and try again.'; RETURN;
  END IF;

  SELECT u.email, u.email_confirmed_at, u.raw_user_meta_data
    INTO v_email, v_confirmed, v_meta
    FROM auth.users u WHERE u.id = v_user;

  IF v_confirmed IS NULL THEN
    RETURN QUERY SELECT false, v_code, v_name,
      'Confirm your email address before joining a family.'; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.people p
     WHERE p.user_id = v_user AND p.family_code = v_code
  ) THEN
    RETURN QUERY SELECT false, v_code, v_name,
      'You have already applied to join this family.'; RETURN;
  END IF;

  -- first/last name are NOT NULL DEFAULT ''. 20260617000001's BEFORE INSERT
  -- trigger inherits them from the caller's oldest existing membership, which is
  -- the normal case; the metadata fallback covers an account with no other row.
  INSERT INTO public.people (user_id, family_code, first_name, last_name,
                             primary_email, created_by)
  VALUES (v_user, v_code,
          COALESCE(v_meta ->> 'first_name', ''),
          COALESCE(v_meta ->> 'last_name', ''),
          lower(COALESCE(v_email, '')),
          v_user);

  RETURN QUERY SELECT true, v_code, v_name, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.join_family_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_family_by_code(text) TO authenticated;

-- 6c. Peek at an invitation before signing in. GRANTED TO anon — be careful here.
-- Verbatim from 20260811000001 §3 plus ONE conjunct, and the conjunct is
-- `COALESCE(f.status, 'active') = 'active'` rather than `f.status = 'active'` for a
-- reason worth stating, because it is the one place in this file that does not test
-- the column directly.
--
-- The join to `families` is a LEFT JOIN, deliberately: an invitation may name a
-- family that has no `families` row at all (a family predating that table, and
-- historically what some fixtures produce), and this function has always returned
-- the invitation with a NULL family_name in that case rather than refusing it.
-- Writing `f.status = 'active'` would turn the LEFT JOIN into an inner one by
-- stealth and quietly break every such invitation — a behaviour change nobody
-- asked for, in the one function an anonymous visitor can reach.
--
-- So: an ABSENT row keeps its old meaning, and a row that is PRESENT must say
-- 'active'. The test is still positive — `= 'active'` — so a third status is
-- refused here on arrival.
--
-- A refused peek returns NO ROW, which the page reads as `valid = false` and
-- reports with the same sentence it uses for an expired, revoked or already-accepted
-- token. That is 20260806000013's rule and it is why this discloses nothing new: a
-- token holder cannot tell which of the five states they are in.
--
-- SEVEN COLUMNS, NOT FIVE. The reasoning above came from 20260811000001 §3, which is
-- the last migration to explain this function — but 20260813000004 §4 re-created it
-- with `first_name` and `last_name` appended, so the five-column shape is stale. That
-- was not caught by reading: `CREATE OR REPLACE` against a different OUT-parameter row
-- type is refused outright (42P13, "cannot change return type of existing function"),
-- and the first `db reset` said so. It is worth recording, because the failure mode of
-- the OTHER ordering — dropping and re-creating with the wrong shape — is silent, and
-- 20260813000004's own header warns that a DROP takes the function's grants with it.
CREATE OR REPLACE FUNCTION public.peek_family_invitation(p_token text)
RETURNS TABLE (
  valid        boolean,
  email        text,
  family_name  text,
  pre_approved boolean,
  has_account  boolean,
  first_name   text,
  last_name    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT true, i.email, f.family_name,
         -- The EFFECTIVE pre-approval: what redemption will actually do, not what the
         -- invitation asked for. Mirrors redeem_family_invitation's `AND NOT v_reopen`,
         -- and tests positively for the one state that re-opens.
         i.pre_approved AND NOT EXISTS (
           SELECT 1 FROM public.people p
             JOIN auth.users u ON u.id = p.user_id
            WHERE p.family_code = i.family_code
              AND lower(u.email) = i.email
              AND p.membership_status = 'rejected'),
         EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = i.email),
         -- Whoever invited them typed a name; /register pre-fills with it
         -- (20260813000004). Untouched by this migration and reproduced verbatim,
         -- because the body has to be written out in full to change one conjunct.
         i.first_name, i.last_name
    FROM public.family_invitations i
    LEFT JOIN public.families f ON f.family_code = i.family_code
   WHERE i.token_hash = encode(extensions.digest(COALESCE(p_token, ''), 'sha256'), 'hex')
     AND i.accepted_at IS NULL
     AND i.revoked_at IS NULL
     AND i.expires_at > NOW()
     AND COALESCE(f.status, 'active') = 'active'
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.peek_family_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_family_invitation(text) TO authenticated, anon;

-- 6d. Redeem an invitation.
-- Verbatim from 20260813000006 §5 apart from three lines, all in the preamble:
--
--   * `v_found := FOUND;` captures whether the invitation exists BEFORE anything
--     else runs a query. `FOUND` reflects the LAST statement, so reading the
--     family's status first and then testing `NOT FOUND` would be testing the wrong
--     statement — a bug that would admit every unknown token.
--   * the family's name and status are read HERE instead of forty lines further
--     down. The name lookup that used to sit after the membership branch is gone
--     from there; nothing else about its use changes.
--   * `COALESCE(v_status, 'active') = 'active'` joins the catch-all, for §6c's
--     reason: `families` may legitimately have no row for the code, and that has
--     always been tolerated. The inner test is positive; the NOT is the refusal,
--     so a status added later is refused rather than admitted.
--
-- One message for every way an invitation can be unusable — now six ways instead of
-- five. That is the rule the whole of §6 follows.
CREATE OR REPLACE FUNCTION public.redeem_family_invitation(
  p_token   text,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (ok boolean, family_code text, family_name text, pre_approved boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claims   jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role     text  := COALESCE(v_claims ->> 'role', '');
  p_user     uuid;
  v_inv      public.family_invitations;
  v_found    boolean;
  v_status   text;
  v_email    text;
  v_name     text;
  v_person   uuid;
  v_meta     jsonb;
  v_existing text;
  v_decided  timestamptz;
  v_reopen   boolean := false;
  v_first    text;
  v_last     text;
BEGIN
  IF v_role = 'service_role' THEN
    p_user := p_user_id;
  ELSE
    -- Not the service role: whoever you are, you are redeeming for YOURSELF.
    p_user := (SELECT auth.uid());
  END IF;

  IF p_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, false, 'Not authenticated'; RETURN;
  END IF;

  SELECT * INTO v_inv
    FROM public.family_invitations
   WHERE token_hash = encode(extensions.digest(COALESCE(p_token, ''), 'sha256'), 'hex');
  -- CAPTURED IMMEDIATELY. The lookup below overwrites FOUND, and testing the wrong
  -- statement here would admit every token that does not exist.
  v_found := FOUND;

  -- The family, read here rather than after the membership branch, so that a REMOVED
  -- family is refused by the same catch-all as every other unusable state instead of
  -- being discovered halfway through a redemption.
  IF v_found THEN
    SELECT f.family_name, f.status INTO v_name, v_status
      FROM public.families f WHERE f.family_code = v_inv.family_code;
  END IF;

  -- One message for every way an invitation can be unusable. Distinguishing them tells a
  -- holder of a guessed token which guesses are close.
  IF NOT v_found
     OR v_inv.accepted_at IS NOT NULL
     OR v_inv.revoked_at IS NOT NULL
     OR v_inv.expires_at <= NOW()
     OR NOT (COALESCE(v_status, 'active') = 'active') THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, false,
      'That invitation is no longer valid. Ask for a new one.'; RETURN;
  END IF;

  SELECT lower(u.email), u.raw_user_meta_data INTO v_email, v_meta
    FROM auth.users u WHERE u.id = p_user;

  -- The address is a NARROWING condition on the token, not a substitute for it.
  IF v_email IS DISTINCT FROM v_inv.email THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, false,
      'This invitation was sent to a different email address.'; RETURN;
  END IF;

  -- THE EXISTING MEMBERSHIP, AND THE ONE STATE AN INVITATION MAY RE-OPEN (20260811000001).
  -- A positive switch with a catch-all refusal, so deleting the permit closes the door
  -- rather than opening it.
  SELECT p.id, p.membership_status, p.membership_decided_at
    INTO v_person, v_existing, v_decided
    FROM public.people p
   WHERE p.user_id = p_user AND p.family_code = v_inv.family_code;

  IF v_person IS NOT NULL THEN
    IF v_existing = 'rejected'
       AND (v_decided IS NULL OR v_inv.created_at > v_decided) THEN
      -- Asked back AFTER the refusal it reverses. NULL-safe in the permissive direction on
      -- purpose: this application always stamps membership_decided_at when it declines and
      -- the stamp trigger never writes 'rejected', so NULL means a service-role write.
      v_reopen := true;
    ELSIF v_existing = 'rejected' THEN
      -- Superseded: minted before the decline. The catch-all message, true of it and
      -- disclosing nothing about their status.
      RETURN QUERY SELECT false, NULL::text, NULL::text, false,
        'That invitation is no longer valid. Ask for a new one.'; RETURN;
    ELSE
      RETURN QUERY SELECT false, v_inv.family_code, NULL::text, false,
        'You already belong to this family.'; RETURN;
    END IF;
  END IF;

  -- NULLIF, not COALESCE alone: `raw_user_meta_data ->> 'first_name'` is the EMPTY STRING
  -- rather than NULL for an account registered without one, and COALESCE would happily
  -- choose it over the invitation's name. The ACCOUNT still wins where it has one — its
  -- owner is a better authority on their own name than whoever invited them.
  v_first := COALESCE(NULLIF(btrim(COALESCE(v_meta ->> 'first_name', '')), ''), v_inv.first_name, '');
  v_last  := COALESCE(NULLIF(btrim(COALESCE(v_meta ->> 'last_name',  '')), ''), v_inv.last_name,  '');

  IF v_reopen THEN
    -- BACK IN THE QUEUE, NEVER STRAIGHT IN. The omissions are the point: membership_note,
    -- membership_decided_at, membership_decided_by and permission_template_id all survive,
    -- so reversing a refusal does not erase the record of it and a member templated before
    -- being declined is not silently reset to General.
    UPDATE public.people
       SET membership_status       = 'pending',
           membership_requested_at = NOW()
     WHERE id = v_person;
  ELSE
    -- ADOPT the record the invitation names, if it is still claimable. Re-tested here
    -- rather than trusted from creation time, because `user_id` can be claimed in between.
    -- A no-match leaves v_person NULL and falls through to the insert, which is exactly the
    -- behaviour that shipped before this branch existed.
    IF v_inv.invited_person_id IS NOT NULL THEN
      UPDATE public.people p
         SET user_id              = p_user,
             first_name           = v_first,
             last_name            = v_last,
             primary_email        = v_email,
             -- The generated address is replaced by the real one, so the flags describing
             -- it go with it — otherwise the app would refuse to mail an account that now
             -- has a genuine mailbox.
             email_is_placeholder = false,
             no_email_reason      = NULL
       WHERE p.id = v_inv.invited_person_id
         AND p.family_code = v_inv.family_code
         AND p.user_id IS NULL
      RETURNING p.id INTO v_person;
    END IF;

    IF v_person IS NULL THEN
      -- Same insert join_family_by_code() makes, leaning on the same triggers: the profile
      -- is inherited from the caller's oldest membership, the stamp trigger pends them,
      -- and they land in General.
      INSERT INTO public.people (user_id, family_code, first_name, last_name,
                                 primary_email, created_by)
      VALUES (p_user, v_inv.family_code, v_first, v_last, v_email, p_user)
      RETURNING id INTO v_person;
    END IF;
  END IF;

  -- PRE-APPROVAL IS AN UPDATE, NOT AN INSERT VALUE: the BEFORE INSERT stamp trigger
  -- (20260806000011 §2) overrides whatever status the insert carried, deliberately, so no
  -- caller can arrive pre-approved by supplying a column. Allowed here because
  -- people_guard_membership_status refuses only the 'authenticated' role and this is
  -- SECURITY DEFINER.
  --
  -- IT ALSO COVERS THE ADOPTED ROW, which is why it is outside the branch: an adopted
  -- record is UPDATEd rather than inserted, so the stamp trigger never saw it and it holds
  -- whatever status it was created with — 'pending' from the trigger that fired when the
  -- tree created it. Leaving it there is correct for an ordinary invitation and wrong for
  -- a pre-approved one, and this is the line that decides.
  --
  -- `AND NOT v_reopen` IS THE WHOLE SECURITY ARGUMENT OF 20260811000001. A re-open goes
  -- back to the queue whatever the invitation says, so no invitation can turn a refusal
  -- into a membership without a fresh human decision. Deleting this conjunct reintroduces
  -- that reversal; there is a test that fails when you do.
  IF v_inv.pre_approved AND NOT v_reopen THEN
    UPDATE public.people
       SET membership_status     = 'approved',
           membership_decided_at = NOW(),
           membership_decided_by = (SELECT p.user_id FROM public.people p WHERE p.id = v_inv.invited_by)
     WHERE id = v_person;
  END IF;

  UPDATE public.family_invitations
     SET accepted_at = NOW(), accepted_by = v_person
   WHERE id = v_inv.id;

  -- REPORTS WHAT HAPPENED, not what the invitation asked for. A re-open of a pre-approved
  -- invitation returns false here, so /invite/<token> and the dialog say "an administrator
  -- will review" rather than promising access that was not granted.
  RETURN QUERY SELECT true, v_inv.family_code, v_name,
    (v_inv.pre_approved AND NOT v_reopen), NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.redeem_family_invitation(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_family_invitation(text, uuid) TO authenticated;

-- 6e. Switching family: THE DECISION IS TO ALLOW IT, and the function is unchanged.
--
-- The alternative was tested against the product rather than against the schema.
-- Refusing the switch would leave a member of a removed family with no way to reach
-- it at all: /my-families would offer the name, the switch would fail with "not a
-- member of family X" — which is false — and nothing anywhere would say the family
-- had been removed. The member's own conclusion would be that the product is
-- broken, which is worse than the truth by every measure.
--
-- So the switch succeeds, `auth_family_code()` resolves the removed family exactly
-- as it resolved it yesterday (the header explains why a conjunct there would SKIP
-- rather than hide, which is the real reason this has to be the answer), and the
-- app renders a notice screen in that family saying it was removed and is no longer
-- available. One place to write that sentence, in the family it is about.
--
-- Nothing about a MEMBERSHIP changes either: `set_active_family` still requires a
-- `people` row in the target, so this admits nobody who was not already in.
COMMENT ON FUNCTION public.set_active_family(text) IS
  'Switch the caller''s active family. DELIBERATELY DOES NOT TEST families.status '
  '(20260817000006): a member of a removed family must be able to select it, or nothing '
  'can tell them what happened to it — the app renders a notice screen in that family '
  'instead. Refusing here would report "not a member", which is false. Still requires a '
  'people row in the target, so it admits nobody new.';

-- ── 7. Restoration, for the staff console only ──────────────────────────────
-- WHY THIS IS AN RPC AND NOT A DIRECT SERVICE-ROLE UPDATE. The console will hold
-- the service key, so it could write `families.status` itself and the guard in §2
-- would not object — that guard is about the browser's role, not about the column.
-- The reason to spend an RPC anyway is that the staff check would then exist in
-- exactly one place: a `requireStaff()` in TypeScript, on a page nobody visits and
-- no test covers, standing between a support engineer's session and every family in
-- the product. Putting the same test in the database means a mistake in one layer is
-- not the only thing holding.
--
-- That is the same argument §2 of AGENTS.md makes about server actions ("the page
-- that renders the form is not a gate") applied one level down: the action that
-- calls this is not a gate either, and this function does not trust it.
--
-- HOW IT KNOWS WHO IS ACTING, and why it takes an id at all. `is_genorra_staff()`
-- reads `auth.uid()`, which is NULL for a service-role request — the service key's
-- JWT carries a role and no `sub`. So a console reading through the admin client
-- (which is what 20260817000005 and the design both say it does) cannot be
-- identified by the function at all unless it says who it is.
--
-- `redeem_family_invitation` has the same problem for registration and AGENTS.md
-- §2b names its solution as the sanctioned one: read the role from PostgREST's
-- VERIFIED JWT claims, honour `p_user_id` only for `service_role`, and for everyone
-- else derive the caller from `auth.uid()` and ignore the argument — not validate
-- it, ignore it. A browser cannot set `request.jwt.claims`; PostgREST sets it from
-- the token it has already verified. So the shape is reproduced here exactly.
--
-- GRANTED TO NOBODY. `service_role` keeps EXECUTE from 20260806000015 §6's default
-- privileges, and that is the only caller. Granting it to `authenticated` would
-- also publish it in PostgREST's OpenAPI document, which any signed-in member can
-- fetch — and a console that 404s a non-staff caller rather than telling them they
-- are not staff should not announce itself in the schema.
--
-- IT CAN SET EITHER STATUS. Restoration is what it exists for, but a staff member
-- acting on a support request may need to remove a family too, and a function that
-- can only move one way would be answered by a direct UPDATE the first time that
-- came up — which is the layer this exists to avoid.
CREATE OR REPLACE FUNCTION public.staff_set_family_status(
  p_family_code text,
  p_status      text,
  p_user_id     uuid DEFAULT NULL
)
RETURNS TABLE (ok boolean, family_code text, status text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Every table reference in this body is ALIASED and every column qualified,
  -- because `family_code` and `status` are RETURNS TABLE names and therefore plpgsql
  -- VARIABLES in here. An unqualified `WHERE family_code = …` is ambiguous and
  -- raises at CALL time rather than at CREATE time —  create_family_invitation
  -- carries the same warning for the same reason.
  v_claims jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role   text  := COALESCE(v_claims ->> 'role', '');
  v_actor  uuid;
  v_code   text  := upper(btrim(COALESCE(p_family_code, '')));
  v_status text  := lower(btrim(COALESCE(p_status, '')));
  -- The CHECK on families.status is the authority; this is the list this function
  -- will accept, and §8g exercises both directions against the constraint so the two
  -- cannot silently drift. Validated before the UPDATE so a typo is a message rather
  -- than a raw constraint violation surfacing in a support tool.
  v_valid  CONSTANT text[] := ARRAY['active', 'removed'];
  v_hit    text;
BEGIN
  IF v_role = 'service_role' THEN
    v_actor := p_user_id;
  ELSE
    -- Anyone else is acting for themselves, whatever they passed.
    v_actor := (SELECT auth.uid());
  END IF;

  -- THE GATE, and it is first. A non-staff caller learns nothing about the family
  -- code they named — not whether it exists, not what status it is in.
  IF NOT public.is_genorra_staff(v_actor) THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Not authorized'; RETURN;
  END IF;

  IF NOT (v_status = ANY (v_valid)) THEN
    RETURN QUERY SELECT false, v_code, NULL::text,
      format('Unknown family status %L. Expected one of: %s',
             v_status, array_to_string(v_valid, ', ')); RETURN;
  END IF;

  -- `removed_at` is stamped on the way in and cleared on the way out, so it never
  -- describes an active family. COALESCE keeps the ORIGINAL timestamp when a family
  -- that is already removed is removed again — re-running this must not rewrite when
  -- it happened.
  --
  -- `removed_by` is left ALONE on removal and cleared on restore: a staff member has
  -- no `people` row in the family, so there is no honest value to write, and
  -- overwriting whatever the family's own administrator recorded would destroy the
  -- only record of who did it.
  UPDATE public.families AS f
     SET status     = v_status,
         removed_at = CASE WHEN v_status = 'removed'
                           THEN COALESCE(f.removed_at, NOW()) ELSE NULL END,
         removed_by = CASE WHEN v_status = 'removed' THEN f.removed_by ELSE NULL END
   WHERE f.family_code = v_code
  RETURNING f.family_code INTO v_hit;

  -- Distinguishing "no such family" from a state IS fine here, and only here: the
  -- caller has already been proven to be GENORRA staff, so there is no oracle to
  -- protect. §6's one-message rule is about strangers.
  IF v_hit IS NULL THEN
    RETURN QUERY SELECT false, v_code, NULL::text,
      'No family with that code.'; RETURN;
  END IF;

  RETURN QUERY SELECT true, v_code, v_status, NULL::text;
END $$;

REVOKE ALL ON FUNCTION public.staff_set_family_status(text, text, uuid)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.staff_set_family_status(text, text, uuid) IS
  'Set families.status from the GENORRA staff console — the ONLY route back from '
  '''removed'', which is deliberately not in the member-facing product. Refuses unless '
  'public.is_genorra_staff() holds for the acting account, resolved from auth.uid() and '
  'from p_user_id only for a verified service_role JWT claim (redeem_family_invitation''s '
  'shape, AGENTS.md §2b). Executable by service_role only. An RPC rather than a direct '
  'service-role UPDATE so the staff test exists in the database as well as in the app.';

-- ── 8. Verify ───────────────────────────────────────────────────────────────
-- Everything here that CAN run without a fixture does, unconditionally, and the two
-- things that genuinely cannot say so out loud. That split is AGENTS.md's, after
-- 20260806000012 reported success over a function that could not run.
--
-- Most of this is BEHAVIOURAL rather than structural, which took some arranging and
-- is the point: `request.jwt.claims` is a GUC, `auth.uid()` and `auth.role()` read
-- it, and PostgREST is the only thing that normally writes it — so setting it here
-- lets four of the five doors be called for real, as an authenticated stranger,
-- against a family this block creates and removes. A door asserted to CONTAIN a
-- conjunct is a door nobody has opened.
DO $mig$
DECLARE
  v_code    CONSTANT text := 'ZZREMOV';
  v_token   CONSTANT text := 'zz-removal-probe-token-20260817000006';
  v_stranger CONSTANT uuid := '00000000-0000-4000-8000-00000000f001';
  v_bad     int;
  v_policies int;
  v_rls     boolean;
  v_status  text;
  v_hits    int;
  v_msg     text;
  v_ok      boolean;
  v_refused boolean;
  v_cleared boolean;
  v_src     text;
  v_user    uuid;
  v_admins  uuid;
  v_general uuid;
BEGIN
  -- 8a. The columns, the CHECK and the trigger exist.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'families'
       AND column_name IN ('status', 'removed_at', 'removed_by')
     GROUP BY table_name HAVING COUNT(*) = 3
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: families is missing one of status / removed_at / removed_by';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.families'::regclass AND conname = 'families_status_check'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: families_status_check was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.families'::regclass AND tgname = 'families_guard_removal'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: families_guard_removal trigger is missing';
  END IF;

  -- 8b. The resource, with exactly the one action something reads.
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE key = 'admin/family/remove'
       AND category = 'admin'
       AND actions = ARRAY['delete']::TEXT[]
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: admin/family/remove is not registered as an admin resource declaring '
      'exactly [delete]';
  END IF;

  SELECT COUNT(*) INTO v_bad
    FROM public.template_permissions
   WHERE resource_key = 'admin/family/remove' AND action::text <> 'delete';
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % grant(s) for admin/family/remove name an action it does not declare', v_bad;
  END IF;

  -- It gates a capability, not a table, and no policy may consult it. The removal
  -- write goes through the service role because of §2's guard, so a policy naming
  -- this key would be a second, weaker answer to who may remove a family. Checked
  -- against pg_policies rather than trusted, because the policies in this chain are
  -- COMPOSED at migration time and hosted has drifted from the chain before.
  IF EXISTS (
    SELECT 1 FROM public.permission_table_map WHERE resource_key = 'admin/family/remove'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: admin/family/remove must not map to a table';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%admin/family/remove%'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: a policy evaluates admin/family/remove';
  END IF;

  -- And the sort_order is unique within its category, which is 20260806000005's
  -- invariant and the thing a mistyped number breaks silently — 20260817000000 §4
  -- caught exactly this on its first `db reset`.
  IF EXISTS (
    SELECT sort_order FROM public.permission_resources
     WHERE category = 'admin' GROUP BY sort_order HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: two admin resources share a sort_order';
  END IF;

  -- 8c. No family lacks a visibility row (5a), from all three sources.
  SELECT COUNT(*) INTO v_bad
    FROM (
      SELECT family_code AS code FROM public.families
      UNION SELECT DISTINCT family_code FROM public.people
       WHERE family_code IS NOT NULL AND family_code <> ''
      UNION SELECT DISTINCT family_code FROM public.permission_templates
       WHERE family_code IS NOT NULL AND family_code <> ''
    ) f
   WHERE f.code IS NOT NULL AND f.code <> ''
     AND NOT EXISTS (SELECT 1 FROM public.resource_visibility rv
                      WHERE rv.family_code = f.code
                        AND rv.resource_key = 'admin/family/remove');
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % family(ies) have no admin/family/remove visibility row, so the grid '
      'cannot offer a switch for it', v_bad;
  END IF;

  -- 8d. And the mirror failure: a family whose administrators cannot remove it.
  SELECT COUNT(*) INTO v_bad
    FROM public.permission_templates t
   WHERE t.name = 'Administrators' AND t.is_system = true
     AND NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                      WHERE tp.template_id = t.id
                        AND tp.resource_key = 'admin/family/remove'
                        AND tp.action = 'delete' AND tp.scope = 'any');
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % system Administrators template(s) cannot delete admin/family/remove', v_bad;
  END IF;

  -- 8e. The challenges table: RLS on, no policy, and code_hash NOT unique.
  SELECT c.relrowsecurity INTO v_rls
    FROM pg_class c WHERE c.oid = 'public.family_removal_challenges'::regclass;
  IF NOT v_rls THEN
    RAISE EXCEPTION
      'ROLLBACK: RLS is not enabled on family_removal_challenges. With seed.sql granting '
      'ALL on every table to authenticated, the confirmation codes would be readable by '
      'the family they would remove.';
  END IF;

  SELECT COUNT(*) INTO v_policies
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'family_removal_challenges';
  IF v_policies <> 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: family_removal_challenges carries % policy(ies) and is meant to carry '
      'none — the browser must not be able to read a code or learn that a removal is in '
      'progress.', v_policies;
  END IF;

  -- Asked of pg_get_indexdef() rather than by unpacking `indkey`, which is an
  -- int2vector and needs a cast whose behaviour differs between major versions. The
  -- definition text names its columns and cannot be read two ways.
  IF EXISTS (
    SELECT 1 FROM pg_index i
     WHERE i.indrelid = 'public.family_removal_challenges'::regclass
       AND i.indisunique
       AND pg_get_indexdef(i.indexrelid) LIKE '%code_hash%'
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: code_hash carries a UNIQUE index. Six digits is a space of a million, so '
      'two families holding the same live code is ordinary and this would refuse a '
      'legitimate request.';
  END IF;

  -- 8f. The doors still carry the grants they had. `CREATE OR REPLACE` preserves an
  -- ACL and §6 restates the grants anyway; this is what would catch a REVOKE that
  -- matched more than intended. Losing one breaks sign-up or invitation acceptance
  -- with "permission denied for function" and nothing else here would notice.
  IF NOT has_function_privilege('authenticated', 'public.validate_family_code(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.join_family_by_code(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.redeem_family_invitation(text, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.peek_family_invitation(text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'ROLLBACK: a door lost its `authenticated` EXECUTE grant';
  END IF;

  -- anon keeps peek and gains nothing. The second half is the one that matters: it is
  -- the assertion 20260806000015 §7 makes globally, restated for the two functions
  -- this file created.
  IF NOT has_function_privilege('anon', 'public.peek_family_invitation(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ROLLBACK: anon lost peek_family_invitation — /invite/<token> is dead';
  END IF;

  IF has_function_privilege('anon', 'public.staff_set_family_status(text, text, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.staff_set_family_status(text, text, uuid)', 'EXECUTE')
  THEN
    RAISE EXCEPTION
      'ROLLBACK: a browser role can execute staff_set_family_status. It is the only route '
      'back from removal and belongs to the staff console alone.';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.staff_set_family_status(text, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ROLLBACK: service_role cannot execute staff_set_family_status';
  END IF;

  -- 8g. redeem_family_invitation kept the three conjuncts 20260811000001 asserts, and
  -- gained the fourth. WHOLE STATEMENTS, never fragments — that file explains why:
  -- `prosrc` contains the COMMENTS too, so matching a fragment discussed in a comment
  -- would pass for a body whose code had been deleted and whose comment survived.
  SELECT p.prosrc INTO v_src
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'redeem_family_invitation';
  IF v_src NOT LIKE '%IF v_inv.pre_approved AND NOT v_reopen THEN%' THEN
    RAISE EXCEPTION 'ROLLBACK: redeem_family_invitation lost the re-open pre-approval clamp';
  END IF;
  IF v_src NOT LIKE '%AND (v_decided IS NULL OR v_inv.created_at > v_decided) THEN%' THEN
    RAISE EXCEPTION 'ROLLBACK: redeem_family_invitation lost the superseded-invitation guard';
  END IF;
  IF v_src NOT LIKE '%IF v_email IS DISTINCT FROM v_inv.email THEN%' THEN
    RAISE EXCEPTION 'ROLLBACK: redeem_family_invitation lost the email narrowing conjunct';
  END IF;
  IF v_src NOT LIKE '%v_found := FOUND;%' THEN
    RAISE EXCEPTION
      'ROLLBACK: redeem_family_invitation no longer captures FOUND before the families '
      'lookup — `NOT FOUND` would then be testing the wrong statement and every unknown '
      'token would be admitted';
  END IF;

  -- 8h. A THROWAWAY FAMILY, and everything that can only be checked by doing it.
  --
  -- Inserting fires families_seed_permission_templates and families_seed_system_funds,
  -- so 5d's claim that a NEW family is born with the right defaults is checked here
  -- rather than asserted from the function's source. created_by is left NULL: nothing
  -- below needs a founder, and requiring an auth.users row is exactly what let
  -- 20260806000012's verify block skip itself into a false pass.
  INSERT INTO public.families (family_code, family_name)
  VALUES (v_code, 'Removal probe');

  SELECT f.status INTO v_status FROM public.families f WHERE f.family_code = v_code;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'ROLLBACK: a new family defaulted to status %, expected active', v_status;
  END IF;

  -- 5d, all three halves, for a family created after this migration.
  IF NOT EXISTS (
    SELECT 1 FROM public.resource_visibility rv
     WHERE rv.family_code = v_code AND rv.resource_key = 'admin/family/remove'
       AND rv.visibility = 'restricted'
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: seed_family_permission_templates() did not restrict admin/family/remove '
      'for a new family. 5d says the admin category already covers it; it does not.';
  END IF;

  SELECT t.id INTO v_admins FROM public.permission_templates t
   WHERE t.family_code = v_code AND t.name = 'Administrators' AND t.is_system = true;
  SELECT t.id INTO v_general FROM public.permission_templates t
   WHERE t.family_code = v_code AND t.name = 'General' AND t.is_system = true;
  IF v_admins IS NULL OR v_general IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: the families trigger did not seed both system templates';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.template_permissions tp
     WHERE tp.template_id = v_admins AND tp.resource_key = 'admin/family/remove'
       AND tp.action = 'delete' AND tp.scope = 'any'
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: a new family''s Administrators template cannot remove it. 5d assumed '
      'unnest(pr.actions) would cover this key and it did not.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.template_permissions tp
     WHERE tp.template_id = v_general AND tp.resource_key = 'admin/family/remove'
       AND tp.action = 'delete' AND tp.scope = 'none'
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: a new family''s General template does not hold an explicit `none` for '
      'admin/family/remove — either it was granted something, or the grid has a blank '
      'cell where the answer should be';
  END IF;

  -- An invitation into the probe family, for the two invitation doors. No auth.users
  -- row is needed: both refuse before they read one, which is what makes them
  -- testable here at all.
  INSERT INTO public.family_invitations (family_code, email, token_hash)
  VALUES (v_code, 'zz-removal-probe@example.invalid',
          encode(extensions.digest(v_token, 'sha256'), 'hex'));

  -- ── The doors, called as an authenticated stranger, family ACTIVE ──────────
  -- PostgREST sets request.jwt.claims from a token it has already verified; setting
  -- it here is the only way to give auth.uid() a value inside a migration, and it is
  -- what turns four assertions about source text into four calls.
  PERFORM set_config('request.jwt.claims',
                     format('{"role":"authenticated","sub":"%s"}', v_stranger), true);

  SELECT COUNT(*) INTO v_hits FROM public.validate_family_code(v_code);
  IF v_hits <> 1 THEN
    RAISE EXCEPTION
      'ROLLBACK: validate_family_code() cannot see an ACTIVE family (% row(s)). The new '
      'conjunct has broken joining for everybody.', v_hits;
  END IF;

  SELECT r.message INTO v_msg FROM public.join_family_by_code(v_code) r;
  IF v_msg IS DISTINCT FROM 'Confirm your email address before joining a family.' THEN
    RAISE EXCEPTION
      'ROLLBACK: join_family_by_code() on an ACTIVE family answered %, expected the email '
      'confirmation refusal that follows a successful family lookup', COALESCE(v_msg, '<null>');
  END IF;

  SELECT COUNT(*) INTO v_hits FROM public.peek_family_invitation(v_token);
  IF v_hits <> 1 THEN
    RAISE EXCEPTION
      'ROLLBACK: peek_family_invitation() cannot see an invitation into an ACTIVE family '
      '(% row(s)) — /invite/<token> is broken for everybody', v_hits;
  END IF;

  SELECT r.message INTO v_msg FROM public.redeem_family_invitation(v_token) r;
  IF v_msg IS DISTINCT FROM 'This invitation was sent to a different email address.' THEN
    RAISE EXCEPTION
      'ROLLBACK: redeem_family_invitation() on an ACTIVE family answered %, expected the '
      'address mismatch that follows a successful validity check',
      COALESCE(v_msg, '<null>');
  END IF;

  -- ── The guard, refusing the browser ───────────────────────────────────────
  -- Still speaking as `authenticated`. This is the PATCH the header is about, and it
  -- is the whole reason the emailed code means anything.
  v_refused := false;
  BEGIN
    UPDATE public.families SET status = 'removed' WHERE family_code = v_code;
  EXCEPTION WHEN insufficient_privilege THEN
    -- Matched on the MESSAGE as well as the SQLSTATE: 42501 is also what a missing
    -- table privilege raises, and a verify block that cannot tell those apart is one
    -- that passes for the wrong reason (20260812000000 §6f).
    v_refused := (SQLERRM LIKE '%removing or restoring a family%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION
      'ROLLBACK: families_guard_removal did not refuse a status change from the '
      'authenticated role. An administrator holding only admin/family:edit could remove '
      'their family from devtools, past the confirmation code entirely.';
  END IF;

  -- And the same for the record columns, which are guarded for their own sake.
  v_refused := false;
  BEGIN
    UPDATE public.families SET removed_at = NOW() WHERE family_code = v_code;
  EXCEPTION WHEN insufficient_privilege THEN
    v_refused := (SQLERRM LIKE '%removing or restoring a family%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION
      'ROLLBACK: families_guard_removal permits the authenticated role to write '
      'removed_at. The record of a removal must not be rewritable by the browser.';
  END IF;

  -- Back to no session. Everything after this is a service-role-shaped write, which
  -- is the shape the migration owner already has.
  PERFORM set_config('request.jwt.claims', '', true);

  -- ── The vocabulary is closed ──────────────────────────────────────────────
  v_refused := false;
  BEGIN
    UPDATE public.families SET status = 'archived' WHERE family_code = v_code;
    RAISE EXCEPTION 'ROLLBACK: families_status_check admitted an unknown status';
  EXCEPTION WHEN check_violation THEN
    v_refused := true;
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: families_status_check did not refuse `archived`';
  END IF;

  -- ── Remove it, as the service role would ──────────────────────────────────
  UPDATE public.families
     SET status = 'removed', removed_at = NOW()
   WHERE family_code = v_code;
  SELECT f.status INTO v_status FROM public.families f WHERE f.family_code = v_code;
  IF v_status <> 'removed' THEN
    RAISE EXCEPTION
      'ROLLBACK: the guard refuses a service-role removal. Nothing could then remove a '
      'family at all.';
  END IF;

  -- ── The same four doors, family REMOVED ───────────────────────────────────
  -- The half that proves the conjuncts do something. Each must now answer the
  -- CATCH-ALL — the same thing it would say about a code or a token that never
  -- existed — and not a message of its own.
  PERFORM set_config('request.jwt.claims',
                     format('{"role":"authenticated","sub":"%s"}', v_stranger), true);

  SELECT COUNT(*) INTO v_hits FROM public.validate_family_code(v_code);
  IF v_hits <> 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: validate_family_code() still names a REMOVED family. Its code remains an '
      'invitation to join something that is gone.';
  END IF;

  SELECT r.message INTO v_msg FROM public.join_family_by_code(v_code) r;
  IF v_msg IS DISTINCT FROM 'Family code not found. Check with your family and try again.' THEN
    RAISE EXCEPTION
      'ROLLBACK: join_family_by_code() on a REMOVED family answered %, expected the '
      'catch-all. Anything else is an enumeration oracle or an open door.',
      COALESCE(v_msg, '<null>');
  END IF;

  SELECT COUNT(*) INTO v_hits FROM public.peek_family_invitation(v_token);
  IF v_hits <> 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: peek_family_invitation() still describes an invitation into a REMOVED '
      'family, to an anonymous caller';
  END IF;

  SELECT r.message INTO v_msg FROM public.redeem_family_invitation(v_token) r;
  IF v_msg IS DISTINCT FROM 'That invitation is no longer valid. Ask for a new one.' THEN
    RAISE EXCEPTION
      'ROLLBACK: redeem_family_invitation() on a REMOVED family answered %, expected the '
      'catch-all', COALESCE(v_msg, '<null>');
  END IF;

  -- 8i. staff_set_family_status refuses everybody who is not staff, three ways.
  --
  -- THE SERVICE-ROLE PROBE GOES FIRST, and the order is not cosmetic. Deleting the
  -- staff gate and re-running this file was how it was checked (AGENTS.md §7: a green
  -- run is not evidence until you have seen it fail), and with the AUTHENTICATED probe
  -- first the mutation was caught by families_guard_removal instead — the right
  -- outcome, since the guard is a genuine second layer under this function, and the
  -- wrong REPORT, because the error then says nothing about the gate that went missing.
  -- A service-role caller is past that guard, so this probe is the one that isolates
  -- the gate itself.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SELECT r.ok, r.message INTO v_ok, v_msg
    FROM public.staff_set_family_status(v_code, 'active', v_stranger) r;
  IF v_ok IS DISTINCT FROM false OR v_msg IS DISTINCT FROM 'Not authorized' THEN
    RAISE EXCEPTION
      'ROLLBACK: staff_set_family_status admitted a service-role call naming a non-staff '
      'account (ok=%, message=%). The staff test lives in this function precisely so that '
      'a mistake in the console''s own guard is not the only thing holding.',
      v_ok, COALESCE(v_msg, '<null>');
  END IF;
  SELECT f.status INTO v_status FROM public.families f WHERE f.family_code = v_code;
  IF v_status <> 'removed' THEN
    RAISE EXCEPTION
      'ROLLBACK: a refused staff_set_family_status call restored the family anyway';
  END IF;

  -- No identity at all: what a service-role call that forgot to say who is acting
  -- looks like. It must fail closed rather than treating "nobody" as "trusted".
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT r.ok, r.message INTO v_ok, v_msg
    FROM public.staff_set_family_status(v_code, 'active') r;
  IF v_ok IS DISTINCT FROM false OR v_msg IS DISTINCT FROM 'Not authorized' THEN
    RAISE EXCEPTION
      'ROLLBACK: staff_set_family_status admitted a caller it could not identify '
      '(ok=%, message=%)', v_ok, COALESCE(v_msg, '<null>');
  END IF;

  -- And an authenticated member who has found the endpoint — the id they passed must
  -- be IGNORED, not validated, so naming somebody else buys them nothing.
  PERFORM set_config('request.jwt.claims',
                     format('{"role":"authenticated","sub":"%s"}', v_stranger), true);
  SELECT r.ok, r.message INTO v_ok, v_msg
    FROM public.staff_set_family_status(v_code, 'active', v_stranger) r;
  IF v_ok IS DISTINCT FROM false OR v_msg IS DISTINCT FROM 'Not authorized' THEN
    RAISE EXCEPTION
      'ROLLBACK: staff_set_family_status admitted an authenticated non-staff caller '
      '(ok=%, message=%)', v_ok, COALESCE(v_msg, '<null>');
  END IF;

  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- 8j. THE SUCCESS PATH, which needs the one fixture this file cannot invent.
  -- genorra_staff.user_id references auth.users, so a staff row needs a real
  -- account. A fresh database has none and SAYS SO rather than skipping quietly;
  -- hosted has plenty, so this is the half that actually runs there — which is the
  -- right way round, because hosted is where an unrun function would first throw.
  --
  -- The staff row exists only inside this transaction and is deleted below. It grants
  -- nothing lasting, and a failure anywhere here rolls the whole file back.
  SELECT u.id INTO v_user FROM auth.users u ORDER BY u.created_at ASC, u.id ASC LIMIT 1;

  IF v_user IS NULL THEN
    RAISE NOTICE
      'family removal: SKIPPED the staff_set_family_status success path — this database '
      'has no auth.users row to make temporarily staff. Every refusal above ran, and the '
      'UPDATE it would have exercised is the same one this block ran directly.';
  ELSE
    INSERT INTO public.genorra_staff (user_id, role, note)
    VALUES (v_user, 'engineer', 'Transient probe row, 20260817000006 §8j')
    ON CONFLICT (user_id) DO NOTHING;

    SELECT r.ok, r.status, r.message INTO v_ok, v_status, v_msg
      FROM public.staff_set_family_status(v_code, 'active', v_user) r;
    IF v_ok IS DISTINCT FROM true OR v_status <> 'active' THEN
      RAISE EXCEPTION
        'ROLLBACK: staff_set_family_status refused a genuine staff restore (ok=%, '
        'status=%, message=%)', v_ok, COALESCE(v_status, '<null>'), COALESCE(v_msg, '<null>');
    END IF;

    SELECT f.status, f.removed_at IS NULL INTO v_status, v_cleared
      FROM public.families f WHERE f.family_code = v_code;
    IF v_status <> 'active' THEN
      RAISE EXCEPTION 'ROLLBACK: the restore reported success and left status %', v_status;
    END IF;
    IF NOT v_cleared THEN
      RAISE EXCEPTION
        'ROLLBACK: the restore left removed_at set, so an active family carries a removal '
        'timestamp';
    END IF;

    -- The vocabulary check, from inside the function, for a caller it trusts.
    SELECT r.ok, r.message INTO v_ok, v_msg
      FROM public.staff_set_family_status(v_code, 'archived', v_user) r;
    IF v_ok IS DISTINCT FROM false OR v_msg NOT LIKE 'Unknown family status%' THEN
      RAISE EXCEPTION
        'ROLLBACK: staff_set_family_status accepted a status families_status_check would '
        'refuse (ok=%, message=%)', v_ok, COALESCE(v_msg, '<null>');
    END IF;

    -- And an unknown family code, for a caller it trusts.
    SELECT r.ok, r.message INTO v_ok, v_msg
      FROM public.staff_set_family_status('ZZNOPE9', 'active', v_user) r;
    IF v_ok IS DISTINCT FROM false OR v_msg IS DISTINCT FROM 'No family with that code.' THEN
      RAISE EXCEPTION
        'ROLLBACK: staff_set_family_status reported success for a family that does not '
        'exist (ok=%, message=%)', v_ok, COALESCE(v_msg, '<null>');
    END IF;

    DELETE FROM public.genorra_staff WHERE user_id = v_user;
    RAISE NOTICE 'family removal: staff_set_family_status restore path exercised end to end';
  END IF;

  PERFORM set_config('request.jwt.claims', '', true);

  -- 8k. Clean up.
  --
  -- ORDER IS LOAD-BEARING and it is 20260812000000 §6f's order rather than a fresh
  -- guess: the `families` row goes FIRST, because families_seed_system_funds gave
  -- this probe a Donations fund and funds_protect_system() releases a system fund
  -- for deletion on exactly one condition — that the `families` row is already gone.
  DELETE FROM public.family_invitations        WHERE family_code = v_code;
  DELETE FROM public.family_removal_challenges WHERE family_code = v_code;
  DELETE FROM public.families                 WHERE family_code = v_code;
  DELETE FROM public.funds                    WHERE family_code = v_code;
  DELETE FROM public.template_permissions tp
   USING public.permission_templates t
   WHERE tp.template_id = t.id AND t.family_code = v_code;
  DELETE FROM public.permission_templates     WHERE family_code = v_code;
  DELETE FROM public.resource_visibility      WHERE family_code = v_code;

  RAISE NOTICE
    'family removal verified: status defaults active, vocabulary closed, guard refuses '
    'authenticated and permits service_role, four doors refuse a removed family with the '
    'catch-all and admit an active one, admin/family/remove restricted everywhere with '
    'Administrators granted; probe family % removed', v_code;
END $mig$;

COMMIT;
