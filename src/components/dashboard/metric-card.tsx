"use client"

import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface MetricCardProps {
  title: string
  /** Pre-formatted value for display (e.g. "42" or "$1,250"). */
  value: string
  icon: ComponentType<{ className?: string }>
  /**
   * Delta-mode secondary row: arrow + delta text. Omit when the metric
   * doesn't have a sensible comparison (e.g. total pipeline value).
   */
  delta?: {
    /** Positive / negative / zero drives arrow + color. */
    sign: number
    /** Pre-formatted delta, e.g. "+3 vs yesterday". */
    label: string
  }
  /** Used instead of `delta` when the metric has a static subtitle. */
  subtitle?: string
}

export function MetricCard({ title, value, icon: Icon, delta, subtitle }: MetricCardProps) {
  // Select color scheme based on title for a premium custom feel
  const theme = title.toLowerCase().includes('revenue') || title.toLowerCase().includes('deal')
    ? { border: 'hover:border-emerald-500/30', text: 'text-emerald-400', bg: 'bg-emerald-500/10' }
    : title.toLowerCase().includes('failed') || title.toLowerCase().includes('missed')
    ? { border: 'hover:border-red-500/30', text: 'text-red-400', bg: 'bg-red-500/10' }
    : title.toLowerCase().includes('active') || title.toLowerCase().includes('conversation')
    ? { border: 'hover:border-blue-500/30', text: 'text-blue-400', bg: 'bg-blue-500/10' }
    : { border: 'hover:border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-500/10' }

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      className={cn(
        "rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md transition-colors shadow-lg hover:shadow-[0_0_20px_rgba(30,41,59,0.3)]",
        theme.border
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/50 shadow-inner", theme.bg, theme.text)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-[30px] leading-none font-bold tracking-tight tabular-nums text-white">
        {value}
      </p>
      {delta ? <DeltaRow sign={delta.sign} label={delta.label} /> : subtitle ? (
        <p className="mt-2 text-xs font-medium text-slate-500">{subtitle}</p>
      ) : null}
    </motion.div>
  )
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const tone =
    sign > 0
      ? 'text-emerald-400 bg-emerald-500/5'
      : sign < 0
      ? 'text-red-400 bg-red-500/5'
      : 'text-slate-500 bg-slate-800/20'
  
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  
  return (
    <div className={cn('mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border border-transparent', tone)}>
      <Arrow className="h-3.5 w-3.5" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  )
}
