"use client"

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Cpu,
  Key,
  Zap,
  Activity,
  Terminal,
  Save,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  DollarSign,
  Clock,
  ChevronRight,
  Loader2,
  Lock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

interface ProviderConfig {
  provider: string
  hasKey: boolean
  apiUrl: string
}

interface RoutingRule {
  feature: string
  provider: string
  model: string
  fallback_provider: string | null
  fallback_model: string | null
}

interface AnalyticsSummary {
  totalRequests: number
  successRate: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  totalCost: number
  avgLatency: number
  avgAccuracy: number
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI ChatGPT', logo: '🟢', desc: 'Industry standard for complex planning and reasoning.' },
  { id: 'gemini', name: 'Google Gemini', logo: '🔵', desc: 'Massive context window & rapid multimodal understanding.' },
  { id: 'claude', name: 'Anthropic Claude', logo: '🟠', desc: 'Superior brand consistency & structured code outputs.' },
  { id: 'grok', name: 'xAI Grok', logo: '⚫', desc: 'Realtime lookup integration and witty conversation style.' },
  { id: 'deepseek', name: 'DeepSeek AI', logo: '🐳', desc: 'Extreme cost efficiency and deep developer coding capability.' },
  { id: 'ollama', name: 'Ollama Local AI', logo: '🦙', desc: 'Run open-source models (Llama 3/Mistral) locally on your hardware.' }
]

const MODELS_BY_PROVIDER: Record<string, { id: string; name: string }[]> = {
  openai: [
    { id: 'gpt-4o', name: 'gpt-4o (Balanced Pro)' },
    { id: 'gpt-4-turbo', name: 'gpt-4-turbo (Developer v4.1)' },
    { id: 'gpt-5-preview', name: 'gpt-5-preview (Next-Gen Ready)' }
  ],
  gemini: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (High Accuracy)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Super Fast)' }
  ],
  claude: [
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Most Popular)' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus (Creative Writer)' }
  ],
  grok: [
    { id: 'grok-beta', name: 'Grok Beta (xAI)' }
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder (API)' }
  ],
  ollama: [
    { id: 'llama3', name: 'Llama 3 (8B / 70B Local)' },
    { id: 'mistral', name: 'Mistral (7B Local)' }
  ]
}

const FEATURES = [
  { id: 'default', name: 'Global Default AI', desc: 'Applies when no feature-specific routing is configured.' },
  { id: 'agents', name: 'AI NLU Agents', desc: 'Intent detection and automated scheduling.' },
  { id: 'replies', name: 'AI Support Bots', desc: 'Direct chat responder and Q&A help.' },
  { id: 'automations', name: 'AI Flow Automations', desc: 'Step triggers and action conditions.' },
  { id: 'qualification', name: 'Lead Qualification', desc: 'Evaluating contact value scores.' },
  { id: 'workflow_generation', name: 'Visual Flow Creator', desc: 'Compiling text prompts to canvases.' }
]

