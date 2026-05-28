-- ============================================================
-- Migration 019_spreadsheet_automation.sql
-- ============================================================

-- 1. Create sheet_connections table
CREATE TABLE IF NOT EXISTS sheet_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('google_sheets', 'airtable', 'postgres', 'mysql', 'excel_upload')),
  name TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create sheet_sync_configs table
CREATE TABLE IF NOT EXISTS sheet_sync_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES sheet_connections(id) ON DELETE CASCADE,
  spreadsheet_id TEXT,
  sheet_name TEXT,
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_interval TEXT NOT NULL DEFAULT 'manual' CHECK (sync_interval IN ('manual', '15m', '1h', '12h', '24h')),
  last_synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create sheet_sync_logs table
CREATE TABLE IF NOT EXISTS sheet_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_id UUID REFERENCES sheet_sync_configs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error')),
  rows_processed INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create sheet_reminders_analytics table
CREATE TABLE IF NOT EXISTS sheet_reminders_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_id UUID REFERENCES sheet_sync_configs(id) ON DELETE CASCADE,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS idx_sheet_connections_company ON sheet_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_sheet_sync_configs_company ON sheet_sync_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_sheet_sync_configs_connection ON sheet_sync_configs(connection_id);
CREATE INDEX IF NOT EXISTS idx_sheet_sync_logs_config ON sheet_sync_logs(config_id);
CREATE INDEX IF NOT EXISTS idx_sheet_reminders_analytics_config ON sheet_reminders_analytics(config_id);

-- 6. Enable RLS
ALTER TABLE sheet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_reminders_analytics ENABLE ROW LEVEL SECURITY;

-- 7. Add Policies
DROP POLICY IF EXISTS "Company users can manage sheet connections" ON sheet_connections;
CREATE POLICY "Company users can manage sheet connections" ON sheet_connections FOR ALL USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "Company users can manage sheet configs" ON sheet_sync_configs;
CREATE POLICY "Company users can manage sheet configs" ON sheet_sync_configs FOR ALL USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "Company users can view sheet logs" ON sheet_sync_logs;
CREATE POLICY "Company users can view sheet logs" ON sheet_sync_logs FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "Company users can view sheet analytics" ON sheet_reminders_analytics;
CREATE POLICY "Company users can view sheet analytics" ON sheet_reminders_analytics FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- 8. Add set_updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON sheet_connections;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sheet_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON sheet_sync_configs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sheet_sync_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
