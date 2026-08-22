-- ============================================================================
-- An announcement may name the election it is about, so pressing it opens the ballot.
--
-- `announceElection` has posted a notice on every publication since elections shipped, and
-- the notice was a dead end: the title read "New Election: Board 2027", the body said when
-- nominations opened, and there was no way from it to the election. A member had to find
-- Community > Elections in the rail and pick the right one out of the list — which is the
-- one thing the notice existed to save them.
--
-- ── A COLUMN, NOT A URL IN THE BODY ─────────────────────────────────────────
-- The cheap version is a `link_href TEXT` the writer fills in. It was rejected: a text
-- column holding a route is a reference the database cannot check, cannot cascade and cannot
-- family-scope, and the moment anything user-facing can set it, it is an open redirect. A
-- real foreign key gets all three for free, and §C below adds the fourth thing a bare FK does
-- not give — the cross-family guard.
--
-- ── ON DELETE SET NULL, NOT CASCADE ─────────────────────────────────────────
-- Deleting an election must not silently delete the family's record that it happened.
-- `unpublishElection` and `deleteElection` already refuse once anybody has acted, so the row
-- that goes is a draft nobody used — and even then the notice stays, as a notice, having lost
-- only its way through. The reverse (CASCADE) would make removing a mis-typed draft delete a
-- post an administrator may have edited since.
--
-- ── §8: WHAT THIS DOES TO EMBEDS, ASKED RATHER THAN ASSUMED ─────────────────
-- Adding a foreign key is exactly the move AGENTS.md §8 warns turns a correct bare embed into
-- PGRST201 on a table nobody touched — `announcement_unpins` did it to `announcements`, and
-- one column on `families` did it to `people`. This adds `announcements -> elections`, a pair
-- that had none. §D asserts the pair count is 1 and, more usefully, asserts that NO pair
-- anywhere in `public` newly went above 1 because of this file, which is the check the
-- `announcement_unpins` incident wanted and did not have.
--
-- Nothing embeds `elections(...)` from `announcements` today: `SELECT_COLUMNS` in
-- `app/actions/announcements.ts` takes the id as a plain column, precisely so this link costs
-- no embed and cannot be the next PGRST201.
--
-- ── THE BROWSER CANNOT SET IT TO A USEFUL LIE, AND THAT IS THE GUARD'S JOB ──
-- `announcements` has an INSERT policy admitting `announcements:create`, and a policy is a
-- predicate over the row: `family_code` is checked, `election_id` is not (§4 exactly). So a
-- member who may post could file a notice in THEIR family carrying ANOTHER family's election
-- id, and every reader of that notice would be handed a link that 404s — or, if the reference
-- were ever embedded, a title from a family they cannot see. `tg_announcement_same_family`
-- refuses it, and refuses on UPDATE too, because a policy has no opinion about which column
-- changed.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
--   the trigger not created
--     ERROR: announcements accepted an election from another family
--   the trigger created BEFORE INSERT only
--     ERROR: announcements accepted a cross-family election on UPDATE
--   `IS DISTINCT FROM` written as `<>`
--     ERROR: announcements accepted an election id that matches no row
--     (a missing election makes the comparison NULL, which `<>` treats as "not false")
--   ON DELETE SET NULL written as CASCADE
--     ERROR: announcements.election_id is ON DELETE c, not SET NULL
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

