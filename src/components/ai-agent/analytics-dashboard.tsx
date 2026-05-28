"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, TrendingUp, UserCheck, ShieldAlert, Cpu, Timer, BarChart3, PieChart } from 'lucide-react'

export function AIAnalyticsDashboard() {
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('7d')

  // Mock analytics based on date ranges
  const data = {
    '7d': {
      accuracy: 94.6,
      resolution: 78.4,
      handoffRate: 14.2,
      latency: 480,
      totalResponses: 1542,
      aiRevenue: 48900,
      accuracyPoints: [91, 92, 95, 93, 96, 94, 95],
      latencyPoints: [580, 520, 490, 460, 430, 410, 480],
      intents: [
        { name: 'pricing_inquiry', count: 482, percentage: 31 },
        { name: 'appointment_booking', count: 324, percentage: 21 },
        { name: 'product_interest', count: 278, percentage: 18 },
        { name: 'support_request', count: 185, percentage: 12 },
        { name: 'human_support', count: 124, percentage: 8 },
        { name: 'complaint', count: 75, percentage: 5 },
        { name: 'other', count: 74, percentage: 5 }
      ]
    },
    '30d': {
      accuracy: 93.8,
      resolution: 76.1,
      handoffRate: 15.8,
      latency: 510,
      totalResponses: 6280,
      aiRevenue: 194500,
      accuracyPoints: [90, 92, 91, 93, 94, 92, 95, 94, 93, 94, 95, 94],
      latencyPoints: [620, 590, 580, 560, 540, 520, 500, 490, 510, 480, 470, 510],
      intents: [
        { name: 'pricing_inquiry', count: 1980, percentage: 32 },
        { name: 'appointment_booking', count: 1320, percentage: 21 },
        { name: 'product_interest', count: 1110, percentage: 18 },
        { name: 'support_request', count: 780, percentage: 12 },
        { name: 'human_support', count: 502, percentage: 8 },
        { name: 'complaint', count: 318, percentage: 5 },
        { name: 'other', count: 270, percentage: 4 }
      ]
    },
    'all': {
      accuracy: 94.1,
      resolution: 77.2,
      handoffRate: 15.1,
      latency: 495,
      totalResponses: 24500,
      aiRevenue: 785000,
      accuracyPoints: [89, 91, 93, 92, 94, 93, 95, 94],
      latencyPoints: [650, 610, 580, 540, 510, 490, 480, 495],
      intents: [
        { name: 'pricing_inquiry', count: 7840, percentage: 32 },
        { name: 'appointment_booking', count: 5145, percentage: 21 },
        { name: 'product_interest', count: 4410, percentage: 18 },
        { name: 'support_request', count: 2940, percentage: 12 },
        { name: 'human_support', count: 1960, percentage: 8 },
        { name: 'complaint', count: 1225, percentage: 5 },
        { name: 'other', count: 980, percentage: 4 }
      ]
    }
  }[range]

  return (
    <div className="space-y-6">
      {/* Date filter row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">AI Operations Telemetry</h2>
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
          {(['7d', '30d', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                range === r ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'Lifetime'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'AI Response Accuracy', value: `${data.accuracy}%`, desc: 'Intent confidence threshold', icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { title: 'AI Resolution Rate', value: `${data.resolution}%`, desc: 'Queries answered without handoff', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { title: 'Human Handoff Rate', value: `${data.handoffRate}%`, desc: 'Complex escalations / requests', icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { title: 'Avg Response Latency', value: `${data.latency}ms`, desc: 'Model processing + dispatch speed', icon: Timer, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        ].map((kpi, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">{kpi.title}</span>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${kpi.bg} ${kpi.color}`}>
                <kpi.icon className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-white tracking-tight">{kpi.value}</h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{kpi.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* SVG Accuracy Trend */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Accuracy & Confidence Trend
            </h3>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Stable</span>
          </div>

          <div className="h-56 w-full flex items-end">
            <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="50" x2="500" y2="50" stroke="#1e293b" strokeDasharray="4 4" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="#1e293b" strokeDasharray="4 4" />
              <line x1="0" y1="150" x2="500" y2="150" stroke="#1e293b" strokeDasharray="4 4" />

              {/* Area path */}
              <path
                d={`M 0 200 ${data.accuracyPoints.map((p, idx) => {
                  const x = (idx / (data.accuracyPoints.length - 1)) * 500
                  const y = 200 - ((p - 80) / 20) * 150
                  return `L ${x} ${y}`
                }).join(' ')} L 500 200 Z`}
                fill="url(#accGrad)"
              />

              {/* Line path */}
              <path
                d={data.accuracyPoints.map((p, idx) => {
                  const x = (idx / (data.accuracyPoints.length - 1)) * 500
                  const y = 200 - ((p - 80) / 20) * 150
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                }).join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
              />

              {/* Data Dots */}
              {data.accuracyPoints.map((p, idx) => {
                const x = (idx / (data.accuracyPoints.length - 1)) * 500
                const y = 200 - ((p - 80) / 20) * 150
                return <circle key={idx} cx={x} cy={y} r="3.5" fill="#10b981" className="hover:scale-150 transition-transform" />
              })}
            </svg>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
            <span>START OF PERIOD</span>
            <span>MIDWAY</span>
            <span>CURRENT</span>
          </div>
        </div>

        {/* Intent Distribution Bars */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-purple-400" />
            Intent Distribution
          </h3>

          <div className="space-y-4">
            {data.intents.slice(0, 5).map((intent, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-300 font-semibold">{intent.name}</span>
                  <span className="text-slate-500 font-bold">{intent.count} ({intent.percentage}%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${intent.percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-purple-500 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Latency Performance SVG */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
            <Timer className="h-4 w-4 text-blue-400" />
            Latency Analytics
          </h3>

          <div className="h-44 w-full flex items-end">
            <svg className="w-full h-full animate-fade-in" viewBox="0 0 300 120" preserveAspectRatio="none">
              {/* Bars */}
              {data.latencyPoints.map((lat, idx) => {
                const barWidth = 20
                const gap = 15
                const x = idx * (barWidth + gap) + 20
                const maxVal = 700
                const pct = lat / maxVal
                const height = pct * 100
                const y = 120 - height
                return (
                  <g key={idx}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      rx="3"
                      fill="#3b82f6"
                      className="opacity-80 hover:opacity-100 transition-opacity"
                    />
                    <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fill="#94a3b8" fontSize="6px" fontFamily="monospace">
                      {lat}ms
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="text-[10px] text-slate-500 text-center mt-3">Daily Average Model Response + Network Dispatch Time</div>
        </div>

        {/* AI Conversion & Business Impact */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <PieChart className="h-4 w-4 text-pink-400" />
              AI Business Performance
            </h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="border border-slate-800/80 bg-slate-950/20 p-3 rounded-lg">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">AI Generated Deals</span>
                <h4 className="text-xl font-extrabold text-white mt-1">{(data.totalResponses * 0.05).toFixed(0)}</h4>
              </div>
              <div className="border border-slate-800/80 bg-slate-950/20 p-3 rounded-lg">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">AI Impact Revenue</span>
                <h4 className="text-xl font-extrabold text-emerald-400 mt-1">${data.aiRevenue.toLocaleString()}</h4>
              </div>
              <div className="border border-slate-800/80 bg-slate-950/20 p-3 rounded-lg">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Avg Lead Score Gain</span>
                <h4 className="text-xl font-extrabold text-purple-400 mt-1">+32 points</h4>
              </div>
              <div className="border border-slate-800/80 bg-slate-950/20 p-3 rounded-lg">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Lead Qualification Rate</span>
                <h4 className="text-xl font-extrabold text-white mt-1">68.2%</h4>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800/80 mt-4 pt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Auto-qualified WhatsApp leads:</span>
            <span className="font-extrabold text-white">82%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
