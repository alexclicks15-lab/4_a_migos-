-- ============================================================
-- Migration 017_ai_knowledge_base.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'faq' CHECK (type IN ('faq', 'documentation', 'product_list')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_company ON ai_knowledge_base(company_id);

ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users can manage RAG knowledge" ON ai_knowledge_base;
CREATE POLICY "Company users can manage RAG knowledge" ON ai_knowledge_base FOR ALL USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);
