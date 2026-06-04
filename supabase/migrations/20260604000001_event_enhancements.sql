-- ── Sub-events (hierarchical events with date + optional time) ───────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time      TIME;

-- ── Multi-assignee per blueprint item ─────────────────────────────────────────
-- Drop single-per-item unique constraint; replace with per-person uniqueness
ALTER TABLE event_assignments DROP CONSTRAINT IF EXISTS event_assignments_event_id_blueprint_item_id_key;
ALTER TABLE event_assignments ADD CONSTRAINT event_assignments_unique_per_person
  UNIQUE (event_id, blueprint_item_id, assigned_to);

-- Response tracking on each assignment
ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS response        TEXT;
ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS response_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (response_status IN ('pending', 'submitted', 'approved'));
ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS approved_by     UUID REFERENCES auth.users(id);
ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ;

-- RLS: assignees can update their own assignments (response + status)
DROP POLICY IF EXISTS "assignees can update own assignments" ON event_assignments;
CREATE POLICY "assignees can update own assignments"
  ON event_assignments FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- ── Per-person RSVP attending flag ────────────────────────────────────────────
-- Each person in event_rsvp_attendees now has their own is_attending flag.
-- Rows are created for ALL family members (not just attending ones).
ALTER TABLE event_rsvp_attendees ADD COLUMN IF NOT EXISTS is_attending BOOLEAN NOT NULL DEFAULT false;
