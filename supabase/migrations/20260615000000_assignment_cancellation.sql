-- Auto-cancel event planning tasks that are never completed before their event ends.

-- 1. Allow a fourth assignment status: 'cancelled'. Replaces the inline CHECK
--    created when response_status was first added.
ALTER TABLE event_assignments DROP CONSTRAINT IF EXISTS event_assignments_response_status_check;
ALTER TABLE event_assignments ADD CONSTRAINT event_assignments_response_status_check
  CHECK (response_status IN ('pending', 'submitted', 'approved', 'cancelled'));

-- 2. Cancel any still-open task (pending/submitted and not complete) once its
--    event has ended. The event's effective end is end_date, then start_date,
--    then the legacy event_date; events with no date are left alone. Idempotent —
--    approved and already-cancelled rows are never touched.
CREATE OR REPLACE FUNCTION cancel_overdue_event_assignments()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE event_assignments AS ea
  SET response_status = 'cancelled'
  FROM events AS e
  WHERE ea.event_id = e.id
    AND ea.is_complete = false
    AND ea.response_status IN ('pending', 'submitted')
    AND COALESCE(e.end_date, e.start_date, e.event_date) IS NOT NULL
    AND COALESCE(e.end_date, e.start_date, e.event_date) < CURRENT_DATE;
$$;
