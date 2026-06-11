-- Board positions assigned at the Regional level can now be tied to a specific region.
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL;
