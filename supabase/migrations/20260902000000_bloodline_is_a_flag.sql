-- ════════════════════════════════════════════════════════════════════════════
-- THE BLOODLINE IS A FLAG ON THE PERSON, AND THE LINK VOCABULARY IS GONE
--
-- `people.is_bloodline` replaces a derivation: `person_relationships.link_kind`
-- (blood | step | adopted | foster), `families.bloodline_anchor_id`, and the walk over
-- them in `bloodlineIds()`. All three go, along with `linkKindLabel`, the marriage
-- guard trigger, the anchor guard trigger, the anchor picker, the anchor audit and
-- ~100 lines in `app/actions/dues.ts` that read the whole roster and every relationship
-- in the family to answer one boolean per member.
--
-- ── AGENTS.md §4c ARGUED THE OPPOSITE, AND ITS ARGUMENT IS ABOUT A DIFFERENT THING ──
-- It says: "On the edge, never on the person. The same child is a step-child of one
-- parent and a blood child of the other, so a `people.is_blood_relative` boolean would
-- have to be wrong about one of them."
--
-- That is true of a RELATIONSHIP LABEL and false of the BLOODLINE, and the two had been
-- sharing one column. `bloodlineIds()` walks from ONE anchor — `families.bloodline_anchor_id`,
-- family-wide by explicit decision ("two members cannot disagree about who is in the
-- family's bloodline") — and collapses every edge down to a SET OF PEOPLE. There has only
-- ever been one answer per person, so a per-person column holds it exactly. Nothing is
-- lost by storing what was being computed.
--
-- What IS lost is the label — "Step-son", "Adopted daughter" on a card — and that is the
-- requested change rather than a side effect.
--
-- ── AND THE DERIVATION HAD FAILED IN THE FIELD THREE TIMES ──────────────────────────
-- This is not a simplification that trades rigour for fewer lines. All three are recorded
-- in the code being deleted:
--
--   1. The first walk was a connected-component walk over blood edges, and a child is
--      blood to BOTH parents — so it chained through a half-sibling and put a member's
--      own WIFE in his bloodline. Reported as step-children carrying the droplet anyway.
--      Fixed by the shared-ancestor rule.
--
--   2. The shared-ancestor rule then computes the anchor's ancestors through both of the
--      anchor's parents, so a family created by a SON has his mother's entire line in the
--      bloodline. `auditBloodlineAnchor()` exists only to explain that on screen, and its
--      own header says the lever a member reaches for is the wrong one: "she IS his blood
--      mother, so marking it 'step' records something false and silently mis-classifies
--      her own relatives too."
--
--   3. And on 2026-09-01, in these words: "a sister added as the BLOOD sister of a brother
--      got no droplet and did not appear under Bloodline." Nothing was wrong — only `parent`
--      edges may conduct, precisely because chaining a sibling edge once put a step-daughter
--      in her step-father's bloodline — so the answer was correct and unexplainable, and the
--      fix was a sentence in a dialog asking whose children the two siblings are.
--      `lib/family-tree.test.ts` carried four tests defending that non-obviousness,
--      including a monotonicity argument against the tempting narrow fix. All four are gone
--      with the walk: tick the sister, and she is in.
--
-- A derivation whose inputs a family cannot state correctly, whose correction records a
-- falsehood, and whose correct answers need four tests to explain, is worse than the fact it
-- was deriving. The fact is "is this person in our bloodline", which is something a family
-- knows and can now say.
--
-- ── NOT NULL DEFAULT false, AND THAT REMOVES A THIRD STATE ──────────────────────────
-- `bloodlineIds()` answered NULL for "do not know" — no anchor, an anchor outside the
-- roster, or a failed read — and `duesEligibility` turned that into 'bloodline-unknown'
-- and billed nobody. There is no unknown here: a person is in the bloodline or is not.
--
-- THE MONEY OUTCOME IS UNCHANGED FOR EVERY FAMILY THAT EXISTS TODAY, and the §2 backfill
-- is what makes that true rather than approximately true:
--
--   a family with a usable anchor    the walk's answer is written to the column, so a
--                                    `bloodline_only` due bills exactly whom it billed
--   a family with no usable anchor   'bloodline-unknown' billed nobody; all-false bills
--                                    nobody. Same outcome, arrived at honestly
--
-- ── `is_bloodline` DECIDES MONEY, SO THE BROWSER MAY NOT WRITE IT ───────────────────
-- `dues_schedules.bloodline_only` is the one place descent decides who owes a due. The
-- `people` UPDATE policy admits a member's write to their own row (`community/directory`,
-- own_expr `user_id = auth.uid()`), and a policy has no opinion about which column
-- changed — so without §3 `saveProfileSection({ is_bloodline: false })` would be a member
-- exempting themselves from a blood-only due, with every policy satisfied. Exactly the
-- shape `people_guard_membership_status` and `people_guard_permission_template` close.
--
-- ── DROP COLUMN IS NOT ADDITIVE, AND THAT INVERTS THE DEPLOYMENT ARGUMENT ───────────
-- "How migrations reach the hosted project" turns on migrations being additive: the OLD
-- code serves while the schema moves, safely, because the running code does not use the
-- new column yet. Three DROP COLUMNs invert that — for one alias window the old code asks
-- for `link_kind` and `bloodline_anchor_id`, PostgREST answers 42703, and 42703 kills the
-- WHOLE query rather than that one column. The family tree and `/dues` would read empty
-- for the length of one deploy.
--
-- It is admissible for the reason `20260822000001` gave when it dropped
-- `position_journal_entries.body`: NO FAMILY IS USING THIS PRODUCT YET, so the caution
-- protects nobody. If that stops being true, the shape is two deploys — stop reading the
-- column, ship, then drop it.
--
-- ── ONE THING THIS CHANGES FOR EMBEDS (AGENTS.md §8) ────────────────────────────────
-- `families` has had TWO foreign keys to `people` since `20260817000006` —
-- `bloodline_anchor_id` and `removed_by` — which made a bare `people(...)` embed on
-- `families` PGRST201 everywhere. §5 drops the first, so that embed becomes RESOLVABLE
-- again. Nothing embeds it today and nothing should start on the strength of this: the
-- next column with a foreign key to `people` puts the ambiguity straight back.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. The column ───────────────────────────────────────────────────────────
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS is_bloodline BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.people.is_bloodline IS
  'TRUE when this person is in the family''s bloodline, as somebody in the family has '
  'stated it. Set only through setPersonBloodline() behind community/family-tree:edit; '
  'people_guard_bloodline refuses the authenticated role. Read by duesEligibility for '
  'dues_schedules.bloodline_only, and by the family tree''s Bloodline filter. NOT derived '
  'from relationships — 20260902000000 removed the walk that used to derive it.';

