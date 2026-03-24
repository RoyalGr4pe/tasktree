-- Add priority column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority text NULL
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
