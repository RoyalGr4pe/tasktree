ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status text NULL
  CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done'));
