-- Dues schedules and payment tracking

CREATE TABLE IF NOT EXISTS dues_schedules (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT        NOT NULL,
  label        TEXT        NOT NULL,
  amount_cents INT         NOT NULL DEFAULT 0,
  frequency    TEXT        NOT NULL DEFAULT 'annual' CHECK (frequency IN ('annual', 'semi-annual', 'quarterly', 'monthly', 'one-time')),
  due_month    INT         CHECK (due_month BETWEEN 1 AND 12),
  due_day      INT         CHECK (due_day BETWEEN 1 AND 31),
  active       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dues_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view dues schedules"
  ON dues_schedules FOR SELECT
  TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can manage dues schedules"
  ON dues_schedules FOR ALL
  TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  )
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

CREATE TRIGGER dues_schedules_updated_at
  BEFORE UPDATE ON dues_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS dues_payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code     TEXT        NOT NULL,
  person_id       UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  schedule_id     UUID        REFERENCES dues_schedules(id) ON DELETE SET NULL,
  amount_cents    INT         NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'waived')),
  payment_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT,
  notes           TEXT,
  recorded_by     UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dues_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view dues payments"
  ON dues_payments FOR SELECT
  TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can manage dues payments"
  ON dues_payments FOR ALL
  TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  )
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );
