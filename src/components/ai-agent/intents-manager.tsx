"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Plus, Trash2, Save, Play, User2, Sliders, Shield, Tag, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Intent {
  id?: string
  name: string
  description: string
  confidence_threshold: number
  is_active: boolean
}

interface Action {
  id?: string
  intent_name: string
  action_type: 'add_tag' | 'remove_tag' | 'create_deal' | 'update_lead_score' | 'schedule_event' | 'trigger_automation' | 'human_handoff'
  action_config: {
    tag?: string
    score_change?: number
    flow_key?: string
    event_summary?: string
  }
}

export function AIIntentsManager() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [intents, setIntents] = useState<Intent[]>([])
  const [actions, setActions] = useState<Action[]>([])

  // Modal / Form state for a new intent
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newThreshold, setNewThreshold] = useState(0.7)

  // Standard pre-configured intents the system defaults to
  const DEFAULT_INTENTS = [
    { name: 'pricing_inquiry', description: 'Customer asks for pricing, quotes, or catalogs' },
    { name: 'appointment_booking', description: 'Customer requests a meeting, demo, or scheduling' },
    { name: 'product_interest', description: 'Customer indicates interest in products or services' },
    { name: 'bulk_order_inquiry', description: 'Customer inquires about large wholesale orders (e.g. quantity > 10)' },
    { name: 'order_tracking', description: 'Customer asks to track an order or checks delivery status' },
    { name: 'payment_done', description: 'Customer claims payment has been made' },
    { name: 'support_request', description: 'Customer requests general support, assistance, or configuration' },
    { name: 'complaint', description: 'Customer displays frustration, complains, or alerts support' },
    { name: 'refund_request', description: 'Customer requests billing refunds or returns' },
    { name: 'human_support', description: 'Customer explicitly requests a human agent' },
    { name: 'unsubscribe_request', description: 'Customer asks to opt-out, unsubscribe, or stop alerts' }
  ]

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      setLoading(true)
      const supabase = createClient()
      try {
        const [intentsRes, actionsRes] = await Promise.all([
          supabase.from('ai_intents').select('*').eq('user_id', user.id),
          supabase.from('ai_actions').select('*').eq('user_id', user.id)
        ])

        let loadedIntents = intentsRes.data || []
        // Backfill defaults if user has none configured
        if (loadedIntents.length === 0) {
          loadedIntents = DEFAULT_INTENTS.map((i) => ({
            name: i.name,
            description: i.description,
            confidence_threshold: 0.7,
            is_active: true
          }))
        }
        setIntents(loadedIntents)
        setActions(actionsRes.data || [])
      } catch (err) {
        console.warn('Failed to load database intents, using defaults:', err)
        // Fallback mock arrays
        setIntents(DEFAULT_INTENTS.map((i) => ({
          name: i.name,
          description: i.description,
          confidence_threshold: 0.7,
          is_active: true
        })))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  const handleAddIntent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return

    const cleanedName = newName.trim().toLowerCase().replace(/\s+/g, '_')
    if (intents.some((i) => i.name === cleanedName)) {
      toast.error('Intent name already exists!')
      return
    }

    const newItem: Intent = {
      name: cleanedName,
      description: newDesc,
      confidence_threshold: newThreshold,
      is_active: true
    }

    setIntents((prev) => [...prev, newItem])
    setNewName('')
    setNewDesc('')
    setNewThreshold(0.7)
    setShowAddForm(false)
    toast.success(`Intent "${cleanedName}" added to config! Remember to save changes.`)
  }

  const handleDeleteIntent = (name: string) => {
    setIntents((prev) => prev.filter((i) => i.name !== name))
    setActions((prev) => prev.filter((a) => a.intent_name !== name))
    toast.info(`Deleted intent "${name}". Click Save to write changes.`)
  }

  const handleAddAction = (intentName: string, type: Action['action_type']) => {
    const defaultConfigs = {
      add_tag: { tag: 'AI_Intent' },
      remove_tag: { tag: 'AI_Intent' },
      create_deal: { score_change: 0 },
      update_lead_score: { score_change: 15 },
      schedule_event: { event_summary: 'Demo Booking Call' },
      trigger_automation: { flow_key: 'sales_followup' },
      human_handoff: {}
    }

    const newAction: Action = {
      intent_name: intentName,
      action_type: type,
      action_config: defaultConfigs[type]
    }

    setActions((prev) => [...prev, newAction])
  }

  const handleRemoveAction = (idx: number) => {
    setActions((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleActionConfigChange = (idx: number, key: string, val: any) => {
    setActions((prev) =>
      prev.map((act, i) =>
        i === idx
          ? {
              ...act,
              action_config: { ...act.action_config, [key]: val }
            }
          : act
      )
    )
  }

  const handleSaveAll = async () => {
    if (!user) return
    setSaving(true)
    const supabase = createClient()
    try {
      // 1. Save Intents (Clean existing and bulk write)
      // Since intent list is small, deleting and re-inserting is simplest for this beta model,
      // or we do standard upserts. Let's do delete & insert.
      await supabase.from('ai_intents').delete().eq('user_id', user.id)
      const { error: intErr } = await supabase.from('ai_intents').insert(
        intents.map((i) => ({
          user_id: user.id,
          name: i.name,
          description: i.description,
          confidence_threshold: i.confidence_threshold,
          is_active: i.is_active
        }))
      )
      if (intErr) throw intErr

      // 2. Save Actions (Clean and write)
      await supabase.from('ai_actions').delete().eq('user_id', user.id)
      if (actions.length > 0) {
        const { error: actErr } = await supabase.from('ai_actions').insert(
          actions.map((a) => ({
            user_id: user.id,
            intent_name: a.intent_name,
            action_type: a.action_type,
            action_config: a.action_config
          }))
        )
        if (actErr) throw actErr
      }

      toast.success('Intents and trigger actions written successfully!')
      
      // Reload from DB to capture real IDs
      const [intentsRes, actionsRes] = await Promise.all([
        supabase.from('ai_intents').select('*').eq('user_id', user.id),
        supabase.from('ai_actions').select('*').eq('user_id', user.id)
      ])
      if (intentsRes.data) setIntents(intentsRes.data)
      if (actionsRes.data) setActions(actionsRes.data)
    } catch (err: any) {
      console.error('Failed to save intents config:', err)
      toast.error(`Save failed: ${err.message || 'database exception'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-44 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="text-xs text-slate-500">Loading intents registry...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Intent Classification & Automation Triggers</h3>
          <p className="text-xs text-slate-400 mt-0.5">Map classified customer intents to instant pipeline and CRM actions.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-2 px-3.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Custom Intent
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Triggers'}
          </button>
        </div>
      </div>

      {/* Add custom intent form */}
      {showAddForm && (
        <form onSubmit={handleAddIntent} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Configure New Custom Intent</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">Intent Name (alphanumeric_snake)</label>
              <input
                type="text"
                required
                placeholder="e.g. bulk_pricing"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">Description</label>
              <input
                type="text"
                required
                placeholder="e.g. When customer asks for a quote or bulk wholesale rates"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors"
            >
              Confirm Add
            </button>
          </div>
        </form>
      )}

      {/* Intents List */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {intents.map((intent, i) => {
          const intentActions = actions.filter((a) => a.intent_name === intent.name)
          
          return (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col justify-between space-y-4">
              <div>
                {/* Header title */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono text-purple-400 font-bold">{intent.name}</span>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{intent.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={intent.is_active}
                      onChange={(e) =>
                        setIntents((prev) =>
                          prev.map((item) =>
                            item.name === intent.name
                              ? { ...item, is_active: e.target.checked }
                              : item
                          )
                        )
                      }
                      className="rounded accent-purple-600 h-4 w-4 cursor-pointer"
                    />
                    {/* Delete only if custom */}
                    {!DEFAULT_INTENTS.some((df) => df.name === intent.name) && (
                      <button
                        onClick={() => handleDeleteIntent(intent.name)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions mapping list */}
                <div className="border-t border-slate-800/80 mt-4 pt-3 space-y-3">
                  <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center justify-between">
                    <span>Actions triggered</span>
                    <div className="flex gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddAction(intent.name, e.target.value as any)
                            e.target.value = ''
                          }
                        }}
                        className="bg-slate-850 text-slate-400 text-[9px] font-bold border border-slate-700 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                      >
                        <option value="">+ Add action</option>
                        <option value="add_tag">Add Tag</option>
                        <option value="remove_tag">Remove Tag</option>
                        <option value="update_lead_score">Adjust Lead Score</option>
                        <option value="create_deal">Create pipeline Deal</option>
                        <option value="schedule_event">Google Calendar Event</option>
                        <option value="trigger_automation">Start Flow</option>
                        <option value="human_handoff">Human Handoff</option>
                      </select>
                    </div>
                  </div>

                  {intentActions.length === 0 ? (
                    <div className="text-slate-600 text-xs italic py-2 flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5" />
                      No actions mapped. Conversation reply only.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {actions.map((act, actIdx) => {
                        if (act.intent_name !== intent.name) return null
                        
                        return (
                          <div
                            key={actIdx}
                            className="flex items-center justify-between gap-3 bg-slate-950/20 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              {act.action_type === 'add_tag' && (
                                <>
                                  <Tag className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                                  <span>Attach Tag:</span>
                                  <input
                                    type="text"
                                    value={act.action_config.tag || ''}
                                    onChange={(e) => handleActionConfigChange(actIdx, 'tag', e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-bold text-rose-300 w-24 focus:outline-none focus:border-rose-500"
                                  />
                                </>
                              )}
                              {act.action_type === 'remove_tag' && (
                                <>
                                  <Tag className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                  <span>Remove Tag:</span>
                                  <input
                                    type="text"
                                    value={act.action_config.tag || ''}
                                    onChange={(e) => handleActionConfigChange(actIdx, 'tag', e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-400 w-24 focus:outline-none focus:border-slate-500"
                                  />
                                </>
                              )}
                              {act.action_type === 'update_lead_score' && (
                                <>
                                  <Sliders className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                  <span>Score:</span>
                                  <select
                                    value={act.action_config.score_change ?? 15}
                                    onChange={(e) => handleActionConfigChange(actIdx, 'score_change', parseInt(e.target.value))}
                                    className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[11px] font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="30">+30 (Bulk Interest)</option>
                                    <option value="25">+25 (Payment Done)</option>
                                    <option value="15">+15 (High Interest)</option>
                                    <option value="10">+10 (Pricing Inquiry)</option>
                                    <option value="-20">-20 (Complaint)</option>
                                    <option value="-50">-50 (Opt-Out)</option>
                                  </select>
                                </>
                              )}
                              {act.action_type === 'create_deal' && (
                                <>
                                  <Play className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  <span className="text-emerald-400 font-semibold">Generate CRM Deal in Pipeline</span>
                                </>
                              )}
                              {act.action_type === 'schedule_event' && (
                                <>
                                  <Play className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                  <span>Meeting Title:</span>
                                  <input
                                    type="text"
                                    value={act.action_config.event_summary || ''}
                                    onChange={(e) => handleActionConfigChange(actIdx, 'event_summary', e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-bold text-blue-300 w-32 focus:outline-none focus:border-blue-500"
                                  />
                                </>
                              )}
                              {act.action_type === 'trigger_automation' && (
                                <>
                                  <Play className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                                  <span>Start Flow:</span>
                                  <input
                                    type="text"
                                    value={act.action_config.flow_key || ''}
                                    onChange={(e) => handleActionConfigChange(actIdx, 'flow_key', e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-bold text-purple-300 w-28 focus:outline-none focus:border-purple-500"
                                  />
                                </>
                              )}
                              {act.action_type === 'human_handoff' && (
                                <>
                                  <Shield className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                  <span className="text-rose-400 font-bold uppercase tracking-wider text-[10px]">Handoff: Pause AI & Notify Support</span>
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveAction(actIdx)}
                              className="text-slate-600 hover:text-red-400 p-0.5 transition-colors shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Confidence Threshold bar */}
              <div className="border-t border-slate-800/80 pt-3 mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>CONFIDENCE THRESHOLD:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={intent.confidence_threshold}
                    onChange={(e) =>
                      setIntents((prev) =>
                        prev.map((item) =>
                          item.name === intent.name
                            ? { ...item, confidence_threshold: parseFloat(e.target.value) }
                            : item
                        )
                      )
                    }
                    className="w-16 accent-purple-500 cursor-pointer"
                  />
                  <span className="font-bold text-slate-400">{(intent.confidence_threshold * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
