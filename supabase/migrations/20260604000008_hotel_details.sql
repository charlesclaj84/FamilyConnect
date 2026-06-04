-- Website and phone on hotel bookings
ALTER TABLE event_hotel_bookings ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE event_hotel_bookings ADD COLUMN IF NOT EXISTS phone   TEXT;

-- Flexible key/value pairs per hotel booking (check-in time, parking info, etc.)
CREATE TABLE event_hotel_booking_details (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_booking_id UUID NOT NULL REFERENCES event_hotel_bookings(id) ON DELETE CASCADE,
  key              TEXT NOT NULL,
  value            TEXT NOT NULL,
  sort_order       INT  NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_hotel_booking_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read hotel_details"
  ON event_hotel_booking_details FOR SELECT TO authenticated
  USING (
    hotel_booking_id IN (
      SELECT hb.id FROM event_hotel_bookings hb
      JOIN events e ON e.id = hb.event_id
      WHERE e.family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );
