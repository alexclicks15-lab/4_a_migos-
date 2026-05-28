"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/hooks/use-company";
import { createClient } from "@/lib/supabase/client";
import {
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  User,
  RefreshCw,
  BarChart2,
  Activity,
  Search,
  Plus,
  X,
  Building,
  Phone,
  Briefcase,
  Sparkles,
  CheckCircle2,
  UserPlus,
  Mail,
  KeyRound,
} from "lucide-react";
import { PLANS, PlanId } from "@/lib/saas/limits";

interface CompanyManage {
  id: string;
  name: string;
  industry: string;
  whatsapp_number: string | null;
  status: "active" | "suspended";
  created_at: string;
  subscription: {
    plan_id: string;
    status: string;
  } | null;
  userCount: number;
}

interface SystemAuditLog {
  id: string;
  company_name: string;
  user_email: string;
  action: string;
  details: string;
  created_at: string;
}

const COMPANY_ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "sales_agent", label: "Sales Agent" },
  { value: "support_agent", label: "Support Agent" },
  { value: "viewer", label: "Viewer" },
];

function getErrorMessage(err: unknown, fallback = "Unexpected error") {
  return err instanceof Error ? err.message : fallback;
}

// ─── Create Company Modal ────────────────────────────────────────────────────

function CreateCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("technology");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [plan, setPlan] = useState<PlanId>("free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      // 1. Create company
      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .insert({
          name: companyName.trim(),
          logo_url: logoUrl || null,
          industry,
          whatsapp_number: whatsappNumber || null,
          status: "active",
        })
        .select()
        .single();

      if (companyErr || !company) {
        throw new Error(companyErr?.message || "Failed to create company");
      }

      // 2. Create subscription
      const { error: subErr } = await supabase.from("subscriptions").insert({
        company_id: company.id,
        plan_id: plan,
        status: "active",
        current_period_start: new Date().toISOString(),
      });

      if (subErr) {
        console.warn("Subscription create warning:", subErr);
      }

      setSuccess(true);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <Building className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Create New Company</h2>
              <p className="text-[10px] text-slate-400">Super Admin — workspace provisioning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <p className="text-white font-semibold">Company created successfully!</p>
              <p className="text-xs text-slate-400">Refreshing company list...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-300 text-xs rounded-lg flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Company Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-400" />
                  Company / Workspace Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Industry */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                  Industry
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="technology">Technology &amp; SaaS</option>
                  <option value="healthcare">Healthcare &amp; Medical</option>
                  <option value="real_estate">Real Estate</option>
                  <option value="education">Education &amp; Coaching</option>
                  <option value="e_commerce">E-Commerce &amp; Retail</option>
                  <option value="consulting">Professional Services</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* WhatsApp */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-400" />
                  WhatsApp Number (Optional)
                </label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Logo URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Logo URL (Optional)
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://acme.com/logo.png"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Plan */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Assign Plan
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as PlanId)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="free">Free Sandbox</option>
                  <option value="starter">Starter Plan</option>
                  <option value="professional">Professional Plan</option>
                  <option value="enterprise">Enterprise Plan</option>
                </select>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Company
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Super Admin Page ───────────────────────────────────────────────────