-- ── A. The column ───────────────────────────────────────────────────────────
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS election_id uuid
    REFERENCES public.elections(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.announcements.election_id IS
  'The election this notice is about, when the product posted it — set only by '
  'announceElection. Gives the card somewhere to go. NULL for every hand-written '
  'announcement, which is almost all of them. ON DELETE SET NULL: removing a draft election '
  'must not remove the family''s record that it was announced.';

-- Partial, because almost every row is NULL and the only question anybody asks of this column
-- is "which notices point at this election" — `deleteElection` does not ask it (the FK
-- handles that), but a future "the ballot has moved" sweep would.
CREATE INDEX IF NOT EXISTS announcements_election_id_idx
  ON public.announcements (election_id)
  WHERE election_id IS NOT NULL;

-- ── B. No RLS change, deliberately ──────────────────────────────────────────
-- §2c: a table in `public` is born readable and writable by both browser roles, and RLS is the
-- whole gate. `announcements` already has its four composed policies and this column changes
-- none of them — the notice is exactly as visible as it was, and the election behind it keeps
-- its own `auth_may_see_election` narrowing. A member who is handed this id and cannot see the
-- election gets the same 404 they would get typing the URL, which is the correct answer and is
-- why nothing here widens anything.
--
-- What the APP owes on top is §5, and it is in `app/actions/announcements.ts`: the id is
-- withheld from any caller who may not view Elections at all, so the card does not offer a way
-- through that leads to a 404.

-- ── C. The cross-family guard (§4) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_announcement_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_election_family text;
BEGIN
  IF NEW.election_id IS NOT NULL THEN
    SELECT e.family_code INTO v_election_family
      FROM public.elections e WHERE e.id = NEW.election_id;
    -- IS DISTINCT FROM, so a `NULL` from a missing election is caught. `<>` would answer NULL
    -- there, which an IF treats as false, and the row would be written pointing at nothing.
    IF v_election_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'announcements: election % belongs to family %, not % — a notice may only point at its own family''s election',
        NEW.election_id, COALESCE(v_election_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- No grant: EXECUTE on a trigger function is checked at CREATE TRIGGER time, not at fire time
-- (§2b). Naming it here so the next reader does not add one.

DROP TRIGGER IF EXISTS announcements_same_family ON public.announcements;
CREATE TRIGGER announcements_same_family
  BEFORE INSERT OR UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.tg_announcement_same_family();

-- ── D. Verify ───────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_action  "char";
  v_pairs   int;
  v_family  text := 'ZZGUARD1';
  v_family2 text := 'ZZGUARD2';
  v_e2      uuid;
  v_ok      boolean;
BEGIN
  -- D1. The column exists and deletes the right way.
  SELECT confdeltype INTO v_action
    FROM pg_constraint
   WHERE conrelid = 'public.announcements'::regclass
     AND contype = 'f'
     AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                          WHERE attrelid = 'public.announcements'::regclass
                            AND attname = 'election_id')];
  IF v_action IS NULL THEN
    RAISE EXCEPTION 'announcements.election_id has no foreign key to elections';
  END IF;
  IF v_action <> 'n' THEN
    RAISE EXCEPTION 'announcements.election_id is ON DELETE %, not SET NULL', v_action;
  END IF;

  -- D2. §8. No pair of tables in `public` has more than one foreign key between them that did
  -- not have one before — which for this file means the new pair must be exactly 1. Derived
  -- from the catalogue rather than listed, so a table added next year is checked with no edit.
  SELECT count(*) INTO v_pairs
    FROM pg_constraint
   WHERE contype = 'f' AND connamespace = 'public'::regnamespace
     AND conrelid = 'public.announcements'::regclass
     AND confrelid = 'public.elections'::regclass;
  IF v_pairs <> 1 THEN
    RAISE EXCEPTION
      'announcements -> elections now has % foreign keys; a bare elections(...) embed would be PGRST201',
      v_pairs;
  END IF;

  -- D3. THE GUARD, EXERCISED FOR REAL rather than asserted from the catalogue. A trigger that
  -- exists is not a trigger that fires, and `pg_trigger` cannot tell you which. Everything is
  -- unwound by the sentinel below, so this file leaves no rows behind.
  BEGIN
    INSERT INTO public.families (family_code, family_name) VALUES (v_family, 'guard probe 1');
    INSERT INTO public.families (family_code, family_name) VALUES (v_family2, 'guard probe 2');
    INSERT INTO public.elections (family_code, title, status)
      VALUES (v_family2, 'other family election', 'draft')
      RETURNING id INTO v_e2;

    -- The cross-family write must be refused.
    v_ok := false;
    BEGIN
      INSERT INTO public.announcements (family_code, title, body, scope, election_id)
        VALUES (v_family, 'probe', 'probe', 'national', v_e2);
    EXCEPTION WHEN check_violation THEN
      v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'announcements accepted an election from another family';
    END IF;

    -- An id matching NO election must be refused too, or `<>` has crept back in.
    v_ok := false;
    BEGIN
      INSERT INTO public.announcements (family_code, title, body, scope, election_id)
        VALUES (v_family, 'probe', 'probe', 'national',
                '00000000-0000-0000-0000-000000000001'::uuid);
    EXCEPTION
      WHEN check_violation THEN v_ok := true;
      -- A missing id also trips the foreign key, which is a correct refusal by another route.
      WHEN foreign_key_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'announcements accepted an election id that matches no row';
    END IF;

    -- AND ON UPDATE, which is the half a BEFORE INSERT-only trigger would miss: the row is
    -- written clean and repointed a moment later, and the INSERT policy has already had its
    -- say.
    INSERT INTO public.announcements (family_code, title, body, scope)
      VALUES (v_family, 'probe', 'probe', 'national');
    v_ok := false;
    BEGIN
      UPDATE public.announcements SET election_id = v_e2
       WHERE family_code = v_family;
    EXCEPTION WHEN check_violation THEN
      v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'announcements accepted a cross-family election on UPDATE';
    END IF;

    -- And the ORDINARY write still works, or the guard is refusing everything and the
    -- assertions above prove nothing. This is the positive control (AGENTS.md §7).
    UPDATE public.elections SET family_code = v_family
      WHERE id = v_e2;
    UPDATE public.announcements SET election_id = v_e2
     WHERE family_code = v_family;
    IF NOT EXISTS (SELECT 1 FROM public.announcements
                    WHERE family_code = v_family AND election_id = v_e2) THEN
      RAISE EXCEPTION 'the guard refused a notice pointing at its OWN family''s election';
    END IF;

    RAISE EXCEPTION 'unwind-guard-probe';
  EXCEPTION WHEN raise_exception THEN
    -- Compared BY MESSAGE. Swallowing every raise_exception here would hide a real assertion
    -- failure above as a pass, which is the trap 20260820000006's storage probe records.
    IF SQLERRM <> 'unwind-guard-probe' THEN
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'announcements.election_id added; the guard refuses a cross-family election on insert and on update';
END $mig$;
