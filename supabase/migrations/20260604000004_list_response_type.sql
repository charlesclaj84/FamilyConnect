-- Add 'list' as a valid response type for blueprint items
ALTER TABLE event_blueprint_items DROP CONSTRAINT IF EXISTS event_blueprint_items_response_type_check;
ALTER TABLE event_blueprint_items ADD CONSTRAINT event_blueprint_items_response_type_check
  CHECK (response_type IN ('text', 'date', 'checkbox', 'list'));
