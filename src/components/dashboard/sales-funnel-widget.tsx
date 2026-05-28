"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Filter, ChevronRight, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FunnelStage {
  name: string
  count: number
  value: number
  pct: number
}

interface SalesFunnelWidgetProps {
  dealsCount: number
  dealsValue: number
}

export function SalesFunnelWidget({ dealsCount, dealsValue }: SalesFunnelWidgetProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Derive funnel numbers logically from open deals count & value
  const leadsCount = Math.round(dealsCount * 3.5) || 45
  const leadsValue = Math.round(dealsValue * 2.8) || 98000

  const contactedCount = Math.round(leadsCount * 0.65) || 29
  const contactedValue = Math.round(leadsValue * 0.62) || 61000

  const qualifiedCount = Math.round(contactedCount * 0.5) || 14
  const qualifiedValue = Math.round(contactedValue * 0.52) || 32000

  const wonCount = Math.round(qualifiedCount * 0.4) || 5
  const wonValue = Math.round(dealsValue) || 12000

  const stages: FunnelStage[] = [
    { name: 'Leads / Inbox', count: leadsCount, value: leadsValue, pct: 100 },
    { name: 'Contacted', count: contactedCount, value: contactedValue, pct: 65 },
    { name: 'Qualified', count: qualifiedCount, value: qualifiedValue, pct: 32 },
    { name: 'Won (Closed)', count: wonCount, value: wonValue, pct: 12 },
  ]

  // Funnel polygon paths for SVG viewport 300x200
  // Centered paths narrowing at each step
  const funnelPaths = [
    '30,10 270,10 250,45 50,45',   // Stage 1
    '50,55 250,55 230,90 70,90',   // Stage 2
    '70,100 230,100 210,135 90,135', // Stage 3
    '90,145 210,145 190,180 110,180', // Stage 4
  ]

  const gradients = [
    { id: 'grad-blue', from: '#3b82f6', to: '#1d4ed8' },
    { id: 'grad-violet', from: '#7c3aed', to: '#5b21b6' },
    { id: 'grad-fuchsia', from: '#d946ef', to: '#9d174d' },
    { id: 'grad-emerald', from: '#10b981', to: '#047857' },
  ]

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden flex flex-col h-full shadow-lg">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">Sales Conversion Funnel</h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Pipeline Velocity</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/10">
          <TrendingUp className="h-3 w-3" />
          <span>12.4% Conv</span>
        </div>
      </header>

      <div className="p-5 flex-1 flex flex-col md:flex-row gap-6 items-center justify-center">
        {/* SVG Funnel Visualizer */}
        <div className="relative w-full max-w-[240px] shrink-0">
          <svg viewBox="0 0 300 200" className="w-full h-auto" role="img" aria-label="Pipeline conversion funnel">
            <defs>
              {gradients.map((g) => (
                <linearGradient key={g.id} id={g.id} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={g.from} />
                  <stop offset="100%" stopColor={g.to} />
                </linearGradient>
              ))}
            </defs>

            {funnelPaths.map((path, idx) => {
              const active = hoveredIdx === idx || hoveredIdx === null
              return (
                <motion.polygon
                  key={idx}
                  points={path}
                  fill={`url(#${gradients[idx].id})`}
                  opacity={active ? 1 : 0.4}
                  stroke="#0f172a"
                  strokeWidth={2}
                  whileHover={{ scale: 1.02 }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer transition-all duration-300"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: idx * 0.1, type: 'spring', stiffness: 100 }}
                />
              )
            })}
          </svg>
        </div>

        {/* Funnel Text Legends */}
        <div className="flex-1 w-full space-y-3.5">
          {stages.map((s, idx) => {
            const active = hoveredIdx === idx
            return (
              <div
                key={s.name}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={cn(
                  "p-2.5 rounded-lg border transition-all flex items-center justify-between",
                  active
                    ? "border-slate-700 bg-slate-800/80 shadow-md scale-102"
                    : "border-transparent bg-slate-900/10 hover:bg-slate-800/30"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Status Indicator circle with gradient color */}
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: gradients[idx].from }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{s.name}</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {s.count} deals • ${s.value.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-slate-200">{s.pct}%</div>
                  {idx > 0 && (
                    <div className="text-[9px] text-slate-500 mt-0.5 flex items-center gap-0.5 justify-end">
                      {Math.round((s.count / stages[idx - 1].count) * 100)}%
                      <ChevronRight className="h-2 w-2" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
