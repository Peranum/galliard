ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS reference_type TEXT NOT NULL DEFAULT 'WORK';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS reference_id TEXT;

UPDATE tasks
SET status = 'PLANNED'
WHERE status = 'OPEN';

UPDATE tasks
SET reference_type = 'LEAD',
    reference_id = lead_id
WHERE lead_id IS NOT NULL
  AND (reference_id IS NULL OR reference_id = '');

UPDATE tasks
SET reference_type = 'WORK'
WHERE reference_type IS NULL OR reference_type = '';

ALTER TABLE tasks
  ALTER COLUMN status SET DEFAULT 'PLANNED';

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('PLANNED', 'READY', 'IN_PROGRESS', 'REVIEW', 'DONE'));

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_reference_type_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_reference_type_check
  CHECK (reference_type IN ('WORK', 'LEAD', 'CLIENT'));

CREATE INDEX IF NOT EXISTS idx_tasks_reference ON tasks(reference_type, reference_id);
