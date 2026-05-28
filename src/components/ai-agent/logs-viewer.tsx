"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Search, ShieldAlert, Cpu, Timer, Eye, Calendar, AlertCircle, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

interface LogItem {
  id: string
  created_at: string
  message_text: string
  intent_detected?: string
  confidence?: number
  entities_extracted: Record<string, any>
  actions_taken: string[]
  lead_score_before?: number
  lead_score_after?: number
  response_text?: string
  requires_handoff: boolean
  tokens_used: number
  latency_ms: number
  status: 'success' | 'error'
  error_message?: string
  conversation_id: string
}

export function AILogsViewer() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all')
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null)

  const fetchLogs = async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('ai_automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error && data) {
        setLogs(data as LogItem[])
      }
    } catch (err) {
      console.warn('Failed to load database logs:', err)
      // Fallback mock logs
      setLogs([
        {
          id: 'log-1',
          created_at: new Date().toISOString(),
          message_text: 'I want 50 tshirts for my brand next Friday, how much is kochi delivery?',
          intent_detected: 'bulk_order_inquiry',
          confidence: 0.96,
          entities_extracted: { product: 'tshirt', quantity: 50, location: 'kochi', delivery_date: 'next Friday' },
          actions_taken: ['add_tag:bulk_order', 'update_lead_score:+30', 'trigger_flow:sales_followup'],
          lead_score_before: 50,
          lead_score_after: 80,
          response_text: 'Thanks for your wholesale inquiry! Our standard bulk lead score has been applied. We specialize in custom oversized t-shirts. A sales manager will follow up with custom pricing and sample kits shortly.',
          requires_handoff: false,
          tokens_used: 342,
          latency_ms: 450,
          status: 'success',
          conversation_id: 'conv-1'
        },
        {
          id: 'log-2',
          created_at: new Date(Date.now() - 600000).toISOString(),
          message_text: 'This product is terrible! I want a full refund right now or I will contact support.',
          intent_detected: 'complaint',
          confidence: 0.94,
          entities_extracted: {},
          actions_taken: ['add_tag:Complaint Escalated', 'update_lead_score:-20', 'human_handoff'],
          lead_score_before: 80,
          lead_score_after: 60,
          response_text: "I'm so sorry to hear you've had a bad experience. I am escalating this conversation to our support supervisor immediately so we can resolve this for you.",
          requires_handoff: true,
          tokens_used: 412,
          latency_ms: 580,
          status: 'success',
          conversation_id: 'conv-2'
        },
        {
          id: 'log-3',
          created_at: new Date(Date.now() - 1200000).toISOString(),
          message_text: 'Please book a product demo call tomorrow at 4 PM.',
          intent_detected: 'appointment_booking',
          confidence: 0.98,
          entities_extracted: { appointment_date: 'tomorrow', appointment_time: '4 PM' },
          actions_taken: ['add_tag:booking_request', 'update_lead_score:+15', 'schedule_calendar_event:product_demo'],
          lead_score_before: 60,
          lead_score_after: 75,
          response_text: "Perfect! I've booked your product demo meeting for tomorrow at 4 PM. We've sent a calendar invitation link to your contact card. Talk to you soon!",
          requires_handoff: false,
          tokens_used: 380,
          latency_ms: 520,
          status: 'success',
          conversation_id: 'conv-3'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [user])

  const filteredLogs = logs.filter(l => {
    const text = l.message_text.toLowerCase()
    const intent = (l.intent_detected || '').toLowerCase()
    const query = search.toLowerCase()
    const matchesSearch = text.includes(query) || intent.includes(query)
    
    if (statusFilter === 'all') return matchesSearch
    return matchesSearch && l.status === statusFilter
  })

  return (
    <div className="space-y-6">
      {/* Search and filtering */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">AI Copilot Audit Logs</h3>
          <p className="text-xs text-slate-400 mt-0.5">Inspect incoming customer inputs, intent analysis, actions, and token metrics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
            />
          </div>
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-850 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="all">All Logs</option>
            <option value="success">Success</option>
            <option value="error">Errors</option>
          </select>
          {/* Refresh button */}
          <button
            onClick={fetchLogs}
            className="p-2 border border-slate-800 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500 text-xs italic">
          No audit logs found matching your filters.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Customer Input</th>
                  <th className="px-4 py-3">Intent Classified</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Score Delta</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-xs text-slate-300">
                {filteredLogs.map((log) => {
                  const scoreDiff = (log.lead_score_after ?? 50) - (log.lead_score_before ?? 50)
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-900/35 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[10px] text-slate-500">
                        {format(new Date(log.created_at), 'MM/dd HH:mm:ss')}
                      </td>
                      <td className="px-4 py-3.5 max-w-xs truncate font-medium text-white" title={log.message_text}>
                        {log.message_text}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] font-semibold text-purple-400">
                        {log.intent_detected || 'general_inquiry'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-slate-400">
                        {log.confidence ? `${(log.confidence * 100).toFixed(0)}%` : '85%'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-semibold">
                        {scoreDiff > 0 ? (
                          <span className="text-emerald-400">+{scoreDiff}</span>
                        ) : scoreDiff < 0 ? (
                          <span className="text-rose-400">{scoreDiff}</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-slate-400">
                        {log.latency_ms}ms
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {log.status === 'success' ? (
                          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/10">
                            Success
                          </span>
                        ) : (
                          <span className="bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-500/10">
                            Error
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log detail overlay modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="h-4.5 w-4.5 text-purple-400" />
                AI Dispatch Transaction Audit
              </h4>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
              {/* Message block */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Customer Inbound</span>
                  <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 text-white font-medium">
                    "{selectedLog.message_text}"
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">AI Agent Reply</span>
                  <div className="bg-purple-950/10 p-3 rounded-lg border border-purple-500/10 text-purple-200">
                    "{selectedLog.response_text || 'No automated reply sent.'}"
                  </div>
                </div>
              </div>

              {/* Classification metadata */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 bg-slate-950/30 p-3 rounded-lg border border-slate-850 font-mono">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-600 block mb-1">Intent</span>
                  <span className="text-purple-400 font-bold">{selectedLog.intent_detected || 'general_inquiry'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-600 block mb-1">Confidence</span>
                  <span className="text-slate-300 font-bold">{selectedLog.confidence ? `${(selectedLog.confidence * 100).toFixed(0)}%` : '85%'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-600 block mb-1">Latency</span>
                  <span className="text-slate-300 flex items-center gap-1">
                    <Timer className="h-3 w-3 text-blue-400" />
                    {selectedLog.latency_ms}ms
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-600 block mb-1">Tokens Spent</span>
                  <span className="text-slate-300">{selectedLog.tokens_used} tokens</span>
                </div>
              </div>

              {/* Extracted slots */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Extracted Entities & Metadata</span>
                {Object.keys(selectedLog.entities_extracted).length > 0 ? (
                  <pre className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 text-[11px] text-emerald-400 font-mono whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.entities_extracted, null, 2)}
                  </pre>
                ) : (
                  <div className="text-slate-600 italic">No structured slots extracted.</div>
                )}
              </div>

              {/* Actions triggered */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Automated Actions Executed</span>
                {selectedLog.actions_taken && selectedLog.actions_taken.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedLog.actions_taken.map((act, idx) => (
                      <span key={idx} className="bg-purple-600/10 text-purple-300 font-bold px-2 py-0.5 rounded border border-purple-500/10">
                        {act}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-600 italic">No automated actions configured or run.</div>
                )}
              </div>

              {/* Error messages if any */}
              {selectedLog.status === 'error' && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-lg flex gap-2">
                  <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold uppercase text-[9px] block">Error logs exception:</span>
                    <p className="mt-1">{selectedLog.error_message || 'Unexpected database write failure.'}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800 text-xs">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
