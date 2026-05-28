"use client"

import { useState, useMemo } from "react"
import {
  MessageSquare,
  FileText,
  Tag as TagIcon,
  UserCheck,
  PencilLine,
  Briefcase,
  Hourglass,
  GitBranch,
  Webhook,
  CircleSlash,
  Calendar,
  Brain,
  Globe,
  Image,
  LayoutList,
  ListChecks,
  Sparkles,
  TrendingUp,
  StickyNote,
  Layers,
  Pause,
  ToggleRight,
  Timer,
  Repeat,
  Percent,
  CornerDownRight,
  StopCircle,
  UserPlus,
  Bell,
  AlertTriangle,
  ShoppingCart,
  CreditCard,
  CheckCircle,
  Truck,
  Receipt,
  Search,
  X,
  Zap,
  RefreshCw,
  XCircle,
  CalendarDays,
  CalendarOff,
  Clock,
} from "lucide-react"
import type { AutomationStepType } from "@/types"
import { cn } from "@/lib/utils"

// ============================================================
// Category + metadata
// ============================================================

type ActionCategory =
  | "Message"
  | "CRM"
  | "AI"
  | "Flow Control"
  | "API / Webhook"
  | "Human Handoff"
  | "Ecommerce"
  | "Internal"
  | "Schedule"

interface ActionMeta {
  type: AutomationStepType
  label: string
  description: string
  category: ActionCategory
  icon: typeof Zap
  color: string
}

