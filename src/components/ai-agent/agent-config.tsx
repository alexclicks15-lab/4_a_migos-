"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Brain, Cpu, Save, Settings2, Sliders } from 'lucide-react'
import { toast } from 'sonner'

export function AIAgentConfig() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [enabled, setEnabled] = useState(true)
  const [model, setModel] = useState('gpt-4o')
  const [temperature, setTemperature] = useState(0.7)
  const [persona, setPersona] = useState('You are an intelligent WhatsApp CRM AI assistant.')
  const [configId, setConfigId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    
    const fetchConfig = async () => {
      setLoading(true)
      const supabase = createClient()
      try {
        const { data, error } = await supabase
          .from('ai_conversations')
          .select('*')
          .eq('user_id', user.id)
          .is('conversation_id', null)
          .maybeSingle()

        if (!error && data) {
          setEnabled(data.enabled)
          setModel(data.model)
          setTemperature(parseFloat(data.temperature || '0.7'))
          setPersona(data.persona)
          setConfigId(data.id)
        }
      } catch (err) {
        console.warn('Failed to load global config, using defaults:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    const supabase = createClient()
    try {
      const payload = {
        user_id: user.id,
        conversation_id: null, // Indicates global config template
        enabled,
        model,
        temperature,
        persona,
        updated_at: new Date().toISOString()
      }

      // If id is known, append it to upsert
      const { error } = await supabase.from('ai_conversations').upsert(
        payload,
        { onConflict: 'user_id,conversation_id' }
      )

      if (error) throw error

      toast.success('AI Co-pilot configuration updated successfully!')
      
      // Refetch id
      const { data } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('user_id', user.id)
        .is('conversation_id', null)
        .maybeSingle()
      if (data) setConfigId(data.id)
    } catch (err: any) {
      console.error('Failed to save config:', err)
      toast.error(`Save failed: ${err.message || 'database constraint error'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-44 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="text-xs text-slate-500">Retrieving agent context...</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-6">
        {/* Toggle AI header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI Co-pilot Responder Status</h3>
              <p className="text-xs text-slate-400 mt-0.5">Toggle automated responses for new incoming chats.</p>
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

        {/* Configurations grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Model selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-purple-400" />
              AI Model Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="gpt-4o">gpt-4o (Recommended: balanced accuracy & speed)</option>
              <option value="gpt-4-turbo">gpt-4-turbo (High capability, slower responses)</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo (Fast responses, lighter intent parsing)</option>
            </select>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              * Note: If the environment key <code>OPENAI_API_KEY</code> is missing, queries fall back to a high-accuracy regex pattern match engine.
            </p>
          </div>

          {/* Temperature config */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-purple-400" />
              Creativity (Temperature): {temperature}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="flex-1 accent-purple-500 cursor-pointer"
              />
              <span className="text-xs font-mono text-slate-400 font-bold bg-slate-850 px-2 py-1 rounded border border-slate-700">
                {temperature === 0 ? '0.0 (Strict)' : temperature === 1 ? '1.0 (Creative)' : temperature}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Lower numbers produce predictable, strict operational business replies. Higher values enable expressive, creative text styles.
            </p>
          </div>
        </div>

        {/* System Prompt / Persona config */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5 text-purple-400" />
            AI Agent Persona & Brand Guidelines (System Prompt)
          </label>
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={6}
            placeholder="Describe the agent persona and default response logic..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 leading-relaxed"
          />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Outline context about your company, core pricing limits, contact procedures, support pathways, and speech constraints. The agent will read this prompt on every incoming message.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Agent Configuration'}
        </button>
      </div>
    </form>
  )
}
