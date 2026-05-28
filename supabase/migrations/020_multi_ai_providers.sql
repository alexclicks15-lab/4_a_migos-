-- ============================================================
-- Migration 020_multi_ai_providers.sql
-- ============================================================

-- 1. Create table for AI Providers API keys & URLs
CREATE TABLE IF NOT EXISTS ai_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini', 'claude', 'grok', 'deepseek', 'ollama')),
  api_key TEXT, -- Encrypted api key using our encryption helper
  api_url TEXT, -- Useful for custom endpoints like Ollama (e.g. http://localhost:11434) or DeepSeek proxy
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_ai_providers_company ON ai_providers(company_id);

ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company users can view own AI providers" ON ai_providers;
CREATE POLICY "Company users can view own AI providers" ON ai_providers FOR ALL USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- 2. Create table for AI Routing configuration (per feature, per agent, or default)
CREATE TABLE IF NOT EXISTS ai_routing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Optional: routing for a specific agent
  feature TEXT NOT NULL CHECK (feature IN ('default', 'replies', 'automations', 'qualification', 'agents', 'support_bots', 'workflow_generation')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  fallback_provider TEXT,
  fallback_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, agent_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_ai_routing_company ON ai_routing(company_id);

ALTER TABLE ai_routing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company users can view own AI routing" ON ai_routing;
CREATE POLICY "Company users can view own AI routing" ON ai_routing FOR ALL USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- 3. Create table for AI Analytics and Usage tracking
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost NUMERIC(10, 6) NOT NULL DEFAULT 0.0, -- Cost in USD
  latency_ms INTEGER NOT NULL DEFAULT 0,
  is_success BOOLEAN NOT NULL DEFAULT TRUE,
  error_log TEXT,
  accuracy_score NUMERIC(3,2) DEFAULT 1.0, -- Accuracy estimation
  converted BOOLEAN NOT NULL DEFAULT FALSE, -- Tag conversions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_company ON ai_usage_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at);

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company users can view own AI usage logs" ON ai_usage_logs;
CREATE POLICY "Company users can view own AI usage logs" ON ai_usage_logs FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- 4. Add set_updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON ai_providers;
DROP TRIGGER IF EXISTS set_updated_at ON ai_routing;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_routing FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
