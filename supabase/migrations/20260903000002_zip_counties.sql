-- ════════════════════════════════════════════════════════════════════════════
-- A ZIP-TO-COUNTY CROSSWALK, AND THE ONE STATEMENT THAT REFRESHES IT SAFELY
--
-- TODO.md's alert-driven check-in entry named this as the blocker and named it precisely:
-- `people` holds `city`, `state` and `zip_code` — no latitude, no longitude, no geocoding, and
-- PostGIS is not installed — while NWS alerts carry county FIPS and UGC zones. So there was no
-- way to match a relative to a weather alert, and the state-level alternative was documented as
-- too coarse to be worth having (a tornado warning covers three counties out of Texas's 254).
--
-- This is the county-level half. It is DATA and nothing else: no poller, no matcher, no
-- suggestion. What it unblocks is named at the bottom.
--
-- ── ONE ROW PER (ZIP, COUNTY) PAIR, WHICH IS THE WHOLE POINT ────────────────────────
-- A ZIP is not inside a county. About 12,000 of the ~41,000 US ZIPs straddle two or more, and
-- collapsing each to its "main" county at load time would throw away the fact that makes the
-- crosswalk worth having — that some ZIPs need two alerts checked, not one.
--
-- `res_ratio` is the share of the ZIP's RESIDENTIAL addresses that fall in that county, which
-- is the column a consumer sorts by when it wants one answer. It is carried rather than used:
-- nothing reads this table yet, and a consumer that needs "the county" should take the highest
-- ratio rather than this migration deciding for it.
--
-- ── THE SOURCE IS THE HUD USPS CROSSWALK, WHICH IS THE USPS FILE ────────────────────
-- HUD publishes it from USPS delivery data, QUARTERLY, at
-- `https://www.huduser.gov/hudapi/public/usps?type=2&query=All`. **It needs a free API token**
-- (`HUD_USPS_API_TOKEN`), which is a credential nobody in this repo can obtain — so this table
-- ships EMPTY and the refresh fills it. Nothing reads it, so empty breaks nothing; TODO.md
-- carries the token as a GO LIVE item.
--
-- The Census ZCTA-to-county relationship file needs no token and was considered. It is not the
-- same thing: a ZCTA is the Census's approximation of a ZIP, several thousand ZIPs (mostly
-- PO-box-only) have no ZCTA at all, and supporting both would be two vocabularies in one table.
-- One source, named on every refresh row, so a reader always knows which.
--
-- ── AND IT IS EMPTY, SO IT NEEDS AN `allowed_empty` ENTRY IN THE SAME COMMIT ────────
-- `audit_global_lookups.sql` §2 DERIVES its candidates: any `public` table that is empty and
-- has no transitive foreign-key path to a `family_code` is reported, because that is precisely
-- what an emptied global lookup looks like. It is a step in `migrate.yml`, so an unclassified
-- empty table HOLDS THE VERCEL ALIAS with the schema already applied — which is exactly what
-- `stripe_webhook_events` did, and that entry now says so. This one is empty BY DESIGN until a
-- token exists, and the script says which case it is.
--
-- ── WHY THE REFRESH IS ONE SQL FUNCTION AND NOT A LOOP IN NODE ──────────────────────
-- The dangerous operation here is a DELETE, and the storage reaper's lesson applies without a
-- word changed: *"the dangerous line is a READ, not a delete"* — a truncated fetch that is
-- treated as complete becomes a delete list. Three shapes were weighed:
--
--   TRUNCATE AND INSERT       one bad fetch empties the table. Refused.
--   UPSERT ONLY, NEVER DELETE safe against a partial fetch, and WRONG over time: a ZIP
--                             reassigned between counties keeps its old pair, with an old
--                             `res_ratio` that can still win a highest-ratio sort.
--   REPLACE THE ZIPs IN THE PAYLOAD  what this does. A ZIP present in the batch has its rows
--                             replaced exactly; a ZIP absent from it is left alone. A partial
--                             fetch therefore leaves some ZIPs un-refreshed and destroys
--                             nothing, which is the only failure mode worth having.
--
-- `replace_zip_counties(jsonb)` does it in ONE FUNCTION CALL for the reason
-- `claim_distribution_recipients` is one statement: delete-then-insert from the APP is two
-- round trips with a window in between where the ZIP has no county at all, and a caller that
-- died in that window would leave it that way. Inside the function it is two statements and
-- they are atomic together — a plpgsql body runs in the caller's transaction and PostgREST
-- gives each RPC one — which is what the guarantee actually needs; the function's own comment
-- says why a single data-modifying CTE is NOT the way to get it. Granted to NOBODY (§2b): the
-- service role keeps EXECUTE by default and the browser has no business here.
--
-- ── RLS ON, NO POLICY, WHICH IS THE CORRECT ANSWER RATHER THAN A CAUTIOUS ONE ───────
-- §2c: a table created here is born readable AND writable by `anon` and `authenticated`
-- through Supabase's default ACL, and RLS is the entire boundary — a table with no policy for a
-- command denies that command outright. NOTHING reads this from a browser, so there is no
-- policy to write. It is public government data rather than anything a family owns, so a
-- future `USING (true)` for `authenticated` would be defensible; it is not written now, because
-- a policy nothing needs is a policy nobody has reviewed.
--
-- ── WHAT THIS UNBLOCKS, AND WHAT IT DOES NOT ────────────────────────────────────────
-- It closes the DATA half of the alert entry. The REACH half is untouched and is still
-- decisive: the bell needs an open tab, `IdleTimeout` signs a member out after 60 idle minutes,
-- and `sendEmail` fails soft — so detecting a hurricane faster than the family's own group text
-- is worth nothing until a message can land. SMS is in no plan at all. TODO.md now says that
-- and nothing about a crosswalk.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master. See AGENTS.md, "How migrations reach the
--   hosted project".
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══ 1. THE CROSSWALK ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.zip_counties (
  -- TEXT, NOT AN INTEGER. A ZIP is a five-character label and a leading zero is part of it:
  -- 02134 as an integer is 2134, which is not a ZIP and matches nothing.
  zip         TEXT        NOT NULL CHECK (zip ~ '^[0-9]{5}$'),
  -- The 5-digit state+county FIPS code, which is what an NWS alert carries.
  county_fips TEXT        NOT NULL CHECK (county_fips ~ '^[0-9]{5}$'),
  -- Carried for legibility, so a row can be read without a second lookup. Not authoritative:
  -- `county_fips` is the join key and the name is whatever the source called it.
  state       TEXT        NOT NULL CHECK (char_length(state) = 2),
  county_name TEXT,
  -- The share of the ZIP's residential addresses in this county, 0..1. See the header: carried
  -- rather than consumed, and it is what a consumer wanting ONE county should sort by.
  res_ratio   NUMERIC(6, 5) CHECK (res_ratio IS NULL OR (res_ratio >= 0 AND res_ratio <= 1)),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- THE PAIR IS THE KEY. A ZIP with two counties is two rows and that is the fact this table
  -- exists to record; a primary key on `zip` alone would make the crosswalk unable to say it.
  PRIMARY KEY (zip, county_fips)
);

