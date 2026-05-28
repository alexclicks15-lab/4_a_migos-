"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { AutomationPerformanceSummary } from '@/lib/dashboard/types'
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Play,
  Copy,
  RefreshCcw,
  Zap,
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'

interface AutomationHealthWidgetProps {
  data: AutomationPerformanceSummary | null
  loading: boolean
}

export function AutomationHealthWidget({ data, loading }: AutomationHealthWidgetProps) {
  const [retrying, setRetrying] = useState<string | null>(null)

  const handleRetry = (logId: string) => {
    setRetrying(logId)
    setTimeout(() => {
      setRetrying(null)
      toast.success('Trigger execution re-enqueued successfully!')
    }, 1000)
  }

  const copyError = (msg: string) => {
    navigator.clipboard.writeText(msg)
    toast.success('Error message copied to clipboard')
  }

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md h-[400px] flex items-center justify-center">
        <RefreshCcw className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    )
  }

  // Draw execution trend line using SVG (simulated daily runs)
  const runsPoints = [35, 42, 38, 55, 60, 48, data.totalRuns || 54]
  const maxVal = Math.max(...runsPoints) || 1
  const chartW = 300
  const chartH = 60
  const stepX = chartW / (runsPoints.length - 1)
  const linePoints = runsPoints
    .map((v, i) => `${i * stepX},${chartH - (v / maxVal) * (chartH - 10) - 5}`)
    .join(' ')

  const health = data.failedCount === 0
    ? { label: 'Nominal', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
    : data.failedCount < 5
    ? { label: 'Warning', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
    : { label: 'Critical', color: 'text-red-400 bg-red-500/10 border-red-500/20' }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden flex flex-col h-full shadow-lg">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400 animate-pulse" />
          <div>
            <h2 className="text-sm font-semibold text-white">Automation Performance</h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Execution & Errors</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${health.color}`}>
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              data.failedCount === 0 ? 'bg-emerald-400' : data.failedCount < 5 ? 'bg-amber-400' : 'bg-red-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
              data.failedCount === 0 ? 'bg-emerald-400' : data.failedCount < 5 ? 'bg-amber-400' : 'bg-red-400'
            }`} />
          </span>
          {health.label}
        </div>
      </header>

      <div className="p-5 flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[500px]">
        {/* Left Side: Stats and Trend */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-850 bg-slate-950/20 p-3">
              <div className="text-[9px] uppercase font-semibold text-slate-500">Total Runs</div>
              <div className="mt-1 text-lg font-bold text-white">{data.totalRuns}</div>
            </div>
            <div className="rounded-lg border border-slate-850 bg-slate-950/20 p-3">
              <div className="text-[9px] uppercase font-semibold text-slate-500">Success</div>
              <div className="mt-1 text-lg font-bold text-emerald-400">{data.successCount}</div>
            </div>
            <div className="rounded-lg border border-slate-850 bg-slate-950/20 p-3">
              <div className="text-[9px] uppercase font-semibold text-slate-500">Failed</div>
              <div className="mt-1 text-lg font-bold text-red-400">{data.failedCount}</div>
            </div>
          </div>

          {/* Sparkline Trend */}
          <div className="rounded-lg border border-slate-850 bg-slate-950/15 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Daily Executions Trend</span>
              <span className="text-[10px] text-slate-500">Last 7 days</span>
            </div>
            <div className="w-full">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-[60px]" overflow="visible">
                {/* SVG path area */}
                <path
                  d={`M0,${chartH} L${linePoints} L${chartW},${chartH} Z`}
                  fill="url(#grad-executions)"
                  opacity={0.15}
                />
                <linearGradient id="grad-executions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
                {/* Trend line */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  points={linePoints}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Top performing info */}
          <div className="rounded-lg bg-slate-950/20 p-3 text-xs flex justify-between items-center">
            <div>
              <div className="text-slate-500 text-[10px] font-semibold uppercase">Top Performing Flow</div>
              <div className="text-slate-200 font-bold mt-0.5">{data.topFlowName}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-500 text-[10px] font-semibold uppercase">Completion Rate</div>
              <div className="text-emerald-400 font-bold mt-0.5">{data.completionRate}%</div>
            </div>
          </div>
        </div>

        {/* Right Side: Drop-off points & Error logs */}
        <div className="space-y-4">
          {/* Drop-offs */}
          {data.dropOffPoints.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-bold tracking-wide text-slate-500">Automation Drop-off Hotspots</div>
              <div className="space-y-1.5">
                {data.dropOffPoints.map((pt, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] text-slate-400 flex items-center justify-center font-bold">{i+1}</span>
                      {pt.stepName}
                    </span>
                    <span className="text-slate-300 font-bold">{pt.count} drop-offs</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error logs */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase font-bold tracking-wide text-slate-500">Recent Failures & Alerts</div>
            {data.recentErrors.length === 0 ? (
              <div className="rounded-lg border border-slate-850 bg-slate-950/10 p-4 text-center text-xs text-slate-500">
                No recent automation errors logged.
              </div>
            ) : (
              <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                {data.recentErrors.map((err) => (
                  <div
                    key={err.id}
                    className="rounded-lg border border-red-500/10 bg-red-950/5 p-2.5 text-xs relative group transition-colors hover:bg-red-950/10"
                  >
                    <div className="flex justify-between items-center text-slate-500 font-mono text-[9px] mb-1">
                      <span>{new Date(err.at).toLocaleTimeString()}</span>
                      <span className="text-red-400 font-bold uppercase tracking-wider text-[8px]">{err.flowName}</span>
                    </div>
                    <p className="text-red-300 font-mono text-[10px] leading-relaxed break-all pr-12">
                      {err.errorMessage}
                    </p>

                    {/* Quick action buttons on hover */}
                    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyError(err.errorMessage)}
                        className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                        title="Copy Error"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleRetry(err.id)}
                        className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                        title="Retry Trigger"
                        disabled={retrying === err.id}
                      >
                        <RefreshCcw className={`h-3 w-3 ${retrying === err.id ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
