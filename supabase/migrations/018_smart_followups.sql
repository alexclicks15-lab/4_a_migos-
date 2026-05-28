-- ============================================================
-- Migration 018_smart_followups.sql
-- ============================================================

-- 1. Create smart_followups table
CREATE TABLE IF NOT EXISTS smart_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  template_name TEXT,
  template_params JSONB DEFAULT '[]'::jsonb,
  custom_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add smart follow-up settings to ai_conversations
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS inactivity_followup_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS inactivity_hours INTEGER DEFAULT 24;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS inactivity_template_name TEXT;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS inactivity_template_params JSONB DEFAULT '[]'::jsonb;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_smart_followups_company ON smart_followups(company_id);
CREATE INDEX IF NOT EXISTS idx_smart_followups_status ON smart_followups(status);

-- 4. Enable RLS
ALTER TABLE smart_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users can manage smart followups" ON smart_followups;
CREATE POLICY "Company users can manage smart followups" ON smart_followups FOR ALL USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- 5. Trigger set_updated_at
DROP TRIGGER IF EXISTS set_updated_at ON smart_followups;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON smart_followups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
