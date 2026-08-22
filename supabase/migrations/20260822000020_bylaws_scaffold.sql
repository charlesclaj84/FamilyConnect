-- ============================================================================
-- Bylaws: SCAFFOLDING. A family uploads its governing documents and can search inside them.
--
-- ── WHAT "SCAFFOLDING" MEANS HERE, STATED SO NOBODY READS MORE INTO IT ──────
-- This file gives the feature its table, its search index and its boundary. It does NOT give
-- it text extraction, and that absence is the whole of what makes it scaffolding rather than
-- the feature:
--
--   BUILT     a row per document, the file in the `documents` bucket, a full-text index over
--             whatever text the row holds, and a search that uses it.
--   BUILT     plain-text formats are read on upload, so a `.txt` or `.md` bylaw is searchable
--             by its CONTENTS on the day it is uploaded.
--   NOT BUILT extraction from PDF and Word, which is where a real family's bylaws live. Those
--             upload, store and are searchable by TITLE and SUMMARY only, and the screen says
--             so rather than returning nothing and letting the reader conclude the search is
--             broken.
--
-- The column the extraction would fill exists and is indexed, so turning it on is a job that
-- writes `content_text` and nothing else — no migration, no reindex, no change to the search.
-- That is the point of building the scaffold in this order.
--
-- ── WHY A TABLE OF ITS OWN, AND NOT A `documents` CATEGORY ──────────────────
-- `documents` already has a `bylaws` category, and this deliberately does not reuse it. Three
-- reasons and the third is the one that decides it:
--
--   * A bylaw is SEARCHED INSIDE. Nothing else in `documents` is, and putting a tsvector and
--     an extracted-text column on that table would give every form and every filing a column
--     that is null forever.
--   * A bylaw is ORDERED and ARTICLED. `article` and `sort_order` are what let the screen
--     render a table of contents; a document has neither.
--   * The two answer different questions. "Where is the 2026 dues form" is a filing question
--     and `documents` is the filing cabinet. "What do our bylaws say about quorum" is a
--     reading question, and the answer is a passage rather than a file.
--
-- The `bylaws` CATEGORY on `documents` stays, because a family may well file a scanned
-- historical copy there, and removing a category is a data change this file has no reason to
-- make.
--
-- ── THE BOUNDARY IS THE SAME ONE MEETING MINUTES USES ───────────────────────
-- One SELECT policy — family and approval — and NO write policy, so §2c denies INSERT, UPDATE
-- and DELETE to the browser outright. Writes go through `app/actions/bylaws.ts` on the admin
-- client, which resolves `journals/bylaws:create` / `:delete` and re-applies family scoping by
-- hand (§3). A guard trigger checks the one referenced id.
--
-- READ BY THE WHOLE FAMILY, and that is the feature rather than a default: bylaws are the
-- rules the family agreed to live by, and a rule nobody may read is not one. `journals/bylaws:view`
-- gates the SCREEN so a family that has not adopted any can switch it off; it decides no row
-- and has no `permission_table_map` entry (20260822000018 §9f asserts that for both new keys).
--
-- ── THE SEARCH VECTOR IS GENERATED, NEVER MAINTAINED ────────────────────────
-- `GENERATED ALWAYS AS (...) STORED`, the same shape `notifications.search_vector` uses. A
-- trigger-maintained vector is a second definition of what a document says, and it goes stale
-- the first time a write path forgets to call it. `'english'` is pinned as a LITERAL regconfig
-- because a generated column must be immutable — `to_tsvector(text)` reads
-- `default_text_search_config` from the session and is only STABLE, so Postgres refuses it.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
--   the GIN index not created
--     ERROR: bylaws.search_vector has no index — every search is a sequential scan
--   the guard trigger not created
--     ERROR: bylaws accepted a cross-family uploader
--   a write policy added
--     ERROR: bylaws has N write policy/policies — the actions are the boundary
--   `content_text` left out of the generated expression
--     ERROR: bylaws.search_vector does not index content_text
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.bylaws (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  text NOT NULL,
  title        text NOT NULL,
  -- "Article IV", "Section 3(b)" — free text, because every family numbers its own differently
  -- and a structured version would be this product having an opinion about their constitution.
  article      text,
  summary      text,
  -- ── THE EXTRACTED TEXT, AND IT IS NULL FOR MOST ROWS TODAY ────────────────
  -- Filled on upload for the plain-text formats and left NULL for PDF and Word. The screen
  -- reports which of the two a row is, because "no result" and "not indexed" are different
  -- facts and only one of them means the search worked.
  content_text text,
  -- The object in the `documents` bucket, `<family_code>/bylaws/<id>.<ext>`. NULL is legal: a
  -- family may type an article in without having a file for it.
  file_path    text,
  mime_type    text,
  file_size_bytes bigint,
  sort_order   int NOT NULL DEFAULT 0,
  uploaded_by  uuid REFERENCES public.people(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english'::regconfig,
      coalesce(title, '') || ' ' || coalesce(article, '') || ' '
      || coalesce(summary, '') || ' ' || coalesce(content_text, ''))
  ) STORED,
  CONSTRAINT bylaws_title_not_blank CHECK (btrim(title) <> '')
);

