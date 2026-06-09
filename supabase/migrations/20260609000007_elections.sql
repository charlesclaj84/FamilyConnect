-- Elections: create ballots, collect nominations, record votes

CREATE TABLE IF NOT EXISTS elections (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code              TEXT        NOT NULL,
  title                    TEXT        NOT NULL,
  description              TEXT,
  status                   TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'nominations', 'voting', 'closed')),
  nominations_open_at      TIMESTAMPTZ,
  nominations_close_at     TIMESTAMPTZ,
  voting_open_at           TIMESTAMPTZ,
  voting_close_at          TIMESTAMPTZ,
  created_by               UUID        REFERENCES people(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE elections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view elections"
  ON elections FOR SELECT
  TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

CREATE POLICY "admins can manage elections"
  ON elections FOR ALL
  TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  )
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

CREATE TRIGGER elections_updated_at
  BEFORE UPDATE ON elections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS election_positions (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID  NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  title       TEXT  NOT NULL,
  max_winners INT   NOT NULL DEFAULT 1,
  sort_order  INT   NOT NULL DEFAULT 0
);

ALTER TABLE election_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view election positions"
  ON election_positions FOR SELECT
  TO authenticated
  USING (
    election_id IN (SELECT id FROM elections WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

CREATE POLICY "admins can manage election positions"
  ON election_positions FOR ALL
  TO authenticated
  USING (
    election_id IN (
      SELECT id FROM elections WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  )
  WITH CHECK (
    election_id IN (
      SELECT id FROM elections WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );


CREATE TABLE IF NOT EXISTS election_nominations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID        NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  position_id     UUID        NOT NULL REFERENCES election_positions(id) ON DELETE CASCADE,
  nominee_id      UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  nominated_by    UUID        REFERENCES people(id) ON DELETE SET NULL,
  accepted        BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, position_id, nominee_id)
);

ALTER TABLE election_nominations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family can view nominations"
  ON election_nominations FOR SELECT
  TO authenticated
  USING (
    election_id IN (SELECT id FROM elections WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

CREATE POLICY "family can submit nominations"
  ON election_nominations FOR INSERT
  TO authenticated
  WITH CHECK (
    election_id IN (SELECT id FROM elections WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code') AND status = 'nominations')
  );

CREATE POLICY "nominees can accept nominations"
  ON election_nominations FOR UPDATE
  TO authenticated
  USING (nominee_id IN (SELECT id FROM people WHERE user_id = auth.uid()));

CREATE POLICY "admins can delete nominations"
  ON election_nominations FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );


CREATE TABLE IF NOT EXISTS election_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID        NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  position_id UUID        NOT NULL REFERENCES election_positions(id) ON DELETE CASCADE,
  voter_id    UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  nominee_id  UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, position_id, voter_id)
);

ALTER TABLE election_votes ENABLE ROW LEVEL SECURITY;

-- Voters can see their own vote but not others' (secret ballot)
CREATE POLICY "voters can see own votes"
  ON election_votes FOR SELECT
  TO authenticated
  USING (voter_id IN (SELECT id FROM people WHERE user_id = auth.uid()));

-- Admins can view all votes for their family's elections
CREATE POLICY "admins can view all votes"
  ON election_votes FOR SELECT
  TO authenticated
  USING (
    election_id IN (SELECT id FROM elections WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'))
  );

CREATE POLICY "family can cast votes"
  ON election_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    election_id IN (SELECT id FROM elections WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code') AND status = 'voting')
    AND voter_id IN (SELECT id FROM people WHERE user_id = auth.uid())
  );
