"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/hooks/use-company";
import { createClient } from "@/lib/supabase/client";
import { hasFeatureAccess } from "@/lib/saas/limits";
import { Building, Globe, Palette, Sparkles, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";

export function WorkspaceSettings() {
  const { activeCompany, plan, role, refreshCompanyData } = useCompany();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [logo, setLogo] = useState("");
  const [domain, setDomain] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [saving, setSaving] = useState(false);

  const isOwnerOrAdmin = role === 'owner' || role === 'admin' || role === 'super_admin';
  const canCustomDomain = hasFeatureAccess(plan, 'custom_domain');
  const canWhiteLabel = hasFeatureAccess(plan, 'white_label');

  useEffect(() => {
    if (activeCompany) {
      setName(activeCompany.name || "");
      setWhatsapp(activeCompany.whatsapp_number || "");
      setLogo(activeCompany.logo_url || "");
      setDomain(activeCompany.custom_domain || "");
      setPrimaryColor(activeCompany.branding_config?.primary_color || "#4f46e5");
    }
  }, [activeCompany]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany || !isOwnerOrAdmin) return;
    setSaving(true);

    const supabase = createClient();
    try {
      const updates: any = {
        name,
        whatsapp_number: whatsapp || null,
        updated_at: new Date().toISOString(),
      };

      if (canCustomDomain) {
        updates.custom_domain = domain || null;
      }
      if (canWhiteLabel) {
        updates.logo_url = logo || null;
        updates.branding_config = {
          ...activeCompany.branding_config,
          primary_color: primaryColor,
        };
      }

      const { error } = await supabase
        .from("companies")
        .update(updates)
        .eq("id", activeCompany.id);

      if (error) throw error;
      toast.success("Workspace settings updated");
      await refreshCompanyData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update workspace settings");
    } finally {
      setSaving(false);
    }
  };

  if (!activeCompany) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic settings */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-400" />
            General Workspace Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Workspace Name</label>
              <input
                type="text"
                required
                disabled={!isOwnerOrAdmin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">WhatsApp Business Number</label>
              <input
                type="tel"
                disabled={!isOwnerOrAdmin}
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+1234567890"
                className="w-full bg-slate-950 border border-slate-855 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Custom Domain Settings (Pro/Enterprise) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4 relative overflow-hidden">
          {!canCustomDomain && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs z-10 flex flex-col items-center justify-center text-center p-4">
              <Lock className="w-8 h-8 text-amber-500 mb-2" />
              <h4 className="font-semibold text-white text-sm">Custom Domains is a Pro feature</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Upgrade your plan to Starter or Professional to map a white-labeled custom DNS domain.
              </p>
            </div>
          )}

          <h3 className="font-semibold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            Custom Domain Mapping
          </h3>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Custom Domain Hostname</label>
            <input
              type="text"
              placeholder="crm.company.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <p className="text-[10px] text-slate-500">
              Point your domain CNAME record to <code className="text-slate-300">cname.antigravitycrm.com</code>.
            </p>
          </div>
        </div>

        {/* White-Label Customization Settings (Enterprise Only) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4 relative overflow-hidden">
          {!canWhiteLabel && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs z-10 flex flex-col items-center justify-center text-center p-4">
              <Sparkles className="w-8 h-8 text-indigo-400 mb-2 animate-pulse" />
              <h4 className="font-semibold text-white text-sm">White-Labeling is an Enterprise feature</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Unlock full platform re-branding, custom logo assets, and custom HSL primary color systems on Enterprise.
              </p>
            </div>
          )}

          <h3 className="font-semibold text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-400" />
            White-Label Portal Customization
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">White-Label Brand Logo URL</label>
              <input
                type="url"
                placeholder="https://company.com/branding/logo.png"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Brand Primary Palette Hex</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-9 w-9 bg-transparent border-0 cursor-pointer rounded overflow-hidden"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {isOwnerOrAdmin && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl py-2 px-6 text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-950"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "Save Workspace Changes"
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
