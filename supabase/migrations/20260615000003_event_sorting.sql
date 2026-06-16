-- Manual ordering for Event Templates and for an event's sub-events.

-- 1. Event Templates: order on the admin list. Backfill existing rows by name so
--    each family's templates start with distinct, stable positions.
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY family_code ORDER BY name) AS rn
  FROM event_types
)
UPDATE event_types et SET sort_order = ordered.rn
FROM ordered WHERE et.id = ordered.id;

-- 2. Sub-events: order within their parent event. Backfill from the previous
--    implicit order (date, then time, then creation). Top-level events keep 0.
ALTER TABLE events ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY parent_event_id
    ORDER BY event_date NULLS LAST, event_time NULLS LAST, created_at
  ) AS rn
  FROM events
  WHERE parent_event_id IS NOT NULL
)
UPDATE events e SET sort_order = ordered.rn
FROM ordered WHERE e.id = ordered.id;
