// Shared result shapes the dashboard components consume. Centralised
// here so each component stays thin and the page-level loader wires
// them up without type gymnastics.

export interface MetricDelta {
  current: number
  previous: number
}

export interface MetricsBundle {
  activeConversations: MetricDelta
  newContactsToday: MetricDelta
  openDealsValue: number
  openDealsCount: number
  messagesSentToday: MetricDelta
  messagesDeliveredToday: MetricDelta
  messagesFailedToday: MetricDelta
  readRate: number
  replyRate: number
  averageResolutionTime: number // in minutes
  customerSatisfaction: number // 0-100%
  templateApprovals: { name: string; status: 'Approved' | 'Pending' | 'Rejected' }[]
}

export interface ConversationsSeriesPoint {
  day: string // YYYY-MM-DD local
  incoming: number
  outgoing: number
  revenue?: number
}

export interface PipelineStageSlice {
  id: string
  name: string
  color: string
  dealCount: number
  totalValue: number
}

export interface PipelineDonutData {
  stages: PipelineStageSlice[]
  totalValue: number
}

export interface ResponseTimeBucket {
  /** 0 = Mon … 6 = Sun (Monday-first). */
  dow: number
  /** Average first-response time in minutes. Null means no samples. */
  avgMinutes: number | null
  samples: number
}

export interface ResponseTimeSummary {
  buckets: ResponseTimeBucket[]
  thisWeekAvg: number | null
  lastWeekAvg: number | null
}

export type ActivityKind =
  | 'message'
  | 'deal'
  | 'broadcast'
  | 'automation'
  | 'contact'
  | 'payment'
  | 'ai'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  /** Primary line of text rendered in the feed. Pre-formatted. */
  text: string
  /** ISO timestamp the item happened at, drives relative-time + sort. */
  at: string
  /** Optional deep-link for the whole row (not all items have a target). */
  href?: string
}

// Upgraded SaaS Dashboards metrics

export interface FunnelStage {
  name: string
  value: number
  percentage: number
}

export interface AutomationPerformanceSummary {
  totalRuns: number
  successCount: number
  failedCount: number
  completionRate: number // percentage
  conversionRate: number // percentage
  topFlowName: string
  dropOffPoints: { stepName: string; count: number }[]
  recentErrors: { id: string; flowName: string; errorMessage: string; at: string }[]
}

export interface AIInsightsSummary {
  aiHandledCount: number
  aiResolutionRate: number // percentage
  avgLeadQualityScore: number // 0-100
  sentimentAnalysis: {
    positive: number // percentage
    neutral: number // percentage
    negative: number // percentage
  }
  intentDistribution: { intent: string; count: number }[]
  opportunityAlerts: { id: string; contactName: string; dealValue: number; reason: string }[]
  smartFollowups: { contactName: string; action: string }[]
}

export interface AgentPerformance {
  id: string
  name: string
  email: string
  avatarUrl?: string
  avgResponseTime: number // in minutes
  conversationsCount: number
  closedDealsCount: number
  closedDealsValue: number
  missedConversations: number
  status: 'online' | 'offline' | 'away'
}

export interface BroadcastROISummary {
  averageOpenRate: number // percentage
  averageClickRate: number // percentage
  totalRevenueGenerated: number
  conversionRate: number // percentage
  audienceGrowthRate: number // percentage
  bestPerformingTemplate: string
  scheduledCount: number
}

export interface KanbanDealSummary {
  id: string
  title: string
  value: number
  contactName: string
  contactPhone: string
  stageId: string
}
export interface MiniKanbanData {
  stages: { id: string; name: string; color: string }[]
  deals: KanbanDealSummary[]
}
