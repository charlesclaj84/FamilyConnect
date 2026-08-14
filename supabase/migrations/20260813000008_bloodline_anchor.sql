-- ============================================================================
-- `families.bloodline_anchor_id` — the person the family's line descends FROM.
-- ----------------------------------------------------------------------------
-- WHAT WAS WRONG
--   The family tree's Bloodline view walks up from an anchor and keeps everybody
--   who shares an ancestor with it. The rule is right; the anchor was
--   `families.created_by` — whoever signed up — and that is a different person
--   from the one a family's line descends from.
--
--   The reported case, in full:
--
--     Big Chuckie  ── married Sandra ──> Little Chuckie, Yolanda
--                  ── married Wanda  ──> Jerrell
--
--   The family was created by LITTLE Chuckie, so the walk started at him and his
--   ancestors are {himself, Big Chuckie, Sandra}. Everyone came out right except
--   Sandra, who is Big Chuckie's former wife and no blood relation to his line —
--   but IS the anchor's mother, so the walk collected her. Wanda, the same kind
--   of person, was correctly excluded, purely because she happens not to be the
--   founder's mother. One rule, two answers, decided by who registered first.
--
--   Anchored at Big Chuckie the same rule gives all six: him, both his sons and
--   his daughter in; both wives out.
--
-- ── WHY A COLUMN RATHER THAN A BETTER GUESS ─────────────────────────────────
--   There is no derivation to reach for. "The oldest person" is wrong for a
--   family that has recorded a spouse's parents; "the one with most descendants"
--   is wrong until the tree is built; "the founder" is what is already there and
--   is what broke. Which line a family considers ITS line is a fact about the
--   family, not about its data, so it is stored and it is theirs to set.
--
-- ── NULLABLE, AND NULL MEANS "FALL BACK TO THE FOUNDER" ─────────────────────
--   Every existing family keeps exactly today's behaviour until somebody sets
--   this, so the column ships without a backfill that would have to guess. The
--   app resolves `bloodline_anchor_id ?? founder`, and `bloodlineIds()` already
--   returns null — hiding the toggle rather than answering — when neither
--   resolves.
--
--   ON DELETE SET NULL, so removing a person from the family degrades the view
--   to the old default instead of leaving a dangling anchor that matches nobody
--   and silently empties the bloodline.
--
-- ── ADDITIVE, DELIBERATELY ──────────────────────────────────────────────────
--   A nullable column with a default of NULL. The running code does not select
--   it, so this can be applied while the old build is still serving — the
--   property `20260813000006` did NOT have, and the reason that deploy had a
--   window where profile saves failed. See AGENTS.md, "How migrations reach the
--   hosted project".
-- ============================================================================

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS bloodline_anchor_id UUID
    REFERENCES public.people(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.families.bloodline_anchor_id IS
  'The person the family''s bloodline descends from — the family tree walks up from here '
  'and keeps everybody who shares an ancestor with them. NULL falls back to the founder '
  '(families.created_by), which is what every family had before this column existed. '
  'Must name a people row in THIS family; families_guard_bloodline_anchor enforces it.';

-- ── The anchor must be one of this family's own people ──────────────────────
-- A foreign key constrains EXISTENCE and not ownership (AGENTS.md §4), so without
-- this a family could anchor its bloodline on a person in another family. That
-- leaks nothing by itself — the walk only ever collects ids from this family's own
-- roster — but it would silently produce an empty bloodline and no screen could
-- say why.
--
-- A trigger rather than a CHECK, because a CHECK cannot see another table.
CREATE OR REPLACE FUNCTION public.tg_family_guard_bloodline_anchor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.bloodline_anchor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.people p
     WHERE p.id = NEW.bloodline_anchor_id
       AND p.family_code = NEW.family_code
  ) THEN
    RAISE EXCEPTION
      'bloodline_anchor_id % is not a member of family %',
      NEW.bloodline_anchor_id, NEW.family_code;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS families_guard_bloodline_anchor ON public.families;
CREATE TRIGGER families_guard_bloodline_anchor
  BEFORE INSERT OR UPDATE OF bloodline_anchor_id, family_code
  ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_family_guard_bloodline_anchor();

-- No GRANT: EXECUTE on a trigger function is checked at CREATE TRIGGER time (§2b).
--
-- NOTE ON WHO MAY WRITE THE COLUMN. Unlike `tier` and `family_code`, this one is NOT
-- withheld from the `authenticated` role. It is ordinary family configuration — the same
-- kind of thing as the family's name, which members with `admin/family:edit` already set
-- through the user client — rather than a billing fact or an identity. The grant check
-- lives in `setBloodlineAnchor`, and the policy on `families` is what scopes the write to
-- the caller's own family.

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Unconditional: the column and the trigger need no fixture. The behaviour test
-- makes its own family and rolls it back, so it cannot skip either.
DO $mig$
DECLARE
  v_code text := 'MIGTEST8';
  v_other text := 'MIGTEST8B';
  v_person uuid;
  v_alien  uuid;
  v_raised boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'families'
       AND column_name = 'bloodline_anchor_id'
  ) THEN
    RAISE EXCEPTION 'families.bloodline_anchor_id is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'families_guard_bloodline_anchor'
       AND tgrelid = 'public.families'::regclass
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'families_guard_bloodline_anchor is missing — any family''s person would be accepted';
  END IF;

  -- THE TRIGGER REALLY FIRES. plpgsql resolves nothing until the body runs, so a bad
  -- reference inside it would apply cleanly and throw for the first caller.
  INSERT INTO public.families (family_code, family_name) VALUES (v_code, 'Mig Eight');
  INSERT INTO public.families (family_code, family_name) VALUES (v_other, 'Mig Eight B');
  INSERT INTO public.people (family_code, first_name, last_name)
       VALUES (v_code, 'Mig', 'Anchor') RETURNING id INTO v_person;
  INSERT INTO public.people (family_code, first_name, last_name)
       VALUES (v_other, 'Mig', 'Alien') RETURNING id INTO v_alien;

  -- Its own family's person is accepted.
  UPDATE public.families SET bloodline_anchor_id = v_person WHERE family_code = v_code;

  -- Another family's is not.
  BEGIN
    UPDATE public.families SET bloodline_anchor_id = v_alien WHERE family_code = v_code;
  EXCEPTION WHEN others THEN
    v_raised := true;
  END;

  DELETE FROM public.people   WHERE family_code IN (v_code, v_other);
  DELETE FROM public.families WHERE family_code IN (v_code, v_other);

  IF NOT v_raised THEN
    RAISE EXCEPTION
      'the bloodline anchor guard did not fire: a family accepted another family''s person '
      'as its anchor, which would silently empty its bloodline.';
  END IF;

  RAISE NOTICE 'bloodline_anchor_id added; % family/families have one set',
    (SELECT count(*) FROM public.families WHERE bloodline_anchor_id IS NOT NULL);
END $mig$;