const ACTION_CATALOG: ActionMeta[] = [
  // ---- Message ----
  { type: "send_message", label: "Send Message", description: "Send a text message to the contact", category: "Message", icon: MessageSquare, color: "text-blue-400" },
  { type: "send_template", label: "Send Template", description: "Send an approved WhatsApp template message", category: "Message", icon: FileText, color: "text-blue-400" },
  { type: "send_media", label: "Send Media", description: "Send an image, video, document or audio file", category: "Message", icon: Image, color: "text-cyan-400" },
  { type: "send_buttons", label: "Send Buttons", description: "Send interactive message with reply buttons", category: "Message", icon: ListChecks, color: "text-indigo-400" },
  { type: "send_list_message", label: "Send List", description: "Send interactive list message with selectable rows", category: "Message", icon: LayoutList, color: "text-indigo-400" },
  { type: "ai_reply", label: "AI Generated Reply", description: "Generate and send a context-aware AI reply", category: "Message", icon: Sparkles, color: "text-purple-400" },

  // ---- CRM ----
  { type: "add_tag", label: "Add Tag", description: "Add a tag to the contact", category: "CRM", icon: TagIcon, color: "text-emerald-400" },
  { type: "remove_tag", label: "Remove Tag", description: "Remove a tag from the contact", category: "CRM", icon: TagIcon, color: "text-rose-400" },
  { type: "update_contact_field", label: "Update Contact", description: "Update a contact profile field", category: "CRM", icon: PencilLine, color: "text-emerald-400" },
  { type: "create_deal", label: "Create Deal", description: "Create a new deal in a pipeline", category: "CRM", icon: Briefcase, color: "text-emerald-400" },
  { type: "move_pipeline_stage", label: "Move Pipeline Stage", description: "Move a deal to a different pipeline stage", category: "CRM", icon: TrendingUp, color: "text-sky-400" },
  { type: "increase_lead_score", label: "Increase Lead Score", description: "Add points to the contact's lead score", category: "CRM", icon: TrendingUp, color: "text-amber-400" },
  { type: "add_internal_note", label: "Add Internal Note", description: "Add a private note on the contact record", category: "CRM", icon: StickyNote, color: "text-slate-400" },
  { type: "assign_conversation", label: "Assign Conversation", description: "Assign the conversation to an agent", category: "CRM", icon: UserCheck, color: "text-emerald-400" },

  // ---- AI ----
  { type: "ai_agent", label: "AI Agent", description: "Run AI agent: detect intent, extract entities, auto-reply", category: "AI", icon: Brain, color: "text-violet-400" },

  // ---- Flow Control ----
  { type: "wait", label: "Wait / Delay", description: "Pause execution for a set duration", category: "Flow Control", icon: Hourglass, color: "text-slate-400" },
  { type: "delay_until", label: "Delay Until", description: "Wait until a specific date/time or condition", category: "Flow Control", icon: Timer, color: "text-slate-400" },
  { type: "condition", label: "If / Else", description: "Branch based on a condition (tag, field, message)", category: "Flow Control", icon: GitBranch, color: "text-amber-400" },
  { type: "switch", label: "Switch", description: "Multi-path branching with multiple cases", category: "Flow Control", icon: ToggleRight, color: "text-amber-400" },
  { type: "loop", label: "Loop", description: "Repeat steps N times or until a condition is met", category: "Flow Control", icon: Repeat, color: "text-amber-400" },
  { type: "split_traffic", label: "Split Traffic (A/B)", description: "Random weighted split for A/B testing", category: "Flow Control", icon: Percent, color: "text-pink-400" },
  { type: "goto_step", label: "Go To Step", description: "Jump execution to another step in the flow", category: "Flow Control", icon: CornerDownRight, color: "text-slate-400" },
  { type: "pause_flow", label: "Pause Flow", description: "Suspend execution (can be resumed later)", category: "Flow Control", icon: Pause, color: "text-slate-400" },
  { type: "end_flow", label: "End Flow", description: "Explicitly end the automation run", category: "Flow Control", icon: StopCircle, color: "text-red-400" },

  // ---- API / Webhook ----
  { type: "send_webhook", label: "Send Webhook", description: "POST data to an external URL", category: "API / Webhook", icon: Webhook, color: "text-violet-400" },
  { type: "http_request", label: "HTTP Request", description: "Make a configurable HTTP request with retry", category: "API / Webhook", icon: Globe, color: "text-violet-400" },

  // ---- Human Handoff ----
  { type: "assign_human_agent", label: "Assign Human Agent", description: "Assign to a human and pause AI responses", category: "Human Handoff", icon: UserPlus, color: "text-amber-400" },
  { type: "notify_team", label: "Notify Team", description: "Send an internal notification to the team", category: "Human Handoff", icon: Bell, color: "text-amber-400" },
  { type: "escalate_priority", label: "Escalate Priority", description: "Mark the conversation as urgent/critical", category: "Human Handoff", icon: AlertTriangle, color: "text-red-400" },

  // ---- Ecommerce ----
  { type: "create_order", label: "Create Order", description: "Create a new order for the contact", category: "Ecommerce", icon: ShoppingCart, color: "text-orange-400" },
  { type: "send_payment_link", label: "Send Payment Link", description: "Generate and send a payment link", category: "Ecommerce", icon: CreditCard, color: "text-orange-400" },
  { type: "verify_payment", label: "Verify Payment", description: "Check payment status for an order", category: "Ecommerce", icon: CheckCircle, color: "text-emerald-400" },
  { type: "track_shipment", label: "Track Shipment", description: "Check and send shipping/delivery status", category: "Ecommerce", icon: Truck, color: "text-sky-400" },
  { type: "generate_invoice", label: "Generate Invoice", description: "Generate and send an invoice document", category: "Ecommerce", icon: Receipt, color: "text-orange-400" },

  // ---- Internal ----
  { type: "trigger_automation", label: "Trigger Automation", description: "Fire another automation flow", category: "Internal", icon: Layers, color: "text-teal-400" },
  { type: "close_conversation", label: "Close Conversation", description: "Close the current conversation", category: "Internal", icon: CircleSlash, color: "text-slate-400" },
  { type: "google_calendar_create_event", label: "Create Calendar Event", description: "Create a Google Calendar event", category: "Internal", icon: Calendar, color: "text-red-400" },
  // ---- Schedule / Appointments ----
  { type: "create_appointment", label: "Create Appointment", description: "Book a slot for a service in the CRM", category: "Schedule", icon: Calendar, color: "text-emerald-400" },
  { type: "generate_token", label: "Generate Token", description: "Generate daily reset sequential token number", category: "Schedule", icon: Layers, color: "text-indigo-400" },
  { type: "check_availability", label: "Check Availability", description: "Check free slot times for a specific date", category: "Schedule", icon: Calendar, color: "text-cyan-400" },
  { type: "send_reminder", label: "Send Reminder", description: "Send automated WhatsApp appointment reminders", category: "Schedule", icon: Clock, color: "text-slate-400" },
  { type: "reschedule_appointment", label: "Reschedule Appointment", description: "Move booking slot to a new date and time", category: "Schedule", icon: RefreshCw, color: "text-blue-400" },
  { type: "cancel_booking", label: "Cancel Booking", description: "Cancel appointment slot and notify integrations", category: "Schedule", icon: XCircle, color: "text-red-400" },
  { type: "assign_agent", label: "Assign Agent", description: "Assign specific agent/staff to the appointment", category: "Schedule", icon: UserCheck, color: "text-amber-400" },
  { type: "add_calendar_event", label: "Add Calendar Event", description: "Create appointment sync entry in GCal/Outlook", category: "Schedule", icon: Calendar, color: "text-red-400" },
]

