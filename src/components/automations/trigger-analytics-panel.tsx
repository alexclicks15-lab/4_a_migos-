"use client"

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAutomationStore } from '@/lib/automations/store'
import { formatRelative } from '@/lib/automations/trigger-meta'
import {
  X,
  Play,
  Clock,
  TrendingUp,
  AlertOctagon,
  RefreshCw,
  CheckCircle2,
  Copy,
  HelpCircle
} from 'lucide-react'
import { toast } from 'sonner'

export function TriggerAnalyticsPanel() {
  const isOpen = useAutomationStore((s) => s.analyticsOpen)
  const setOpen = useAutomationStore((s) => s.setAnalyticsOpen)
  const logs = useAutomationStore((s) => s.logs)
  const loading = useAutomationStore((s) => s.logsLoading)
  const executionCount = useAutomationStore((s) => s.executionCount)
  const lastExecutedAt = useAutomationStore((s) => s.lastExecutedAt)
  const fetchAnalytics = useAutomationStore((s) => s.fetchAnalytics)
  const id = useAutomationStore((s) => s.id)

  useEffect(() => {
    if (isOpen && id) {
      fetchAnalytics()
    }
  }, [isOpen, id, fetchAnalytics])

  // Compute conversion rate (based on last 50 logs)
  const totalLogs = logs.length
  const successLogs = logs.filter((l) => l.status === 'success' || l.status === 'partial').length
  const conversionRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 0

  // Filter error logs
  const errorLogs = logs.filter((l) => l.status === 'failed' || l.error_message)

  // Copy error message helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Error log copied to clipboard')
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
        />

        {/* Panel Drawer */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative flex h-screen w-full max-w-md flex-col border-l border-slate-800 bg-slate-900 shadow-2xl"
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-400" />
              <h2 className="text-lg font-bold text-white">Trigger Analytics</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAnalytics()}
                disabled={loading}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
                title="Refresh Analytics"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 gap-4">
              {/* Total executions */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium">Trigger Executions</div>
                  <div className="mt-1 text-2xl font-bold text-white">{executionCount}</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Play className="h-5 w-5" />
                </div>
              </div>

              {/* Last triggered time */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium">Last Triggered</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {lastExecutedAt ? formatRelative(lastExecutedAt) : 'Never triggered'}
                  </div>
                  {lastExecutedAt && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {new Date(lastExecutedAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                  <Clock className="h-5 w-5" />
                </div>
              </div>

              {/* Conversion Rate */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                      Conversion Rate
                      <span className="text-[10px] text-slate-500">(recent 50 runs)</span>
                    </div>
                    <div className="mt-1 text-2xl font-bold text-white">{conversionRate}%</div>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    conversionRate >= 80
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : conversionRate >= 50
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${conversionRate}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      conversionRate >= 80
                        ? 'bg-emerald-500'
                        : conversionRate >= 50
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Error Logs Panel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <AlertOctagon className="h-4 w-4 text-red-400" />
                  Recent Errors ({errorLogs.length})
                </h3>
                <span className="text-[10px] text-slate-500">Last 50 runs</span>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : errorLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950/20 p-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  <p className="mt-2 text-sm font-medium text-white">Nominal Operations</p>
                  <p className="mt-1 text-xs text-slate-500">No execution errors logged in recent runs.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                  {errorLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-red-500/20 bg-red-950/5 p-3 space-y-1.5 text-xs relative group"
                    >
                      <button
                        onClick={() => copyToClipboard(`[${new Date(log.created_at).toLocaleString()}] Trigger: ${log.trigger_event} - Error: ${log.error_message}`)}
                        className="absolute right-2 top-2 p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy log entry"
                      >
                        <Copy className="h-3 w-3" />
                      </button>

                      <div className="flex justify-between items-center text-slate-400 font-mono text-[10px]">
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                        <span className="bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 font-sans font-medium uppercase tracking-wide text-[8px]">
                          {log.trigger_event.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <p className="text-red-300 font-medium leading-relaxed font-mono text-[11px] break-words pr-5">
                        {log.error_message || 'Unknown execution error'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
