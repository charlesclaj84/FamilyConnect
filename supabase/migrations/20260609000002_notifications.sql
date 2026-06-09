-- In-app notifications for events, tasks, announcements, etc.

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  TEXT        NOT NULL,
  recipient_id UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL, -- 'event_published','task_assigned','task_approved','rsvp_deadline','announcement'
  title        TEXT        NOT NULL,
  body         TEXT,
  link         TEXT,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND recipient_id IN (
      SELECT id FROM people WHERE user_id = auth.uid()
    )
  );

-- Users can mark their own notifications read (via update)
CREATE POLICY "users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    recipient_id IN (SELECT id FROM people WHERE user_id = auth.uid())
  );

-- Admins and service role can insert notifications
CREATE POLICY "admins can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
        AND is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS notifications_recipient_unread
  ON notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;
