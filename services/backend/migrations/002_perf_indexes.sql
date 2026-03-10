CREATE INDEX IF NOT EXISTS idx_leads_stage_last_activity ON leads(stage, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_owner_stage ON leads(owner_name, stage);
CREATE INDEX IF NOT EXISTS idx_stage_history_to_stage_changed_at ON lead_stage_history(to_stage, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_status ON campaign_messages(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_message_id ON campaign_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_due_updated ON tasks(status, due_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_message_type_ts ON email_events(message_id, event_type, ts DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_created ON activity_log(entity_type, entity_id, created_at DESC);
