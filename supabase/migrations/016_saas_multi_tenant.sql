-- ============================================================
-- Migration 016_saas_multi_tenant.sql
-- ============================================================

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  industry TEXT,
  whatsapp_number TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  custom_domain TEXT,
  branding_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(custom_domain);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins can manage all companies" ON companies;
CREATE POLICY "Super admins can manage all companies" ON companies FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin'
  )
);

-- 2. Create company_users table (RBAC linkage)
CREATE TABLE IF NOT EXISTS company_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'sales_agent' CHECK (role IN ('owner', 'admin', 'manager', 'sales_agent', 'support_agent', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_invite')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_company_users_profile ON company_users(profile_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users(company_id);

ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

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

-- Helper: check if current user is a super_admin (avoids repeated subqueries).
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

DROP POLICY IF EXISTS "Users can view own company links" ON company_users;
CREATE POLICY "Users can view own company links" ON company_users FOR SELECT USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR is_super_admin()
);

DROP POLICY IF EXISTS "Owners and admins can manage company users" ON company_users;
CREATE POLICY "Owners and admins can manage company users" ON company_users FOR ALL USING (
  is_company_owner_or_admin(company_id) OR is_super_admin()
);

-- 3. Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_monthly NUMERIC NOT NULL,
  price_yearly NUMERIC NOT NULL,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read plans" ON plans;
CREATE POLICY "Anyone can read plans" ON plans FOR SELECT USING (true);

-- Insert default plans
INSERT INTO plans (id, name, price_monthly, price_yearly, limits) VALUES
('free', 'Free Sandbox', 0, 0, '{"contacts": 100, "ai_replies": 50, "broadcasts": 2, "workflows": 3, "team_members": 1}'::jsonb),
('starter', 'Starter Plan', 29, 290, '{"contacts": 1000, "ai_replies": 500, "broadcasts": 10, "workflows": 10, "team_members": 3}'::jsonb),
('professional', 'Professional Plan', 79, 790, '{"contacts": 10000, "ai_replies": 5000, "broadcasts": 100, "workflows": 50, "team_members": 10}'::jsonb),
('enterprise', 'Enterprise Plan', 249, 2490, '{"contacts": 999999, "ai_replies": 999999, "broadcasts": 999999, "workflows": 999999, "team_members": 99}'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price_monthly = EXCLUDED.price_monthly, price_yearly = EXCLUDED.price_yearly, limits = EXCLUDED.limits;

-- 4. Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  trial_start TIMESTAMPTZ DEFAULT NOW(),
  trial_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  razorpay_subscription_id TEXT,
  razorpay_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company users can view own subscription" ON subscriptions;
CREATE POLICY "Company users can view own subscription" ON subscriptions FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- 5. Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'void')),
  billing_reason TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company users can view own invoices" ON invoices;
CREATE POLICY "Company users can view own invoices" ON invoices FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- 6. Create usage_logs table
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('contacts', 'ai_replies', 'broadcasts', 'workflows', 'team_members')),
  value INTEGER NOT NULL DEFAULT 0,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company users can view own usage logs" ON usage_logs;
CREATE POLICY "Company users can view own usage logs" ON usage_logs FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users cu
    WHERE cu.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- 7. Modify existing tables to add company_id tenancy
DO $$ 
DECLARE
  t TEXT;
  tables_to_migrate TEXT[] := ARRAY[
    'contacts', 'deals', 'conversations', 'contact_notes', 'messages',
    'automations', 'automation_steps', 'automation_logs', 'pipelines',
    'pipeline_stages', 'tags', 'contact_tags', 'ai_conversations',
    'ai_intents', 'ai_entities', 'ai_actions', 'ai_memory',
    'ai_training_data', 'ai_automation_logs', 'appointments',
    'appointment_slots', 'appointment_tokens', 'appointment_reminders',
    'appointment_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_migrate LOOP
    -- Add company_id column if not exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = t AND column_name = 'company_id'
      ) THEN
        EXECUTE 'ALTER TABLE ' || t || ' ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_' || t || '_company_id ON ' || t || '(company_id)';
      END IF;
    END IF;
  END LOOP;
END $$;

-- 8. Add super_admin role toggle to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 9. Trigger to auto-create and link default company for existing/new users
CREATE OR REPLACE FUNCTION handle_user_default_company()
RETURNS TRIGGER AS $$
DECLARE
  default_company_id UUID;
  v_profile_id UUID;
BEGIN
  -- Retrieve profile ID for the user
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = NEW.user_id;
  
  IF v_profile_id IS NOT NULL THEN
    -- Check if user already linked to a company
    IF NOT EXISTS (SELECT 1 FROM company_users cu WHERE cu.profile_id = v_profile_id) THEN
      -- Create a default company for this user
      INSERT INTO companies (name, industry, status)
      VALUES (NEW.full_name || ' Workspace', 'Technology', 'active')
      RETURNING id INTO default_company_id;

      -- Add user as Owner of the company
      INSERT INTO company_users (company_id, profile_id, role, status)
      VALUES (default_company_id, v_profile_id, 'owner', 'active');

      -- Subscribe company to Free Sandbox plan
      INSERT INTO subscriptions (company_id, plan_id, status)
      VALUES (default_company_id, 'free', 'active');

      -- Update user's records to belong to this company
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

-- Trigger on profiles insert/update
DROP TRIGGER IF EXISTS tr_user_default_company ON profiles;
CREATE TRIGGER tr_user_default_company
AFTER INSERT OR UPDATE OF full_name ON profiles
FOR EACH ROW EXECUTE FUNCTION handle_user_default_company();

-- Run default company generation for all existing profiles right away
DO $$
DECLARE
  p RECORD;
  default_company_id UUID;
BEGIN
  FOR p IN SELECT * FROM profiles LOOP
    -- Skip if user is already linked to a company
    IF NOT EXISTS (SELECT 1 FROM company_users WHERE profile_id = p.id) THEN
      -- Create a default company for this user
      INSERT INTO companies (name, industry, status)
      VALUES (COALESCE(p.full_name, p.email) || ' Workspace', 'Technology', 'active')
      RETURNING id INTO default_company_id;

      -- Add user as Owner
      INSERT INTO company_users (company_id, profile_id, role, status)
      VALUES (default_company_id, p.id, 'owner', 'active');

      -- Subscribe to Free plan
      INSERT INTO subscriptions (company_id, plan_id, status)
      VALUES (default_company_id, 'free', 'active');

      -- Update existing records to belong to this company
      UPDATE contacts    SET company_id = default_company_id WHERE user_id = p.user_id;
      UPDATE pipelines   SET company_id = default_company_id WHERE user_id = p.user_id;
      UPDATE automations SET company_id = default_company_id WHERE user_id = p.user_id;
    END IF;
  END LOOP;
END $$;
