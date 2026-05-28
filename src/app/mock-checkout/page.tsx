"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, CheckCircle2, ChevronRight, Lock, ShieldCheck, ArrowLeft } from "lucide-react";
import { PLANS, PlanId } from "@/lib/saas/limits";

export default function MockCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse checkout details from URL query params
  const provider = searchParams.get("provider") || "stripe";
  const planId = (searchParams.get("planId") as PlanId) || "free";
  const companyId = searchParams.get("companyId") || "";
  const billingPeriod = searchParams.get("billingPeriod") || "monthly";
  const successUrl = searchParams.get("successUrl") || "/settings?tab=billing";
  const cancelUrl = searchParams.get("cancelUrl") || "/settings?tab=billing";

  const plan = PLANS[planId] || PLANS.free;
  const price = billingPeriod === "yearly" ? plan.price_yearly : plan.price_monthly;
  const priceLabel = billingPeriod === "yearly" ? "yr" : "mo";

  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("424");
  const [cardName, setCardName] = useState("Simulated Customer");

  const handleSimulatePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/mock-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          planId,
          billingPeriod,
          provider,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to process simulation");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(successUrl);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Something went wrong during checkout.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-15%] w-[70%] h-[70%] rounded-full bg-violet-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-15%] w-[70%] h-[70%] rounded-full bg-indigo-600/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
            AG
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white flex items-center gap-1.5">
              <span>Antigravity Checkout Sandbox</span>
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Simulated
              </span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-indigo-400" />
          <span>Secure Mock Sandbox</span>
        </div>
      </header>

      {/* Main Form container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-slate-900/60 border border-slate-800 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl">
          
          {/* Left panel: Plan details summary */}
          <div className="p-8 bg-slate-900/40 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between">
            <div>
              <button 
                onClick={() => router.push(cancelUrl)}
                className="flex items-center gap-1 text-slate-400 hover:text-white text-xs font-semibold mb-8 group transition-colors"
              >
                <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                Back to dashboard
              </button>

              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">
                Selected Plan
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight mt-1 text-white">
                {plan.name}
              </h2>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  ${price}
                </span>
                <span className="text-slate-400 text-sm">
                  /{priceLabel}
                </span>
              </div>

              <div className="mt-8 space-y-3.5">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Features Included:
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Up to {plan.limits.contacts.toLocaleString()} contacts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{plan.limits.ai_replies.toLocaleString()} AI Bot replies / month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{plan.limits.broadcasts.toLocaleString()} broadcast campaigns</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{plan.limits.workflows} active automations</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-slate-800/80 text-xs text-slate-500">
              Provider: <span className="font-semibold text-slate-400 capitalize">{provider}</span> Sandbox Gateway
            </div>
          </div>

          {/* Right panel: Payment method simulation */}
          <div className="p-8 flex flex-col justify-between">
            {success ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-12">
                <div className="w-16 h-16 bg-emerald-950 border border-emerald-500 rounded-full flex items-center justify-center text-emerald-400 text-3xl animate-pulse">
                  ✓
                </div>
                <h3 className="text-xl font-bold text-white">Payment Successful!</h3>
                <p className="text-slate-400 text-sm max-w-xs">
                  Your mock subscription has been activated. Redirecting you back to the billing settings...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Simulated Payment Details</h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Use these simulated fields to mock checkout verification.
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-200 text-xs rounded-lg">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Cardholder Name</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Card Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <CreditCard className="absolute right-3.5 top-3 w-4 h-4 text-slate-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Expires</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">CVV</label>
                      <input
                        type="text"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <button
                    onClick={handleSimulatePayment}
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 px-4 text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/50"
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        Simulate Payment Success
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => router.push(cancelUrl)}
                    disabled={loading}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl py-2.5 px-4 text-xs transition-all"
                  >
                    Cancel Transaction
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 z-10">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-500" />
          <span>Antigravity Enterprise SaaS Engine v1.0</span>
        </div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-slate-300">Privacy Policy</a>
          <a href="#" className="hover:text-slate-300">Terms of Use</a>
          <a href="#" className="hover:text-slate-300">Contact Support</a>
        </div>
      </footer>
    </div>
  );
}
