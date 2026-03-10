ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS company_category TEXT NOT NULL DEFAULT 'OTHER',
  ADD COLUMN IF NOT EXISTS company_subcategory TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_company_category ON leads(company_category);