-- ── 2. Backfill: write down the answer the walk was giving ──────────────────
-- The rule `bloodlineIds()` implemented, in one statement: a person is in the bloodline
-- when they share an ancestor with the anchor. Faithful in all four particulars, because
-- an approximation here would write false facts about real families into a column that
-- decides money:
--
--   * ONLY 'blood' PARENT EDGES CONDUCT. A step or adoptive parent is not a route to a
--     line, and a marriage never is — `blood_parent` admits neither.
--   * BOTH STORED DIRECTIONS COUNT. Whether the inverse row was ever written depends on
--     whether anybody knew a gender at the time (`inverseTypeFor` answers null without
--     one), so a Father/Mother row and a Son/Daughter row are the same edge and both are
--     read. A one-directional walk drops half the parentage.
--   * SIBLING EDGES DO NOT CONDUCT. Deliberate in the original and preserved here: a
--     brother with no shared parent recorded is left out, because guessing which parent
--     two siblings share is precisely how a member's wife ended up in his bloodline.
--   * THE ANCHOR IS THE FAMILY'S STATED ONE, THE FOUNDER ONLY AS A FALLBACK — the same
--     resolution `getFamilyTree` and `familyBloodline` both performed, and they had to
--     agree or the tree and the bill would disagree about who is blood.
--
-- `UNION`, not `UNION ALL`, is the cycle guard. `person_relationships` has no constraint
-- stopping somebody being recorded as their own grandfather, and the recursive term would
-- not return a wrong answer on such a graph — it would not return at all. The (person,
-- ancestor) pair set is finite, so deduplicating terminates. Same hazard `ancestorsOf`
-- guarded with a `visiting` set.
--
-- EVERY JOIN CARRIES `family_code`. The walk must not cross a family boundary even if a
-- row does — `supabase/scripts/audit_cross_family_refs.sql` is what reports such a row,
-- and this backfill must not launder one into a bloodline.
WITH RECURSIVE anchor AS (
  SELECT f.family_code,
         COALESCE(
           (SELECT p.id FROM public.people p
             WHERE p.id = f.bloodline_anchor_id
               AND p.family_code = f.family_code),
           (SELECT p.id FROM public.people p
             WHERE p.user_id = f.created_by
               AND p.family_code = f.family_code
             ORDER BY p.created_at
             LIMIT 1)
         ) AS person_id
    FROM public.families f
),
blood_parent AS (
  SELECT r.family_code, r.person_id AS child_id, r.related_person_id AS parent_id
    FROM public.person_relationships r
    JOIN public.relationship_types t ON t.id = r.relationship_type_id
   WHERE r.link_kind = 'blood'
     AND t.name IN ('Father', 'Mother')
  UNION
  SELECT r.family_code, r.related_person_id AS child_id, r.person_id AS parent_id
    FROM public.person_relationships r
    JOIN public.relationship_types t ON t.id = r.relationship_type_id
   WHERE r.link_kind = 'blood'
     AND t.name IN ('Son', 'Daughter')
),
anc AS (
  -- Everybody is their own ancestor, which is what makes a descendant of the anchor and
  -- the anchor itself both come out blood without a special case.
  SELECT p.family_code, p.id AS person_id, p.id AS ancestor_id
    FROM public.people p
  UNION
  SELECT a.family_code, a.person_id, bp.parent_id
    FROM anc a
    JOIN blood_parent bp
      ON bp.child_id = a.ancestor_id
     AND bp.family_code = a.family_code
)
UPDATE public.people p
   SET is_bloodline = true
 WHERE EXISTS (
   SELECT 1
     FROM anchor an
     JOIN anc aa ON aa.family_code = an.family_code AND aa.person_id = an.person_id
     JOIN anc pa ON pa.family_code = an.family_code AND pa.person_id = p.id
                AND pa.ancestor_id = aa.ancestor_id
    WHERE an.family_code = p.family_code
      AND an.person_id IS NOT NULL
 );

-- ── 3. The guard: only the action may move it ──────────────────────────────
-- SECURITY INVOKER is load-bearing and is asserted in §6. A SECURITY DEFINER trigger sees
-- its own OWNER as `current_user` for every caller alike, so the test below would be false
-- for everybody and the guard would be decoration — the reason `20260806000011` chose
-- INVOKER for `people_guard_membership_status` and asserts `NOT prosecdef`.
--
-- IT IS A BOUNDARY AROUND THE ROLE THE BROWSER SPEAKS AS, not around the column. The
-- service role passes, deliberately: `setPersonBloodline` writes on the admin client after
-- resolving `community/family-tree:edit` and `belongsToFamily`, and `tests/rls/seed.mjs`
-- has to be able to state the flag outright.
CREATE OR REPLACE FUNCTION public.tg_person_guard_bloodline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_bloodline IS DISTINCT FROM OLD.is_bloodline
     AND current_user = 'authenticated' THEN
    RAISE EXCEPTION
      'is_bloodline may only be changed through setPersonBloodline()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS people_guard_bloodline ON public.people;
CREATE TRIGGER people_guard_bloodline
  BEFORE UPDATE OF is_bloodline ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.tg_person_guard_bloodline();

-- ── 4. `person_relationships.link_kind` and its trigger ────────────────────
-- The trigger rewrote 'blood' to 'step' on any spouse-type edge, on insert and on update,
-- because a marriage is never blood. With no kind on the edge there is nothing to correct.
DROP TRIGGER IF EXISTS person_relationships_marriage_is_not_blood ON public.person_relationships;
DROP FUNCTION IF EXISTS public.tg_relationship_marriage_is_not_blood();

-- Takes `person_relationships_link_kind_check` with it.
ALTER TABLE public.person_relationships DROP COLUMN IF EXISTS link_kind;

-- ── 5. `families.bloodline_anchor_id` and its trigger ──────────────────────
-- Added by `20260813000008` so a family could say which ancestor its line descends from,
-- because defaulting to the founder put a son's mother's line in the bloodline. With the
-- flag there is no walk, so there is nothing for an anchor to be the start of.
DROP TRIGGER IF EXISTS families_guard_bloodline_anchor ON public.families;
DROP FUNCTION IF EXISTS public.tg_family_guard_bloodline_anchor();

ALTER TABLE public.families DROP COLUMN IF EXISTS bloodline_anchor_id;

-- ── 6. Verify ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_n INT;
BEGIN
  -- The column, and its NOT NULL — a nullable one would reintroduce the third state this
  -- migration's header says has gone, silently, the first time somebody inserted a row
  -- without it.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'people'
       AND column_name = 'is_bloodline' AND is_nullable = 'NO'
       AND data_type = 'boolean'
  ) THEN
    RAISE EXCEPTION 'people.is_bloodline is missing, nullable, or not a boolean';
  END IF;

  -- The guard exists, fires on the column, and is INVOKER. All three, because a guard that
  -- is present and SECURITY DEFINER refuses nobody.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE t.tgrelid = 'public.people'::regclass
       AND t.tgname = 'people_guard_bloodline'
       AND NOT p.prosecdef
  ) THEN
    RAISE EXCEPTION
      'people_guard_bloodline is missing or is SECURITY DEFINER, which makes it inert';
  END IF;

  -- The three things that are gone.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'person_relationships'
       AND column_name = 'link_kind'
  ) THEN
    RAISE EXCEPTION 'person_relationships.link_kind survived';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'families'
       AND column_name = 'bloodline_anchor_id'
  ) THEN
    RAISE EXCEPTION 'families.bloodline_anchor_id survived';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'person_relationships'
       AND column_name = 'is_step'
  ) THEN
    RAISE EXCEPTION
      'person_relationships.is_step is back — 20260822000024 dropped it and nothing may write it';
  END IF;

  -- NOTHING IN THE SCHEMA MAY STILL DERIVE THIS. A policy, a CHECK or a SECURITY DEFINER
  -- body naming either dropped column would have failed to apply above; one naming
  -- `is_bloodline` is the thing to catch, because a future policy sweep composing the
  -- bloodline into an expression is how a per-person fact becomes a per-viewer one again.
  -- `dues_schedules.bloodline_only` is the SCHEDULE's setting and is deliberately exempt:
  -- `dues_schedules_freeze_used_terms` names it, correctly, and it is not this column.
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public'
     AND coalesce(qual, '') || coalesce(with_check, '') LIKE '%is_bloodline%';
  IF v_n > 0 THEN
    RAISE EXCEPTION
      '% policy expression(s) read people.is_bloodline — it gates money, not rows', v_n;
  END IF;

  -- AND NO `permission_table_map` ROW MAY NAME IT EITHER, for the reason
  -- `20260822000021` asserts the same thing for the Library keys: that column is what a
  -- future sweep composes policies FROM, so an expression parked there is a policy
  -- nobody has written yet.
  SELECT count(*) INTO v_n
    FROM public.permission_table_map
   WHERE coalesce(own_expr, '') || coalesce(self_expr, '') LIKE '%is_bloodline%';
  IF v_n > 0 THEN
    RAISE EXCEPTION '% permission_table_map row(s) name is_bloodline', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.people WHERE is_bloodline;
  RAISE NOTICE
    'Bloodline is a flag: people.is_bloodline set on % row(s) by the backfill; link_kind, bloodline_anchor_id and both their triggers are gone',
    v_n;
END $$;
