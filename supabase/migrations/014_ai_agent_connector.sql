-- ============================================================
-- Migration 014_ai_agent_connector.sql
-- ============================================================

-- 1. Contacts modification
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 50;

-- 2. AI Conversations settings
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  persona TEXT NOT NULL DEFAULT 'You are an intelligent WhatsApp CRM AI assistant.',
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, conversation_id)
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own AI conversations" ON ai_conversations;
CREATE POLICY "Users can manage own AI conversations" ON ai_conversations FOR ALL USING (auth.uid() = user_id);

-- 3. AI Intents Configuration
CREATE TABLE IF NOT EXISTS ai_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  confidence_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE ai_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own AI intents" ON ai_intents;
CREATE POLICY "Users can manage own AI intents" ON ai_intents FOR ALL USING (auth.uid() = user_id);

-- 4. AI Entities Configuration
CREATE TABLE IF NOT EXISTS ai_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('string', 'number', 'date', 'time', 'boolean', 'json')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE ai_entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own AI entities" ON ai_entities;
CREATE POLICY "Users can manage own AI entities" ON ai_entities FOR ALL USING (auth.uid() = user_id);

-- 5. AI Actions mapping
CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intent_name TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('add_tag', 'remove_tag', 'create_deal', 'update_lead_score', 'schedule_event', 'trigger_automation', 'human_handoff')),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own AI actions" ON ai_actions;
CREATE POLICY "Users can manage own AI actions" ON ai_actions FOR ALL USING (auth.uid() = user_id);

-- 6. AI Conversation Memory
CREATE TABLE IF NOT EXISTS ai_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  summary TEXT,
  short_term_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id)
);

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own AI memory" ON ai_memory;
CREATE POLICY "Users can manage own AI memory" ON ai_memory FOR ALL
  USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = ai_memory.contact_id AND contacts.user_id = auth.uid()));

-- 7. AI Training Data QA examples
CREATE TABLE IF NOT EXISTS ai_training_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  example_input TEXT NOT NULL,
  expected_output JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_training_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own AI training data" ON ai_training_data;
CREATE POLICY "Users can manage own AI training data" ON ai_training_data FOR ALL USING (auth.uid() = user_id);

-- 8. AI Operational Logs
CREATE TABLE IF NOT EXISTS ai_automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  intent_detected TEXT,
  confidence NUMERIC(3,2),
  entities_extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions_taken JSONB NOT NULL DEFAULT '[]'::jsonb,
  lead_score_before INTEGER,
  lead_score_after INTEGER,
  response_text TEXT,
  requires_handoff BOOLEAN NOT NULL DEFAULT FALSE,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own AI logs" ON ai_automation_logs;
CREATE POLICY "Users can manage own AI logs" ON ai_automation_logs FOR ALL USING (auth.uid() = user_id);

-- 9. Setup set_updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON ai_conversations;
DROP TRIGGER IF EXISTS set_updated_at ON ai_memory;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
