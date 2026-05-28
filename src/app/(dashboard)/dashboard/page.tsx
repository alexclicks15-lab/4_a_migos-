"use client"

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MessageSquare,
  UserPlus,
  Send,
  SlidersHorizontal,
  RefreshCw,
  Zap,
  PhoneCall,
  Calendar,
  Layers,
  Brain,
  ShoppingCart,
  Timer,
  AlertTriangle,
  Radio,
  UserCheck,
  TrendingUp,
  CreditCard,
  Briefcase,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'

import { useDashboardStore } from '@/lib/dashboard/dashboard-store'
import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadPipelineDonut,
  loadResponseTime,
  loadAutomationPerformance,
  loadAIInsights,
  loadTeamPerformance,
  loadBroadcastROI,
  loadMiniKanban
} from '@/lib/dashboard/queries'

import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PipelineDonutData,
  ResponseTimeSummary,
  AutomationPerformanceSummary,
  AIInsightsSummary,
  AgentPerformance,
  BroadcastROISummary,
  MiniKanbanData
} from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

// Import Upgraded widgets
import { AIInsightsWidget } from '@/components/dashboard/ai-insights-widget'
import { SalesFunnelWidget } from '@/components/dashboard/sales-funnel-widget'
import { AutomationHealthWidget } from '@/components/dashboard/automation-health-widget'
import { TeamLeaderboardWidget } from '@/components/dashboard/team-leaderboard-widget'
import { BroadcastPerformanceWidget } from '@/components/dashboard/broadcast-performance-widget'
import { MiniKanbanWidget } from '@/components/dashboard/mini-kanban-widget'
import { DashboardCustomizer } from '@/components/dashboard/dashboard-customizer'

