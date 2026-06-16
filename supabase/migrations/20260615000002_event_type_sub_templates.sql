-- An Event Template can auto-include other Event Templates as sub-events.
-- When an event is created from a parent template, one sub-event is created per
-- linked child template (single level only — sub-events cannot nest further, so
-- child templates' own sub-templates are not expanded).
CREATE TABLE IF NOT EXISTS event_type_sub_templates (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_event_type_id UUID        NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
  child_event_type_id  UUID        NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
  sort_order           INT         NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_event_type_id, child_event_type_id),
  CONSTRAINT no_self_subtemplate CHECK (parent_event_type_id <> child_event_type_id)
);

ALTER TABLE event_type_sub_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read event_type_sub_templates"
  ON event_type_sub_templates FOR SELECT TO authenticated
  USING (
    parent_event_type_id IN (
      SELECT id FROM event_types
      WHERE family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code')
    )
  );
