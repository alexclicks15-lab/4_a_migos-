"use client"

import type { AgentPerformance } from '@/lib/dashboard/types'
import { Users, Award, Shield, Timer, Flame, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TeamLeaderboardWidgetProps {
  data: AgentPerformance[] | null
  loading: boolean
}

export function TeamLeaderboardWidget({ data, loading }: TeamLeaderboardWidgetProps) {
  if (loading || !data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    )
  }

  // Calculate overall team productivity metrics
  const totalConvs = data.reduce((sum, a) => sum + a.conversationsCount, 0)
  const totalValue = data.reduce((sum, a) => sum + a.closedDealsValue, 0)
  const avgResponse = Math.round(data.reduce((sum, a) => sum + a.avgResponseTime, 0) / data.length)
  const onlineCount = data.filter((a) => a.status === 'online').length

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden flex flex-col h-full shadow-lg">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-sky-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">Team Performance & Status</h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Agent Leaderboard</p>
          </div>
        </div>
        <div className="text-xs font-semibold text-slate-400">
          <span className="text-emerald-400 font-bold">{onlineCount}</span> / {data.length} Agents Active
        </div>
      </header>

      <div className="p-5 flex-1 space-y-5 overflow-y-auto max-h-[500px]">
        {/* Top Performer Ribbon / KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-850 bg-slate-950/20 p-2.5 flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] uppercase font-bold text-slate-500 truncate">Total Won</div>
              <div className="text-sm font-bold text-white truncate">${totalValue.toLocaleString()}</div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-850 bg-slate-950/20 p-2.5 flex items-center gap-2">
            <Timer className="h-4 w-4 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] uppercase font-bold text-slate-500 truncate">Avg Response</div>
              <div className="text-sm font-bold text-white truncate">{avgResponse} mins</div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-850 bg-slate-950/20 p-2.5 flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] uppercase font-bold text-slate-500 truncate">Closed Deals</div>
              <div className="text-sm font-bold text-white truncate">
                {data.reduce((sum, a) => sum + a.closedDealsCount, 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Agent ranking cards (Top 2) */}
        <div className="flex flex-col sm:flex-row gap-3">
          {data.slice(0, 2).map((agent, index) => (
            <div key={agent.id} className="flex-1 rounded-xl border border-slate-800 bg-slate-950/15 p-3.5 flex items-center gap-3 relative overflow-hidden">
              {/* Gold/Silver rank medal indicator in background */}
              <Award className={`absolute -right-3 -bottom-3 h-12 w-12 opacity-10 ${
                index === 0 ? 'text-yellow-400' : 'text-slate-400'
              }`} />

              <div className="relative shrink-0">
                <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                  {getInitials(agent.name)}
                </div>
                {/* Online pulsing green indicator */}
                <span className={cn(
                  "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-slate-900",
                  agent.status === 'online' ? 'bg-emerald-500' : agent.status === 'away' ? 'bg-amber-500' : 'bg-slate-500'
                )} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wide">#{index+1} Rank</span>
                </div>
                <h4 className="text-xs font-bold text-white truncate">{agent.name}</h4>
                <p className="text-[10px] text-emerald-400 font-bold mt-0.5">${agent.closedDealsValue.toLocaleString()} closed</p>
              </div>
            </div>
          ))}
        </div>

        {/* Full Team Table */}
        <div className="border border-slate-850 rounded-lg overflow-hidden bg-slate-950/10">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/30 border-b border-slate-850 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                <th className="px-4 py-2">Agent</th>
                <th className="px-4 py-2">Conversations</th>
                <th className="px-4 py-2 text-right">Avg Response</th>
                <th className="px-4 py-2 text-right">Deals Won</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {data.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-900/30 transition-colors">
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      agent.status === 'online' ? 'bg-emerald-500 animate-pulse' : agent.status === 'away' ? 'bg-amber-500' : 'bg-slate-600'
                    )} />
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{agent.name}</div>
                      <div className="text-[9px] text-slate-500 truncate">{agent.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300 font-medium">{agent.conversationsCount}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-300">{agent.avgResponseTime} min</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-400">
                    {agent.closedDealsCount} (${Math.round(agent.closedDealsValue / 1000)}k)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
