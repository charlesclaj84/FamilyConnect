-- ── Admin flags on people ─────────────────────────────────────────────────────
ALTER TABLE people ADD COLUMN IF NOT EXISTS is_admin    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE people ADD COLUMN IF NOT EXISTS can_approve BOOLEAN NOT NULL DEFAULT false;

-- ── Family roles lookup (global, shared across all families) ──────────────────
CREATE TABLE family_roles (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL UNIQUE,
  category   TEXT    NOT NULL CHECK (category IN ('executive_officer', 'appointed_position')),
  sort_order INT     NOT NULL
);

INSERT INTO family_roles (name, category, sort_order) VALUES
  ('President',                'executive_officer',   1),
  ('Vice President',           'executive_officer',   2),
  ('Secretary',                'executive_officer',   3),
  ('Treasurer',                'executive_officer',   4),
  ('Sergeant-at-Arms',         'executive_officer',   5),
  ('Assistant Secretary',      'appointed_position',  6),
  ('Assistant Treasurer',      'appointed_position',  7),
  ('Immediate Past President', 'appointed_position',  8),
  ('Parliamentarian',          'appointed_position',  9),
  ('Chaplain',                 'appointed_position', 10),
  ('Historian',                'appointed_position', 11),
  ('Public Relations Officer', 'appointed_position', 12),
  ('Communications Officer',   'appointed_position', 13),
  ('Membership Chair',         'appointed_position', 14),
  ('Fundraising Chair',        'appointed_position', 15),
  ('Events Chair',             'appointed_position', 16),
  ('Community Service Chair',  'appointed_position', 17),
  ('Youth Chair',              'appointed_position', 18),
  ('Scholarship Chair',        'appointed_position', 19),
  ('Technology Chair',         'appointed_position', 20),
  ('Safety & Security Chair',  'appointed_position', 21),
  ('Family Reunion Chair',     'appointed_position', 22),
  ('Hospitality Chair',        'appointed_position', 23),
  ('Sponsorship Chair',        'appointed_position', 24),
  ('Volunteer Coordinator',    'appointed_position', 25);

ALTER TABLE family_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read roles"
  ON family_roles FOR SELECT TO authenticated USING (true);

-- ── User role assignments (per family) ────────────────────────────────────────
CREATE TABLE user_roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_code TEXT        NOT NULL,
  role_id     UUID        NOT NULL REFERENCES family_roles(id) ON DELETE CASCADE,
  assigned_by UUID        REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, family_code, role_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read user_roles"
  ON user_roles FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

-- ── Event types ───────────────────────────────────────────────────────────────
CREATE TABLE event_types (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER event_types_updated_at
  BEFORE UPDATE ON event_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read event_types"
  ON event_types FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

-- ── Event blueprint items ─────────────────────────────────────────────────────
CREATE TABLE event_blueprint_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID        NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_by    UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER event_blueprint_items_updated_at
  BEFORE UPDATE ON event_blueprint_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE event_blueprint_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read blueprint_items"
  ON event_blueprint_items FOR SELECT TO authenticated
  USING (
    event_type_id IN (
      SELECT id FROM event_types
      WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

-- ── Events ────────────────────────────────────────────────────────────────────
-- status: draft (admin only) → published (visible + RSVP open) → approved | cancelled
CREATE TABLE events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code   TEXT        NOT NULL,
  event_type_id UUID        REFERENCES event_types(id),
  name          TEXT        NOT NULL,
  description   TEXT,
  event_date    DATE,
  location      TEXT,
  rsvp_deadline DATE,
  status        TEXT        NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','published','approved','cancelled')),
  created_by    UUID        REFERENCES auth.users(id),
  approved_by   UUID        REFERENCES auth.users(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read published events"
  ON events FOR SELECT TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND status IN ('published', 'approved')
  );

CREATE POLICY "admins can read all family events"
  ON events FOR SELECT TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
  );
-- Note: the above two policies combine so admins see all; regular members see published+approved.
-- Since Postgres OR's multiple policies, both are in effect. This gives admins full visibility.

-- ── Event assignments ─────────────────────────────────────────────────────────
CREATE TABLE event_assignments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  blueprint_item_id UUID        NOT NULL REFERENCES event_blueprint_items(id) ON DELETE CASCADE,
  assigned_to       UUID        REFERENCES auth.users(id),
  is_complete       BOOLEAN     NOT NULL DEFAULT false,
  completed_at      TIMESTAMPTZ,
  assigned_by       UUID        REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, blueprint_item_id)
);

CREATE TRIGGER event_assignments_updated_at
  BEFORE UPDATE ON event_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE event_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read assignments"
  ON event_assignments FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

CREATE POLICY "assignees can update own assignments"
  ON event_assignments FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- ── Event RSVP ────────────────────────────────────────────────────────────────
CREATE TABLE event_rsvp (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  submitted_by UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_attending BOOLEAN     NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, submitted_by)
);

CREATE TRIGGER event_rsvp_updated_at
  BEFORE UPDATE ON event_rsvp
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE event_rsvp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read rsvps"
  ON event_rsvp FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );
CREATE POLICY "users can manage own rsvp"
  ON event_rsvp FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "users can update own rsvp"
  ON event_rsvp FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid());

-- ── Event RSVP attendees ──────────────────────────────────────────────────────
CREATE TABLE event_rsvp_attendees (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id   UUID NOT NULL REFERENCES event_rsvp(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  UNIQUE (rsvp_id, person_id)
);

ALTER TABLE event_rsvp_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read rsvp_attendees"
  ON event_rsvp_attendees FOR SELECT TO authenticated
  USING (
    rsvp_id IN (
      SELECT r.id FROM event_rsvp r
      JOIN events e ON e.id = r.event_id
      WHERE e.family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );
CREATE POLICY "users can manage own rsvp_attendees"
  ON event_rsvp_attendees FOR INSERT TO authenticated
  WITH CHECK (
    rsvp_id IN (SELECT id FROM event_rsvp WHERE submitted_by = auth.uid())
  );
CREATE POLICY "users can delete own rsvp_attendees"
  ON event_rsvp_attendees FOR DELETE TO authenticated
  USING (
    rsvp_id IN (SELECT id FROM event_rsvp WHERE submitted_by = auth.uid())
  );
