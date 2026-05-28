-- ============================================================
-- 013_google_calendar.sql — Google Calendar Integration
--
-- Idempotent migration — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS google_calendar_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry_date TIMESTAMPTZ,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_config_user_id ON google_calendar_config(user_id);

ALTER TABLE google_calendar_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own google calendar config" ON google_calendar_config;
CREATE POLICY "Users can manage own google calendar config" ON google_calendar_config FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON google_calendar_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON google_calendar_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
