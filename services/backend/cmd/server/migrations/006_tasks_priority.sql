ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'MEDIUM';

UPDATE tasks
SET priority = 'MEDIUM'
WHERE priority IS NULL OR priority = '';

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_priority_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'));

CREATE INDEX IF NOT EXISTS idx_tasks_priority_status_due ON tasks(priority, status, due_at);
