-- Add chapter targeting to announcements
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL;

-- Index for efficient chapter-filtered queries
CREATE INDEX IF NOT EXISTS announcements_chapter_id_idx ON announcements(chapter_id);