function CreateProfileModal({
  companies,
  onClose,
  onCreated,
}: {
  companies: CompanyManage[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profileRole, setProfileRole] = useState("user");
  const [companyId, setCompanyId] = useState("");
  const [companyRole, setCompanyRole] = useState("sales_agent");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/super-admin/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          profileRole,
          companyId: companyId || null,
          companyRole,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create profile");
      }

      setSuccess(true);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-900/40">
              <UserPlus className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Create New Profile</h2>
              <p className="text-[10px] text-slate-400">Super Admin - account provisioning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <p className="text-white font-semibold">Profile created successfully!</p>
              <p className="text-xs text-slate-400">Refreshing admin data...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-300 text-xs rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                  Temporary Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Platform Role</label>
                  <select
                    value={profileRole}
                    onChange={(e) => setProfileRole(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  >
                    <option value="user">User</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Company Role</label>
                  <select
                    value={companyRole}
                    onChange={(e) => setCompanyRole(e.target.value)}
                    disabled={!companyId}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                  >
                    {COMPANY_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-cyan-400" />
                  Assign to Company
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="">No company assignment</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Create Profile
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const { role } = useCompany();
  const [companies, setCompanies] = useState<CompanyManage[]>([]);
  const [auditLogs, setAuditLogs] = useState<SystemAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"companies" | "telemetry" | "logs">("companies");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);

  const fetchSuperData = async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: cos, error: cosErr } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (cosErr) throw cosErr;

      const mappedCos = await Promise.all(
        (cos || []).map(async (c) => {
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("plan_id, status")
            .eq("company_id", c.id)
            .maybeSingle();

          const { count } = await supabase
            .from("company_users")
            .select("*", { count: "exact", head: true })
            .eq("company_id", c.id);

          return {
            ...c,
            subscription: sub || null,
            userCount: count || 0,
          };
        })
      );
      setCompanies(mappedCos);

      const mockLogs: SystemAuditLog[] = [
        {
          id: "1",
          company_name: "Acme Corp",
          user_email: "owner@acme.com",
          action: "SIGN_IN",
          details: "User logged in from Chrome / OS X",
          created_at: new Date(Date.now() - 5 * 60000).toISOString(),
        },
        {
          id: "2",
          company_name: "Acme Corp",
          user_email: "owner@acme.com",
          action: "UPDATE_BILLING",
          details: "Upgraded subscription plan to Professional",
          created_at: new Date(Date.now() - 40 * 60000).toISOString(),
        },
        {
          id: "3",
          company_name: "Beta Builders",
          user_email: "admin@betabuilders.io",
          action: "CREATE_WORKFLOW",
          details: "Created new WhatsApp Chatbot automation flow",
          created_at: new Date(Date.now() - 120 * 60000).toISOString(),
        },
        {
          id: "4",
          company_name: "Clinic Care",
          user_email: "doctor@care.org",
          action: "INVITE_MEMBER",
          details: "Invited receptionist@care.org as Sales Agent",
          created_at: new Date(Date.now() - 360 * 60000).toISOString(),
        },
      ];
      setAuditLogs(mockLogs);
    } catch (err) {
      console.error("Failed to load Super Admin details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === "super_admin") {
      fetchSuperData();
    }
  }, [role]);

  const handleToggleSuspension = async (company: CompanyManage) => {
    const nextStatus = company.status === "active" ? "suspended" : "active";
    if (!confirm(`Are you sure you want to change ${company.name} status to ${nextStatus}?`)) return;

    setActionLoading(company.id);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("companies")
        .update({ status: nextStatus })
        .eq("id", company.id);

      if (error) throw error;
      fetchSuperData();
    } catch (err) {
      console.error(err);
      alert("Failed to update company status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleOverridePlan = async (companyId: string, planId: PlanId) => {
    setActionLoading(companyId);
    const supabase = createClient();
    try {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle();

      if (sub) {
        await supabase
          .from("subscriptions")
          .update({ plan_id: planId, status: "active" })
          .eq("id", sub.id);
      } else {
        await supabase.from("subscriptions").insert({
          company_id: companyId,
          plan_id: planId,
          status: "active",
        });
      }
      fetchSuperData();
    } catch (err) {
      console.error(err);
      alert("Failed to override plan");
    } finally {
      setActionLoading(null);
    }
  };

  if (role !== "super_admin") {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto w-12 h-12 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-500 text-2xl">
            🔒
          </div>
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-xs text-slate-400">
            You must be logged in as a platform Super Admin to view the admin console.
          </p>
        </div>
      </div>
    );
  }

  const activeSubs = companies.filter(
    (c) => c.subscription?.status === "active" || c.subscription?.status === "trialing"
  );
  const mrr = activeSubs.reduce((acc, curr) => {
    const pId = curr.subscription?.plan_id as PlanId;
    const planDetails = PLANS[pId] || PLANS.free;
    return acc + planDetails.price_monthly;
  }, 0);

  const filteredCos = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {showCreateModal && (
        <CreateCompanyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchSuperData}
        />
      )}

      {showCreateProfileModal && (
        <CreateProfileModal
          companies={companies}
          onClose={() => setShowCreateProfileModal(false)}
          onCreated={fetchSuperData}
        />
      )}

      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Root Admin Control</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Super Admin Dashboard</h1>
            <p className="text-sm text-slate-400">
              Provision companies, manage licensing tiers, and view real-time operations telemetry.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateProfileModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-cyan-900/30"
            >
              <UserPlus className="w-4 h-4" />
              New Profile
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              New Company
            </button>
            <button
              onClick={fetchSuperData}
              className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-px">
          <button
            onClick={() => setActiveTab("companies")}
            className={`pb-2.5 px-4 text-sm font-semibold transition-all relative ${
              activeTab === "companies"
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Companies &amp; Billing
          </button>
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`pb-2.5 px-4 text-sm font-semibold transition-all relative ${
              activeTab === "telemetry"
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            SaaS Telemetry
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-2.5 px-4 text-sm font-semibold transition-all relative ${
              activeTab === "logs"
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Platform Logs
          </button>
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Loading telemetry...</span>
          </div>
        ) : activeTab === "companies" ? (
          <div className="space-y-4">
            {/* Search + create row */}
            <div className="flex items-center gap-3">
              <div className="flex flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 max-w-md items-center gap-2">
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-sm text-white placeholder-slate-500 w-full"
                />
              </div>
            </div>

            {/* Companies table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Company Name</th>
                    <th className="px-6 py-4">Users</th>
                    <th className="px-6 py-4">Active Plan</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500 text-sm">
                        {search ? "No companies match your search." : "No companies yet. Create your first one."}
                      </td>
                    </tr>
                  ) : (
                    filteredCos.map((company) => (
                      <tr key={company.id} className="hover:bg-slate-800/10">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-sm text-white uppercase border border-slate-700">
                              {company.name.charAt(0)}
                            </span>
                            <div>
                              <p className="font-semibold text-white">{company.name}</p>
                              <p className="text-[10px] text-slate-500 capitalize">{company.industry}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>{company.userCount} seats</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={company.subscription?.plan_id || "free"}
                            onChange={(e) => handleOverridePlan(company.id, e.target.value as PlanId)}
                            disabled={actionLoading === company.id}
                            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 transition-colors"
                          >
                            <option value="free">Free Sandbox</option>
                            <option value="starter">Starter Plan</option>
                            <option value="professional">Professional Plan</option>
                            <option value="enterprise">Enterprise Plan</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              company.status === "active"
                                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                                : "bg-red-950/40 border-red-500/30 text-red-400"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                company.status === "active" ? "bg-emerald-400" : "bg-red-400"
                              }`}
                            />
                            {company.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleSuspension(company)}
                            disabled={actionLoading === company.id}
                            className={`text-xs font-semibold flex items-center gap-1.5 py-1 px-2.5 rounded-lg border transition-all ${
                              company.status === "active"
                                ? "bg-red-950/30 hover:bg-red-950/50 border-red-900 text-red-400"
                                : "bg-emerald-950/30 hover:bg-emerald-950/50 border-emerald-900 text-emerald-400"
                            }`}
                          >
                            {company.status === "active" ? (
                              <>
                                <ToggleRight className="w-4 h-4" />
                                Suspend
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4" />
                                Activate
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === "telemetry" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Companies</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-2xl font-extrabold text-white">{companies.length}</span>
                  <span className="text-xs text-emerald-400 font-medium">+12% vs last month</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Monthly Recurring Revenue</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-2xl font-extrabold text-white">${mrr.toLocaleString()}</span>
                  <span className="text-xs text-indigo-400 font-medium">Stripe Sandbox</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Subscription Ratio</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-2xl font-extrabold text-white">
                    {Math.round((activeSubs.length / (companies.length || 1)) * 100)}%
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{activeSubs.length} Active Licences</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Simulated Webhook Events</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-2xl font-extrabold text-white">100% OK</span>
                  <span className="text-xs text-emerald-400 font-medium">Sandbox mode</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-400" />
                Resource Saturation Metrics
              </h3>
              <p className="text-xs text-slate-400 max-w-lg">
                This chart highlights the overall consumption of system capabilities by tenant companies.
              </p>
              <div className="h-48 bg-slate-950/60 border border-slate-800 rounded-xl flex items-end justify-around p-6">
                <div className="flex flex-col items-center gap-2 w-16">
                  <div className="bg-indigo-500 w-8 h-32 rounded-t" />
                  <span className="text-[10px] text-slate-400">Contacts</span>
                </div>
                <div className="flex flex-col items-center gap-2 w-16">
                  <div className="bg-cyan-500 w-8 h-20 rounded-t" />
                  <span className="text-[10px] text-slate-400">AI Replies</span>
                </div>
                <div className="flex flex-col items-center gap-2 w-16">
                  <div className="bg-emerald-500 w-8 h-12 rounded-t" />
                  <span className="text-[10px] text-slate-400">Workflows</span>
                </div>
                <div className="flex flex-col items-center gap-2 w-16">
                  <div className="bg-violet-500 w-8 h-24 rounded-t" />
                  <span className="text-[10px] text-slate-400">Team Seats</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Audit Logs Telemetry
                </h3>
              </div>
              <div className="divide-y divide-slate-850">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-slate-800/10 transition-colors gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-950 border border-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded text-slate-300">
                          {log.action}
                        </span>
                        <span className="text-xs text-slate-400">({log.company_name})</span>
                      </div>
                      <p className="text-sm font-medium text-white">{log.details}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-indigo-300">{log.user_email}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
