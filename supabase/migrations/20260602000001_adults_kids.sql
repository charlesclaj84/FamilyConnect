-- Adults profile table (one record per user, plus records for converted kids)
CREATE TABLE IF NOT EXISTS adults (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  family_code      TEXT        NOT NULL,
  prefix           TEXT,
  first_name       TEXT        NOT NULL DEFAULT '',
  middle_name      TEXT,
  last_name        TEXT        NOT NULL DEFAULT '',
  suffix           TEXT,
  primary_email    TEXT,
  primary_phone    TEXT,
  street_address   TEXT,
  apartment        TEXT,
  city             TEXT,
  state            TEXT,
  zip_code         TEXT,
  country          TEXT,
  date_of_birth    DATE,
  sunset_date      DATE,
  tshirt_category  TEXT,
  tshirt_size      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE adults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can select own adult record"
  ON adults FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users can insert own adult record"
  ON adults FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own adult record"
  ON adults FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can delete own adult record"
  ON adults FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER adults_updated_at
  BEFORE UPDATE ON adults
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Kids table (children entered by a parent user)
CREATE TABLE IF NOT EXISTS kids (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_code      TEXT        NOT NULL,
  first_name       TEXT        NOT NULL,
  middle_name      TEXT,
  last_name        TEXT        NOT NULL,
  date_of_birth    DATE,
  tshirt_category  TEXT,
  tshirt_size      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE kids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parents can select own kids"
  ON kids FOR SELECT
  TO authenticated
  USING (parent_user_id = auth.uid());

CREATE POLICY "parents can insert own kids"
  ON kids FOR INSERT
  TO authenticated
  WITH CHECK (parent_user_id = auth.uid());

CREATE POLICY "parents can update own kids"
  ON kids FOR UPDATE
  TO authenticated
  USING (parent_user_id = auth.uid())
  WITH CHECK (parent_user_id = auth.uid());

CREATE POLICY "parents can delete own kids"
  ON kids FOR DELETE
  TO authenticated
  USING (parent_user_id = auth.uid());

CREATE TRIGGER kids_updated_at
  BEFORE UPDATE ON kids
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
