-- ── Chapters ──────────────────────────────────────────────────────────────────
CREATE TABLE chapters (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_code, name)
);

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family members can read chapters"
  ON chapters FOR SELECT TO authenticated
  USING (family_code = (auth.jwt() -> 'user_metadata' ->> 'family_code'));

-- ── Role enhancements ─────────────────────────────────────────────────────────
-- scope:     where in the org this role operates
-- is_global: true = seeded / uneditable; false = custom family role
-- family_code: NULL for global roles, set for family-specific custom roles
ALTER TABLE family_roles ADD COLUMN IF NOT EXISTS scope       TEXT    NOT NULL DEFAULT 'national'
  CHECK (scope IN ('national', 'regional', 'chapter'));
ALTER TABLE family_roles ADD COLUMN IF NOT EXISTS is_global   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE family_roles ADD COLUMN IF NOT EXISTS family_code TEXT;

-- All previously seeded roles are global
UPDATE family_roles SET is_global = true WHERE family_code IS NULL;

-- ── User role assignment enhancements ─────────────────────────────────────────
-- scope:      National / Regional / Chapter level for this specific assignment
-- chapter_id: which chapter (when scope = 'chapter')
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS scope      TEXT NOT NULL DEFAULT 'national'
  CHECK (scope IN ('national', 'regional', 'chapter'));
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES chapters(id);

-- ── Chapter membership on people ─────────────────────────────────────────────
ALTER TABLE people ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES chapters(id);

-- ── Blueprint item enhancements ───────────────────────────────────────────────
ALTER TABLE event_blueprint_items ADD COLUMN IF NOT EXISTS due_date      DATE;
ALTER TABLE event_blueprint_items ADD COLUMN IF NOT EXISTS response_type TEXT NOT NULL DEFAULT 'text'
  CHECK (response_type IN ('text', 'date', 'checkbox'));
