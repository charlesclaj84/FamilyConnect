-- ============================================================================
-- `person_relationships.link_kind` — does blood travel down this edge?
-- ----------------------------------------------------------------------------
-- WHY THE GRAPH COULD NOT ANSWER THIS ALREADY
--   A family wanted to see its bloodline, and the obvious implementation is to walk
--   parent/child/sibling edges and never spouse edges. That is right for one
--   generation and wrong from the second, in two separate ways:
--
--     * a spouse's mother acquires a CHILD edge the moment she is recorded, so a
--       walk that trusts child edges reaches her — through a marriage.
--     * and the case that actually forced this column: a member with three
--       children, one of them his by blood. Nothing in the graph distinguishes
--       them. Both edges are `child`, both are real, and only a person knows.
--
--   So it is not derivable, and this is the fact the database was missing.
--
-- ── WHY ON THE EDGE AND NOT ON THE PERSON ───────────────────────────────────
--   Because being blood is not a property somebody HAS. It is a property of the
--   link between two people, and the same child is on both sides of it at once:
--   step-son of the man who married his mother, blood son of the mother. A
--   `people.is_blood_relative` boolean has one value and would have to be wrong
--   about one of those two relationships — and it would be wrong about whichever
--   parent got recorded second, silently.
--
--   It is also the shape that survives the tree growing. Nothing has to be
--   revisited when the other parent is added later; the new edge carries its own
--   answer.
--
-- ── WHY A KIND AND NOT A BOOLEAN ────────────────────────────────────────────
--   `by_blood boolean` would drive the toggle perfectly well and would tell the
--   screen nothing. A family that records an adopted daughter has said something
--   they will want to see said back — "Adopted daughter" on her card, not a
--   missing person and not "Step-daughter", which is a different relationship and
--   the wrong word for her. One column that names the link answers both questions;
--   a boolean answers one and invites a second column later for the other.
--
-- ── `is_step` IS SUPERSEDED, NOT DROPPED ────────────────────────────────────
--   20260602000003 created `is_step` for exactly this job and nothing ever wrote
--   it: every insert in the codebase passes `false`, so the backfill below is a
--   formality and is written anyway, because a backfill that happens to be a no-op
--   today is not the same as one that was never needed.
--
--   It stays for now because it is NOT NULL DEFAULT false and costs nothing, and
--   because dropping a column is the kind of change that wants its own migration
--   with its own verify — see 20260813000006, where four SECURITY DEFINER bodies
--   had to be re-issued first. TODO.md carries it. Do not write it: `link_kind`
--   is the column, and two columns describing one fact is how they come to
--   disagree.
-- ============================================================================

ALTER TABLE public.person_relationships
  ADD COLUMN IF NOT EXISTS link_kind TEXT NOT NULL DEFAULT 'blood';

-- Named, so a failure says which value was refused rather than naming the table.
ALTER TABLE public.person_relationships
  DROP CONSTRAINT IF EXISTS person_relationships_link_kind_check;
ALTER TABLE public.person_relationships
  ADD CONSTRAINT person_relationships_link_kind_check
  CHECK (link_kind IN ('blood', 'step', 'adopted', 'foster'));

COMMENT ON COLUMN public.person_relationships.link_kind IS
  'blood | step | adopted | foster. Blood travels ONLY through ''blood'' — this is what '
  'the family tree''s Bloodline view walks. A property of the LINK, not of either person: '
  'the same child is a step-child of one parent and a blood child of the other. '
  'Supersedes is_step, which is never written.';

-- The backfill. Every existing row is a blood link unless somebody had marked it a
-- step relationship, which nothing in the app ever did — see the header.
UPDATE public.person_relationships
   SET link_kind = 'step'
 WHERE is_step IS TRUE
   AND link_kind = 'blood';

-- A spouse edge is never a blood link, whatever the column says. Blood does not travel
-- through a marriage, and that is the one part of this NOT left to a caller: an insert
-- that forgot to say so would put a spouse in the bloodline, which is the exact bug this
-- column exists to prevent. Enforced rather than documented.
--
-- Expressed against `relationship_types` by NAME because that table is the vocabulary
-- (20260602000003) and `lib/family-tree.ts` maps the same names onto 'spouse'. A trigger
-- rather than a CHECK, since a CHECK cannot see another table.
CREATE OR REPLACE FUNCTION public.tg_relationship_marriage_is_not_blood()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT rt.name INTO v_name
    FROM public.relationship_types rt
   WHERE rt.id = NEW.relationship_type_id;

  IF v_name IN ('Husband', 'Wife', 'Partner', 'Ex-Husband', 'Ex-Wife', 'Ex-Partner')
     AND NEW.link_kind = 'blood' THEN
    -- Corrected rather than refused: the caller is not wrong to omit it, and failing an
    -- ordinary "add my wife" on a column nobody typed would be a worse product than
    -- quietly holding the invariant. There is no legitimate blood marriage to protect.
    NEW.link_kind := 'step';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS person_relationships_marriage_is_not_blood ON public.person_relationships;