export default function DashboardPage() {
  const db = createClient()
  
  // Dashboard Zustand selectors
  const workspace = useDashboardStore((s) => s.workspace)
  const dateRange = useDashboardStore((s) => s.dateRange)
  const agentFilter = useDashboardStore((s) => s.agentFilter)
  const wabaFilter = useDashboardStore((s) => s.wabaFilter)
  const setFilter = useDashboardStore((s) => s.setFilter)
  const toggleCustomizer = useDashboardStore((s) => s.toggleCustomizer)
  const widgets = useDashboardStore((s) => s.widgets)
  const loadLayout = useDashboardStore((s) => s.loadLayout)

  // Widget visibility and size configurations
  const visibleWidgets = widgets.filter((w) => w.visible)

  // Dashboard DB Data State
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [series, setSeries] = useState<ConversationsSeriesPoint[] | null>(null)
  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null)
  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [automation, setAutomation] = useState<AutomationPerformanceSummary | null>(null)
  const [aiInsights, setAiInsights] = useState<AIInsightsSummary | null>(null)
  const [teamPerf, setTeamPerf] = useState<AgentPerformance[] | null>(null)
  const [broadcast, setBroadcast] = useState<BroadcastROISummary | null>(null)
  const [kanban, setKanban] = useState<MiniKanbanData | null>(null)

  // Loading States
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Load layout from localStorage once on client
  useEffect(() => {
    loadLayout()
  }, [loadLayout])

  const loadAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const days = dateRange === 'today' ? 1 : dateRange === '7d' ? 7 : 30
      
      const [
        metricsData,
        seriesData,
        pipelineData,
        responseTimeData,
        activityData,
        automationData,
        aiData,
        teamData,
        broadcastData,
        kanbanData
      ] = await Promise.all([
        loadMetrics(db),
        loadConversationsSeries(db, days),
        loadPipelineDonut(db),
        loadResponseTime(db),
        loadActivity(db, 50),
        loadAutomationPerformance(db),
        loadAIInsights(db),
        loadTeamPerformance(db),
        loadBroadcastROI(db),
        loadMiniKanban(db)
      ])

      setMetrics(metricsData)
      setSeries(seriesData)
      setPipeline(pipelineData)
      setResponseTime(responseTimeData)
      setActivity(activityData)
      setAutomation(automationData)
      setAiInsights(aiData)
      setTeamPerf(teamData)
      setBroadcast(broadcastData)
      setKanban(kanbanData)
    } catch (err) {
      console.error('[dashboard] failed to load dashboard stats:', err)
      toast.error('Failed to load dashboard metrics.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [db, dateRange])

  // Initial and DateRange change fetch trigger
  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Simulated WebSocket Live Refresh updates
  useEffect(() => {
    const timer = setInterval(() => {
      // Periodic updates simulating Socket.io live channel activity
      const mockEvents = [
        {
          kind: 'message' as const,
          text: 'Incoming message from Liam Neeson: "Is the onboarding completed?"',
          toastMsg: 'New message received',
          href: '/inbox'
        },
        {
          kind: 'payment' as const,
          text: 'Payment received: $450 from Alex Rivera',
          toastMsg: 'Payment completed successfully!',
          href: '/pipelines'
        },
        {
          kind: 'ai' as const,
          text: 'AI Assistant classified intent: "Pricing Inquiry" for guest contact',
          toastMsg: 'AI copilot classification trigger'
        },
        {
          kind: 'deal' as const,
          text: 'Deal "Retainer Upgrade" moved to stage: Won',
          toastMsg: 'Pipeline stage updated: Won!',
          href: '/pipelines'
        }
      ]

      const chosenEvent = mockEvents[Math.floor(Math.random() * mockEvents.length)]
      const timestamp = new Date().toISOString()

      // Enqueue to Activity
      setActivity((prev) => {
        if (!prev) return null
        const newEvent: ActivityItem = {
          id: `sim-${Date.now()}`,
          kind: chosenEvent.kind,
          text: chosenEvent.text,
          at: timestamp,
          href: chosenEvent.href
        }
        return [newEvent, ...prev].slice(0, 50)
      })

      // Update counters slightly to simulate live KPI refresh
      setMetrics((prev) => {
        if (!prev) return null
        return {
          ...prev,
          messagesSentToday: {
            ...prev.messagesSentToday,
            current: prev.messagesSentToday.current + 1
          },
          activeConversations: {
            ...prev.activeConversations,
            current: prev.activeConversations.current + (Math.random() > 0.6 ? 1 : 0)
          }
        }
      })

      // Toast notification trigger
      toast(chosenEvent.toastMsg, {
        description: chosenEvent.text,
        action: chosenEvent.href ? {
          label: 'View',
          onClick: () => {} // handled by next/navigation in full code
        } : undefined
      })
    }, 15000)

    return () => clearInterval(timer)
  }, [])

  // Widget Renderer
  const renderWidget = (id: string) => {
    switch (id) {
      case 'ai-assistant':
        return (
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-5 flex flex-col md:flex-row gap-5 items-center justify-between shadow-lg">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  AI Business Copilot
                  <span className="text-[9px] font-bold tracking-wider text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/10">Active</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                  "Sarah Jenkins (AI Host) resolution rate is stable at 74% this week. Broadcast campaign is performing 32% above average. 2 automations have logged minor errors."
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                loadAllData(true)
                toast.success('AI insights synchronized!')
              }}
              className="w-full md:w-auto shrink-0 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Sync AI Analytics
            </button>
          </div>
        )

      case 'whatsapp-kpis':
        return (
          <div className="space-y-4">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Live WhatsApp Operations</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {!metrics ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              ) : (
                <>
                  <MetricCard
                    title="Active Conversations"
                    value={metrics.activeConversations.current.toLocaleString()}
                    icon={MessageSquare}
                    delta={{
                      sign: metrics.activeConversations.previous,
                      label: deltaLabel(metrics.activeConversations.previous, 'new today vs yesterday'),
                    }}
                  />
                  <MetricCard
                    title="Messages Sent Today"
                    value={metrics.messagesSentToday.current.toLocaleString()}
                    icon={Send}
                    delta={{
                      sign:
                        metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                      label: deltaLabel(
                        metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                        'vs yesterday',
                      ),
                    }}
                  />
                  <MetricCard
                    title="Read Rate"
                    value={`${metrics.readRate}%`}
                    icon={UserCheck}
                    subtitle="Message open statistics"
                  />
                  <MetricCard
                    title="Reply Rate"
                    value={`${metrics.replyRate}%`}
                    icon={Timer}
                    subtitle="Avg resolution: 12.5m"
                  />
                </>
              )}
            </div>
          </div>
        )

      case 'revenue-sales':
        return (
          <div className="h-full">
            <ConversationsChart
              series={{ 7: series, 30: series, 90: series } as any}
              loading={!series}
              range={dateRange === 'today' ? 7 : dateRange === '7d' ? 7 : 30 as any}
              onRangeChange={(r) => setFilter('dateRange', r === 7 ? '7d' : '30d')}
            />
          </div>
        )

      case 'sales-funnel':
        return (
          <div className="h-full">
            <SalesFunnelWidget
              dealsCount={metrics?.openDealsCount || 12}
              dealsValue={metrics?.openDealsValue || 45000}
            />
          </div>
        )

      case 'automation-perf':
        return (
          <div className="h-full">
            <AutomationHealthWidget data={automation} loading={!automation} />
          </div>
        )

      case 'ai-insights':
        return (
          <div className="h-full">
            <AIInsightsWidget data={aiInsights} loading={!aiInsights} />
          </div>
        )

      case 'team-perf':
        return (
          <div className="h-full">
            <TeamLeaderboardWidget data={teamPerf} loading={!teamPerf} />
          </div>
        )

      case 'broadcast-roi':
        return (
          <div className="h-full">
            <BroadcastPerformanceWidget data={broadcast} loading={!broadcast} />
          </div>
        )

      case 'mini-kanban':
        return (
          <div className="h-full">
            <MiniKanbanWidget data={kanban} loading={!kanban} />
          </div>
        )

      case 'activity-feed':
        return (
          <div className="h-full">
            <ActivityFeed items={activity} loading={!activity} />
          </div>
        )

      case 'quick-actions':
        return (
          <div className="space-y-4">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Smart Quick Actions</div>
            <QuickActions />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Filter Controls Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">WA-CRM Analytics</h1>
            <button
              onClick={() => loadAllData(true)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">SaaS operations dashboard for WhatsApp automation, pipelines, and AI intelligence.</p>
        </div>

        {/* Global Selectors */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Workspace Selector */}
          <select
            value={workspace}
            onChange={(e) => setFilter('workspace', e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white focus:outline-none"
          >
            <option value="Default Workspace">Default Workspace</option>
            <option value="Enterprise Workspace">Enterprise Workspace</option>
          </select>

          {/* Date Selector */}
          <select
            value={dateRange}
            onChange={(e) => setFilter('dateRange', e.target.value as any)}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white focus:outline-none"
          >
            <option value="today">Today</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
          </select>

          {/* Agent Filter */}
          <select
            value={agentFilter}
            onChange={(e) => setFilter('agentFilter', e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white focus:outline-none"
          >
            <option value="All">All Agents</option>
            <option value="mock-agent-1">Sarah Jenkins (AI)</option>
            <option value="mock-agent-2">James C.</option>
          </select>

          {/* Customize Layout button */}
          <button
            onClick={() => toggleCustomizer(true)}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1 font-semibold"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
            Customize Layout
          </button>
        </div>
      </div>

      {/* Grid of Dynamic Draggable/Resizable Widgets */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="col-span-1 md:col-span-2 h-[260px]">
              <SkeletonCard />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {visibleWidgets.map((w) => {
            const sizeClass =
              w.size === 'small'
                ? 'col-span-1'
                : w.size === 'medium'
                ? 'col-span-1 md:col-span-2'
                : 'col-span-1 md:col-span-3'

            return (
              <div key={w.id} className={sizeClass}>
                {renderWidget(w.id)}
              </div>
            )
          })}
        </div>
      )}

      {/* Layout customizer drawer */}
      <DashboardCustomizer />
    </div>
  )
}

// ------------------------------------------------------------

function deltaLabel(delta: number, suffix: string): string {
  if (delta === 0) return `No change ${suffix}`
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${suffix}`
}
