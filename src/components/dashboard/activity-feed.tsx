"use client"

import Link from 'next/link'
import { useState, useMemo } from 'react'
import {
  MessageSquare,
  UserPlus,
  Briefcase,
  Radio,
  Zap,
  Inbox,
  CreditCard,
  Brain,
  Search,
  AlertCircle
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { ActivityItem, ActivityKind } from '@/lib/dashboard/types'
import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'

interface ActivityFeedProps {
  items: ActivityItem[] | null
  loading: boolean
}

const PAGE_SIZES = [5, 10, 20, 50] as const
type PageSize = (typeof PAGE_SIZES)[number]

interface KindTheme {
  icon: ComponentType<{ className?: string }>
  badge: string
}

const KIND_THEME: Record<ActivityKind, KindTheme> = {
  message: { icon: MessageSquare, badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  contact: { icon: UserPlus, badge: 'bg-primary/10 text-primary border-primary/20' },
  deal: { icon: Briefcase, badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  broadcast: { icon: Radio, badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  automation: { icon: Zap, badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  payment: { icon: CreditCard, badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ai: { icon: Brain, badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
}

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  const [pageSize, setPageSize] = useState<PageSize>(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'messages' | 'leads' | 'deals' | 'workflows'>('all')

  // Filter items locally based on search query and category filters
  const processedItems = useMemo(() => {
    const list = items ?? []
    
    return list.filter((item) => {
      // Search check
      const matchesSearch = item.text.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Category filter check
      let matchesFilter = true
      if (activeFilter === 'messages') {
        matchesFilter = item.kind === 'message' || item.kind === 'broadcast'
      } else if (activeFilter === 'leads') {
        matchesFilter = item.kind === 'contact'
      } else if (activeFilter === 'deals') {
        matchesFilter = item.kind === 'deal' || item.kind === 'payment'
      } else if (activeFilter === 'workflows') {
        matchesFilter = item.kind === 'automation' || item.kind === 'ai'
      }

      return matchesSearch && matchesFilter
    })
  }, [items, searchQuery, activeFilter])

  const totalLoaded = processedItems.length
  const visible = processedItems.slice(0, pageSize)
  
  const isSizeUseful = (size: PageSize, i: number) =>
    i === 0 || totalLoaded > PAGE_SIZES[i - 1]

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden flex flex-col h-full shadow-lg">
      <header className="border-b border-slate-800 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Realtime Activity Center</h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Live CRM Actions</p>
          </div>
          <Link
            href="/inbox"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Open Inbox →
          </Link>
        </div>

        {/* Search bar & filter pills */}
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search feed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950/60 py-1 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap gap-1 rounded bg-slate-950/40 p-0.5 border border-slate-850">
            {(['all', 'messages', 'leads', 'deals', 'workflows'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "rounded px-2 py-0.5 text-[9px] font-bold uppercase transition-all",
                  activeFilter === filter
                    ? "bg-slate-800 text-indigo-400"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[500px]">
        {loading || !items ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : totalLoaded === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Inbox}
              title="No matching activities"
              hint="Try clearing your search query or changing filters."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/80">
            {visible.map((it, i) => {
              const theme = KIND_THEME[it.kind] || { icon: Inbox, badge: 'bg-slate-800 text-slate-400' }
              const Icon = theme.icon
              const stripe = i % 2 === 0 ? 'bg-transparent' : 'bg-slate-950/5'
              
              // Detect failure for priority alerts styling
              const isFailure = it.text.toLowerCase().includes('fail')
              
              const row = (
                <div className={cn(
                  "flex items-center gap-3 px-5 py-3 border-l-2 transition-all",
                  isFailure ? 'border-l-red-500 bg-red-950/5' : 'border-l-transparent'
                )}>
                  <span
                    className={cn(
                      'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border',
                      theme.badge,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-xs font-medium truncate",
                        isFailure ? 'text-red-300 font-bold' : 'text-slate-200'
                      )}>
                        {it.text}
                      </span>
                      {isFailure && (
                        <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 animate-pulse" />
                      )}
                    </div>
                    <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                      {relativeTime(it.at)} • {new Date(it.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
              
              return (
                <li key={it.id} className={cn(stripe, 'transition-colors hover:bg-slate-800/40')}>
                  {it.href ? (
                    <Link href={it.href} className="block">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {totalLoaded > 0 && (
        <footer className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-xs bg-slate-900/40">
          <span className="text-slate-500 tabular-nums">
            Showing {visible.length} of {totalLoaded} results
          </span>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-slate-500">Show</span>
            {PAGE_SIZES.map((size, i) => {
              const disabled = !isSizeUseful(size, i)
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  disabled={disabled}
                  className={cn(
                    'rounded-md px-2 py-1 font-semibold tabular-nums transition-colors',
                    pageSize === size
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                    disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-400',
                  )}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </footer>
      )}
    </section>
  )
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 2_592_000) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}
