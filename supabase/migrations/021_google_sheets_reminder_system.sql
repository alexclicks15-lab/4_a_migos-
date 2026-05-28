-- ============================================================
-- 021_google_sheets_reminder_system.sql
-- Google Sheets powered WhatsApp date reminder automation
-- ============================================================

ALTER TABLE sheet_connections
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE sheet_sync_configs
  ADD COLUMN IF NOT EXISTS worksheet_id TEXT,
  ADD COLUMN IF NOT EXISTS preview_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS reminder_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_id UUID REFERENCES sheet_sync_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  source_field TEXT NOT NULL,
  offset_days INTEGER NOT NULL DEFAULT 0,
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'yearly', 'monthly', 'custom_interval')),
  interval_days INTEGER,
  send_time TIME,
  template TEXT NOT NULL,
  use_ai BOOLEAN NOT NULL DEFAULT FALSE,
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduler_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_id UUID REFERENCES sheet_sync_configs(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error')),
  job_type TEXT NOT NULL DEFAULT 'sheet_sync',
  message TEXT,
  rows_scanned INTEGER NOT NULL DEFAULT 0,
  reminders_triggered INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminder_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_id UUID REFERENCES sheet_sync_configs(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  source_field TEXT,
  target_date DATE,
  recipient_phone TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'skipped')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS synced_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_id UUID REFERENCES sheet_sync_configs(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  source_row_key TEXT NOT NULL,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, config_id, source_row_key)
);

-- Compatibility tables requested by product specs. They mirror the existing
-- sheet_* implementation names without forcing a disruptive data migration.
CREATE TABLE IF NOT EXISTS connected_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES sheet_connections(id) ON DELETE CASCADE,
  sync_config_id UUID REFERENCES sheet_sync_configs(id) ON DELETE CASCADE,
  spreadsheet_id TEXT,
  sheet_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  automation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sheet_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_id UUID REFERENCES sheet_sync_configs(id) ON DELETE CASCADE,
  crm_field TEXT NOT NULL,
  sheet_column TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(config_id, crm_field)
);

CREATE INDEX IF NOT EXISTS idx_reminder_triggers_config ON reminder_triggers(config_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_company ON scheduler_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_history_company ON reminder_history(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_history_dedupe ON reminder_history(company_id, config_id, contact_id, trigger_type, target_date);
CREATE INDEX IF NOT EXISTS idx_synced_contacts_company ON synced_contacts(company_id, config_id);
CREATE INDEX IF NOT EXISTS idx_connected_sheets_company ON connected_sheets(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_sheets_sync_config ON connected_sheets(sync_config_id) WHERE sync_config_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sheet_mappings_config ON sheet_mappings(config_id);

ALTER TABLE reminder_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users can manage reminder triggers" ON reminder_triggers;
CREATE POLICY "Company users can manage reminder triggers" ON reminder_triggers FOR ALL USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "Company users can view scheduler logs" ON scheduler_logs;
CREATE POLICY "Company users can view scheduler logs" ON scheduler_logs FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "Company users can view reminder history" ON reminder_history;
CREATE POLICY "Company users can view reminder history" ON reminder_history FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "Company users can manage synced contacts" ON synced_contacts;
CREATE POLICY "Company users can manage synced contacts" ON synced_contacts FOR ALL USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "Company users can manage connected sheets" ON connected_sheets;
CREATE POLICY "Company users can manage connected sheets" ON connected_sheets FOR ALL USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "Company users can manage sheet mappings" ON sheet_mappings;
CREATE POLICY "Company users can manage sheet mappings" ON sheet_mappings FOR ALL USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

DROP TRIGGER IF EXISTS set_updated_at ON reminder_triggers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reminder_triggers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON connected_sheets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON connected_sheets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON sheet_mappings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sheet_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
