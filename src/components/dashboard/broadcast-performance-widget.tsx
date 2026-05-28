"use client"

import type { BroadcastROISummary } from '@/lib/dashboard/types'
import { Megaphone, Calendar, TrendingUp, Sparkles, Send, Award } from 'lucide-react'

interface BroadcastPerformanceWidgetProps {
  data: BroadcastROISummary | null
  loading: boolean
}

export function BroadcastPerformanceWidget({ data, loading }: BroadcastPerformanceWidgetProps) {
  if (loading || !data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    )
  }

  // List of mock campaign performance
  const campaigns = [
    { name: 'Weekly Offer 20% Off', sent: 1250, openRate: 85, clickRate: 38, status: 'Sent' },
    { name: 'New Inbound Intake Alert', sent: 890, openRate: 91, clickRate: 48, status: 'Sent' },
    { name: 'Holiday Special Re-engage', sent: 2100, openRate: 78, clickRate: 29, status: 'Sent' },
    { name: 'Summer Launch Warmup', sent: 500, openRate: 0, clickRate: 0, status: 'Scheduled' },
  ]

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden flex flex-col h-full shadow-lg">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">Broadcast Campaigns</h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Campaign Engagement & ROI</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/10">
          <Calendar className="h-3 w-3" />
          <span>{data.scheduledCount} Scheduled</span>
        </div>
      </header>

      <div className="p-5 flex-1 space-y-4 overflow-y-auto max-h-[500px]">
        {/* KPI metrics row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-850 bg-slate-950/20 p-3">
            <div className="text-[10px] uppercase font-bold text-slate-500">Total Campaign Value</div>
            <div className="mt-1 text-lg font-bold text-emerald-400">${data.totalRevenueGenerated.toLocaleString()}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">Estimated ROI value</div>
          </div>
          <div className="rounded-lg border border-slate-850 bg-slate-950/20 p-3">
            <div className="text-[10px] uppercase font-bold text-slate-500">Audience Growth</div>
            <div className="mt-1 text-lg font-bold text-blue-400">+{data.audienceGrowthRate}%</div>
            <div className="text-[9px] text-slate-500 mt-0.5">Growth monthly rate</div>
          </div>
        </div>

        {/* Open Rate & Click Rate Progress */}
        <div className="space-y-3.5 border-y border-slate-800/80 py-4">
          {/* Open Rate */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400">Average Open Rate</span>
              <span className="text-white font-bold">{data.averageOpenRate}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div style={{ width: `${data.averageOpenRate}%` }} className="bg-amber-400 h-full rounded-full" />
            </div>
          </div>

          {/* Click Rate */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400">Average Click Rate</span>
              <span className="text-white font-bold">{data.averageClickRate}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div style={{ width: `${data.averageClickRate}%` }} className="bg-purple-500 h-full rounded-full" />
            </div>
          </div>
        </div>

        {/* Best Template Info */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/10 p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Award className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] uppercase font-bold text-slate-500">Best Performing Template</div>
            <div className="text-xs font-bold text-white truncate mt-0.5">{data.bestPerformingTemplate}</div>
          </div>
        </div>

        {/* Recent Campaigns lists */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-bold tracking-wide text-slate-500">Recent Campaigns</div>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {campaigns.map((c, i) => (
              <div key={i} className="rounded-lg border border-slate-850 bg-slate-950/20 p-2.5 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">{c.name}</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    {c.sent} sent • {c.status === 'Sent' ? `${c.openRate}% open` : 'Pending'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {c.status === 'Sent' ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {c.clickRate}% click
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      Scheduled
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
