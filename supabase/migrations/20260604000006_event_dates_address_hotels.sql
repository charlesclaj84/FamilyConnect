-- ── Start/end dates on events (replaces single event_date in UI) ──────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date   DATE;

-- ── Full address on events (both main and sub) ─────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS suite          TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS city           TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS state          TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS zip_code       TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country        TEXT;

-- ── Hotel bookings (main events only) ─────────────────────────────────────────
CREATE TABLE event_hotel_bookings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  hotel_name     TEXT        NOT NULL,
  street_address TEXT,
  suite          TEXT,
  city           TEXT,
  state          TEXT,
  zip_code       TEXT,
  country        TEXT,
  booking_code   TEXT,
  created_by     UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER event_hotel_bookings_updated_at
  BEFORE UPDATE ON event_hotel_bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE event_hotel_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read hotel_bookings"
  ON event_hotel_bookings FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );

-- ── Price estimates per hotel booking ──────────────────────────────────────────
CREATE TABLE event_hotel_price_estimates (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_booking_id  UUID    NOT NULL REFERENCES event_hotel_bookings(id) ON DELETE CASCADE,
  room_type         TEXT    NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_hotel_price_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read price_estimates"
  ON event_hotel_price_estimates FOR SELECT TO authenticated
  USING (
    hotel_booking_id IN (
      SELECT hb.id FROM event_hotel_bookings hb
      JOIN events e ON e.id = hb.event_id
      WHERE e.family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );
