CREATE TABLE IF NOT EXISTS lead_contacts (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  department TEXT,
  full_name TEXT,
  role TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead_sort ON lead_contacts(lead_id, sort_order);
