-- ============================================================================
-- Unpinning an announcement is a decision each member makes for themselves.
--
-- WHAT CHANGED ON SCREEN
--   Announcements no longer render as a banner above the dashboard. They are rows in
--   Recent Updates, interleaved with notifications, and a pinned one sits at the top
--   of that list until the reader dismisses it — after which it falls back into the
--   feed in published_at order rather than disappearing. So "unpin" now means "stop
--   holding this at the top of MY list", which is a per-reader fact and needs a row.
--
-- WHY A TABLE AND NOT localStorage
--   The banner this replaces kept its dismissed set in `localStorage`, which is a
--   different answer per browser: dismiss on a laptop, and the phone still shows it at
--   the top a week later. It is also unrecoverable — nothing can put a dismissal back,
--   because nothing else can read it. A row is per PERSON, so the answer follows the
--   member across devices and can be undone (Recent Updates offers "Pin again").
--
--   It is per `people.id` rather than per `auth.users.id` deliberately. A member can
--   belong to several families and announcements are family-scoped; keying on the
--   account would let a dismissal in one family silently apply in another.
--
-- THE FAMILY-WIDE PIN IS UNTOUCHED. `announcements.pinned` and `pinned_until` still
-- mean what they meant — an administrator holding announcements:edit decides what is
-- pinned FOR the family — and this table records only who has dismissed it. Two
-- different decisions by two different people, so two different places. Re-pinning
-- family-wide is still an administrator's act; re-pinning for yourself is a delete
-- from this table.
--
-- SELF-SERVICE, per AGENTS.md §2: dismissing a notice needs no grant (create/edit
-- default to 'none', so demanding one would mean nobody could ever dismiss anything),
-- and the check it owes instead is that the row is genuinely the caller's. That check
-- is `person_id = public.auth_person_id()` in all three policies — which carries both
-- halves at once, because auth_person_id() resolves the caller's row IN THE ACTIVE
-- FAMILY and returns NULL unless the membership is approved (20260806000011). A
-- pending, rejected or disabled caller therefore matches nothing here without a
-- conjunct of its own.
--
-- NOT ADDED TO permission_table_map. The sweep in 20260618000001 has already run, so a
-- row now would compose nothing — the same reason 20260806000013 writes its policy by
-- hand. There is also nothing to compose: this table has no permissioned read.
--
-- IDEMPOTENT. Policies are dropped by name and recreated.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See
--   AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The table ────────────────────────────────────────────────────────────
-- A row means "this person has dismissed this announcement from the top of their
-- Recent Updates". Absence means it is still pinned for them, which is why there is
-- no boolean: the default has to be "pinned", and a missing row is the cheapest way
-- to say so for a family that has never dismissed anything.
CREATE TABLE IF NOT EXISTS public.announcement_unpins (
  announcement_id UUID        NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  person_id       UUID        NOT NULL REFERENCES public.people(id)        ON DELETE CASCADE,
  -- Denormalized from the announcement, and not redundant: every query in this app is
  -- family-scoped by hand on the admin client (AGENTS.md §3), and the policies below
  -- test it too. Both foreign keys cascade, so it cannot outlive its own family's rows.
  family_code     TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (announcement_id, person_id)
);

-- The read is always "everything this person has dismissed", so the index leads with
-- the person. The primary key already answers the other direction.
CREATE INDEX IF NOT EXISTS announcement_unpins_person_idx
  ON public.announcement_unpins (person_id);

ALTER TABLE public.announcement_unpins ENABLE ROW LEVEL SECURITY;

-- ── 2. Policies: your own rows, in the family you are acting in ─────────────
-- No UPDATE policy, and none is wanted: a row has no mutable column. Re-pinning is a
-- DELETE, which is the honest shape — the member is withdrawing the dismissal, not
-- editing it.
DROP POLICY IF EXISTS "own announcement unpins:select" ON public.announcement_unpins;
CREATE POLICY "own announcement unpins:select"
  ON public.announcement_unpins FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND person_id = public.auth_person_id()
  );

DROP POLICY IF EXISTS "own announcement unpins:insert" ON public.announcement_unpins;
CREATE POLICY "own announcement unpins:insert"
  ON public.announcement_unpins FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND person_id = public.auth_person_id()
    -- The one thing RLS structurally cannot do on its own (AGENTS.md §4): the row
    -- being written is legitimately the caller's, while the id it CARRIES could point
    -- at another family's announcement. Checked here as well as in the action, because
    -- this table is reachable through PostgREST with any argument a caller likes.
    --
    -- BOTH OUTER COLUMNS ARE QUALIFIED, and that is the whole correctness of this
    -- clause. Inside the subquery an unqualified `family_code` resolves to `a`'s, not
    -- to the row being inserted, so `a.family_code = family_code` would be `a.x = a.x`
    -- — a tautology that admits any announcement id in the database.
    AND EXISTS (
      SELECT 1 FROM public.announcements a
       WHERE a.id = announcement_unpins.announcement_id
         AND a.family_code = announcement_unpins.family_code
    )
  );

DROP POLICY IF EXISTS "own announcement unpins:delete" ON public.announcement_unpins;
CREATE POLICY "own announcement unpins:delete"
  ON public.announcement_unpins FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND person_id = public.auth_person_id()
  );

-- ── 3. Verify ───────────────────────────────────────────────────────────────
-- Unconditional and fixture-free, so it cannot skip silently.
DO $mig$
DECLARE v_n int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='announcement_unpins'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: announcement_unpins was not created';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.announcement_unpins'::regclass) THEN
    RAISE EXCEPTION 'ROLLBACK: RLS is not enabled on announcement_unpins';
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='announcement_unpins';
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 3 policies on announcement_unpins, found %', v_n;
  END IF;

  -- Every policy must carry the person conjunct. Without it the table is a family-wide
  -- read of who has dismissed what, and a way to dismiss on somebody else's behalf.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='announcement_unpins'
     AND COALESCE(qual, '') || COALESCE(with_check, '') LIKE '%auth_person_id%';
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'ROLLBACK: only % of 3 policies name auth_person_id()', v_n;
  END IF;
END $mig$;

COMMIT;
