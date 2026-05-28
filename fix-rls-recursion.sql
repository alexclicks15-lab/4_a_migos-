-- ============================================================
-- PATCH: Fix infinite recursion in company_users RLS policies
-- Run this in: https://supabase.com/dashboard/project/zuyolugchtqvcyuwdemq/sql/new
-- ============================================================

-- Helper: check if the current user has owner/admin role in a company.
-- SECURITY DEFINER bypasses RLS so the function doesn't recurse into itself.
CREATE OR REPLACE FUNCTION is_company_owner_or_admin(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   company_users cu
    JOIN   profiles p ON p.id = cu.profile_id
    WHERE  cu.company_id = p_company_id
    AND    p.user_id     = auth.uid()
    AND    cu.role       IN ('owner', 'admin')
  );
$$;

-- Helper: check if current user is a super_admin.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Re-create company_users policies without recursion
DROP POLICY IF EXISTS "Users can view own company links" ON company_users;
CREATE POLICY "Users can view own company links" ON company_users FOR SELECT USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR is_super_admin()
);

DROP POLICY IF EXISTS "Owners and admins can manage company users" ON company_users;
CREATE POLICY "Owners and admins can manage company users" ON company_users FOR ALL USING (
  is_company_owner_or_admin(company_id) OR is_super_admin()
);

-- Also fix profile creation failures caused by an ambiguous PL/pgSQL
-- variable/column name in the default-company trigger.
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
