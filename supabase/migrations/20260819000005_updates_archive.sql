-- ============================================================================
-- `/updates` — an archive for the dashboard's Recent Updates feed, and the first
-- full-text search in this schema.
--
-- ── WHAT WAS MISSING ────────────────────────────────────────────────────────
-- 2026-08-13 folded announcements into the dashboard's Recent Updates card, which
-- was better in every way it was meant to be — one feed instead of two surfaces,
-- and a dismissal that is per PERSON rather than per browser — and left the card
-- holding two kinds of thing and showing only the newest handful of each. A member
-- could not scroll back (nothing renders row seven, and older than that is not
-- merely unseen, it is unfetched), could not search either table from anywhere in
-- the product, and could not see the two together anywhere but a card five rows
-- tall. TODO.md has carried the entry since that day; the card deliberately carried
-- no "View all updates" link because there was nothing at the other end of one.
--
-- ── WHAT THIS MIGRATION IS AND IS NOT ───────────────────────────────────────
-- It registers ONE resource key and adds FOUR indexes. It creates no table, changes
-- no policy, and writes no `resource_visibility` row.
--
--   A. `updates`, in `permission_resources`, `actions = {view}`
--   B. the search vectors and their GIN indexes
--   C. two ordinary btree indexes the feed reads have never had
--
-- ── A. WHAT `updates:view` GOVERNS, SAID PRECISELY ──────────────────────────
-- The archive is two tables and only one of them has a permission key, which
-- TODO.md flagged as the unsettled part of this feature. Both halves stay true and
-- the page is built around them rather than over them:
--
--   * `announcements` is governed by the `announcements` key and its composed SELECT
--     policy. The archive reads that table on the USER client, so RLS decides which
--     rows come back — and the page resolves `announcements:view` FIRST and skips
--     the query entirely when the caller does not hold it, so a reader is told the
--     board is not included rather than shown an archive that quietly has no
--     announcements in it.
--   * `notifications` is governed by NOTHING, deliberately. `20260805000007` deleted
--     its resource and its `permission_table_map` row, and its argument still holds:
--     the base policy already restricts every row to its own recipient, so a
--     permission factor over it was a tautology — "a switch wired to nothing …
--     worse than absent, because it reads as a privacy control that is being
--     honoured".
--
-- So `updates:view` withholds A SCREEN, and it is the same kind of key as
-- `gatherings/budget`: an administrator moving it decides whether the archive page
-- exists for that member, not what either table will release to them. It is
-- registered anyway rather than left unregistered, because §6's alternative is
-- worse — an unregistered non-admin key resolves `view` to 'everyone' and the page
-- could then never be switched off by anybody, which is a default nobody can fix
-- from the UI.
--
-- **NO `permission_table_map` ROW IS WRITTEN FOR `updates`, AND THAT IS LOAD-BEARING.**
-- A map row is what puts a key into a COMPOSED RLS POLICY, and the two tables here
-- already have their answers: `announcements` is keyed on `announcements`, and
-- `notifications` deliberately has no key at all. Mapping `updates` at either table
-- would re-key rows that other screens read — the shape `20260808000001` dismantled
-- for the old `dues` key. §D asserts the absence.
--
-- ── B. WHY FULL TEXT AND NOT `ILIKE` ────────────────────────────────────────
-- The house style for a server-side search is `ILIKE` through PostgREST's `or`
-- filter, sanitised by `safeQuery` — `searchMembers` and the two staff-console
-- searches. It is the right tool for a name and the wrong one here, for one reason
-- that decides it: a search over three years of family news is a MULTI-WORD search.
-- `body ILIKE '%hotel block%'` does not match "the block at the hotel", and nobody
-- typing two words means them adjacent in that order. `websearch_to_tsquery` matches
-- both, stems ("hotels" finds "hotel"), takes `-` to exclude and `or` to widen, and —
-- the property that matters most for a value arriving from a text box — NEVER RAISES
-- on malformed input, unlike `to_tsquery`.
--
-- It also takes `"a phrase"`, and that one does not survive the trip: PostgREST reads
-- a leading double quote as value quoting, so `sanitizeUpdatesQuery` in
-- lib/updates-archive.ts strips it. The degradation is graceful rather than broken —
-- the words arrive as two required terms — and it is written down there rather than
-- promised here.
--
-- Two decisions inside that, both deliberate:
--
--   * A STORED GENERATED COLUMN, not an expression index. The column is what
--     PostgREST can filter on (`?search_vector=wfts(english).…`), which is what
--     keeps this search a plain query on the user client rather than a new
--     SECURITY DEFINER function in `public` — i.e. a new unauthenticated HTTP
--     endpoint needing its own grant (§2b). There is no precedent for a search RPC
--     in this repo and this is not the feature to set one.
--   * `'english'` IS WRITTEN AS AN EXPLICIT `regconfig` in both. `to_tsvector(text)`
--     — the one-argument form — depends on `default_text_search_config`, which makes
--     it STABLE rather than IMMUTABLE, and a generated column refuses it. The
--     two-argument form with a literal config is immutable and is the whole reason
--     this can be a column at all. The QUERY side must name the same config or the
--     index is not used and the answers differ; `app/actions/updates.ts` passes
--     `config: 'english'` and says so.
--
-- WHAT IT MEANS FOR THE TWO TABLES IS NOT SYMMETRICAL, and the help chapter says so
-- rather than letting a member conclude the search is broken. An announcement's
-- title and body are what somebody wrote, verbatim and untruncated. A notification's
-- title is one of nine fixed literals and its body is composed at WRITE time,
-- clipped at 120 or 300 characters with no marker, with names copied in as they were
-- then — and a chat notification stores no message text at all. So the search works
-- well against the board and thinly against the bell, which is a property of what
-- those rows are rather than of this index.
--
-- ── C. THE TWO BTREE INDEXES ARE OVERDUE ────────────────────────────────────
-- Measured 2026-08-19: `announcements` had exactly two indexes, its primary key and
-- one on `chapter_id`, so every read of the board and the feed — all of which are
-- `family_code` + `ORDER BY published_at DESC` — was a scan. And
-- `notifications` had its primary key plus a PARTIAL index
-- (`WHERE read_at IS NULL`) that serves the unread count and cannot serve an
-- archive, which by definition shows read rows. The archive is what made those
-- worth adding; the bell and the dashboard get them for free.
--
-- ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
-- No `resource_visibility` row. `updates` is a NON-ADMIN key, so `auth_permission()`
-- falls through to 'everyone' for view where there is no row, which is the answer
-- wanted: an archive of what a member has already been shown is not something a
-- family should have to switch on. `20260817000004` makes only `admin/` keys fail
-- closed. §D asserts that the key is not in the admin category, because that
-- migration also asserts the two can never disagree.
--
-- No `unaccent`, no `pg_trgm`. Both would be a new `CREATE EXTENSION` and the first
-- cannot be indexed without an immutable wrapper. The consequence is stated in the
-- help chapter: this search is not accent-insensitive, unlike the member pickers,
-- which do their matching in the browser through `lib/person-search.ts`.
--
-- IDEMPOTENT. Every statement is `IF NOT EXISTS` or `ON CONFLICT`, and the generated
-- columns are added only when absent.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See
--   AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── A1. The resource ────────────────────────────────────────────────────────
-- `subsection` is NULL: this is a rail item of its own under Community, not a pane
-- of another screen. `sort_order` 62 puts it directly after `announcements` (60) and
-- `announcements/birthdays` (61) and before `members` (70) — the order the RAIL uses,
-- which is `groupResources`'s ordering rule.
--
-- It therefore renders as a top-level row immediately after an indented one, and that
-- is checked rather than assumed: `groupResources` emits a heading only when a
-- subsection is non-null AND different from the previous, so a NULL after
-- 'Announcements' prints no heading and no empty one. `members` (70) has always done
-- the same thing directly after that block.
--
-- `actions = {view}`. The archive writes nothing of its own: pinning is
-- `announcements:edit`, dismissing is self-service, deleting is
-- `announcements:delete`, and `read_at` belongs to `notifications`, which has no key.
-- AGENTS.md: declare only the actions something reads, because a switch nothing
-- consults reads as a control being honoured.
--
-- ON CONFLICT DO UPDATE on every display column, because on a fresh chain
-- 20260618000000's seed has already created this row with four columns and the
-- default four actions — this is where the narrowed `actions` arrives.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('updates', 'Updates', 'community', NULL, 62, ARRAY['view']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── A2. The grants that narrowing orphans ───────────────────────────────────
-- Only reachable on a fresh chain, where 20260618000000's seed registers this key
-- with the DEFAULT four actions and the template seeder then grants all four.
-- Narrowing to `{view}` above leaves create/edit/delete rows naming actions their
-- resource no longer declares, which 20260808000000 §6c asserts against globally.
-- Derived from `permission_resources.actions` rather than naming the three actions,
-- so this stays correct if the declared set ever changes.
DELETE FROM public.template_permissions tp
 USING public.permission_resources pr
 WHERE pr.key = tp.resource_key
   AND tp.resource_key = 'updates'
   AND NOT (tp.action::text = ANY (pr.actions));

-- ── A3. Administrators FIRST, on every action the key declares ──────────────
-- Before A4's computed default, which is `ON CONFLICT DO NOTHING` — first writer
-- wins, and the ordering is the invariant rather than an accident. The test is
-- `is_system = true` AND the name, not the name alone, which a family may rename.
-- `unnest(pr.actions)` so no grant is written for an action the resource does not
-- declare.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, pr.key, a::public.permission_action, 'any', NOW()
  FROM public.permission_templates t
 CROSS JOIN public.permission_resources pr
 CROSS JOIN LATERAL unnest(pr.actions) AS a
 WHERE t.name = 'Administrators' AND t.is_system = true
   AND pr.key = 'updates'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── A4. Every other template states the answer rather than falling through ──
-- 20260807000000 §7 materialized every grid so Members & Access can show the whole
-- answer without a reader having to know about fall-through. This writes that
-- default down with exactly the CASE `seed_family_permission_templates()` uses.
--
-- The visibility test is on `t.family_code`, the TEMPLATE's family. A template only
-- counts for the family it belongs to; joining on anything else would let one
-- family's restriction decide another's grid.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, pr.key, a::public.permission_action,
       CASE
         WHEN a = 'view' AND NOT EXISTS (
                SELECT 1 FROM public.resource_visibility rv
                 WHERE rv.family_code = t.family_code
                   AND rv.resource_key = pr.key
                   AND rv.visibility = 'restricted')
           THEN 'any'::public.permission_scope
         ELSE 'none'::public.permission_scope
       END
  FROM public.permission_templates t
 CROSS JOIN public.permission_resources pr
 CROSS JOIN LATERAL unnest(pr.actions) AS a
 WHERE pr.key = 'updates'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── B. The search vectors ───────────────────────────────────────────────────
-- One column per table, over TITLE and BODY together, because the search bar is one
-- box and a member does not know which field a phrase was typed into. `coalesce` on
-- both halves: `notifications.body` is nullable and `NULL || ' '` is NULL, which
-- would leave every chat notification with an empty vector and no title match either.
--
-- Weights are deliberately NOT set (`setweight`). Ranking is not used — the archive
-- is chronological, and a relevance score computed separately per table could not be
-- compared across the two anyway. `ORDER BY` stays the date.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english'::regconfig, coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english'::regconfig, coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS announcements_search_idx
  ON public.announcements USING gin (search_vector);

CREATE INDEX IF NOT EXISTS notifications_search_idx
  ON public.notifications USING gin (search_vector);

COMMENT ON COLUMN public.announcements.search_vector IS
  'title + body as an english tsvector, for /updates. Query it with '
  'websearch_to_tsquery(''english'', …) — the config must match or the GIN index is not '
  'used. Generated: never write it.';

COMMENT ON COLUMN public.notifications.search_vector IS
  'title + body as an english tsvector, for /updates. A notification''s text is composed '
  'at write time and clipped, so this finds less than the announcements one does — see '
  '20260819000005''s header. Generated: never write it.';

-- ── C. The two btree indexes the feed reads have never had ──────────────────
-- `announcements`: every read is the family, newest first.
-- `notifications`: every read is one recipient, newest first — and the only index
-- that existed is partial on `read_at IS NULL`, which an archive cannot use.
CREATE INDEX IF NOT EXISTS announcements_family_published_idx
  ON public.announcements (family_code, published_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_id, created_at DESC);

-- ── D. Verify, unconditionally ──────────────────────────────────────────────
-- Catalogue reads, plus three real searches against one row this block inserts and
-- deletes again. Nothing here needs a fixture, so nothing can skip itself into a false
-- pass — which is also why the NOTIFICATIONS vector is checked by comparing its stored
-- generation expression to the announcements one rather than by inserting a row:
-- `notifications.recipient_id` is `NOT NULL REFERENCES people(id)`, so exercising it
-- would need a family, a person and a `people` row, and a verify block that needs a
-- fixture is a verify block that can skip.
DO $mig$
DECLARE
  v_actions text[];
  v_n       bigint;
BEGIN
  -- D1. The resource, exactly as declared.
  SELECT pr.actions INTO v_actions FROM public.permission_resources pr WHERE pr.key = 'updates';
  IF v_actions IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: the updates resource is not registered';
  END IF;
  IF v_actions <> ARRAY['view']::text[] THEN
    RAISE EXCEPTION 'ROLLBACK: updates declares actions %, expected {view}', v_actions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE key = 'updates' AND category = 'community' AND subsection IS NULL
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: updates is not a top-level Community resource';
  END IF;

  -- The two-way equivalence 20260817000004 asserts: an `admin/` key and the admin
  -- category are the same set. `updates` must be in neither, or it would fail closed
  -- and the whole "no resource_visibility row is needed" argument above would be
  -- false — silently, because the page would simply 404 for everybody.
  IF (SELECT category FROM public.permission_resources WHERE key = 'updates') = 'admin' THEN
    RAISE EXCEPTION 'ROLLBACK: updates is in the admin category, so view fails closed with no visibility row';
  END IF;

  -- D2. It maps NO table, and nothing evaluates it in a policy. Matched on the
  -- rendered literal rather than with LIKE '%updates%', which would match nothing
  -- useful and quite a lot of prose.
  IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE resource_key = 'updates') THEN
    RAISE EXCEPTION 'ROLLBACK: permission_table_map maps a table to updates — see this file''s header';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND COALESCE(p.qual, '') || COALESCE(p.with_check, '')
           LIKE '%auth_permission(''updates''::text%'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: a policy evaluates auth_permission(''updates'', …)';
  END IF;

  -- The two keys the archive actually depends on must both still be as they were.
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'announcements') THEN
    RAISE EXCEPTION 'ROLLBACK: the announcements resource is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'notifications') THEN
    RAISE EXCEPTION
      'ROLLBACK: a `notifications` resource exists. 20260805000007 deleted it because a '
      'permission factor over a per-recipient table is a tautology; this migration''s header '
      'and the /updates page are both written on its absence.';
  END IF;

  -- No orphaned grant, and Administrators can view it everywhere.
  SELECT count(*) INTO v_n
    FROM public.template_permissions tp
    JOIN public.permission_resources pr ON pr.key = tp.resource_key
   WHERE tp.resource_key = 'updates' AND NOT (tp.action::text = ANY (pr.actions));
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % updates grant(s) name an action the resource does not declare', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.permission_templates t
   WHERE t.name = 'Administrators' AND t.is_system = true
     AND NOT EXISTS (
       SELECT 1 FROM public.template_permissions tp
        WHERE tp.template_id = t.id AND tp.resource_key = 'updates'
          AND tp.action = 'view' AND tp.scope = 'any');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % Administrators template(s) cannot view updates', v_n;
  END IF;

  -- D3. Duplicate sort_order inside one category, which would make the grid's order
  -- depend on nothing. Same check 20260819000002 §D3 makes.
  SELECT count(*) INTO v_n FROM (
    SELECT category, sort_order FROM public.permission_resources
     GROUP BY category, sort_order HAVING count(*) > 1
  ) dupes;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % duplicate (category, sort_order) pair(s) in permission_resources', v_n;
  END IF;

  -- D4. The columns are generated, so nothing can write them.
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.announcements'::regclass
       AND attname = 'search_vector' AND attgenerated = 's'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: announcements.search_vector is missing or not generated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.notifications'::regclass
       AND attname = 'search_vector' AND attgenerated = 's'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: notifications.search_vector is missing or not generated';
  END IF;

  -- AND THE TWO EXPRESSIONS ARE THE SAME EXPRESSION, which is what carries D5's evidence
  -- across to the table D5 cannot insert into. Structural checks pass over a column built
  -- with the wrong config or with `body` left out, and `/updates` would then find nothing
  -- for every bell search with no error anywhere — the failure this whole block is written
  -- against. Comparing the stored expressions means the three real searches below prove
  -- both columns or neither.
  IF (SELECT pg_get_expr(d.adbin, d.adrelid)
        FROM pg_attrdef d JOIN pg_attribute a
          ON a.attrelid = d.adrelid AND a.attnum = d.adnum
       WHERE d.adrelid = 'public.announcements'::regclass AND a.attname = 'search_vector')
     IS DISTINCT FROM
     (SELECT pg_get_expr(d.adbin, d.adrelid)
        FROM pg_attrdef d JOIN pg_attribute a
          ON a.attrelid = d.adrelid AND a.attnum = d.adnum
       WHERE d.adrelid = 'public.notifications'::regclass AND a.attname = 'search_vector')
  THEN
    RAISE EXCEPTION
      'ROLLBACK: the two search_vector columns are generated by DIFFERENT expressions, so '
      'the searches below prove nothing about notifications. Both must be '
      'to_tsvector(english, coalesce(title) || '' '' || coalesce(body)).';
  END IF;

  -- D5. THE SEARCH ACTUALLY MATCHES, and this is the assertion worth having: every
  -- check above would pass over a column built with the wrong config, or with the
  -- body left out of the expression, and the feature would then find nothing with no
  -- error anywhere. ONE row in and three queries out — a word that is absent, a
  -- two-word search whose words are not adjacent and sit in the BODY, and a stemmed
  -- singular against a plural in the TITLE. D4 has just established that
  -- `notifications.search_vector` is generated by the same expression, so these three
  -- speak for both columns.
  --
  -- The family code is a literal no family can hold (`families_guard_family_code`
  -- and every writer produce codes without spaces), so these rows are unreachable
  -- even in the instant they exist.
  INSERT INTO public.announcements (family_code, title, body, published_at)
  VALUES ('__verify 20260819000005', 'Rooms are held', 'The block at the Marriott closes on 1 June', NOW());

  SELECT count(*) INTO v_n
    FROM public.announcements
   WHERE family_code = '__verify 20260819000005'
     AND search_vector @@ websearch_to_tsquery('english', 'hotel block');
  IF v_n <> 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: the search matched a word that is not in the row (%). Either the config is '
      'wrong or the expression is not what it looks like.', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.announcements
   WHERE family_code = '__verify 20260819000005'
     AND search_vector @@ websearch_to_tsquery('english', 'marriott closes');
  IF v_n <> 1 THEN
    RAISE EXCEPTION
      'ROLLBACK: a two-word search over title+body matched % row(s), expected 1. This is the '
      'whole reason the search is full-text rather than ILIKE — the two words are not adjacent '
      'in the text.', v_n;
  END IF;

  -- Stemming, and the title half of the expression. "rooms" must find "Rooms",
  -- "held" must find "held", and the plural must resolve.
  SELECT count(*) INTO v_n
    FROM public.announcements
   WHERE family_code = '__verify 20260819000005'
     AND search_vector @@ websearch_to_tsquery('english', 'room');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: "room" did not find "Rooms" — the english config is not in play (% row(s))', v_n;
  END IF;

  DELETE FROM public.announcements WHERE family_code = '__verify 20260819000005';

  -- D6. The four indexes.
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='announcements_search_idx') THEN
    RAISE EXCEPTION 'ROLLBACK: announcements_search_idx is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='notifications_search_idx') THEN
    RAISE EXCEPTION 'ROLLBACK: notifications_search_idx is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='announcements_family_published_idx') THEN
    RAISE EXCEPTION 'ROLLBACK: announcements_family_published_idx is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='notifications_recipient_created_idx') THEN
    RAISE EXCEPTION 'ROLLBACK: notifications_recipient_created_idx is missing';
  END IF;

  RAISE NOTICE 'updates: resource registered {view}, two search vectors verified against real '
    'text, four indexes present';
END $mig$;

COMMIT;