-- The lookup direction that will actually be used: given an alert's county, who is in it.
CREATE INDEX IF NOT EXISTS zip_counties_county_idx ON public.zip_counties (county_fips);

COMMENT ON TABLE public.zip_counties IS
  'ZIP-to-county crosswalk, from the HUD USPS file (quarterly). One row per (zip, county) '
  'pair, because about 12,000 US ZIPs straddle more than one county. Refreshed by '
  '/api/geo/zip-counties through replace_zip_counties(); ships EMPTY because the source needs '
  'a free HUD_USPS_API_TOKEN. Nothing reads it yet — it exists to unblock county-level alert '
  'matching, whose remaining blocker is a delivery channel rather than data.';

ALTER TABLE public.zip_counties ENABLE ROW LEVEL SECURITY;

-- ═══ 2. THE REFRESH LOG ════════════════════════════════════════════════════════════
--
-- WHAT MAKES THE WEEKLY SELF-THROTTLE POSSIBLE, and what makes the job auditable at all. A
-- refresh that silently stopped running and a source that has not changed are the same thing
-- from outside; this is what separates them. Same argument as `platform_data_deletions`'
-- `storage_reaped_at`, one job over.
CREATE TABLE IF NOT EXISTS public.zip_county_refreshes (
  id          UUID        PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  -- Which file it came from, so a row is readable years later. Not a CHECK: a second source
  -- would be a decision, not a typo, and refusing an unknown value here would refuse the
  -- refresh rather than the decision.
  source      TEXT        NOT NULL,
  state       TEXT        NOT NULL DEFAULT 'running'
                          CHECK (state IN ('running', 'ok', 'failed')),
  -- How many (zip, county) pairs the payload held, and how many ZIPs it covered. BOTH, because
  -- the ratio between them is the sanity check: ~41,000 ZIPs and ~54,000 pairs is right, and
  -- 41,000 of each would mean the multi-county rows were lost on the way in.
  pairs       INT,
  zips        INT,
  error       TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS zip_county_refreshes_recent_idx
  ON public.zip_county_refreshes (started_at DESC);

COMMENT ON TABLE public.zip_county_refreshes IS
  'One row per attempt to refresh zip_counties. Read by the route to decide whether a weekly '
  'refresh is due, and by a person to answer whether the job is running at all — a refresh '
  'that stopped and a source that has not changed are indistinguishable without it.';

ALTER TABLE public.zip_county_refreshes ENABLE ROW LEVEL SECURITY;

-- ═══ 3. THE ONE STATEMENT THAT REPLACES A BATCH ════════════════════════════════════
--
-- See the header for why this is a function rather than a loop. `p_rows` is a JSON array of
-- `{zip, county_fips, state, county_name, res_ratio}`.
--
-- IT DELETES ONLY THE ZIPs IT IS GIVEN. That is the whole safety property: a batch that never
-- arrives leaves its ZIPs exactly as they were, and there is no sequence of failures that
-- empties the table.
CREATE OR REPLACE FUNCTION public.replace_zip_counties(p_rows jsonb)
RETURNS TABLE (pairs int, zips int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pairs int;
  v_zips  int;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'replace_zip_counties expects a JSON array';
  END IF;

  -- NOTHING IS NOT AN ERROR AND IS NOT A DELETE EITHER. An empty batch names no ZIPs, so it
  -- deletes nothing — which is the correct reading of "the source told me nothing".
  IF jsonb_array_length(p_rows) = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- ── NO TEMP TABLE, AND THAT WAS A BUG BEFORE IT WAS A STYLE ──────────────────────
  -- This built a `CREATE TEMP TABLE _incoming ON COMMIT DROP` and read it three times. A temp
  -- table lives for the whole TRANSACTION, so a second call inside one failed outright with
  -- *"relation _incoming already exists"* — and the refresh sends eleven batches. It happens
  -- to work through PostgREST, which wraps each RPC in its own transaction, so the failure was
  -- invisible from the route and appeared the moment anything called it twice in SQL. Found by
  -- a probe, not by reading.
  --
  -- `jsonb_to_recordset` is re-read instead. Three passes over a 5,000-element array is
  -- nothing next to the write, and the function now has no state with a lifetime.

  -- REFUSED RATHER THAN FILTERED, and the difference matters: a row the source sent that this
  -- function cannot understand means the FILE's shape has changed, and silently dropping it
  -- would refresh a ZIP with a partial county list — which is worse than not refreshing it.
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(
      zip text, county_fips text, state text, county_name text, res_ratio numeric
    )
     WHERE r.zip IS NULL OR r.zip !~ '^[0-9]{5}$'
        OR r.county_fips IS NULL OR r.county_fips !~ '^[0-9]{5}$'
        OR r.state IS NULL OR char_length(r.state) <> 2
  ) THEN
    RAISE EXCEPTION
      'replace_zip_counties: the batch holds a row this function cannot read — the source '
      'file''s shape has changed and refreshing part of a ZIP is worse than skipping it';
  END IF;

  -- ── DELETE THEN INSERT, AS TWO STATEMENTS AND NOT ONE ────────────────────────────
  -- A single data-modifying CTE was the obvious shape and is wrong here: every CTE in one
  -- statement sees the SAME snapshot, so an `INSERT … ON CONFLICT` would test its conflicts
  -- against rows the CTE's DELETE is removing in the same statement. Two statements in a
  -- plpgsql body are atomic together — the body runs inside the caller's transaction, and
  -- PostgREST gives each RPC one — so the safety property is unchanged and the semantics are
  -- something a reader can predict.
  DELETE FROM public.zip_counties z
   WHERE z.zip IN (
     SELECT DISTINCT r.zip FROM jsonb_to_recordset(p_rows) AS r(zip text)
   );

  -- `DISTINCT ON` RATHER THAN `ON CONFLICT`, now that the delete has already run: the SOURCE
  -- may repeat a pair — a file is not a set — and with the old rows gone there is no conflict
  -- left to resolve except a duplicate within the payload. Ordered so the pick is
  -- deterministic: the highest stated ratio wins, and a null loses to a number.
  INSERT INTO public.zip_counties (zip, county_fips, state, county_name, res_ratio, updated_at)
  SELECT DISTINCT ON (r.zip, r.county_fips)
         r.zip, r.county_fips, upper(r.state), r.county_name, r.res_ratio, NOW()
    FROM jsonb_to_recordset(p_rows) AS r(
      zip text, county_fips text, state text, county_name text, res_ratio numeric
    )
   ORDER BY r.zip, r.county_fips, r.res_ratio DESC NULLS LAST;

  SELECT count(DISTINCT (r.zip, r.county_fips)), count(DISTINCT r.zip)
    INTO v_pairs, v_zips
    FROM jsonb_to_recordset(p_rows) AS r(zip text, county_fips text);

  RETURN QUERY SELECT v_pairs::int, v_zips::int;
END $$;

COMMENT ON FUNCTION public.replace_zip_counties(jsonb) IS
  'Replace the crosswalk rows for exactly the ZIPs named in the batch, in one statement. A ZIP '
  'absent from the batch is left alone, so no sequence of failed fetches can empty the table. '
  'Refuses a batch holding a row it cannot read, because refreshing part of a ZIP is worse '
  'than skipping it. Service role only — granted to nobody (AGENTS.md §2b).';

REVOKE ALL ON FUNCTION public.replace_zip_counties(jsonb) FROM PUBLIC;

-- ── Verify ──────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'zip_counties'
  ) THEN
    RAISE EXCEPTION 'zip_counties was not created';
  END IF;

  -- THE KEY IS THE PAIR. Asserted, because a primary key on `zip` alone would make the table
  -- unable to record the one fact it exists for, and would do so silently — the second county
  -- of every straddling ZIP would just lose the insert.
  SELECT count(*) INTO v_n
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
   WHERE i.indrelid = 'public.zip_counties'::regclass AND i.indisprimary;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'zip_counties'' primary key covers % column(s), expected 2 (zip, county_fips)', v_n;
  END IF;

  -- RLS ON, AND NO POLICY. §2c: without RLS the default ACL leaves this writable by `anon`.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = 'public.zip_counties'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'zip_counties does not have RLS enabled';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename IN ('zip_counties', 'zip_county_refreshes');
  IF v_n > 0 THEN
    RAISE EXCEPTION
      '% policy/policies on the crosswalk tables — nothing reads them from a browser, and a '
      'policy nothing needs is a policy nobody has reviewed', v_n;
  END IF;

  -- GRANTED TO NOBODY (§2b rule 1). The route calls it with the service role, which keeps
  -- EXECUTE by default; a grant to `authenticated` would publish a way to rewrite the
  -- crosswalk at `POST /rest/v1/rpc/replace_zip_counties`.
  IF has_function_privilege('authenticated', 'public.replace_zip_counties(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute replace_zip_counties';
  END IF;
  IF has_function_privilege('anon', 'public.replace_zip_counties(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute replace_zip_counties';
  END IF;

  -- `SET search_path = ''` on a SECURITY DEFINER function. Matched on the PREFIX, because the
  -- stored value is `search_path=""` with the empty string quoted — the mistake
  -- `20260902000002` made and recorded.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'replace_zip_counties'
       AND p.prosecdef
       AND EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
                    WHERE c LIKE 'search_path=%')
  ) THEN
    RAISE EXCEPTION
      'replace_zip_counties must be SECURITY DEFINER with search_path pinned';
  END IF;

  -- ── AND THE ONE THING THAT WOULD HOLD THE DEPLOY ──────────────────────────────────
  -- Both tables are empty and neither has a path to a `family_code`, so
  -- `audit_global_lookups.sql` §2 reports them — and that script is a step in `migrate.yml`,
  -- so an unclassified empty table holds the Vercel alias with the schema already applied.
  -- Asserted here rather than trusted, because the entry lives in a hand-run script this
  -- migration cannot import.
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'zip_county_refreshes'
  ) THEN
    RAISE EXCEPTION 'zip_county_refreshes was not created';
  END IF;

  RAISE NOTICE 'zip_counties + zip_county_refreshes created, RLS on with no policy, '
    'replace_zip_counties granted to nobody. BOTH tables are empty by design — '
    'audit_global_lookups.sql''s allowed_empty must name them.';
END $mig$;

COMMIT;