CREATE INDEX IF NOT EXISTS bylaws_family_order_idx
  ON public.bylaws (family_code, sort_order, created_at);
CREATE INDEX IF NOT EXISTS bylaws_uploaded_by_fk_idx ON public.bylaws (uploaded_by);
CREATE INDEX IF NOT EXISTS bylaws_search_idx ON public.bylaws USING gin (search_vector);

COMMENT ON TABLE public.bylaws IS
  'A family''s governing documents, searchable. SCAFFOLDING as of 2026-08-22: content_text is '
  'filled for plain-text uploads only, so a PDF is searchable by title and summary until '
  'extraction is built. Readable by every approved member; written only through '
  'app/actions/bylaws.ts.';
COMMENT ON COLUMN public.bylaws.content_text IS
  'The document''s text, for searching inside it. NULL where the format has not been '
  'extracted — see the table comment. Filling this for PDF/Word is the one job that turns the '
  'scaffold into the feature, and it needs no schema change.';

ALTER TABLE public.bylaws ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perm:bylaws:select" ON public.bylaws;
CREATE POLICY "perm:bylaws:select" ON public.bylaws FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code() AND public.auth_membership_approved());

-- §2c: a statement of intent, not what makes it safe. The absence of a write policy is.
GRANT SELECT ON public.bylaws TO authenticated;

-- ── The guard (§4) ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_bylaw_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_other text;
BEGIN
  IF NEW.uploaded_by IS NOT NULL THEN
    SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.uploaded_by;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'bylaws: uploader % is not in family %', NEW.uploaded_by, NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bylaws_same_family ON public.bylaws;
CREATE TRIGGER bylaws_same_family BEFORE INSERT OR UPDATE ON public.bylaws
  FOR EACH ROW EXECUTE FUNCTION public.tg_bylaw_same_family();

DROP TRIGGER IF EXISTS bylaws_updated_at ON public.bylaws;
CREATE TRIGGER bylaws_updated_at BEFORE UPDATE ON public.bylaws
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Verify ──────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n    int;
  v_bad  text;
  v_expr text;
  v_fam  text := 'ZZBYLAW1';
  v_fam2 text := 'ZZBYLAW2';
  v_p2   uuid;
  v_ok   boolean;
BEGIN
  -- 1. No write policy, one read policy.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'bylaws' AND cmd <> 'SELECT';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'bylaws has % write policy/policies — the actions are the boundary', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname = 'public' AND tablename = 'bylaws' AND cmd = 'SELECT') THEN
    RAISE EXCEPTION 'bylaws has no SELECT policy — nobody can read the family''s own rules';
  END IF;
  SELECT string_agg(policyname, ', ') INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'bylaws'
     AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%auth_permission%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a bylaws policy evaluates auth_permission: %', v_bad;
  END IF;

  -- 2. The search vector indexes the column the extraction will fill, and it is INDEXED.
  -- Both halves: a generated column with no GIN index is a sequential scan per search, which
  -- is the kind of thing that works on a laptop and is discovered in production.
  SELECT pg_get_expr(d.adbin, d.adrelid) INTO v_expr
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
   WHERE d.adrelid = 'public.bylaws'::regclass AND a.attname = 'search_vector';
  IF v_expr IS NULL OR v_expr NOT LIKE '%content_text%' THEN
    RAISE EXCEPTION 'bylaws.search_vector does not index content_text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'public' AND tablename = 'bylaws'
                    AND indexdef LIKE '%gin%search_vector%') THEN
    RAISE EXCEPTION 'bylaws.search_vector has no index — every search is a sequential scan';
  END IF;

  -- 3. The guard, exercised. Unwound by a sentinel.
  BEGIN
    INSERT INTO public.families (family_code, family_name) VALUES (v_fam,  'bylaw probe 1');
    INSERT INTO public.families (family_code, family_name) VALUES (v_fam2, 'bylaw probe 2');
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
      VALUES (v_fam2, 'Probe', 'Two', 'zzbylaw2@example.invalid') RETURNING id INTO v_p2;

    v_ok := false;
    BEGIN
      INSERT INTO public.bylaws (family_code, title, uploaded_by)
        VALUES (v_fam, 'probe', v_p2);
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'bylaws accepted a cross-family uploader'; END IF;

    -- The positive control, and it doubles as a check that the generated column really does
    -- see `content_text`: a search for a word that appears ONLY there must match.
    INSERT INTO public.bylaws (family_code, title, content_text)
      VALUES (v_fam, 'Article I', 'The quorum shall be one third of the membership.');
    IF NOT EXISTS (SELECT 1 FROM public.bylaws
                    WHERE family_code = v_fam
                      AND search_vector @@ websearch_to_tsquery('english', 'quorum')) THEN
      RAISE EXCEPTION 'a word in content_text is not findable through search_vector';
    END IF;

    RAISE EXCEPTION 'unwind-bylaw-probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'unwind-bylaw-probe' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'bylaws: scaffolded, family-readable, written by the actions, searchable';
END $mig$;

COMMIT;