const CATEGORY_ORDER: ActionCategory[] = [
  "Message",
  "CRM",
  "AI",
  "Flow Control",
  "API / Webhook",
  "Human Handoff",
  "Ecommerce",
  "Internal",
  "Schedule",
]

const CATEGORY_COLORS: Record<ActionCategory, string> = {
  "Message": "bg-blue-500/10 text-blue-300 border-blue-500/20",
  "CRM": "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  "AI": "bg-violet-500/10 text-violet-300 border-violet-500/20",
  "Flow Control": "bg-amber-500/10 text-amber-300 border-amber-500/20",
  "API / Webhook": "bg-purple-500/10 text-purple-300 border-purple-500/20",
  "Human Handoff": "bg-orange-500/10 text-orange-300 border-orange-500/20",
  "Ecommerce": "bg-orange-500/10 text-orange-300 border-orange-500/20",
  "Internal": "bg-teal-500/10 text-teal-300 border-teal-500/20",
  "Schedule": "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
}

// ============================================================
// Component
// ============================================================

interface ActionPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (type: AutomationStepType) => void
}

export function ActionPickerModal({ open, onClose, onSelect }: ActionPickerModalProps) {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory | null>(null)

  const filtered = useMemo(() => {
    let items = ACTION_CATALOG
    if (selectedCategory) {
      items = items.filter((a) => a.category === selectedCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (a) =>
          a.label.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      )
    }
    return items
  }, [search, selectedCategory])

  const grouped = useMemo(() => {
    const map = new Map<ActionCategory, ActionMeta[]>()
    for (const item of filtered) {
      const arr = map.get(item.category) ?? []
      arr.push(item)
      map.set(item.category, arr)
    }
    return CATEGORY_ORDER
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, actions: map.get(c)! }))
  }, [filtered])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="flex-1 text-base font-semibold text-white">Add Action</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-slate-800 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actions…"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              autoFocus
            />
          </div>

          {/* Category filter chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                !selectedCategory
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-300"
              )}
            >
              All
            </button>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                  selectedCategory === cat
                    ? CATEGORY_COLORS[cat]
                    : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Action list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {grouped.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No actions match your search.
            </div>
          ) : (
            grouped.map(({ category, actions }) => (
              <div key={category} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {category}
                </h3>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {actions.map((action) => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.type}
                        type="button"
                        onClick={() => {
                          onSelect(action.type)
                          onClose()
                          setSearch("")
                          setSelectedCategory(null)
                        }}
                        className="group flex items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-slate-700 hover:bg-slate-800/70"
                      >
                        <div className={cn("mt-0.5 shrink-0", action.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white group-hover:text-primary">
                            {action.label}
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {action.description}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-5 py-3">
          <p className="text-xs text-slate-500">
            {ACTION_CATALOG.length} actions available · {filtered.length} shown
          </p>
        </div>
      </div>
    </div>
  )
}

// Export for use in automation builder
export { ACTION_CATALOG, type ActionMeta, type ActionCategory }