export function AIProvidersManager() {
  const [loading, setLoading] = useState(true)
  const [savingKeys, setSavingKeys] = useState<string | null>(null)
  const [savingRouting, setSavingRouting] = useState<string | null>(null)

  // Configuration state
  const [keysState, setKeysState] = useState<Record<string, { apiKey: string; apiUrl: string }>>({})
  const [providersStatus, setProvidersStatus] = useState<Record<string, boolean>>({})
  const [routingState, setRoutingState] = useState<Record<string, RoutingRule>>({})

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [providerSplit, setProviderSplit] = useState<Record<string, number>>({})
  const [recentLogs, setRecentLogs] = useState<any[]>([])

  const fetchConfigs = async () => {
    try {
      // 1. Fetch credentials status
      const resProviders = await fetch('/api/ai/providers')
      if (resProviders.ok) {
        const data = await resProviders.json() as ProviderConfig[]
        const kState: any = {}
        const statusMap: any = {}
        data.forEach(item => {
          kState[item.provider] = {
            apiKey: item.hasKey ? '••••••••' : '',
            apiUrl: item.apiUrl || ''
          }
          statusMap[item.provider] = item.hasKey
        })
        setKeysState(kState)
        setProvidersStatus(statusMap)
      }

      // 2. Fetch routing configs
      const resRouting = await fetch('/api/ai/routing')
      if (resRouting.ok) {
        const data = await resRouting.json() as RoutingRule[]
        const rState: any = {}
        data.forEach(rule => {
          rState[rule.feature] = rule
        })
        setRoutingState(rState)
      }

      // 3. Fetch analytics
      const resAnalytics = await fetch('/api/ai/analytics')
      if (resAnalytics.ok) {
        const data = await resAnalytics.json()
        setAnalytics(data.summary)
        setProviderSplit(data.providers)
        setRecentLogs(data.logs)
      }
    } catch (err) {
      console.error('[providers-manager] Error loading settings:', err)
      toast.error('Could not retrieve provider settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfigs()
  }, [])

  const handleSaveKey = async (provider: string) => {
    const creds = keysState[provider] || { apiKey: '', apiUrl: '' }
    
    try {
      setSavingKeys(provider)
      const res = await fetch('/api/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: creds.apiKey,
          apiUrl: creds.apiUrl
        })
      })

      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Failed to save configuration')
      }

      toast.success(`${PROVIDERS.find(p => p.id === provider)?.name} config saved successfully!`)
      setProvidersStatus(prev => ({
        ...prev,
        [provider]: creds.apiKey !== ''
      }))
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to update keys')
    } finally {
      setSavingKeys(null)
    }
  }

  const handleSaveRouting = async (feature: string) => {
    const rule = routingState[feature] || {
      feature,
      provider: 'openai',
      model: 'gpt-4o',
      fallback_provider: '',
      fallback_model: ''
    }

    try {
      setSavingRouting(feature)
      const res = await fetch('/api/ai/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature,
          provider: rule.provider,
          model: rule.model,
          fallbackProvider: rule.fallback_provider || null,
          fallbackModel: rule.fallback_model || null
        })
      })

      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Failed to update routing')
      }

      toast.success(`Routing updated for: ${FEATURES.find(f => f.id === feature)?.name}`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Routing save failed')
    } finally {
      setSavingRouting(null)
    }
  }

  const handleKeyChange = (provider: string, field: 'apiKey' | 'apiUrl', value: string) => {
    setKeysState(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider] || { apiKey: '', apiUrl: '' },
        [field]: value
      }
    }))
  }

  const handleRoutingChange = (feature: string, field: keyof RoutingRule, value: any) => {
    setRoutingState(prev => {
      const current = prev[feature] || {
        feature,
        provider: 'openai',
        model: 'gpt-4o',
        fallback_provider: null,
        fallback_model: null
      }
      
      const updated = {
        ...current,
        [field]: value
      }

      // If provider changes, select the first available model for that provider
      if (field === 'provider') {
        const models = MODELS_BY_PROVIDER[value] || []
        updated.model = models[0]?.id || ''
      }
      if (field === 'fallback_provider') {
        if (value) {
          const models = MODELS_BY_PROVIDER[value] || []
          updated.fallback_model = models[0]?.id || ''
        } else {
          updated.fallback_model = null
        }
      }

      return {
        ...prev,
        [feature]: updated
      }
    })
  }

  if (loading) {
    return (
      <div className="flex h-56 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          <p className="text-xs text-slate-500 font-bold">Synchronizing AI infrastructure...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 mt-4">
      {/* Analytics Telemetry Widgets */}
      {analytics && analytics.totalRequests > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { title: 'Total Tokens', value: analytics.totalTokens.toLocaleString(), desc: 'Input + output tokens', icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { title: 'Estimated Costs', value: `$${analytics.totalCost.toFixed(3)}`, desc: 'Accrued cost (USD)', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { title: 'Average Latency', value: `${analytics.avgLatency}ms`, desc: 'Average response speed', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { title: 'Success Rate', value: `${analytics.successRate}%`, desc: 'Automatic fallbacks logs', icon: CheckCircle2, color: 'text-pink-400', bg: 'bg-pink-500/10' }
          ].map((stat, i) => (
            <Card key={i} className="bg-slate-900 border-slate-800/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{stat.title}</span>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <h4 className="text-xl font-bold text-white mt-2">{stat.value}</h4>
              <p className="text-[9px] text-slate-500 mt-0.5">{stat.desc}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Main Grid: Providers and Routing */}
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Left column: Providers Integration */}
        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-800/80">
            <CardHeader className="border-b border-slate-800/80 pb-4">
              <CardTitle className="text-white text-base">Connected AI Providers</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Manage API credentials for external integrations and local endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-slate-800/80 p-0">
              {PROVIDERS.map(p => {
                const state = keysState[p.id] || { apiKey: '', apiUrl: '' }
                const isConnected = providersStatus[p.id] || false
                const isLocal = p.id === 'ollama'

                return (
                  <div key={p.id} className="p-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{p.logo}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-white">{p.name}</h4>
                            {isConnected ? (
                              <span className="text-[9px] font-medium bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-0.5">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Ready
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                                Not Configured
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{p.desc}</p>
                        </div>
                      </div>
                    </div>

                    {/* Inputs panel */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5" /> API Credential Key
                        </Label>
                        <input
                          type="password"
                          value={state.apiKey}
                          placeholder={isLocal ? "None required" : "sk-..."}
                          disabled={isLocal}
                          onChange={e => handleKeyChange(p.id, 'apiKey', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-650 focus:border-purple-500 outline-none disabled:opacity-50"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                          API URL / Gateway Endpoint
                        </Label>
                        <input
                          type="text"
                          value={state.apiUrl}
                          placeholder={isLocal ? "http://localhost:11434" : "Default"}
                          onChange={e => handleKeyChange(p.id, 'apiUrl', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-650 focus:border-purple-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleSaveKey(p.id)}
                        disabled={savingKeys === p.id}
                        className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 font-semibold text-[10px] h-7 px-3 flex items-center gap-1"
                      >
                        {savingKeys === p.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Update Config
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Routing Management */}
        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-800/80">
            <CardHeader className="border-b border-slate-800/80 pb-4">
              <CardTitle className="text-white text-base">AI Model Routing Engine</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Select which model operates each feature, with support for automated fallbacks.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-slate-800/80 p-0">
              {FEATURES.map(f => {
                const rule = routingState[f.id] || {
                  feature: f.id,
                  provider: 'openai',
                  model: 'gpt-4o',
                  fallback_provider: '',
                  fallback_model: ''
                }

                const models = MODELS_BY_PROVIDER[rule.provider] || []
                const fallbackModels = rule.fallback_provider ? MODELS_BY_PROVIDER[rule.fallback_provider] || [] : []

                return (
                  <div key={f.id} className="p-4 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1">
                        <Zap className="h-3 w-3 text-purple-400" /> {f.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{f.desc}</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {/* Provider Select */}
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">Primary Provider</span>
                        <select
                          value={rule.provider}
                          onChange={e => handleRoutingChange(f.id, 'provider', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:border-purple-500 outline-none"
                        >
                          {PROVIDERS.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Model Select */}
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">Model</span>
                        <select
                          value={rule.model}
                          onChange={e => handleRoutingChange(f.id, 'model', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:border-purple-500 outline-none"
                        >
                          {models.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Fallback settings */}
                    <div className="grid gap-2 sm:grid-cols-2 p-2 bg-slate-950/40 rounded border border-slate-850">
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">Fallback Provider</span>
                        <select
                          value={rule.fallback_provider || ''}
                          onChange={e => handleRoutingChange(f.id, 'fallback_provider', e.target.value || null)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs text-white focus:border-purple-500 outline-none"
                        >
                          <option value="">No Fallback</option>
                          {PROVIDERS.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      {rule.fallback_provider && (
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">Fallback Model</span>
                          <select
                            value={rule.fallback_model || ''}
                            onChange={e => handleRoutingChange(f.id, 'fallback_model', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs text-white focus:border-purple-500 outline-none"
                          >
                            {fallbackModels.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        onClick={() => handleSaveRouting(f.id)}
                        disabled={savingRouting === f.id}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-[10px] h-7 px-3.5 flex items-center gap-1"
                      >
                        {savingRouting === f.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Save Routing
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Telemetry Logs Panel */}
      {recentLogs.length > 0 && (
        <Card className="bg-slate-900 border-slate-800/80">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Terminal className="h-4.5 w-4.5 text-purple-400" /> Recent AI Telemetry Log
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Live operational metrics showing model execution status, request latencies, and token costs.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold bg-slate-950/20">
                  <th className="p-3">Feature</th>
                  <th className="p-3">Provider / Model</th>
                  <th className="p-3">Tokens</th>
                  <th className="p-3">Cost (USD)</th>
                  <th className="p-3">Latency</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-950/20 text-slate-300">
                    <td className="p-3 capitalize font-sans">{log.feature.replace('_', ' ')}</td>
                    <td className="p-3">
                      <span className="text-slate-400 capitalize">{log.provider}</span>
                      <span className="text-slate-650 ml-1.5">{log.model}</span>
                    </td>
                    <td className="p-3 text-slate-400">{log.total_tokens} <span className="text-[9px] text-slate-550">({log.prompt_tokens}/{log.completion_tokens})</span></td>
                    <td className="p-3 text-emerald-400 font-bold">${parseFloat(log.cost).toFixed(5)}</td>
                    <td className="p-3 text-blue-400">{log.latency_ms}ms</td>
                    <td className="p-3 text-right">
                      {log.is_success ? (
                        <span className="inline-block bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold text-[10px]">
                          Success
                        </span>
                      ) : (
                        <span className="inline-block bg-red-500/10 text-red-400 px-2 py-0.5 rounded font-bold text-[10px]" title={log.error_log}>
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
