-- ============================================================================
-- MARKETING ATTRIBUTION AND THE CONVERSION SEND LEDGER
--
-- Two tables, both supporting the Meta Pixel / Conversions API integration in
-- `lib/meta/`, and NEITHER of them family data.
--
-- ── WHY THEY EXIST ─────────────────────────────────────────────────────────
--
--   marketing_attribution        Which campaign found this account. Written once
--                                at registration from the first-party cookie the
--                                browser has been carrying since the ad click.
--                                It is what lets GENORRA answer "which campaign
--                                produced this paying family?" WITHOUT asking
--                                Meta — a question no reporting inside an ad
--                                platform can answer honestly about itself, and
--                                one that survives the platform being changed.
--
--   marketing_conversion_events  Every conversion event id this product has ever
--                                claimed, and how the send went. It is the
--                                idempotency ledger: a payment webhook delivered
--                                five times claims the id once and sends once.
--                                Meta deduplicates by event id for 48 HOURS ONLY,
--                                so a redelivery a week later — which is exactly
--                                what a provider's dead-letter retry looks like —
--                                would otherwise be counted as a second purchase.
--                                It is also the ONLY trace a fire-and-forget
--                                background send leaves anywhere in this product.
--
-- ── RLS IS THE ENTIRE GATE, AND THERE ARE ZERO POLICIES ────────────────────
-- AGENTS.md §2c: Supabase's default ACL hands `anon` and `authenticated` full
-- `arwdDxtm` on any table created in `public` BEFORE this migration runs, so a
-- GRANT here would record nothing and a REVOKE would be undone by
-- `supabase/seed.sql` on the next local reset. What actually closes these tables
-- is that RLS is ENABLED and NO POLICY EXISTS for any command — under which
-- PostgreSQL denies SELECT, INSERT, UPDATE and DELETE outright for both browser
-- roles. Same arrangement as the six Gatherings tables and the five Meeting
-- Minutes ones, and asserted at the bottom of this file in both directions.
--
-- Every read and write is `createAdminClient()` from `lib/meta/`. AGENTS.md §3's
-- obligation to re-apply family scoping by hand DOES NOT APPLY, and that is worth
-- stating rather than leaving to be inferred: neither table has a `family_code`
-- and neither holds family data. `marketing_attribution` is keyed on the ACCOUNT
-- (`auth.users`), which is the right grain — attribution belongs to the person who
-- arrived, and one person may later belong to several families. They are invisible
-- to `npm run audit:family-scope` for the same reason (its SCOPED_TABLES is every
-- table WITH a `family_code`), so no verdict is owed there.
--
-- ── WHAT IS DELIBERATELY NOT STORED ────────────────────────────────────────
-- No email, no name, no IP address, no user agent, no `_fbp`, no hashed matching
-- parameters. Those are assembled in memory for one request and posted to Meta;
-- keeping a copy would turn a transient marketing payload into a standing store
-- of personal data with no purpose that needs it.
--
-- The LANDING PATH is stored and the query string is not; the referrer HOST is
-- stored and the rest of the referring URL is not. A path in this product names a
-- feature, while a query string can hold a search term or an invitation token, and
-- a full referrer can hold whatever the referring site had in its address bar.
--
-- `fbclid` IS stored, and only ever reaches this table when the visitor granted
-- consent — `forConsent()` in lib/meta/attribution.ts strips it from the cookie
-- otherwise, so there is nothing for the writer to find. That is enforced in the
-- browser and in the writer rather than by a constraint here, because a CHECK
-- cannot see a consent cookie.
-- ============================================================================

