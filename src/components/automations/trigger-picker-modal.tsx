"use client"

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAutomationStore } from '@/lib/automations/store'
import { TRIGGER_META } from '@/lib/automations/trigger-meta'
import type { AutomationTriggerType } from '@/types'
import {
  MessageSquare,
  Smartphone,
  Users,
  ShoppingCart,
  Clock,
  Webhook,
  Brain,
  Layers,
  Search,
  X,
  GripVertical,
  Key,
  CheckSquare,
  Image,
  Mic,
  UserPlus,
  List,
  Reply,
  UserCheck,
  UserX,
  Tag,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  AlertTriangle,
  Package,
  Calendar,
  RefreshCw,
  Cake,
  Heart,
  Code,
  Zap,
  Play,
  Trophy,
  Target,
  Activity,
  FileSpreadsheet,
  Smile,
  Eye,
  Award,
  ReplyAll,
  DollarSign,
  CheckCircle,
  Undo2,
  BellRing,
  FileText,
  Wallet,
  Frown,
  Sparkles,
  ShieldAlert,
  Globe2,
  HandMetal,
} from 'lucide-react'

const ICON_MAP: Record<string, any> = {
  MessageSquare,
  Smartphone,
  Users,
  ShoppingCart,
  Clock,
  Webhook,
  Brain,
  Layers,
  Search,
  X,
  GripVertical,
  Key,
  CheckSquare,
  Image,
  Mic,
  UserPlus,
  List,
  Reply,
  UserCheck,
  UserX,
  Tag,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  AlertTriangle,
  Package,
  Calendar,
  RefreshCw,
  Cake,
  Heart,
  Code,
  Zap,
  Play,
  Trophy,
  Target,
  Activity,
  FileSpreadsheet,
  Smile,
  Eye,
  Award,
  ReplyAll,
  DollarSign,
  CheckCircle,
  Undo2,
  BellRing,
  FileText,
  Wallet,
  Frown,
  Sparkles,
  ShieldAlert,
  Globe2,
  HandMetal,
}

const CATEGORIES = [
  { id: 'All', label: 'All Triggers', icon: Zap },
  { id: 'Message', label: 'Message Triggers', icon: MessageSquare },
  { id: 'WhatsApp', label: 'WhatsApp Triggers', icon: Smartphone },
  { id: 'CRM', label: 'CRM Triggers', icon: Users },
  { id: 'Ecommerce', label: 'Ecommerce Triggers', icon: ShoppingCart },
  { id: 'Schedule', label: 'Schedule Triggers', icon: Clock },
  { id: 'Webhook', label: 'API/Webhook Triggers', icon: Webhook },
  { id: 'AI', label: 'AI Triggers', icon: Brain },
  { id: 'Automation', label: 'Automation Triggers', icon: Layers },
]

interface TriggerPickerModalProps {
  /** 'primary' replaces the main trigger via store; 'additional' calls onSelectAdditional */
  mode?: 'primary' | 'additional'
  onSelectAdditional?: (type: AutomationTriggerType) => void
  onCloseAdditional?: () => void
}

export function TriggerPickerModal({ mode = 'primary', onSelectAdditional, onCloseAdditional }: TriggerPickerModalProps = {}) {
  const storeIsOpen = useAutomationStore((s) => s.triggerPickerOpen)
  const storeSetOpen = useAutomationStore((s) => s.setTriggerPickerOpen)
  const updateTrigger = useAutomationStore((s) => s.updateTrigger)

  // In 'additional' mode, the modal is controlled by parent props
  const isOpen = mode === 'additional' ? true : storeIsOpen
  const closeModal = mode === 'additional' ? (onCloseAdditional ?? (() => {})) : () => storeSetOpen(false)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  // Filter triggers based on search query and selected category
  const filteredTriggers = useMemo(() => {
    const list = Object.entries(TRIGGER_META).map(([type, meta]) => ({
      type: type as AutomationTriggerType,
      ...meta,
    }))

    return list.filter((t) => {
      const matchesSearch =
        t.label.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [search, selectedCategory])

  const handleSelect = (type: AutomationTriggerType) => {
    if (mode === 'additional' && onSelectAdditional) {
      onSelectAdditional(type)
    } else {
      updateTrigger(type)
      storeSetOpen(false)
    }
  }

  // Handle HTML5 drag start
  const handleDragStart = (e: React.DragEvent, type: AutomationTriggerType) => {
    e.dataTransfer.setData('text/plain', type)
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeModal}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal content box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative flex h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                {mode === 'additional' ? 'Add Additional Trigger' : 'Select Flow Trigger'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'additional'
                  ? 'Choose another trigger that can also start this automation flow.'
                  : 'Choose the event that starts this automation flow. Only one primary trigger is allowed per flow.'}
              </p>
            </div>
            <button
              onClick={closeModal}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* Search bar row */}
          <div className="border-b border-slate-800 bg-slate-900/50 px-6 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search triggers by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Main Body - Split Layout */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Categories (scrollable) */}
            <aside className="w-64 border-r border-slate-800 bg-slate-900/30 overflow-y-auto hidden md:block">
              <nav className="p-4 space-y-1">
                <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Categories</div>
                {CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon
                  const active = selectedCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all ${
                        active
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'
                      }`}
                    >
                      <CatIcon className={`h-4 w-4 ${active ? 'text-red-400' : 'text-slate-400'}`} />
                      {cat.label}
                    </button>
                  )
                })}
              </nav>
            </aside>

            {/* Triggers grid */}
            <main className="flex-1 overflow-y-auto p-6 bg-slate-950/20">
              {/* Category selector pill view for mobile/tablet */}
              <div className="flex flex-wrap gap-2 mb-4 md:hidden">
                {CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  )
                })}
              </div>

              {filteredTriggers.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="text-sm text-slate-500">No triggers match your search criteria.</p>
                  <button
                    onClick={() => {
                      setSearch('')
                      setSelectedCategory('All')
                    }}
                    className="mt-2 text-xs text-red-400 hover:underline"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredTriggers.map((t) => {
                    const TriggerIcon = ICON_MAP[t.iconName] || Zap
                    return (
                      <div
                        key={t.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t.type)}
                        className="w-full"
                      >
                        <motion.div
                          whileHover={{ scale: 1.02, y: -2 }}
                          className="group relative cursor-pointer rounded-lg border border-slate-800 bg-slate-900 p-4 transition-all hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/5"
                          onClick={() => handleSelect(t.type)}
                        >
                          {/* Drag Handle indicator on card */}
                          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-slate-600 transition-opacity">
                            <GripVertical className="h-4 w-4 cursor-grab" />
                          </div>

                          <div className="flex items-start gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${t.pillClass}`}>
                              <TriggerIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.category}</div>
                              <h3 className="truncate text-sm font-semibold text-white group-hover:text-red-400 transition-colors">
                                {t.label}
                              </h3>
                              <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                {t.description}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )
                  })}
                </div>
              )}
            </main>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
