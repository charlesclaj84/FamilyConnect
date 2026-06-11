-- Accounting expansion:
--   * member-chosen pay cadence (dues_member_plans)
--   * fund routing config (priority/minimum on funds + fund_allocations split)
--   * contributions ledger (fund_contributions — money INTO funds)
--   * event budgets (event_budget_items + event_expenses) with a backing fund
-- All money stays in integer *_cents. Reuses the existing set_updated_at() trigger.

-- ============================================================
-- 1a. funds: routing priority, minimum balance, backing event
-- ============================================================
ALTER TABLE funds
  ADD COLUMN IF NOT EXISTS priority      INT  NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS minimum_cents INT  NOT NULL DEFAULT 0 CHECK (minimum_cents >= 0),
  ADD COLUMN IF NOT EXISTS event_id      UUID REFERENCES events(id) ON DELETE SET NULL;

-- A fund backs at most one event, and an event has at most one backing fund.
CREATE UNIQUE INDEX IF NOT EXISTS funds_event_id_uniq
  ON funds(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS funds_family_priority_idx
  ON funds(family_code, priority);

-- ============================================================
-- 1c. dues_member_plans: a member's chosen pay cadence per schedule
--     (created before the dues_payments ALTER that references it)
-- ============================================================
CREATE TABLE IF NOT EXISTS dues_member_plans (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT        NOT NULL,
  person_id   UUID        NOT NULL REFERENCES people(id)         ON DELETE CASCADE,
  schedule_id UUID        NOT NULL REFERENCES dues_schedules(id) ON DELETE CASCADE,
  cadence     TEXT        NOT NULL DEFAULT 'monthly'
                CHECK (cadence IN ('weekly','monthly','quarterly','annual','one-time')),
  start_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_by  UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, schedule_id)
);

CREATE INDEX IF NOT EXISTS dues_member_plans_family_idx   ON dues_member_plans(family_code);
CREATE INDEX IF NOT EXISTS dues_member_plans_schedule_idx ON dues_member_plans(schedule_id);

ALTER TABLE dues_member_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view dues_member_plans"
  ON dues_member_plans FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can manage dues_member_plans"
  ON dues_member_plans FOR ALL TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  )
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

-- Members may manage their OWN plan (so a non-admin can pick a cadence).
CREATE POLICY "members manage own dues_member_plans"
  ON dues_member_plans FOR ALL TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND person_id IN (SELECT id FROM people WHERE user_id = auth.uid())
  )
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND person_id IN (SELECT id FROM people WHERE user_id = auth.uid())
  );

CREATE TRIGGER dues_member_plans_updated_at
  BEFORE UPDATE ON dues_member_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 1b. dues_payments: gateway-ready source + routing bookkeeping
-- ============================================================
ALTER TABLE dues_payments
  ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'manual'
                            CHECK (source IN ('manual','stripe','import')),
  ADD COLUMN IF NOT EXISTS processor_ref TEXT,
  ADD COLUMN IF NOT EXISTS plan_id       UUID REFERENCES dues_member_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS routed_at     TIMESTAMPTZ;

-- Idempotency for a future payment processor (e.g. Stripe webhook retries).
CREATE UNIQUE INDEX IF NOT EXISTS dues_payments_processor_ref_uniq
  ON dues_payments(source, processor_ref) WHERE processor_ref IS NOT NULL;

-- ============================================================
-- 1d. fund_allocations: family-wide dues split (basis points)
-- ============================================================
CREATE TABLE IF NOT EXISTS fund_allocations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT        NOT NULL,
  fund_id      UUID        NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  basis_points INT         NOT NULL DEFAULT 0 CHECK (basis_points BETWEEN 0 AND 10000),
  created_by   UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_code, fund_id)
);

CREATE INDEX IF NOT EXISTS fund_allocations_family_idx ON fund_allocations(family_code);

ALTER TABLE fund_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view fund_allocations"
  ON fund_allocations FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can manage fund_allocations"
  ON fund_allocations FOR ALL TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  )
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

CREATE TRIGGER fund_allocations_updated_at
  BEFORE UPDATE ON fund_allocations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 1e. fund_contributions: money INTO funds (dues routing + manual)
-- ============================================================
CREATE TABLE IF NOT EXISTS fund_contributions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id          UUID        NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  family_code      TEXT        NOT NULL,
  amount_cents     INT         NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  source           TEXT        NOT NULL DEFAULT 'admin_manual'
                     CHECK (source IN ('dues_routing','admin_manual')),
  dues_payment_id  UUID        REFERENCES dues_payments(id) ON DELETE CASCADE,
  contributed_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT,
  recorded_by      UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fund_contributions_fund_idx    ON fund_contributions(fund_id);
CREATE INDEX IF NOT EXISTS fund_contributions_family_idx  ON fund_contributions(family_code);
CREATE INDEX IF NOT EXISTS fund_contributions_payment_idx ON fund_contributions(dues_payment_id);

ALTER TABLE fund_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view fund_contributions"
  ON fund_contributions FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can manage fund_contributions"
  ON fund_contributions FOR ALL TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  )
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

-- ============================================================
-- 1f. event_budget_items: budgeted line items for an event
-- ============================================================
CREATE TABLE IF NOT EXISTS event_budget_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  family_code  TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  budget_cents INT         NOT NULL DEFAULT 0 CHECK (budget_cents >= 0),
  sort_order   INT         NOT NULL DEFAULT 0,
  created_by   UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_budget_items_event_idx ON event_budget_items(event_id, sort_order);

ALTER TABLE event_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view event_budget_items"
  ON event_budget_items FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can manage event_budget_items"
  ON event_budget_items FOR ALL TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  )
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

CREATE TRIGGER event_budget_items_updated_at
  BEFORE UPDATE ON event_budget_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 1g. event_expenses: actual spend (optionally draws down a fund)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_expenses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  budget_item_id UUID        REFERENCES event_budget_items(id) ON DELETE SET NULL,
  fund_id        UUID        REFERENCES funds(id) ON DELETE SET NULL,
  family_code    TEXT        NOT NULL,
  amount_cents   INT         NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  spent_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  description    TEXT,
  recorded_by    UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_expenses_event_idx ON event_expenses(event_id);
CREATE INDEX IF NOT EXISTS event_expenses_item_idx  ON event_expenses(budget_item_id);
CREATE INDEX IF NOT EXISTS event_expenses_fund_idx  ON event_expenses(fund_id);

ALTER TABLE event_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view event_expenses"
  ON event_expenses FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can manage event_expenses"
  ON event_expenses FOR ALL TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  )
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

-- ============================================================
-- 1h. fund_balance_cents helper: contributions − disbursements − expenses
-- ============================================================
CREATE OR REPLACE FUNCTION fund_balance_cents(p_fund_id UUID)
RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT  COALESCE((SELECT SUM(amount_cents) FROM fund_contributions WHERE fund_id = p_fund_id), 0)
        - COALESCE((SELECT SUM(amount_cents) FROM fund_disbursements WHERE fund_id = p_fund_id), 0)
        - COALESCE((SELECT SUM(amount_cents) FROM event_expenses     WHERE fund_id = p_fund_id), 0);
$$;