-- ── 1. Where an account came from ─────────────────────────────────────────
CREATE TABLE public.marketing_attribution (
  -- ON DELETE CASCADE: attribution about a deleted account is about nobody. It
  -- also means `truncate_entire_database.sql` and `reset_families.sql` clear
  -- these rows through the accounts they name, exactly as they do `genorra_staff`.
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- FIRST TOUCH — the arrival that FOUND this person. Written once and never
  -- rewritten; `persistAttributionForUser` inserts these columns with
  -- ON CONFLICT DO NOTHING for exactly that reason. Overwriting a first touch on
  -- every return visit is the commonest attribution bug there is, and it reports
  -- every conversion as coming from a brand search.
  first_touch_at    timestamptz NOT NULL DEFAULT now(),
  first_utm_source   text,
  first_utm_medium   text,
  first_utm_campaign text,
  first_utm_content  text,
  first_utm_term     text,
  first_landing_path text,
  first_referrer_host text,
  first_fbclid       text,

  -- LAST TOUCH — the arrival they converted on. Kept separately rather than
  -- replacing the first, because the two answer different questions and a
  -- business needs both: first touch says what to spend on to find people, last
  -- touch says what closes them.
  last_touch_at     timestamptz NOT NULL DEFAULT now(),
  last_utm_source   text,
  last_utm_medium   text,
  last_utm_campaign text,
  last_utm_content  text,
  last_utm_term     text,
  last_landing_path text,
  last_referrer_host text,
  last_fbclid       text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketing_attribution IS
  'First-party acquisition context per account. Service role only: RLS enabled, no policies. See lib/meta/attribution.ts.';

-- Reporting reads this by campaign, not by user. Partial, because most rows have
-- no campaign at all (direct arrivals) and there is no question that asks for them.
CREATE INDEX marketing_attribution_first_campaign_idx
  ON public.marketing_attribution (first_utm_campaign)
  WHERE first_utm_campaign IS NOT NULL;

ALTER TABLE public.marketing_attribution ENABLE ROW LEVEL SECURITY;
-- NO POLICIES. See the header — this is the gate, not an omission.

-- ── 2. The conversion send ledger ─────────────────────────────────────────
CREATE TABLE public.marketing_conversion_events (
  -- THE PRIMARY KEY IS THE EVENT ID, which is what makes the claim atomic: a
  -- concurrent second delivery loses the INSERT rather than reading "not sent
  -- yet" and sending. Same shape as `claim_distribution_recipients()`, without
  -- needing a function, because there is exactly one row to claim.
  --
  -- The id is `<prefix>_<32 hex>` — a SHA-256 of the event name and the business
  -- key. The key itself (an account id, a family code, a payment reference) is
  -- never stored here or sent anywhere. See lib/meta/event-id.ts.
  event_id   text PRIMARY KEY,
  event_name text NOT NULL,

  -- Nullable and ON DELETE SET NULL rather than CASCADE: the ledger's job is to
  -- prove a conversion was not sent twice, and deleting an account must not
  -- release its event ids for re-sending. A server-side event fired with no
  -- session — a webhook processed out of band — legitimately has no user at all.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 'pending' is what a claim looks like before the background send finishes.
  -- 'suppressed' is reserved for a decision made after the claim — today only
  -- "no matchable identity", which is a real outcome and not a failure.
  delivery text NOT NULL DEFAULT 'pending'
    CHECK (delivery IN ('pending', 'sent', 'failed', 'suppressed')),
  -- Meta's own error text, capped by the writer. Diagnostics only; it must never
  -- be shown to a user and never carries `user_data` or `custom_data`.
  detail text,

  claimed_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

COMMENT ON TABLE public.marketing_conversion_events IS
  'Idempotency ledger for Meta conversion events. Service role only: RLS enabled, no policies. See lib/meta/dispatch.ts.';

-- "What has not landed?" is the only operational question asked of this table.
CREATE INDEX marketing_conversion_events_unsettled_idx
  ON public.marketing_conversion_events (claimed_at DESC)
  WHERE delivery <> 'sent';

ALTER TABLE public.marketing_conversion_events ENABLE ROW LEVEL SECURITY;
-- NO POLICIES. See the header.

-- ── 3. Verify ─────────────────────────────────────────────────────────────
-- Both directions, because a one-way assertion cannot see this class of damage
-- (AGENTS.md, "Every assertion about a purge has to run in BOTH directions"):
-- RLS must be ON, and the policy count must be ZERO. A future migration that
-- adds a policy to either table has to come and delete this block, which is the
-- point — it makes opening these tables to the browser a deliberate act rather
-- than a side effect of a sweep that composes `auth_permission` onto everything
-- with a `permission_table_map` row.
DO $$
DECLARE
  t text;
  v_rls boolean;
  v_policies int;
BEGIN
  FOREACH t IN ARRAY ARRAY['marketing_attribution', 'marketing_conversion_events'] LOOP
    SELECT c.relrowsecurity INTO v_rls
      FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace AND c.relname = t;

    IF v_rls IS NULL THEN
      RAISE EXCEPTION '20260823000000: public.% was not created', t;
    END IF;
    IF NOT v_rls THEN
      RAISE EXCEPTION '20260823000000: RLS is not enabled on public.% — it is the only gate', t;
    END IF;

    SELECT count(*) INTO v_policies FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t;
    IF v_policies <> 0 THEN
      RAISE EXCEPTION
        '20260823000000: public.% has % policies. These tables are service-role only; '
        'a policy here would publish acquisition data to the browser.', t, v_policies;
    END IF;
  END LOOP;

  -- Neither key may be registered in the permission model. Stated positively so a
  -- later sweep that maps every table to a resource key trips here rather than
  -- silently composing an `auth_permission` factor onto a table whose whole
  -- protection is having no policy — the same assertion 20260822000018 §9f makes
  -- about the three Library keys that gate no table.
  IF EXISTS (
    SELECT 1 FROM public.permission_table_map
     WHERE table_name IN ('marketing_attribution', 'marketing_conversion_events')
  ) THEN
    RAISE EXCEPTION
      '20260823000000: a permission_table_map row names a marketing table. '
      'These are not family data and must not be gated by a family permission key.';
  END IF;

  RAISE NOTICE '20260823000000: marketing_attribution and marketing_conversion_events created, RLS on, no policies';
END $$;
