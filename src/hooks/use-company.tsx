"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./use-auth";
import { UserRole, hasPermission, PermissionMatrix } from "@/lib/saas/permissions";
import { PlanId, UsageReport, getCompanyUsage } from "@/lib/saas/limits";

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  industry: string | null;
  whatsapp_number: string | null;
  status: 'active' | 'suspended';
  custom_domain: string | null;
  branding_config: Record<string, any>;
  created_at: string;
}

interface CompanyContextValue {
  companies: Company[];
  activeCompany: Company | null;
  setActiveCompany: (company: Company) => void;
  role: UserRole | 'super_admin' | null;
  plan: PlanId;
  usage: UsageReport | null;
  loading: boolean;
  refreshCompanyData: () => Promise<void>;
  checkPermission: (permission: keyof PermissionMatrix) => boolean;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null);
  const [role, setRole] = useState<UserRole | 'super_admin' | null>(null);
  const [plan, setPlan] = useState<PlanId>('free');
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCompanyData = useCallback(async () => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    try {
      // 1. If super admin, they have special privileges
      const isSuperAdmin = profile?.role === 'super_admin';

      // 2. Fetch companies this user belongs to
      let companyList: Company[] = [];
      if (isSuperAdmin) {
        // Super admin can see all companies
        const { data: allCompanies } = await supabase
          .from('companies')
          .select('*')
          .order('name');
        companyList = allCompanies || [];
      } else {
        const { data: linkedCompanies } = await supabase
          .from('company_users')
          .select('company_id, companies (*)')
          .eq('profile_id', profile?.id || '');

        if (linkedCompanies) {
          companyList = (linkedCompanies as any)
            .map((c: any) => c.companies)
            .filter((c: any): c is Company => !!c);
        }
      }

      setCompanies(companyList);

      if (companyList.length === 0) {
        setActiveCompanyState(null);
        setRole(isSuperAdmin ? 'super_admin' : null);
        setLoading(false);
        return;
      }

      // 3. Determine active company from localStorage or default to first
      let active = companyList[0];
      const cachedId = localStorage.getItem('active_company_id');
      if (cachedId) {
        const found = companyList.find(c => c.id === cachedId);
        if (found) active = found;
      }
      setActiveCompanyState(active);
      localStorage.setItem('active_company_id', active.id);

      // 4. Fetch subscription / plan
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan_id, status')
        .eq('company_id', active.id)
        .maybeSingle();

      const activePlan: PlanId = isSuperAdmin
        ? 'super_admin'
        : (sub?.status === 'active' || sub?.status === 'trialing') 
        ? (sub.plan_id as PlanId) 
        : 'free';
      setPlan(activePlan);

      // 5. Fetch user's role in this active company
      if (isSuperAdmin) {
        setRole('super_admin');
      } else {
        const { data: userLink } = await supabase
          .from('company_users')
          .select('role')
          .eq('company_id', active.id)
          .eq('profile_id', profile?.id || '')
          .maybeSingle();
        
        setRole((userLink?.role as UserRole) || 'viewer');
      }

      // 6. Fetch usage details
      const usageReport = await getCompanyUsage(active.id, activePlan);
      setUsage(usageReport);
    } catch (err) {
      console.error("[CompanyProvider] refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, profile, authLoading]);

  // Sync with auth changes
  useEffect(() => {
    refreshCompanyData();
  }, [refreshCompanyData]);

  // Dynamically inject custom brand colors for white-labeling
  useEffect(() => {
    const color = activeCompany?.branding_config?.primary_color;
    if (color) {
      const styleId = "white-label-branding-styles";
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `
        :root, html {
          --primary: ${color} !important;
          --ring: ${color} !important;
          --sidebar-primary: ${color} !important;
        }
      `;
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };
    }
  }, [activeCompany?.branding_config?.primary_color]);

  // Handle manual switch of active company
  const setActiveCompany = useCallback((company: Company) => {
    localStorage.setItem('active_company_id', company.id);
    setActiveCompanyState(company);
    setLoading(true);
    refreshCompanyData();
  }, [refreshCompanyData]);

  const checkPermission = useCallback((permission: keyof PermissionMatrix) => {
    return hasPermission(role, permission);
  }, [role]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompany,
        setActiveCompany,
        role,
        plan,
        usage,
        loading: loading || authLoading,
        refreshCompanyData,
        checkPermission,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return ctx;
}
