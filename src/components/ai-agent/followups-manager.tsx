"use client"

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Bell, Clock, RefreshCw, Send, Trash2, ShieldCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface FollowUp {
  id: string
  contact_id: string
  contacts?: { name: string; phone: string }
  scheduled_at: string
  template_name: string
  template_params: string[]
  custom_message: string
  status: 'pending' | 'sent' | 'cancelled' | 'failed'
  error_message?: string
  created_at: string
}

interface Template {
  id: string
  name: string
  body_text: string
  status: string
}

export function AIFollowupsManager() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [followups, setFollowups] = useState<FollowUp[]>([])

  // Inactivity Nudge config state
  const [enabled, setEnabled] = useState(false)
  const [hours, setHours] = useState(24)
  const [templateName, setTemplateName] = useState('')
  const [templateParams, setTemplateParams] = useState<string[]>([])
  const [configId, setConfigId] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    const { data } = await supabase
      .from('message_templates')
      .select('id, name, body_text, status')
      .eq('user_id', user.id)
      .eq('status', 'Approved')
    
    setTemplates((data as Template[]) || [])
  }, [user])

  const fetchFollowups = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    
    // We join contacts to get details. We use a nested select.
    const { data, error } = await supabase
      .from('smart_followups')
      .select('*, contacts(name, phone)')
      .order('scheduled_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch follow-ups:', error)
    } else {
      setFollowups(data as any[] || [])
    }
  }, [user])

  const fetchConfig = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .is('conversation_id', null)
      .maybeSingle()

    if (data) {
      setEnabled(data.inactivity_followup_enabled ?? false)
      setHours(data.inactivity_hours ?? 24)
      setTemplateName(data.inactivity_template_name ?? '')
      setTemplateParams(data.inactivity_template_params ?? [])
      setConfigId(data.id)
    }
  }, [user])

  const loadData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchTemplates(), fetchConfig(), fetchFollowups()])
    setLoading(false)
  }, [fetchTemplates, fetchConfig, fetchFollowups])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .upsert({
          user_id: user.id,
          conversation_id: null,
          inactivity_followup_enabled: enabled,
          inactivity_hours: hours,
          inactivity_template_name: templateName || null,
          inactivity_template_params: templateParams,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,conversation_id' })

      if (error) throw error
      toast.success('Inactivity smart follow-up settings saved successfully!')
    } catch (err: any) {
      console.error('Failed to save follow-up config:', err)
      toast.error(`Save failed: ${err.message || 'database constraint error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelFollowup = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('smart_followups')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      toast.error('Failed to cancel follow-up')
    } else {
      toast.success('Scheduled follow-up cancelled')
      fetchFollowups()
    }
  }

  const selectedTemplate = templates.find(t => t.name === templateName)
  const variablesCount = selectedTemplate 
    ? Array.from(selectedTemplate.body_text.matchAll(/\{\{(\d+)\}\}/g)).length 
    : 0

  useEffect(() => {
    if (variablesCount > 0) {
      setTemplateParams(prev => {
        const next = [...prev]
        while (next.length < variablesCount) next.push('')
        return next.slice(0, variablesCount)
      })
    } else {
      setTemplateParams([])
    }
  }, [templateName, variablesCount])

  if (loading) {
    return (
      <div className="flex h-44 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="text-xs text-slate-500">Loading follow-ups scheduler...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Automated Inactivity Nudge Panel */}
      <form onSubmit={handleSaveConfig} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 animate-pulse">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Automated Inactivity Follow-up</h3>
              <p className="text-xs text-slate-400 mt-0.5">Ping unresponsive customers automatically with pre-approved WhatsApp templates.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? 'bg-purple-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {enabled && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-purple-400" />
                Inactivity Window (Hours)
              </label>
              <select
                value={hours}
                onChange={(e) => setHours(parseInt(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="6">6 Hours</option>
                <option value="12">12 Hours</option>
                <option value="24">24 Hours (Standard)</option>
                <option value="48">48 Hours</option>
                <option value="72">72 Hours (Enterprise follow-up)</option>
              </select>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                If the customer remains unresponsive for this period after our last outbound message, the nudge triggers.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-purple-400" />
                Follow-up WhatsApp Template
              </label>
              <select
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">-- Choose Approved Template --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
              {selectedTemplate && (
                <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-2.5 mt-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Body Preview:</p>
                  <p className="text-xs text-slate-350 leading-relaxed italic">"{selectedTemplate.body_text}"</p>
                </div>
              )}
            </div>

            {variablesCount > 0 && (
              <div className="space-y-3 md:col-span-2 border-t border-slate-800/80 pt-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Template Variable Values</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: variablesCount }).map((_, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{`Variable {{${idx + 1}}}`}</label>
                      <input
                        type="text"
                        value={templateParams[idx] || ''}
                        onChange={(e) => {
                          const next = [...templateParams]
                          next[idx] = e.target.value
                          setTemplateParams(next)
                        }}
                        required
                        placeholder={`Value for {{${idx + 1}}}`}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Follow-up Configuration'}
          </button>
        </div>
      </form>

      {/* Manual Scheduled / Historical Logs List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Smart Follow-ups Queue & Logs</h3>
            <p className="text-xs text-slate-400 mt-0.5">Monitor manually scheduled triggers and completed follow-up records.</p>
          </div>
          <button 
            type="button" 
            onClick={fetchFollowups}
            className="p-1.5 text-slate-500 hover:text-white rounded border border-slate-800 bg-slate-850 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          {followups.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs italic">
              No scheduled or completed follow-ups logged in the system queue.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-450 uppercase font-semibold tracking-wider text-[10px]">
                  <th className="py-2.5 px-2">Contact</th>
                  <th className="py-2.5 px-2">Trigger Date</th>
                  <th className="py-2.5 px-2">Message Content / Template</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {followups.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-950/20 text-slate-300">
                    <td className="py-3 px-2">
                      <div className="font-semibold text-white">{row.contacts?.name || 'Customer'}</div>
                      <div className="text-[10px] text-slate-500">{row.contacts?.phone || 'No phone'}</div>
                    </td>
                    <td className="py-3 px-2 font-mono text-slate-400">
                      {format(new Date(row.scheduled_at), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="py-3 px-2 max-w-xs truncate">
                      {row.template_name ? (
                        <div className="flex items-center gap-1.5">
                          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded px-1.5 py-0.5 text-[10px] font-bold">Template</span>
                          <span className="font-mono text-purple-300">{row.template_name}</span>
                        </div>
                      ) : (
                        <span className="italic">"{row.custom_message}"</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider inline-flex items-center gap-1 ${
                        row.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                          : row.status === 'sent'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : row.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {row.status}
                      </span>
                      {row.error_message && (
                        <div className="text-[9px] text-rose-400/90 mt-1 max-w-[200px] truncate" title={row.error_message}>
                          Error: {row.error_message}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {row.status === 'pending' && (
                        <button
                          onClick={() => handleCancelFollowup(row.id)}
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded bg-slate-850 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/20 transition-all cursor-pointer inline-flex items-center gap-1"
                          title="Cancel scheduled follow-up"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold">Cancel</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
