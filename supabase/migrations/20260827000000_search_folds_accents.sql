-- ─────────────────────────────────────────────────────────────────────────────────────
-- SEARCH FOLDS ACCENTS, IN EVERY LANGUAGE THE PRODUCT SPEAKS
--
-- Three full-text search vectors — `announcements`, `notifications` and `bylaws` — were
-- built with `'english'`. Now that the product reads in Spanish and French, that was
-- checked rather than assumed, and the finding is not the one expected.
--
-- ── WHAT `'english'` ACTUALLY DOES TO SPANISH AND FRENCH ────────────────────────────
-- Measured against this stack, not reasoned about:
--
--   to_tsvector('english', 'Reunión … las mesas') @@ websearch_to_tsquery('english', 'mesas')  → t
--   … the same row, queried for the SINGULAR 'mesa'                                            → t
--   to_tsvector('english', 'Réunion … les tables') @@ … 'tables'                               → t
--   … the same row, 'table'                                                                    → t
--   to_tsvector('english', 'la casa de la abuela')  →  'abuela' 'casa' 'de' 'la'
--
-- SO IT IS NOT BROKEN. The `-s` plural rule is shared across all three languages, and
-- Spanish and French function words are not English stop words, so nothing is discarded.
-- The first plan for this migration was to move to `'simple'`, and `'simple'` is strictly
-- WORSE: it does no stemming at all, so it loses English's (`meeting` stops finding
-- `meetings`, measured `f`) and gains nothing for the other two (`mesa` stops finding
-- `mesas`, also measured `f`). A change that only takes things away.
--
-- ── THE REAL GAP IS THE ACCENT, AND IT FAILS IN BOTH DIRECTIONS ─────────────────────
--
--   to_tsvector('english', 'Réunion annuelle') @@ websearch_to_tsquery('english', 'reunion')  → f
--   to_tsvector('english', 'Reunion annuelle') @@ websearch_to_tsquery('english', 'réunion')  → f
--
-- A member on a US keyboard types `reunion` and finds nothing; a member who types the
-- accent finds nothing in a row that was typed without it. Both are ordinary. This is
-- exactly the problem `lib/person-search.ts` already solves for NAMES — it is the fact the
-- family-record vignette on `/features` draws, "typing without the accent still finds the
-- name that has one" — and the archive search did not solve it.
--
-- ── THE FIX: ONE CONFIGURATION, `unaccent` BEFORE THE STEMMER ───────────────────────
-- `public.genorra_search` is `english` with `unaccent` routed in front of `english_stem`
-- for the three word token types. Measured after creating it: accents fold in BOTH
-- directions, `reunion mesa` finds `Reunión … las mesas`, and English stemming still works.
--
-- ── AND IT CAN BACK A GENERATED COLUMN, WHICH IS THE THING TO VERIFY FIRST ──────────
-- `extensions.unaccent()` the FUNCTION is STABLE, and a generated column refuses anything
-- but IMMUTABLE — so the obvious worry is that this cannot be a stored column any more.
-- It can: `to_tsvector(regconfig, text)` is immutable whatever its config's dictionaries
-- do, and the immutability is a property of that function rather than of the dictionary
-- chain. Probed in a rolled-back transaction before this file was written; a generated
-- column on the new config accepted the insert and answered the unaccented query `t`.
--
-- The stored expression keeps the config's NAME (`'genorra_search'::regconfig`, resolved
-- through `search_path` at read time) rather than its OID — so the configuration must live
-- somewhere the querying role can see, which is why it is in `public` and not `extensions`.
-- Renaming or dropping it would break three tables' generated columns.
--
-- ── WHY NOT A `spanish` / `french` DICTIONARY PER ROW ───────────────────────────────
-- Both are installed, and using them means a `regconfig` column written from the author's
-- language — which the QUERY side then has to match, and a reader searching in Spanish over
-- a mixed archive would have to query all three configurations and union the answers. That
-- is a feature with its own screen, not a correction. The gain over this is real but small:
-- the `-s` rule is already shared, and what is left is irregular stemming a family search
-- box does not need. Recorded here so the option is a decision rather than an oversight.
--
-- ── WHAT THIS DOES NOT DO ──────────────────────────────────────────────────────────
-- It does not touch `lib/person-search.ts`, which already folds accents in TypeScript for
-- the member pickers and does not go through Postgres at all. Two mechanisms for one rule,
-- and they are not merged because one runs on a `tsvector` index and the other on an
-- in-memory array of names — see that file's header.
--
-- ── DEPLOYMENT ────────────────────────────────────────────────────────────────────
-- The three columns are DROPPED and re-ADDED, which rewrites each table. All three are
-- small (an archive of announcements, a notification log, a family's bylaws) and there is
-- no family on the product yet. The QUERY side must name the same configuration or the
-- index is not used AND the answers differ, so `app/actions/updates.ts` and
-- `app/actions/bylaws.ts` change in this commit.
-- ─────────────────────────────────────────────────────────────────────────────────────

-- ── 1. The extension, in `extensions` ───────────────────────────────────────────────
-- AGENTS.md: "Schema-qualify extension functions with `extensions.`, not `public.`" —
-- Supabase installs them there and functions in this repo set `search_path = ''`. Nothing
-- here calls `unaccent()` directly, but it is qualified in the mapping below for that rule
-- and so a reader is not left wondering where it came from.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- ── 2. THE OLD COLUMNS COME OFF FIRST, AND THE ORDER IS NOT COSMETIC ────────────────
-- A generated column DEPENDS on the text search configuration it names, so
-- `DROP TEXT SEARCH CONFIGURATION` below is refused while any of the three still points at
-- one. On the migration chain that never comes up — the columns name `english`, which this
-- file does not drop — but it makes the file un-RE-runnable, and an un-re-runnable file is
-- one nobody can mutation-test. Measured: with the drops after the configuration, all three
-- deliberate mutations failed identically on `cannot drop … because other objects depend on
-- it`, which is a file reporting its own shape rather than the mutation.
--
-- Dropped and re-added rather than altered, because a generated column's expression cannot
-- be changed in place. The GIN indexes go with the columns and are rebuilt in §4.
ALTER TABLE public.announcements DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.bylaws        DROP COLUMN IF EXISTS search_vector;

-- ── 3. The configuration, in `public` ───────────────────────────────────────────────
-- `public` rather than `extensions`, because the generated columns below store the config's
-- NAME and re-resolve it through `search_path`. See the header.
DROP TEXT SEARCH CONFIGURATION IF EXISTS public.genorra_search;
CREATE TEXT SEARCH CONFIGURATION public.genorra_search ( COPY = pg_catalog.english );

-- The three word token types. `unaccent` is a FILTERING dictionary — it hands the
-- accent-stripped word on to the next dictionary rather than answering — so the order is
-- load-bearing: unaccent, then stem. Reversed, the stemmer sees the accented form and the
-- accent survives into the token.
--
-- ── `asciiword` IS NOT ON THAT LIST, AND THAT IS CORRECT ────────────────────────────
-- The parser emits `asciiword` for a word of pure ASCII and `word` for one with anything
-- else in it, so `family` and `Réunion` take different mappings. `asciiword` stays on the
-- untouched `english_stem` — `unaccent` on a word with no accent in it is a no-op, so
-- adding it would buy nothing — and the pair still matches across the two, which is the
-- whole requirement: `Réunion` unaccents to `reunion` under `word` and the query `reunion`
-- stems to `reunion` under `asciiword`.
--
-- IT ALSO MEANS AN ASSERTION ON ALL-ASCII TEXT CANNOT SEE THIS MAPPING AT ALL. Measured
-- while mutation-testing: replacing `english_stem` with `simple` here left
-- `to_tsvector(…, 'the annual family meetings')` completely unchanged, because every word in
-- it is an `asciiword`. That mutation survived, so §5d asserts the mapping out of
-- `pg_ts_config_map` directly rather than inferring it from a token.
ALTER TEXT SEARCH CONFIGURATION public.genorra_search
  ALTER MAPPING FOR hword, hword_part, word
  WITH extensions.unaccent, pg_catalog.english_stem;

COMMENT ON TEXT SEARCH CONFIGURATION public.genorra_search IS
  'English stemming with accents folded first, so `reunion` finds `Reunión` and `réunion` '
  'finds `Reunion`. Backs the generated `search_vector` on announcements, notifications and '
  'bylaws, and named by every query against them. Do not rename: three generated columns '
  'store this name and re-resolve it at read time. See 20260827000000.';

-- ── 4. The three vectors, on the new configuration ────────────────────────────────
ALTER TABLE public.announcements
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('public.genorra_search'::regconfig,
      coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED;

ALTER TABLE public.notifications
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('public.genorra_search'::regconfig,
      coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED;

ALTER TABLE public.bylaws
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('public.genorra_search'::regconfig,
      coalesce(title, '') || ' ' || coalesce(article, '') || ' '
      || coalesce(summary, '') || ' ' || coalesce(content_text, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS announcements_search_idx
  ON public.announcements USING gin (search_vector);
CREATE INDEX IF NOT EXISTS notifications_search_idx
  ON public.notifications USING gin (search_vector);
CREATE INDEX IF NOT EXISTS bylaws_search_idx
  ON public.bylaws USING gin (search_vector);

-- ── 5. Verify ───────────────────────────────────────────────────────────────────────
-- ── MUTATION-CHECKED, because a green verify block is not evidence until it has failed ─
-- Six, all of which now trip. The first four are the interesting ones:
--
--   * the mapping order reversed (stem before unaccent)      → §5b, accent in the ROW
--   * `unaccent` dropped from the mapping entirely           → §5b
--   * `english_stem` → `simple` in the mapping               → §5d, and ONLY §5d
--   * `bylaws.search_vector` left naming `'english'`         → §5f
--   * one column dropped and never re-added                  → §5g, and earlier at the index
--   * the file re-run against a database that already has it → no finding, which is the
--     point of §2's ordering
--
-- THE THIRD IS WHY §5d EXISTS. Before it, swapping the stemmer for `simple` passed every
-- assertion — see the `asciiword` note in §3: 5c's input is all-ASCII, so it never reaches
-- the mapping this file writes. An effect assertion that cannot see the cause is the shape
-- AGENTS.md warns about, and the answer was to read `pg_ts_config_map` directly.
--
-- Every assertion here runs unconditionally and needs no fixture, per AGENTS.md's rule
-- about a verify block that can skip: there is nothing to seed, because the whole claim is
-- about the CONFIGURATION rather than about any row.
DO $$
DECLARE
  v_cfg oid;
  v_col text;
BEGIN
  -- 4a. The configuration exists in `public`, which is where the columns look for it.
  SELECT oid INTO v_cfg FROM pg_ts_config
   WHERE cfgname = 'genorra_search' AND cfgnamespace = 'public'::regnamespace;
  IF v_cfg IS NULL THEN
    RAISE EXCEPTION 'public.genorra_search was not created';
  END IF;

  -- 4b. THE ACCENT FOLDS, IN BOTH DIRECTIONS. This is the whole point of the migration and
  --     is asserted rather than described, because the mapping's ORDER decides it and a
  --     future edit that reverses it would leave a configuration that still exists, still
  --     stems, and silently stops folding.
  IF NOT (to_tsvector('public.genorra_search', 'Réunion annuelle')
            @@ websearch_to_tsquery('public.genorra_search', 'reunion')) THEN
    RAISE EXCEPTION 'genorra_search does not fold the accent in the ROW';
  END IF;
  IF NOT (to_tsvector('public.genorra_search', 'Reunion annuelle')
            @@ websearch_to_tsquery('public.genorra_search', 'réunion')) THEN
    RAISE EXCEPTION 'genorra_search does not fold the accent in the QUERY';
  END IF;

  -- 4c. AND ENGLISH STEMMING SURVIVES. The rejected `'simple'` plan would pass 4b and fail
  --     this, which is exactly why both are here.
  IF NOT (to_tsvector('public.genorra_search', 'the annual family meetings')
            @@ websearch_to_tsquery('public.genorra_search', 'meeting')) THEN
    RAISE EXCEPTION 'genorra_search lost English stemming';
  END IF;

  -- 4d. THE MAPPING ITSELF, read back out of the catalogue. This is the assertion that
  --     pins what §3 wrote, and it exists because the token assertions above CANNOT: 4b and
  --     4c both feed the parser text whose words are `asciiword`s or whose match survives a
  --     wrong dictionary, so a mutation here can pass all three. Measured — swapping
  --     `english_stem` for `simple` in the mapping changed no token in 4c.
  IF (SELECT array_agg(d.dictname::text ORDER BY m.mapseqno)
        FROM pg_ts_config_map m
        JOIN pg_ts_dict d ON d.oid = m.mapdict
       WHERE m.mapcfg = v_cfg
         AND m.maptokentype = (SELECT tokid FROM ts_token_type('default')
                                WHERE alias = 'word'))
     IS DISTINCT FROM ARRAY['unaccent', 'english_stem'] THEN
    RAISE EXCEPTION
      'genorra_search maps `word` to %, expected {unaccent,english_stem} in that order',
      (SELECT array_agg(d.dictname::text ORDER BY m.mapseqno)
         FROM pg_ts_config_map m JOIN pg_ts_dict d ON d.oid = m.mapdict
        WHERE m.mapcfg = v_cfg
          AND m.maptokentype = (SELECT tokid FROM ts_token_type('default')
                                 WHERE alias = 'word'));
  END IF;

  -- 4e. Spanish, both words at once, unaccented — the reader this was written for.
  IF NOT (to_tsvector('public.genorra_search', 'Reunión de la familia: traer las mesas')
            @@ websearch_to_tsquery('public.genorra_search', 'reunion mesa')) THEN
    RAISE EXCEPTION 'genorra_search does not answer an unaccented Spanish query';
  END IF;

  -- 4f. All three columns are GENERATED and name the new configuration. A column left on
  --     `'english'` is a table whose search silently disagrees with the other two.
  FOR v_col IN
    SELECT c.relname
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relname IN ('announcements', 'notifications', 'bylaws')
       AND a.attname = 'search_vector'
       AND a.attgenerated <> ''
       AND pg_get_expr(d.adbin, d.adrelid) NOT LIKE '%genorra_search%'
  LOOP
    RAISE EXCEPTION '%.search_vector still names a different text search configuration',
      v_col;
  END LOOP;

  -- 4g. And all three exist AS generated columns at all — `DROP COLUMN IF EXISTS` followed
  --     by a failed `ADD` would leave a table with no search at all, and every query
  --     against it would then be a 42703 that kills the whole statement (§8).
  IF (SELECT count(*)
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
       WHERE c.relnamespace = 'public'::regnamespace
         AND c.relname IN ('announcements', 'notifications', 'bylaws')
         AND a.attname = 'search_vector'
         AND a.attgenerated <> '') <> 3 THEN
    RAISE EXCEPTION 'expected three generated search_vector columns';
  END IF;

  RAISE NOTICE 'search: genorra_search folds accents, keeps English stemming, backs 3 columns';
END $$;
