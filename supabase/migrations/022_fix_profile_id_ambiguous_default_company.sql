-- ============================================================
-- 022_fix_profile_id_ambiguous_default_company.sql
-- Fix ambiguous profile_id reference in default-company trigger.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_user_default_company()
RETURNS TRIGGER AS $$
DECLARE
  default_company_id UUID;
  v_profile_id UUID;
BEGIN
  SELECT p.id INTO v_profile_id
  FROM profiles p
  WHERE p.user_id = NEW.user_id;

  IF v_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM company_users cu
      WHERE cu.profile_id = v_profile_id
    ) THEN
      INSERT INTO companies (name, industry, status)
      VALUES (COALESCE(NEW.full_name, NEW.email, 'User') || ' Workspace', 'Technology', 'active')
      RETURNING id INTO default_company_id;

      INSERT INTO company_users (company_id, profile_id, role, status)
      VALUES (default_company_id, v_profile_id, 'owner', 'active');

      INSERT INTO subscriptions (company_id, plan_id, status)
      VALUES (default_company_id, 'free', 'active');

      UPDATE contacts SET company_id = default_company_id WHERE user_id = NEW.user_id;
      UPDATE pipelines SET company_id = default_company_id WHERE user_id = NEW.user_id;
      UPDATE automations SET company_id = default_company_id WHERE user_id = NEW.user_id;
      UPDATE appointments SET company_id = default_company_id WHERE user_id = NEW.user_id;
      UPDATE ai_conversations SET company_id = default_company_id WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
