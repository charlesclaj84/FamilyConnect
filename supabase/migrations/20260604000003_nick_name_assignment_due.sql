-- Nickname on people
ALTER TABLE people ADD COLUMN IF NOT EXISTS nick_name TEXT;

-- Per-assignment due date (replaces due_date on event_blueprint_items for planning)
ALTER TABLE event_assignments ADD COLUMN IF NOT EXISTS due_date DATE;
