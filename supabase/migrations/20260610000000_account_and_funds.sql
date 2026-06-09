-- dues_schedules: add scheduling date-window and description
ALTER TABLE dues_schedules
  ADD COLUMN IF NOT EXISTS start_date  DATE,
  ADD COLUMN IF NOT EXISTS end_date    DATE,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- events: add per-event budget allocation and official public description
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS budget_amount_cents  INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS official_description TEXT;

-- ============================================================
-- funds: dedicated money pools (College Fund, Graduation Fund)
-- ============================================================
CREATE TABLE IF NOT EXISTS funds (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  description  TEXT,
  goal_cents   INT,
  active       BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view funds"
  ON funds FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can insert funds"
  ON funds FOR INSERT TO authenticated
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE POLICY "admins can update funds"
  ON funds FOR UPDATE TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE POLICY "admins can delete funds"
  ON funds FOR DELETE TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE OR REPLACE FUNCTION update_funds_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER funds_updated_at
  BEFORE UPDATE ON funds
  FOR EACH ROW EXECUTE FUNCTION update_funds_updated_at();

-- ============================================================
-- fund_milestones: e.g. "Graduate high school" worth $500
-- ============================================================
CREATE TABLE IF NOT EXISTS fund_milestones (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id      UUID        NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  family_code  TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  description  TEXT,
  amount_cents INT         NOT NULL DEFAULT 0,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fund_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view fund_milestones"
  ON fund_milestones FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can insert fund_milestones"
  ON fund_milestones FOR INSERT TO authenticated
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE POLICY "admins can update fund_milestones"
  ON fund_milestones FOR UPDATE TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE POLICY "admins can delete fund_milestones"
  ON fund_milestones FOR DELETE TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

-- ============================================================
-- fund_disbursements: money paid to a person for a milestone
-- ============================================================
CREATE TABLE IF NOT EXISTS fund_disbursements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id        UUID        NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  milestone_id   UUID        REFERENCES fund_milestones(id) ON DELETE SET NULL,
  family_code    TEXT        NOT NULL,
  person_id      UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  amount_cents   INT         NOT NULL DEFAULT 0,
  disbursed_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  recorded_by    UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fund_disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view fund_disbursements"
  ON fund_disbursements FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can insert fund_disbursements"
  ON fund_disbursements FOR INSERT TO authenticated
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE POLICY "admins can delete fund_disbursements"
  ON fund_disbursements FOR DELETE TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );
