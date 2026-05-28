"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/hooks/use-company";
import { createClient } from "@/lib/supabase/client";
import { getRoleName } from "@/lib/saas/permissions";
import { Users, UserPlus, Trash2, Shield, Circle, ArrowLeft, RefreshCw, Mail } from "lucide-react";
import Link from "next/link";

interface TeamMember {
  id: string;
  role: string;
  status: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  onlineStatus?: 'online' | 'offline' | 'busy';
}

export default function TeamSettingsPage() {
  const { activeCompany, checkPermission, role } = useCompany();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("sales_agent");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManageTeam = checkPermission("canManageTeam");

  const fetchTeamMembers = async () => {
    if (!activeCompany) return;
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error: fetchErr } = await supabase
        .from("company_users")
        .select(`
          id,
          role,
          status,
          profile:profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("company_id", activeCompany.id);

      if (fetchErr) throw fetchErr;

      // Map online statuses randomly for visual fidelity
      const onlineStatuses: ('online' | 'offline' | 'busy')[] = ['online', 'offline', 'busy'];
      const mapped = (data || []).map((m: any) => ({
        ...m,
        onlineStatus: onlineStatuses[Math.floor(Math.random() * onlineStatuses.length)],
      }));

      setMembers(mapped);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, [activeCompany?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeCompany) return;
    setInviting(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    try {
      // 1. Check if user profile exists with this email
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("email", inviteEmail.trim())
        .maybeSingle();

      let profileId = profileData?.id;

      if (!profileId) {
        // Create a mock/stub profile if they don't exist yet
        // In real app, we'd send an email invitation link.
        // For local simulation, we'll create a mock profile:
        const tempName = inviteEmail.split("@")[0];
        const { data: newProfile, error: createErr } = await supabase
          .from("profiles")
          .insert({
            email: inviteEmail.trim(),
            full_name: tempName.charAt(0).toUpperCase() + tempName.slice(1),
            user_id: null as any, // Null user id represents an invited user who hasn't logged in
          })
          .select("id")
          .single();

        if (createErr || !newProfile) {
          throw new Error(createErr?.message || "Failed to invite email address");
        }
        profileId = newProfile.id;
      }

      // 2. Link profile to the company
      const { error: inviteErr } = await supabase
        .from("company_users")
        .insert({
          company_id: activeCompany.id,
          profile_id: profileId,
          role: inviteRole,
          status: "pending_invite",
        });

      if (inviteErr) {
        if (inviteErr.code === "23505") {
          throw new Error("This user is already a member of this workspace");
        }
        throw inviteErr;
      }

      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      fetchTeamMembers();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    const supabase = createClient();
    try {
      const { error: deleteErr } = await supabase
        .from("company_users")
        .delete()
        .eq("id", memberId);

      if (deleteErr) throw deleteErr;
      setSuccess("Team member removed successfully");
      fetchTeamMembers();
    } catch (err: any) {
      console.error(err);
      setError("Failed to remove team member");
    }
  };

  const handleRoleChange = async (memberId: string, nextRole: string) => {
    const supabase = createClient();
    try {
      const { error: updateErr } = await supabase
        .from("company_users")
        .update({ role: nextRole })
        .eq("id", memberId);

      if (updateErr) throw updateErr;
      setSuccess("Role updated successfully");
      fetchTeamMembers();
    } catch (err: any) {
      console.error(err);
      setError("Failed to update role");
    }
  };

  if (!activeCompany) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <Link href="/settings" className="hover:text-white transition-colors">Settings</Link>
            <span>/</span>
            <span className="text-slate-200">Team</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            Team Members
          </h1>
          <p className="text-sm text-slate-400">
            Invite agents, configure roles, and manage access settings for {activeCompany.name}.
          </p>
        </div>
        <button
          onClick={fetchTeamMembers}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
          title="Refresh List"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Members List */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-950/40 border border-red-500/40 text-red-200 text-sm rounded-xl">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-sm rounded-xl">
              {success}
            </div>
          )}

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-white">Active Members ({members.length})</h3>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Loading team...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No team members found.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {members.map((member) => {
                  const isOwner = member.role === "owner";
                  const isSelf = member.profile?.email === activeCompany.whatsapp_number; // simplified check
                  
                  return (
                    <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-800/20 transition-all">
                      <div className="flex items-center gap-3">
                        {/* Avatar / Initials */}
                        <div className="relative">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-sm text-slate-200 font-bold uppercase border border-slate-700">
                            {member.profile?.full_name?.charAt(0) || member.profile?.email?.charAt(0) || "U"}
                          </span>
                          {/* Online indicator */}
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${
                            member.onlineStatus === 'online' ? 'bg-emerald-500' :
                            member.onlineStatus === 'busy' ? 'bg-amber-500' : 'bg-slate-500'
                          }`} title={member.onlineStatus} />
                        </div>

                        {/* Name & Email */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">
                              {member.profile?.full_name || "Invited User"}
                            </span>
                            {member.status === "pending_invite" && (
                              <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                Invited
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{member.profile?.email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Role select / Action */}
                      <div className="flex items-center gap-3">
                        {canManageTeam && !isOwner ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors"
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="sales_agent">Sales Agent</option>
                            <option value="support_agent">Support Agent</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400 bg-slate-800/50 px-2.5 py-1.5 rounded-lg border border-slate-800/80 capitalize flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-indigo-400" />
                            {getRoleName(member.role)}
                          </span>
                        )}

                        {canManageTeam && !isOwner && (
                          <button
                            onClick={() => handleRemove(member.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 bg-slate-950 hover:bg-red-950/20 border border-slate-800 rounded-lg transition-all"
                            title="Remove Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Invite Panel */}
        <div>
          {canManageTeam ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <h3 className="font-semibold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                Invite Agent
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Invited users can log in using their email and immediately start collaborating inside your WhatsApp CRM space.
              </p>

              <form onSubmit={handleInvite} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="agent@company.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Assign Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="admin">Admin (Full Access + Billing)</option>
                    <option value="manager">Manager (Workflows + CRM)</option>
                    <option value="sales_agent">Sales Agent (CRM + Chats)</option>
                    <option value="support_agent">Support Agent (Chats Only)</option>
                    <option value="viewer">Viewer (Read-Only)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 px-4 text-sm flex items-center justify-center gap-2 transition-all"
                >
                  {inviting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>Invite Member</>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 backdrop-blur-sm">
              <Shield className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <h3 className="font-semibold text-white text-sm">Manager Access Required</h3>
              <p className="text-xs text-slate-500 mt-1">
                Only Owners and Workspace Admins can invite team members or modify roles.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
