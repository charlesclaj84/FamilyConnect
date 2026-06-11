-- Add ex-partner relationship types to support multi-partner family trees.
-- relationship_types is a global lookup table keyed by name (no family scoping).
INSERT INTO relationship_types (name) VALUES
  ('Ex-Husband'),
  ('Ex-Wife'),
  ('Ex-Partner')
ON CONFLICT (name) DO NOTHING;
