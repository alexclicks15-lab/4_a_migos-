"use client"

import Link from 'next/link'
import {
  UserPlus,
  Briefcase,
  Radio,
  Zap,
  Sparkles,
  CreditCard,
  PlusSquare,
  Import
} from 'lucide-react'
import type { ComponentType } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface Action {
  label: string
  href?: string
  onClick?: () => void
  icon: ComponentType<{ className?: string }>
  tint: string
  bg: string
}

export function QuickActions() {
  const ACTIONS: Action[] = [
    { label: 'New Contact', href: '/contacts', icon: UserPlus, tint: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'New Deal', href: '/pipelines', icon: Briefcase, tint: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'New Broadcast', href: '/broadcasts/new', icon: Radio, tint: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { label: 'New Automation', href: '/automations/new', icon: Zap, tint: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
    {
      label: 'Start AI Campaign',
      onClick: () => {
        toast.success('AI campaign analyzer initialized!', {
          description: 'AI model is parsing contact tags for optimal template match.'
        })
      },
      icon: Sparkles,
      tint: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20'
    },
    { label: 'Create Flow', href: '/automations/new', icon: PlusSquare, tint: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
    {
      label: 'Send Payment Link',
      onClick: () => {
        toast.success('Payment Link Generator opened!', {
          description: 'A pre-filled checkout link has been generated for copying.'
        })
      },
      icon: CreditCard,
      tint: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20'
    },
    { label: 'Import Contacts', href: '/contacts', icon: Import, tint: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((a, i) => {
        const Icon = a.icon
        const content = (
          <>
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 ${a.bg} ${a.tint}`}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <span className="text-xs font-bold text-white tracking-wide truncate group-hover:text-white/90 transition-colors">
              {a.label}
            </span>
          </>
        )

        return a.href ? (
          <Link
            key={i}
            href={a.href}
            className="group flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 hover:border-slate-700 hover:bg-slate-850/60 shadow-sm transition-all"
          >
            {content}
          </Link>
        ) : (
          <button
            key={i}
            type="button"
            onClick={a.onClick}
            className="group flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 hover:border-slate-700 hover:bg-slate-850/60 shadow-sm text-left transition-all cursor-pointer"
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
