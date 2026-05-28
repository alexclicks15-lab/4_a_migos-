"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Plus, Trash2, Save, HelpCircle, Code } from 'lucide-react'
import { toast } from 'sonner'

interface TrainingExample {
  id?: string
  example_input: string
  expected_output: {
    intent: string
    entities: Record<string, any>
    crm_updates: string[]
    automation_actions: string[]
  }
}

export function AITrainingManager() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [examples, setExamples] = useState<TrainingExample[]>([])

  // Add form states
  const [showAddForm, setShowAddForm] = useState(false)
  const [inputMsg, setInputMsg] = useState('')
  const [intent, setIntent] = useState('pricing_inquiry')
  const [tagsStr, setTagsStr] = useState('add_tag:Bulk Order')
  const [actionsStr, setActionsStr] = useState('schedule_event:Demo Call')
  
  // Custom entities input state
  const [entitiesInput, setEntitiesInput] = useState('{\n  "product": "oversized tshirt",\n  "quantity": 100\n}')

  const DEFAULT_EXAMPLES: TrainingExample[] = [
    {
      example_input: 'I want 100 oversized tshirts for my brand next month',
      expected_output: {
        intent: 'bulk_order_inquiry',
        entities: { product: 'oversized tshirt', quantity: 100, timeline: 'next month' },
        crm_updates: ['add_tag:bulk_order', 'update_lead_score:+30'],
        automation_actions: ['trigger_automation:sales_followup']
      }
    },
    {
      example_input: 'Can we book a product demo call tomorrow at 2 PM?',
      expected_output: {
        intent: 'appointment_booking',
        entities: { appointment_date: 'tomorrow', appointment_time: '2 PM' },
        crm_updates: ['add_tag:booking_request', 'update_lead_score:+15'],
        automation_actions: ['schedule_event:Product Demo Call']
      }
    },
    {
      example_input: 'I already paid for order #5492, can you check?',
      expected_output: {
        intent: 'payment_done',
        entities: { order_id: '5492' },
        crm_updates: ['add_tag:paid', 'update_lead_score:+25'],
        automation_actions: ['trigger_automation:onboarding_flow']
      }
    }
  ]

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      setLoading(true)
      const supabase = createClient()
      try {
        const { data, error } = await supabase
          .from('ai_training_data')
          .select('*')
          .eq('user_id', user.id)

        if (!error && data && data.length > 0) {
          setExamples(data.map(d => ({
            id: d.id,
            example_input: d.example_input,
            expected_output: typeof d.expected_output === 'string' 
              ? JSON.parse(d.expected_output) 
              : d.expected_output
          })))
        } else {
          setExamples(DEFAULT_EXAMPLES)
        }
      } catch (err) {
        console.warn('Failed to load training examples, using defaults:', err)
        setExamples(DEFAULT_EXAMPLES)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMsg.trim()) return

    let parsedEntities = {}
    try {
      parsedEntities = JSON.parse(entitiesInput)
    } catch {
      toast.error('Entities field must be a valid JSON object!')
      return
    }

    const newEx: TrainingExample = {
      example_input: inputMsg.trim(),
      expected_output: {
        intent,
        entities: parsedEntities,
        crm_updates: tagsStr.split(',').map(s => s.trim()).filter(Boolean),
        automation_actions: actionsStr.split(',').map(s => s.trim()).filter(Boolean)
      }
    }

    setExamples(prev => [...prev, newEx])
    setInputMsg('')
    setIntent('pricing_inquiry')
    setTagsStr('add_tag:Bulk Order')
    setActionsStr('schedule_event:Demo Call')
    setEntitiesInput('{\n  "product": "oversized tshirt",\n  "quantity": 100\n}')
    setShowAddForm(false)
    toast.success('Added training example! Click Save changes to persist.')
  }

  const handleDelete = (idx: number) => {
    setExamples(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSaveAll = async () => {
    if (!user) return
    setSaving(true)
    const supabase = createClient()
    try {
      // Clear existing and write fresh set
      await supabase.from('ai_training_data').delete().eq('user_id', user.id)
      
      if (examples.length > 0) {
        const { error } = await supabase.from('ai_training_data').insert(
          examples.map(ex => ({
            user_id: user.id,
            example_input: ex.example_input,
            expected_output: ex.expected_output // jsonb saves object directly
          }))
        )
        if (error) throw error
      }

      toast.success('Training examples synced to prompt generator successfully!')
    } catch (err: any) {
      console.error('Failed to save training data:', err)
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
          <p className="text-xs text-slate-500">Loading ground examples...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">AI Grounding & Few-Shot Examples</h3>
          <p className="text-xs text-slate-400 mt-0.5">Train the AI by giving examples of customer inputs and expected outputs.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-2 px-3.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Example
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Examples'}
          </button>
        </div>
      </div>

      {/* Add Example Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Configure Grounding QA Pair</h4>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">Customer Sentence Input</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Can I get a discount if I buy 50 tshirts?"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <Code className="h-3 w-3" />
                Expected Entities (JSON format)
              </label>
              <textarea
                required
                rows={3}
                value={entitiesInput}
                onChange={(e) => setEntitiesInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-purple-300 outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">Expected Intent</label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="pricing_inquiry">pricing_inquiry</option>
                <option value="appointment_booking">appointment_booking</option>
                <option value="product_interest">product_interest</option>
                <option value="bulk_order_inquiry">bulk_order_inquiry</option>
                <option value="payment_done">payment_done</option>
                <option value="complaint">complaint</option>
                <option value="human_support">human_support</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">CRM Updates (comma-separated)</label>
              <input
                type="text"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="add_tag:bulk_discount, update_lead_score:+15"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">Automation Actions (comma-separated)</label>
              <input
                type="text"
                value={actionsStr}
                onChange={(e) => setActionsStr(e.target.value)}
                placeholder="schedule_event:Discount Meeting, trigger_automation:sales_flow"
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
              Add Grounding Example
            </button>
          </div>
        </form>
      )}

      {/* Examples list */}
      <div className="space-y-4">
        {examples.map((ex, i) => (
          <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <span className="text-[9px] uppercase font-extrabold tracking-wider text-slate-500">Customer Sentence Input Example</span>
                <p className="text-sm font-semibold text-white">"{ex.example_input}"</p>
              </div>
              <button
                onClick={() => handleDelete(i)}
                className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors shrink-0 cursor-pointer"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Expected structured payload */}
            <div className="rounded-lg bg-slate-950/40 border border-slate-850 p-4 grid grid-cols-1 gap-4 sm:grid-cols-4 text-xs font-mono">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-600 block mb-1">Intent</span>
                <span className="text-purple-400 font-bold">{ex.expected_output.intent}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-600 block mb-1">Extracted Slots</span>
                {Object.keys(ex.expected_output.entities).length > 0 ? (
                  <div className="space-y-0.5 text-[10px] text-slate-400">
                    {Object.entries(ex.expected_output.entities).map(([k, v]) => (
                      <div key={k} className="truncate">
                        <span className="text-slate-500">{k}:</span> {String(v)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-600 italic">none</span>
                )}
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-600 block mb-1">CRM Actions</span>
                {ex.expected_output.crm_updates.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {ex.expected_output.crm_updates.map((tag, idx) => (
                      <span key={idx} className="bg-rose-500/10 text-rose-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-rose-500/10 truncate max-w-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-600 italic">none</span>
                )}
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-600 block mb-1">Automations</span>
                {ex.expected_output.automation_actions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {ex.expected_output.automation_actions.map((act, idx) => (
                      <span key={idx} className="bg-blue-500/10 text-blue-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-500/10 truncate max-w-full">
                        {act}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-600 italic">none</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
