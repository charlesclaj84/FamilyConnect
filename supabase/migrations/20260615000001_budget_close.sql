-- Officially closing an event's budget freezes its line items and expenses.
-- NULL = still open (editable); a timestamp = closed at that moment.
ALTER TABLE events ADD COLUMN IF NOT EXISTS budget_closed_at TIMESTAMPTZ;
