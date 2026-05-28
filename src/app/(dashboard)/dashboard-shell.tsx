"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { CompanyProvider, useCompany } from "@/hooks/use-company";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { activeCompany, role, loading: companyLoading } = useCompany();
  const router = useRouter();

  // Sidebar drawer state — only used on mobile. On lg+ the sidebar is
  // always visible and this stays at `false` (ignored by the component).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || companyLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-slate-400">Loading Workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Account suspended check
  if (activeCompany?.status === 'suspended' && role !== 'super_admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-md text-center space-y-5 bg-slate-900 border border-red-900/50 p-8 rounded-2xl shadow-2xl">
          <div className="mx-auto w-16 h-16 bg-red-950/50 border border-red-500/50 rounded-full flex items-center justify-center text-red-500 text-3xl">
            ⚠️
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace Suspended</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your workspace <span className="font-semibold text-white">"{activeCompany.name}"</span> has been suspended by the platform administrator. Please contact support or your account owner.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg text-sm transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        {/* Thinner horizontal padding on mobile so cards have room to breathe. */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CompanyProvider>
        <DashboardShellInner>{children}</DashboardShellInner>
      </CompanyProvider>
    </AuthProvider>
  );
}

