"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/hooks/use-company";
import { createClient } from "@/lib/supabase/client";
import { PLANS, PlanId } from "@/lib/saas/limits";
import { CreditCard, Check, ShieldCheck, FileText, ArrowRight, Zap, RefreshCw } from "lucide-react";
import Link from "next/link";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  billing_reason: string;
  pdf_url: string | null;
  created_at: string;
}

export default function BillingSettingsPage() {
  const { activeCompany, plan, usage, refreshCompanyData } = useCompany();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    if (!activeCompany) return;
    setLoadingInvoices(true);
    const supabase = createClient();
    try {
      const { data, error: invoiceErr } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", activeCompany.id)
        .order("created_at", { ascending: false });

      if (invoiceErr) throw invoiceErr;
      setInvoices(data || []);
    } catch (err) {
      console.error("Error loading invoices: ", err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [activeCompany?.id]);

  const handleCheckout = async (planId: PlanId) => {
    if (!activeCompany) return;
    setCheckoutLoading(planId);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: activeCompany.id,
          planId,
          billingPeriod,
          provider: "stripe", // default sandbox checkout is simulated with stripe
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate checkout");
      }

      if (data.checkoutUrl) {
        // Redirect to Stripe checkout (or our simulated mock-checkout page)
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned from server");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not generate checkout session.");
      setCheckoutLoading(null);
    }
  };

  if (!activeCompany || !usage) return null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <Link href="/settings" className="hover:text-white transition-colors">Settings</Link>
            <span>/</span>
            <span className="text-slate-200">Billing</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-400" />
            Billing & Subscriptions
          </h1>
          <p className="text-sm text-slate-400">
            View resource limits, change subscription plans, and download past invoices.
          </p>
        </div>
        <button
          onClick={async () => {
            await refreshCompanyData();
            await fetchInvoices();
          }}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
          title="Refresh Usage"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-500/40 text-red-200 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Grid: Limits & Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Usage & Limits */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Workspace Resource Usage</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Current usage metrics for your plan: <span className="font-semibold text-indigo-400 uppercase">{plan}</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Contacts Gauge */}
              <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-400">Contacts</span>
                  <span className="text-white">
                    {usage.contacts.current} / {usage.contacts.limit >= 999999 ? "Unlimited" : usage.contacts.limit}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${usage.contacts.pct}%` }} 
                  />
                </div>
                <p className="text-[10px] text-slate-500">{usage.contacts.pct}% of limit used</p>
              </div>

              {/* Workflows Gauge */}
              <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-400">Active Workflows</span>
                  <span className="text-white">
                    {usage.workflows.current} / {usage.workflows.limit >= 999999 ? "Unlimited" : usage.workflows.limit}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${usage.workflows.pct}%` }} 
                  />
                </div>
                <p className="text-[10px] text-slate-500">{usage.workflows.pct}% of limit used</p>
              </div>

              {/* Team Members Gauge */}
              <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-400">Team Seats</span>
                  <span className="text-white">
                    {usage.team_members.current} / {usage.team_members.limit >= 99 ? "Unlimited" : usage.team_members.limit}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-violet-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${usage.team_members.pct}%` }} 
                  />
                </div>
                <p className="text-[10px] text-slate-500">{usage.team_members.pct}% of limit used</p>
              </div>

              {/* AI Replies Gauge */}
              <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-400">AI Bot Responses</span>
                  <span className="text-white">
                    {usage.ai_replies.current} / {usage.ai_replies.limit >= 999999 ? "Unlimited" : usage.ai_replies.limit}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${usage.ai_replies.pct}%` }} 
                  />
                </div>
                <p className="text-[10px] text-slate-500">{usage.ai_replies.pct}% of limit used</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Invoice History */}
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              Invoice History
            </h3>
            
            {loadingInvoices ? (
              <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                <span className="text-xs">Loading invoices...</span>
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No invoices found for this workspace.
              </p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center p-3 bg-slate-950/60 border border-slate-850 rounded-xl hover:border-slate-800 transition-colors">
                    <div>
                      <p className="text-xs font-semibold text-white">{inv.invoice_number}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(inv.created_at).toLocaleDateString()} • {inv.billing_reason || "Subscription"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-white">${inv.amount}</p>
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-900 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Paid
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Subscription Plans */}
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl font-extrabold text-white">Upgrade Plans & Licensing</h2>
          <p className="text-sm text-slate-400">
            Scale your operations with separate CRM channels, unlimited templates, and AI Agent integrations.
          </p>

          {/* Billing Period Toggle */}
          <div className="inline-flex bg-slate-900 border border-slate-800 p-1 rounded-xl mt-4">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                billingPeriod === "monthly" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                billingPeriod === "yearly" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Yearly (Save 20%)
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(Object.keys(PLANS).filter((key) => key !== "super_admin") as PlanId[]).map((key) => {
            const p = PLANS[key];
            const isCurrent = plan === key;
            const price = billingPeriod === "yearly" ? p.price_yearly : p.price_monthly;
            const priceLabel = billingPeriod === "yearly" ? "/yr" : "/mo";

            return (
              <div 
                key={key} 
                className={`bg-slate-900/60 border rounded-3xl p-6 flex flex-col justify-between backdrop-blur-sm relative overflow-hidden transition-all hover:-translate-y-1 duration-300 ${
                  isCurrent 
                    ? "border-indigo-500 shadow-lg shadow-indigo-900/10 ring-1 ring-indigo-500/30" 
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {key === "professional" && (
                  <div className="absolute top-3 right-3 bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                    Popular
                  </div>
                )}

                <div>
                  <h3 className="text-base font-extrabold text-white capitalize">{p.name}</h3>
                  <div className="mt-3 flex items-baseline gap-0.5">
                    <span className="text-3xl font-extrabold text-white">${price}</span>
                    <span className="text-slate-400 text-xs">{priceLabel}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Ideal for {key === "free" ? "developers" : key === "starter" ? "small teams" : key === "professional" ? "growing agencies" : "large enterprises"}.
                  </p>

                  <div className="my-5 border-t border-slate-800" />

                  <ul className="space-y-2.5 text-xs text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{p.limits.contacts.toLocaleString()} Contacts limit</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{p.limits.ai_replies.toLocaleString()} AI Bot Replies</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{p.limits.broadcasts.toLocaleString()} Broadcast cap</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{p.limits.workflows} Active automations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{p.limits.team_members} Team members seats</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full bg-indigo-950 border border-indigo-900 text-indigo-400 font-semibold rounded-2xl py-2.5 px-4 text-xs flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckout(key)}
                      disabled={checkoutLoading !== null}
                      className={`w-full font-semibold rounded-2xl py-2.5 px-4 text-xs transition-all flex items-center justify-center gap-1.5 ${
                        key === "professional"
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                      }`}
                    >
                      {checkoutLoading === key ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          Upgrade Plan
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
