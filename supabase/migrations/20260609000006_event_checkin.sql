-- Event attendance check-in: track who actually showed up vs who RSVPed

ALTER TABLE event_rsvp_attendees
  ADD COLUMN IF NOT EXISTS checked_in_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_by  UUID REFERENCES people(id) ON DELETE SET NULL;