CREATE TRIGGER person_relationships_marriage_is_not_blood
  BEFORE INSERT OR UPDATE OF relationship_type_id, link_kind
  ON public.person_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_relationship_marriage_is_not_blood();

-- No GRANT: EXECUTE on a trigger function is checked at CREATE TRIGGER time, not at fire
-- time (AGENTS.md §2b). `search_path = ''` is set above, which is the rule that migration
-- section states for anything SECURITY DEFINER.

-- Fix the rows that predate the trigger, using the same list.
UPDATE public.person_relationships pr
   SET link_kind = 'step'
  FROM public.relationship_types rt
 WHERE rt.id = pr.relationship_type_id
   AND pr.link_kind = 'blood'
   AND rt.name IN ('Husband', 'Wife', 'Partner', 'Ex-Husband', 'Ex-Wife', 'Ex-Partner');

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Every assertion here needs a fixture EXCEPT the first two, and those two are the ones
-- that would catch this migration being wrong. The trigger test seeds its own rows and
-- rolls them back, so it cannot skip either — the only thing it needs is two people and
-- a relationship type, and it makes them.
DO $mig$
DECLARE
  v_bad      int;
  v_fam      text := 'MIGTEST7';
  v_a        uuid;
  v_b        uuid;
  v_type     uuid;
  v_kind     text;
BEGIN
  -- 1. The column exists with the constraint on it. Unconditional.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'person_relationships'
       AND column_name = 'link_kind' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'person_relationships.link_kind is missing or nullable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'person_relationships_link_kind_check'
       AND conrelid = 'public.person_relationships'::regclass
  ) THEN
    RAISE EXCEPTION 'the link_kind CHECK constraint is missing — any string would be accepted';
  END IF;

  -- 2. No spouse edge survives as blood. Unconditional, and empty on a fresh database,
  --    which is the correct answer rather than a skipped one.
  SELECT count(*) INTO v_bad
    FROM public.person_relationships pr
    JOIN public.relationship_types rt ON rt.id = pr.relationship_type_id
   WHERE pr.link_kind = 'blood'
     AND rt.name IN ('Husband', 'Wife', 'Partner', 'Ex-Husband', 'Ex-Wife', 'Ex-Partner');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '% marriage edge(s) are still marked blood', v_bad;
  END IF;

  -- 3. THE TRIGGER ACTUALLY FIRES. plpgsql resolves nothing until the body runs, so a
  --    bad reference inside it would have been created without complaint and thrown for
  --    the first person to add a spouse. Exercised against throwaway rows.
  SELECT id INTO v_type FROM public.relationship_types WHERE name = 'Wife';
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'relationship_types has no Wife row — 20260813000005 should have seeded it';
  END IF;

  INSERT INTO public.people (family_code, first_name, last_name)
       VALUES (v_fam, 'Mig', 'Husband') RETURNING id INTO v_a;
  INSERT INTO public.people (family_code, first_name, last_name)
       VALUES (v_fam, 'Mig', 'Wife') RETURNING id INTO v_b;

  -- Inserted as 'blood' on purpose: the trigger's whole job is to refuse to let that stand.
  INSERT INTO public.person_relationships
         (person_id, related_person_id, relationship_type_id, family_code, link_kind)
       VALUES (v_a, v_b, v_type, v_fam, 'blood');

  SELECT link_kind INTO v_kind FROM public.person_relationships
   WHERE person_id = v_a AND related_person_id = v_b;

  DELETE FROM public.person_relationships WHERE family_code = v_fam;
  DELETE FROM public.people WHERE family_code = v_fam;

  IF v_kind <> 'step' THEN
    RAISE EXCEPTION
      'the marriage-is-not-blood trigger did not fire: a Wife edge inserted as blood came '
      'back as %. A spouse would appear in the Bloodline view.', v_kind;
  END IF;

  RAISE NOTICE 'link_kind added; % relationship(s) carry it',
    (SELECT count(*) FROM public.person_relationships);
END $mig$;
