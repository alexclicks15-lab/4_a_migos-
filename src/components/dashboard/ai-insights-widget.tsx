"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { AIInsightsSummary } from '@/lib/dashboard/types'
import {
  Brain,
  Sparkles,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Zap,
  HelpCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface AIInsightsWidgetProps {
  data: AIInsightsSummary | null
  loading: boolean
}

export function AIInsightsWidget({ data, loading }: AIInsightsWidgetProps) {
  const [generating, setGenerating] = useState(false)
  const [insightSummary, setInsightSummary] = useState<string | null>(null)

  const handleGenerateSummary = () => {
    setGenerating(true)
    setTimeout(() => {
      setInsightSummary(
        `AI Analysis Summary: Conversations handled by AI have increased by 14% this week with a resolution rate of 74%. alex@wacrm.com represents a high opportunity score ($4,500) due to billing inquiries. Recommendation: Set up an automated recurring checkout reminder for abandoned carts.`
      )
      setGenerating(false)
      toast.success('AI Summary updated!')
    }, 1200)
  }

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md h-[400px] flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    )
  }

  // Sentiment mapping for SVG donut
  const { positive, neutral, negative } = data.sentimentAnalysis
  const totalPct = positive + neutral + negative
  
  // Donut coordinates calculation
  const radius = 35
  const circum = 2 * Math.PI * radius
  
  const posOffset = circum - (positive / 100) * circum
  const neuOffset = circum - (neutral / 100) * circum
  const negOffset = circum - (negative / 100) * circum

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden flex flex-col h-full shadow-lg">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">AI Insights & Assistant</h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">SaaS Intelligence</p>
          </div>
        </div>
        <button
          onClick={handleGenerateSummary}
          disabled={generating}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3 text-yellow-400 animate-pulse" />
          {generating ? 'Summarizing...' : 'AI Summary'}
        </button>
      </header>

      <div className="p-5 flex-1 space-y-5 overflow-y-auto max-h-[500px]">
        {/* Assistant Alert Banner */}
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 flex items-start gap-2.5">
          <Zap className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
          <div className="text-xs text-purple-200">
            <span className="font-bold text-white">AI Copilot: </span>
            {insightSummary ? insightSummary : '12 hot leads need follow-up today. Broadcast campaign is performing 32% above average. 2 automations have logged minor errors.'}
          </div>
        </div>

        {/* AI KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-850 bg-slate-950/20 p-3">
            <div className="text-[10px] uppercase font-bold tracking-wide text-slate-500">AI Resolution Rate</div>
            <div className="mt-1 text-lg font-bold text-emerald-400">{data.aiResolutionRate}%</div>
            <div className="text-[9px] text-slate-500 mt-0.5">{data.aiHandledCount} handled automatically</div>
          </div>
          <div className="rounded-lg border border-slate-850 bg-slate-950/20 p-3">
            <div className="text-[10px] uppercase font-bold tracking-wide text-slate-500">Lead Quality Score</div>
            <div className="mt-1 text-lg font-bold text-blue-400">{data.avgLeadQualityScore}/100</div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
              <div style={{ width: `${data.avgLeadQualityScore}%` }} className="bg-blue-400 h-full rounded-full" />
            </div>
          </div>
        </div>

        {/* Sentiment Analysis and Donut */}
        <div className="flex items-center gap-6 border-y border-slate-800 py-4">
          {/* Donut SVG */}
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full rotate-270">
              {/* Neutral segment */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#64748b"
                strokeWidth="10"
              />
              {/* Positive segment */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#10b981"
                strokeWidth="10"
                strokeDasharray={circum}
                strokeDashoffset={posOffset}
                className="transition-all duration-1000"
              />
              {/* Negative segment (stacked) */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#ef4444"
                strokeWidth="10"
                strokeDasharray={circum}
                strokeDashoffset={circum - (negative / 100) * circum}
                className="transition-all duration-1000"
                style={{ transform: `rotate(${(positive / 100) * 360}deg)`, transformOrigin: '50% 50%' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-[10px] font-bold text-slate-400">Sentiment</div>
              <div className="text-xs font-bold text-white">{positive}% Pos</div>
            </div>
          </div>

          {/* Sentiment Legend */}
          <div className="flex-1 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Positive
              </span>
              <span className="font-bold text-white">{positive}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                Neutral
              </span>
              <span className="font-bold text-white">{neutral}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Negative
              </span>
              <span className="font-bold text-white">{negative}%</span>
            </div>
          </div>
        </div>

        {/* Revenue Opportunities Alerts */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-bold tracking-wide text-slate-500">Revenue Opportunity Alerts</div>
          <div className="space-y-2">
            {data.opportunityAlerts.map((opp) => (
              <div key={opp.id} className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 hover:border-slate-700 transition-colors flex items-start gap-2.5">
                <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{opp.contactName}</span>
                    <span className="font-bold text-emerald-400">${opp.dealValue} Est.</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate leading-relaxed">{opp.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Follow-ups list */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-bold tracking-wide text-slate-500">Dead Lead Recovery Suggestions</div>
          <div className="space-y-1.5">
            {data.smartFollowups.map((rec, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-slate-950/20 px-3 py-2 text-xs">
                <span className="text-slate-300 font-semibold">{rec.contactName}</span>
                <button
                  onClick={() => toast.success(`Recovery message triggered for ${rec.contactName}`)}
                  className="text-red-400 hover:text-red-300 font-bold flex items-center gap-0.5 transition-colors"
                >
                  {rec.action}
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
