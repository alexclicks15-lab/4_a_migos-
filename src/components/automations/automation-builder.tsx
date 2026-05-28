"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  Trash2,
  GripVertical,
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
  Zap,
  Loader2,
  ArrowDown,
  ArrowUp,
  Calendar,
  TrendingUp,
  Image,
  Mic,
  Reply,
  Code,
  Smartphone,
  ShoppingCart,
  Clock,
  Brain,
  Layers,
  RefreshCw,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import type {
  AutomationStepType,
  AutomationTriggerType,
  KeywordMatchTriggerConfig,
} from "@/types"
import { cn } from "@/lib/utils"

import {
  useAutomationStore,
  ParentScope,
  StepPath,
  generateCid,
  blankConfig,
  BuilderInitial,
  BuilderStep,
} from "@/lib/automations/store"

export type { BuilderInitial, BuilderStep } from "@/lib/automations/store"

import { TRIGGER_META } from "@/lib/automations/trigger-meta"
import { TriggerPickerModal } from "./trigger-picker-modal"
import { TriggerAnalyticsPanel } from "./trigger-analytics-panel"
import { ActionPickerModal } from "./action-picker-modal"

// ------------------------------------------------------------
// Step metadata — one source of truth for icon + label + border color
// ------------------------------------------------------------

interface StepMeta {
  label: string
  icon: typeof Zap
  /** Left-border accent color per spec. */
  border: string
}

const STEP_META: Record<AutomationStepType, StepMeta> = {
  send_message: { label: "Send Message", icon: MessageSquare, border: "border-l-primary" },
  send_template: { label: "Send Template", icon: FileText, border: "border-l-primary" },
  add_tag: { label: "Add Tag", icon: TagIcon, border: "border-l-primary" },
  remove_tag: { label: "Remove Tag", icon: TagIcon, border: "border-l-primary" },
  assign_conversation: { label: "Assign Conversation", icon: UserCheck, border: "border-l-primary" },
  update_contact_field: { label: "Update Contact Field", icon: PencilLine, border: "border-l-primary" },
  create_deal: { label: "Create Deal", icon: Briefcase, border: "border-l-primary" },
  wait: { label: "Wait", icon: Hourglass, border: "border-l-slate-500" },
  condition: { label: "Condition (If/Else)", icon: GitBranch, border: "border-l-amber-500" },
  send_webhook: { label: "Send Webhook", icon: Webhook, border: "border-l-primary" },
  close_conversation: { label: "Close Conversation", icon: CircleSlash, border: "border-l-primary" },
  google_calendar_create_event: { label: "Create Calendar Event", icon: Calendar, border: "border-l-red-500" },
  // Phase 1: Advanced Actions
  ai_agent: { label: "AI Agent", icon: Brain, border: "border-l-violet-500" },
  ai_reply: { label: "AI Generated Reply", icon: Brain, border: "border-l-violet-500" },
  http_request: { label: "HTTP Request", icon: Webhook, border: "border-l-purple-500" },
  send_media: { label: "Send Media", icon: Image, border: "border-l-cyan-500" },
  send_buttons: { label: "Send Buttons", icon: Smartphone, border: "border-l-indigo-500" },
  send_list_message: { label: "Send List", icon: Layers, border: "border-l-indigo-500" },
  increase_lead_score: { label: "Increase Lead Score", icon: TrendingUp, border: "border-l-amber-500" },
  add_internal_note: { label: "Add Internal Note", icon: FileText, border: "border-l-slate-500" },
  move_pipeline_stage: { label: "Move Pipeline Stage", icon: TrendingUp, border: "border-l-sky-500" },
  trigger_automation: { label: "Trigger Automation", icon: Layers, border: "border-l-teal-500" },
  pause_flow: { label: "Pause Flow", icon: Hourglass, border: "border-l-slate-500" },
  end_flow: { label: "End Flow", icon: CircleSlash, border: "border-l-red-500" },
  switch: { label: "Switch", icon: GitBranch, border: "border-l-amber-500" },
  delay_until: { label: "Delay Until", icon: Clock, border: "border-l-slate-500" },
  loop: { label: "Loop", icon: Layers, border: "border-l-amber-500" },
  split_traffic: { label: "Split Traffic (A/B)", icon: GitBranch, border: "border-l-pink-500" },
  goto_step: { label: "Go To Step", icon: Layers, border: "border-l-slate-500" },
  assign_human_agent: { label: "Assign Human Agent", icon: UserCheck, border: "border-l-amber-500" },
  notify_team: { label: "Notify Team", icon: Zap, border: "border-l-amber-500" },
  escalate_priority: { label: "Escalate Priority", icon: Zap, border: "border-l-red-500" },
  create_order: { label: "Create Order", icon: ShoppingCart, border: "border-l-orange-500" },
  send_payment_link: { label: "Send Payment Link", icon: Briefcase, border: "border-l-orange-500" },
  verify_payment: { label: "Verify Payment", icon: Zap, border: "border-l-emerald-500" },
  track_shipment: { label: "Track Shipment", icon: Layers, border: "border-l-sky-500" },
  generate_invoice: { label: "Generate Invoice", icon: FileText, border: "border-l-orange-500" },
  // Appointments
  create_appointment: { label: "Create Appointment", icon: Calendar, border: "border-l-emerald-500" },
  generate_token: { label: "Generate Token", icon: Layers, border: "border-l-indigo-500" },
  check_availability: { label: "Check Availability", icon: Calendar, border: "border-l-cyan-500" },
  send_reminder: { label: "Send Reminder", icon: Clock, border: "border-l-slate-500" },
  reschedule_appointment: { label: "Reschedule Appointment", icon: RefreshCw, border: "border-l-blue-500" },
  cancel_booking: { label: "Cancel Booking", icon: XCircle, border: "border-l-red-500" },
  assign_agent: { label: "Assign Agent", icon: UserCheck, border: "border-l-amber-500" },
  add_calendar_event: { label: "Add Calendar Event", icon: Calendar, border: "border-l-red-500" },
}

const TRIGGER_OPTIONS = Object.entries(TRIGGER_META).map(([value, meta]) => ({
  value: value as AutomationTriggerType,
  label: meta.label,
  hint: meta.description,
}))

// Map Lucide icons dynamically for trigger cards
const TRIGGER_ICON_MAP: Record<string, any> = {
  MessageSquare,
  Smartphone,
  Users: UserCheck,
  ShoppingCart,
  Clock,
  Webhook,
  Brain,
  Layers,
  Zap,
}

// ------------------------------------------------------------
// Main builder component
// ------------------------------------------------------------

export function AutomationBuilder({ initial }: { initial: BuilderInitial }) {
  const router = useRouter()
  const isEditing = !!initial.id

  const init = useAutomationStore((s) => s.init)
  const id = useAutomationStore((s) => s.id)
  const name = useAutomationStore((s) => s.name)
  const description = useAutomationStore((s) => s.description)
  const trigger_type = useAutomationStore((s) => s.trigger_type)
  const trigger_config = useAutomationStore((s) => s.trigger_config)
  const is_active = useAutomationStore((s) => s.is_active)
  const steps = useAutomationStore((s) => s.steps)

  const patchTop = useAutomationStore((s) => s.patchTop)
  const saving = useAutomationStore((s) => s.saving)
  const setSaving = useAutomationStore((s) => s.setSaving)
  const setTriggerPickerOpen = useAutomationStore((s) => s.setTriggerPickerOpen)
  const setAnalyticsOpen = useAutomationStore((s) => s.setAnalyticsOpen)

  const expandedId = useAutomationStore((s) => s.expandedId)
  const setExpandedId = useAutomationStore((s) => s.setExpandedId)
  const updateStep = useAutomationStore((s) => s.updateStep)
  const addStepAt = useAutomationStore((s) => s.addStepAt)
  const deleteStepAt = useAutomationStore((s) => s.deleteStepAt)
  const moveStepAt = useAutomationStore((s) => s.moveStepAt)

  // Multi-trigger state
  const triggers = useAutomationStore((s) => s.triggers)
  const addTrigger = useAutomationStore((s) => s.addTrigger)
  const removeTrigger = useAutomationStore((s) => s.removeTrigger)

  // Action picker state
  const actionPickerOpen = useAutomationStore((s) => s.actionPickerOpen)
  const actionPickerScope = useAutomationStore((s) => s.actionPickerScope)
  const actionPickerIndex = useAutomationStore((s) => s.actionPickerIndex)
  const setActionPicker = useAutomationStore((s) => s.setActionPicker)

  const [additionalTriggerPickerOpen, setAdditionalTriggerPickerOpen] = useState(false)

  // Initialize the store with initial values on mount
  useEffect(() => {
    init(initial)
  }, [initial, init])

  async function save() {
    setSaving(true)
    try {
      const payload = {
        name: name || "Untitled automation",
        description: description || null,
        trigger_type: trigger_type,
        trigger_config: trigger_config,
        triggers: triggers,
        is_active: is_active,
        steps: toApiSteps(steps),
      }

      const res = isEditing
        ? await fetch(`/api/automations/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/automations`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const firstIssue: { path?: string; message?: string } | undefined =
          body?.issues?.[0]
        if (firstIssue?.message) {
          toast.error(firstIssue.message, {
            description: firstIssue.path ? `at ${firstIssue.path}` : undefined,
          })
        } else {
          toast.error(body?.error ?? "Save failed")
        }
        return
      }
      toast.success(isEditing ? "Automation saved" : "Automation created")
      if (!isEditing && body?.automation?.id) {
        router.replace(`/automations/${body.automation.id}/edit`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-white">
      {/* Top bar */}
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-3 sm:gap-3 sm:px-4 z-20">
        <button
          type="button"
          onClick={() => router.push("/automations")}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Back to automations"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={name}
          onChange={(e) => patchTop("name", e.target.value)}
          placeholder="Untitled automation"
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-sm font-semibold text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none sm:text-base"
        />
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="hidden sm:inline">Active</span>
          <Switch
            checked={is_active}
            onCheckedChange={(v) => patchTop("is_active", !!v)}
            aria-label="Active"
          />
        </div>

        {/* Analytics Button */}
        {isEditing && (
          <Button
            variant="outline"
            onClick={() => setAnalyticsOpen(true)}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-1.5"
          >
            <TrendingUp className="h-4 w-4 text-red-400 animate-pulse" />
            <span className="hidden sm:inline">Analytics</span>
          </Button>
        )}

        <Button
          onClick={save}
          disabled={saving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEditing ? "Save" : "Save Draft"}
        </Button>
      </header>

      {/* Canvas */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="absolute inset-0 bg-[radial-gradient(circle,#1e293b_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-0 px-4 py-10">
          <TriggerCardWrapper />

          {/* Multi-Trigger Section */}
          {triggers.length > 0 && (
            <div className="w-full max-w-[320px] sm:w-80 mt-2 space-y-2">
              <div className="text-[10px] uppercase font-bold tracking-wide text-slate-500 text-center">Additional Triggers ({triggers.length})</div>
              {triggers.map((t, idx) => {
                const tMeta = TRIGGER_META[t.trigger_type] || { label: t.trigger_type, category: 'Message', iconName: 'Zap', pillClass: 'border-slate-500/30 bg-slate-500/10 text-slate-300' }
                return (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
                    <div className={cn("flex h-6 w-6 items-center justify-center rounded-md border text-xs", tMeta.pillClass)}>
                      <Zap className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{tMeta.label}</div>
                      <div className="text-[10px] text-slate-500">{tMeta.category}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTrigger(idx)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add Additional Trigger Button */}
          <div className="relative flex flex-col items-center">
            <div className="h-4 w-[2px] bg-slate-700" aria-hidden />
            <button
              type="button"
              onClick={() => setAdditionalTriggerPickerOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-slate-600 bg-slate-900/60 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
              title="Add another trigger to this flow"
            >
              <Plus className="h-3 w-3" />
              Add Trigger
            </button>
            <div className="h-4 w-[2px] bg-slate-700" aria-hidden />
          </div>

          {/* Connected Red Plus Button — opens action picker */}
          <div className="relative flex flex-col items-center">
            <div className="h-6 w-[2px] bg-slate-700" aria-hidden />
            <button
              type="button"
              onClick={() => setActionPicker(true, { kind: 'root' }, steps.length)}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-red-500 bg-slate-950 text-red-500 transition-all hover:scale-110 hover:bg-red-500/10 hover:shadow-lg hover:shadow-red-500/20"
              title="Add Action"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="h-6 w-[2px] bg-slate-700" aria-hidden />
          </div>

          <StepList
            steps={steps}
            parentPath={[]}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            updateStep={updateStep}
            addStepAt={addStepAt}
            deleteStepAt={deleteStepAt}
            moveStepAt={moveStepAt}
          />
        </div>
      </div>

      {/* Slide-over Analytics Panel */}
      <TriggerAnalyticsPanel />

      {/* Searchable trigger Picker Modal — Primary */}
      <TriggerPickerModal />

      {/* Additional Trigger Picker */}
      {additionalTriggerPickerOpen && (
        <TriggerPickerModal
          mode="additional"
          onSelectAdditional={(type) => {
            addTrigger(type)
            setAdditionalTriggerPickerOpen(false)
          }}
          onCloseAdditional={() => setAdditionalTriggerPickerOpen(false)}
        />
      )}

      {/* Searchable Action Picker Modal */}
      <ActionPickerModal
        open={actionPickerOpen}
        onClose={() => setActionPicker(false)}
        onSelect={(type) => {
          addStepAt(actionPickerScope, actionPickerIndex, type)
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------
// Trigger Card Drop Zone Wrapper
// ------------------------------------------------------------

function TriggerCardWrapper() {
  const triggerType = useAutomationStore((s) => s.trigger_type)
  const triggerConfig = useAutomationStore((s) => s.trigger_config)
  const automationId = useAutomationStore((s) => s.id)
  const patchTop = useAutomationStore((s) => s.patchTop)
  const updateTrigger = useAutomationStore((s) => s.updateTrigger)

  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const type = e.dataTransfer.getData('text/plain') as AutomationTriggerType
    if (type) {
      updateTrigger(type)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "z-10 w-full max-w-[320px] sm:w-80 rounded-lg transition-all duration-200",
        isDragOver && "scale-105 ring-2 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.25)] border-dashed border-red-500"
      )}
    >
      <TriggerCard
        type={triggerType}
        config={triggerConfig}
        automationId={automationId}
        onTypeChange={(t) => patchTop("trigger_type", t)}
        onConfigChange={(c) => patchTop("trigger_config", c)}
      />
    </div>
  )
}

// ------------------------------------------------------------
// Trigger card
// ------------------------------------------------------------

function TriggerCard({
  type,
  config,
  automationId,
  onTypeChange,
  onConfigChange,
}: {
  type: AutomationTriggerType
  config: Record<string, unknown>
  automationId?: string
  onTypeChange: (t: AutomationTriggerType) => void
  onConfigChange: (c: Record<string, unknown>) => void
}) {
  const [open, setOpen] = useState(false)
  const setTriggerPickerOpen = useAutomationStore((s) => s.setTriggerPickerOpen)

  // Resolve trigger metadata
  const meta = TRIGGER_META[type] || {
    label: type,
    description: "Trigger event",
    category: "Message",
    iconName: "Zap",
    pillClass: "border-slate-800 bg-slate-900 text-slate-300",
  }

  const TriggerIcon = TRIGGER_ICON_MAP[meta.category] || Zap

  return (
    <div className="rounded-lg border border-slate-800 border-l-4 border-l-blue-500 bg-slate-900 shadow-lg relative group">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors rounded-t-lg"
      >
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-md border", meta.pillClass)}>
          <TriggerIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase font-bold tracking-wide text-slate-500">{meta.category} Trigger</div>
          <div className="truncate text-sm font-semibold text-white">
            {meta.label}
          </div>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-850 px-4 py-3 bg-slate-900/60 rounded-b-lg">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">
              Trigger Event
            </label>
            <button
              type="button"
              onClick={() => setTriggerPickerOpen(true)}
              className="w-full text-left rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 focus:border-red-500 focus:outline-none flex justify-between items-center transition-colors"
            >
              <span>{meta.label}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            <p className="mt-1 text-[11px] text-slate-500 leading-normal">
              {meta.description}
            </p>
          </div>

          {/* Keywords settings for keyword_match, exact_match, message_contains */}
          {(type === "keyword_match" || type === "exact_match" || type === "message_contains") && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Keywords (comma-separated)
                </label>
                <Input
                  value={((config.keywords as string[]) ?? []).join(", ")}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      keywords: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g. hello, pricing, help"
                  className="bg-slate-800 text-white"
                />
              </div>
              {type === "keyword_match" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Match type
                  </label>
                  <select
                    value={(config.match_type as string) ?? "contains"}
                    onChange={(e) => onConfigChange({ ...config, match_type: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
                  >
                    <option value="contains">Contains</option>
                    <option value="exact">Exact</option>
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!config.case_sensitive}
                  onCheckedChange={(v) => onConfigChange({ ...config, case_sensitive: !!v })}
                />
                <span className="text-xs text-slate-400">Case sensitive</span>
              </div>
            </div>
          )}

          {type === "template_replied" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">
                Template Name (optional)
              </label>
              <Input
                placeholder="e.g. shipping_update"
                value={(config.template_name as string) ?? ""}
                onChange={(e) => onConfigChange({ ...config, template_name: e.target.value })}
                className="bg-slate-800 text-white"
              />
            </div>
          )}

          {type === "regex_match" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Regex Pattern</label>
              <Input
                placeholder="e.g. ^[0-9]{5}$"
                value={(config.pattern as string) ?? ""}
                onChange={(e) => onConfigChange({ ...config, pattern: e.target.value })}
                className="bg-slate-800 text-white font-mono"
              />
            </div>
          )}

          {type === "intent_detected" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">AI Intent Target</label>
              <Input
                placeholder="e.g. pricing, support, features"
                value={(config.intent as string) ?? ""}
                onChange={(e) => onConfigChange({ ...config, intent: e.target.value })}
                className="bg-slate-800 text-white"
              />
            </div>
          )}

          {type === "button_clicked" && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-slate-400">Button ID (optional)</label>
                <Input
                  placeholder="e.g. btn_confirm_yes"
                  value={(config.button_id as string) ?? ""}
                  onChange={(e) => onConfigChange({ ...config, button_id: e.target.value })}
                  className="bg-slate-800 text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400">Button Text (optional)</label>
                <Input
                  placeholder="e.g. Yes, I accept"
                  value={(config.button_text as string) ?? ""}
                  onChange={(e) => onConfigChange({ ...config, button_text: e.target.value })}
                  className="bg-slate-800 text-white text-xs"
                />
              </div>
            </div>
          )}

          {type === "list_option_selected" && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-slate-400">Option ID (optional)</label>
                <Input
                  placeholder="e.g. row_weekly_update"
                  value={(config.option_id as string) ?? ""}
                  onChange={(e) => onConfigChange({ ...config, option_id: e.target.value })}
                  className="bg-slate-800 text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400">Option Text (optional)</label>
                <Input
                  placeholder="e.g. Weekly Updates"
                  value={(config.option_text as string) ?? ""}
                  onChange={(e) => onConfigChange({ ...config, option_text: e.target.value })}
                  className="bg-slate-800 text-white text-xs"
                />
              </div>
            </div>
          )}

          {(type === "tag_added" || type === "tag_removed") && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Tag ID</label>
              <Input
                placeholder="Tag id"
                value={(config.tag_id as string) ?? ""}
                onChange={(e) =>
                  onConfigChange({ ...config, tag_id: e.target.value })
                }
                className="bg-slate-800 text-white"
              />
            </div>
          )}

          {type === "contact_field_updated" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Field Name</label>
              <select
                value={(config.field as string) ?? "name"}
                onChange={(e) => onConfigChange({ ...config, field: e.target.value })}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
              >
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="company">Company</option>
              </select>
            </div>
          )}

          {type === "time_based" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Cron or Time</label>
              <Input
                placeholder="Cron expression or HH:mm"
                value={(config.schedule as string) ?? ""}
                onChange={(e) =>
                  onConfigChange({ ...config, schedule: e.target.value })
                }
                className="bg-slate-800 text-white"
              />
            </div>
          )}

          {type === "webhook_received" && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">Webhook URL</label>
              <div className="flex gap-1.5">
                <Input
                  readOnly
                  value={
                    automationId
                      ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/automations/webhook?id=${automationId}`
                      : "Save automation first to generate URL"
                  }
                  className="bg-slate-800 text-[10px] text-slate-300 font-mono select-all shrink pr-2 h-8"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (automationId) {
                      const url = `${window.location.origin}/api/automations/webhook?id=${automationId}`
                      navigator.clipboard.writeText(url)
                      toast.success("Webhook URL copied")
                    } else {
                      toast.error("Please save the automation first")
                    }
                  }}
                  className="shrink-0 h-8 text-[10px] border-slate-700 bg-slate-800 text-white px-2"
                >
                  Copy
                </Button>
              </div>
              <p className="text-[9px] text-slate-500 leading-normal">
                Send POST requests to trigger this. Values are resolved via <code className="text-slate-300 font-mono">{"{{vars.name}}"}</code>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Step list + card + connectors
// ------------------------------------------------------------

interface StepListProps {
  steps: BuilderStep[]
  parentPath: StepPath
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  updateStep: (path: StepPath, updater: (s: BuilderStep) => BuilderStep) => void
  addStepAt: (parent: ParentScope, index: number, type: AutomationStepType) => void
  deleteStepAt: (path: StepPath) => void
  moveStepAt: (path: StepPath, direction: -1 | 1) => void
}

function StepList(props: StepListProps) {
  const { steps, parentPath, ...rest } = props
  const parentScope: ParentScope =
    parentPath.length === 0
      ? { kind: "root" }
      : (() => {
          const last = parentPath[parentPath.length - 1]
          if (last.kind !== "branch") return { kind: "root" } as const
          return { kind: "branch", parentCid: last.parentCid, branch: last.branch } as const
        })()

  return (
    <div className="flex flex-col items-center">
      <AddButton onPick={(t) => props.addStepAt(parentScope, 0, t)} />
      {steps.map((step, idx) => (
        <StepRenderer
          key={step.cid}
          step={step}
          index={idx}
          total={steps.length}
          parentScope={parentScope}
          parentPath={parentPath}
          {...rest}
        />
      ))}
    </div>
  )
}

function StepRenderer({
  step,
  index,
  total,
  parentScope,
  parentPath,
  ...props
}: {
  step: BuilderStep
  index: number
  total: number
  parentScope: ParentScope
  parentPath: StepPath
} & Omit<StepListProps, "steps" | "parentPath">) {
  const path: StepPath = [
    ...parentPath,
    parentScope.kind === "root"
      ? { kind: "root", index }
      : { kind: "branch", parentCid: parentScope.parentCid, branch: parentScope.branch, index },
  ]
  const meta = STEP_META[step.step_type as AutomationStepType] || { label: step.step_type, icon: Zap, border: "border-l-primary" }
  const Icon = meta.icon
  const expanded = props.expandedId === step.cid
  const isCondition = step.step_type === "condition"
  const width = isCondition
    ? "w-full max-w-[400px] sm:w-[400px]"
    : "w-full max-w-[320px] sm:w-80"

  return (
    <>
      <div className={cn("z-10 flex flex-col", width)}>
        <div
          className={cn(
            "rounded-lg border border-slate-800 border-l-4 bg-slate-900 shadow-lg transition-colors hover:border-slate-700",
            meta.border,
          )}
        >
          <button
            type="button"
            onClick={() => props.setExpandedId(expanded ? null : step.cid)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors rounded-t-lg"
          >
            <GripVertical className="h-4 w-4 flex-shrink-0 text-slate-600" aria-hidden />
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-850 border border-slate-800 text-slate-300">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold tracking-wide text-slate-500">
                {isCondition ? "Condition" : step.step_type === "wait" ? "Wait" : "Action"}
              </div>
              <div className="truncate text-sm font-semibold text-white">{meta.label}</div>
              <div className="truncate text-[11px] text-slate-500 font-medium mt-0.5">{previewFor(step)}</div>
            </div>
            <ChevronDown
              className={cn("h-4 w-4 text-slate-400 transition-transform", expanded && "rotate-180")}
            />
          </button>
          {expanded && (
            <div className="border-t border-slate-850 px-4 py-3 bg-slate-900/40 rounded-b-lg">
              <StepEditor
                step={step}
                onChange={(next) => props.updateStep(path, () => next)}
              />
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    aria-label="Move up"
                    onClick={() => props.moveStepAt(path, -1)}
                    className="hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === total - 1}
                    aria-label="Move down"
                    onClick={() => props.moveStepAt(path, 1)}
                    className="hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => props.deleteStepAt(path)}
                  className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>

        {isCondition && (
          <ConditionBranches step={step} parentPath={path} {...props} />
        )}
      </div>

      <AddButton
        onPick={(t) => props.addStepAt(parentScope, index + 1, t)}
      />
    </>
  )
}

function ConditionBranches({
  step,
  parentPath,
  ...props
}: {
  step: BuilderStep
  parentPath: StepPath
} & Omit<StepListProps, "steps" | "parentPath">) {
  const yes = step.branches?.yes ?? []
  const no = step.branches?.no ?? []
  const yesPath: StepPath = [
    ...parentPath,
    { kind: "branch", parentCid: step.cid, branch: "yes", index: 0 },
  ]
  const noPath: StepPath = [
    ...parentPath,
    { kind: "branch", parentCid: step.cid, branch: "no", index: 0 },
  ]
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <BranchColumn label="Yes" color="text-primary">
        <StepList {...props} steps={yes} parentPath={yesPath} />
      </BranchColumn>
      <BranchColumn label="No" color="text-rose-400">
        <StepList {...props} steps={no} parentPath={noPath} />
      </BranchColumn>
    </div>
  )
}

function BranchColumn({
  label,
  color,
  children,
}: {
  label: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn("mb-2 text-[11px] font-bold uppercase tracking-wider", color)}>{label}</div>
      {children}
    </div>
  )
}

function AddButton({ onPick }: { onPick: (t: AutomationStepType) => void }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="h-4 w-[2px] bg-slate-700" aria-hidden />
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-slate-700 bg-slate-950 text-slate-400 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary data-[popup-open]:border-primary data-[popup-open]:bg-primary/20 data-[popup-open]:text-primary"
          aria-label="Add step"
        >
          <Plus className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-80 min-w-56 overflow-y-auto border-slate-700 bg-slate-900 text-white"
        >
          {Object.keys(STEP_META).map((t) => {
            const Icon = (STEP_META[t as AutomationStepType] || { icon: Zap }).icon
            return (
              <DropdownMenuItem key={t} onClick={() => onPick(t as AutomationStepType)} className="hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer">
                <Icon className="h-4 w-4 mr-2" />
                {(STEP_META[t as AutomationStepType] || { label: t }).label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="h-4 w-[2px] bg-slate-700" aria-hidden />
    </div>
  )
}

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ------------------------------------------------------------
// Per-step config editor
// ------------------------------------------------------------

function StepEditor({
  step,
  onChange,
}: {
  step: BuilderStep
  onChange: (s: BuilderStep) => void
}) {
  const cfg = step.step_config
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...step, step_config: { ...cfg, ...patch } })

  switch (step.step_type) {
    case "send_message":
      return (
        <FieldBlock label="Message text">
          <Textarea
            value={(cfg.text as string) ?? ""}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="Hi! Thanks for reaching out…"
            className="min-h-24 bg-slate-800 border-slate-700 text-white"
          />
        </FieldBlock>
      )
    case "send_template":
      return (
        <>
          <FieldBlock label="Template name">
            <Input
              value={(cfg.template_name as string) ?? ""}
              onChange={(e) => set({ template_name: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Language">
            <Input
              value={(cfg.language as string) ?? ""}
              onChange={(e) => set({ language: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
        </>
      )
    case "add_tag":
    case "remove_tag":
      return (
        <FieldBlock label="Tag id">
          <Input
            value={(cfg.tag_id as string) ?? ""}
            onChange={(e) => set({ tag_id: e.target.value })}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </FieldBlock>
      )
    case "assign_conversation":
      return (
        <>
          <FieldBlock label="Mode">
            <select
              value={(cfg.mode as string) ?? "round_robin"}
              onChange={(e) => set({ mode: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="round_robin">Round-robin</option>
              <option value="specific">Specific agent</option>
            </select>
          </FieldBlock>
          {cfg.mode === "specific" && (
            <FieldBlock label="Agent id">
              <Input
                value={(cfg.agent_id as string) ?? ""}
                onChange={(e) => set({ agent_id: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </FieldBlock>
          )}
        </>
      )
    case "update_contact_field":
      return (
        <>
          <FieldBlock label="Field">
            <select
              value={(cfg.field as string) ?? "name"}
              onChange={(e) => set({ field: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="company">Company</option>
            </select>
          </FieldBlock>
          <FieldBlock label="Value">
            <Input
              value={(cfg.value as string) ?? ""}
              onChange={(e) => set({ value: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
        </>
      )
    case "create_deal":
      return (
        <>
          <FieldBlock label="Pipeline id">
            <Input
              value={(cfg.pipeline_id as string) ?? ""}
              onChange={(e) => set({ pipeline_id: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Stage id">
            <Input
              value={(cfg.stage_id as string) ?? ""}
              onChange={(e) => set({ stage_id: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Title">
            <Input
              value={(cfg.title as string) ?? ""}
              onChange={(e) => set({ title: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Value">
            <Input
              type="number"
              value={(cfg.value as number) ?? 0}
              onChange={(e) => set({ value: Number(e.target.value) })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
        </>
      )
    case "wait":
      return (
        <div className="grid grid-cols-2 gap-2">
          <FieldBlock label="Amount">
            <Input
              type="number"
              min={1}
              value={(cfg.amount as number) ?? 1}
              onChange={(e) => set({ amount: Math.max(1, Number(e.target.value)) })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Unit">
            <select
              value={(cfg.unit as string) ?? "hours"}
              onChange={(e) => set({ unit: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </FieldBlock>
        </div>
      )
    case "condition":
      return (
        <>
          <FieldBlock label="Subject">
            <select
              value={(cfg.subject as string) ?? "tag_presence"}
              onChange={(e) => set({ subject: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="tag_presence">Tag presence</option>
              <option value="contact_field">Contact field</option>
              <option value="message_content">Message content</option>
              <option value="time_of_day">Time of day</option>
            </select>
          </FieldBlock>
          <FieldBlock label="Operand">
            <Input
              placeholder={
                cfg.subject === "time_of_day"
                  ? "HH:mm-HH:mm"
                  : cfg.subject === "contact_field"
                  ? "name / email / company"
                  : cfg.subject === "tag_presence"
                  ? "tag id"
                  : ""
              }
              value={(cfg.operand as string) ?? ""}
              onChange={(e) => set({ operand: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          {(cfg.subject === "contact_field" || cfg.subject === "message_content") && (
            <FieldBlock label="Value">
              <Input
                value={(cfg.value as string) ?? ""}
                onChange={(e) => set({ value: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </FieldBlock>
          )}
        </>
      )
    case "send_webhook":
      return (
        <>
          <FieldBlock label="URL">
            <Input
              value={(cfg.url as string) ?? ""}
              onChange={(e) => set({ url: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Body template (JSON)">
            <Textarea
              value={(cfg.body_template as string) ?? ""}
              onChange={(e) => set({ body_template: e.target.value })}
              className="min-h-20 bg-slate-800 border-slate-700 font-mono text-xs text-white"
            />
          </FieldBlock>
        </>
      )
    case "close_conversation":
      return (
        <p className="text-xs text-slate-400 leading-normal">
          Sets the conversation status to &quot;closed&quot;. No configuration needed.
        </p>
      )
    case "google_calendar_create_event":
      return (
        <>
          <FieldBlock label="Event title (summary)">
            <Input
              value={(cfg.summary as string) ?? ""}
              onChange={(e) => set({ summary: e.target.value })}
              placeholder="e.g. Follow-up meeting with {{ contact.name }}"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Description">
            <Textarea
              value={(cfg.description as string) ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="e.g. Talk about their pricing requirements. Last message: {{ message.text }}"
              className="min-h-16 bg-slate-800 border-slate-700 text-white font-sans"
            />
          </FieldBlock>
          <div className="grid grid-cols-2 gap-2">
            <FieldBlock label="Start Delay (minutes from now)">
              <Input
                type="number"
                min={0}
                value={(cfg.start_delay_minutes as number) ?? 0}
                onChange={(e) => set({ start_delay_minutes: Math.max(0, Number(e.target.value)) })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </FieldBlock>
            <FieldBlock label="Duration (minutes)">
              <Input
                type="number"
                min={5}
                value={(cfg.duration_minutes as number) ?? 30}
                onChange={(e) => set({ duration_minutes: Math.max(5, Number(e.target.value)) })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </FieldBlock>
          </div>
        </>
      )
    case "create_appointment":
      return (
        <>
          <FieldBlock label="Service">
            <Input
              value={(cfg.service as string) ?? "Consultation"}
              onChange={(e) => set({ service: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Location / Branch">
            <Input
              value={(cfg.location as string) ?? "Main Office"}
              onChange={(e) => set({ location: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Notes">
            <Textarea
              value={(cfg.notes as string) ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="e.g. Scheduled via WhatsApp automation."
              className="min-h-16 bg-slate-800 border-slate-700 text-white font-sans"
            />
          </FieldBlock>
        </>
      )
    case "generate_token":
      return (
        <>
          <FieldBlock label="Branch Prefix">
            <Input
              value={(cfg.branch_prefix as string) ?? "A"}
              onChange={(e) => set({ branch_prefix: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Reset daily">
            <select
              value={cfg.reset_daily === false ? "no" : "yes"}
              onChange={(e) => set({ reset_daily: e.target.value === "yes" })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="yes">Yes (Resets daily to 101)</option>
              <option value="no">No (Continuous sequence)</option>
            </select>
          </FieldBlock>
        </>
      )
    case "check_availability":
      return (
        <>
          <FieldBlock label="Service">
            <Input
              value={(cfg.service as string) ?? "Consultation"}
              onChange={(e) => set({ service: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Location / Branch">
            <Input
              value={(cfg.location as string) ?? "Main Office"}
              onChange={(e) => set({ location: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
        </>
      )
    case "send_reminder":
      return (
        <>
          <FieldBlock label="Reminder Type">
            <select
              value={(cfg.reminder_type as string) ?? "before_2h"}
              onChange={(e) => set({ reminder_type: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="before_24h">24 hours before</option>
              <option value="before_2h">2 hours before</option>
              <option value="before_30m">30 minutes before</option>
              <option value="after_feedback">Feedback request (after)</option>
              <option value="after_review">Review request (after)</option>
              <option value="after_upsell">Upsell sequence (after)</option>
            </select>
          </FieldBlock>
          <FieldBlock label="Template Name (Optional)">
            <Input
              value={(cfg.template_name as string) ?? ""}
              onChange={(e) => set({ template_name: e.target.value })}
              placeholder="e.g. appointment_reminder_approved"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
        </>
      )
    case "reschedule_appointment":
      return (
        <FieldBlock label="Notify customer">
          <select
            value={cfg.notify_customer === false ? "no" : "yes"}
            onChange={(e) => set({ notify_customer: e.target.value === "yes" })}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
          >
            <option value="yes">Yes, send notification</option>
            <option value="no">No, update silently</option>
          </select>
        </FieldBlock>
      )
    case "cancel_booking":
      return (
        <FieldBlock label="Cancellation Reason">
          <Input
            value={(cfg.reason as string) ?? ""}
            onChange={(e) => set({ reason: e.target.value })}
            placeholder="e.g. Customer request / no show"
            className="bg-slate-800 border-slate-700 text-white"
          />
        </FieldBlock>
      )
    case "assign_agent":
      return (
        <>
          <FieldBlock label="Mode">
            <select
              value={(cfg.mode as string) ?? "round_robin"}
              onChange={(e) => set({ mode: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="round_robin">Round-robin</option>
              <option value="specific">Specific agent</option>
            </select>
          </FieldBlock>
          {cfg.mode === "specific" && (
            <FieldBlock label="Agent ID">
              <Input
                value={(cfg.agent_id as string) ?? ""}
                onChange={(e) => set({ agent_id: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </FieldBlock>
          )}
        </>
      )
    case "add_calendar_event":
      return (
        <>
          <FieldBlock label="Event Title / Summary">
            <Input
              value={(cfg.summary as string) ?? ""}
              onChange={(e) => set({ summary: e.target.value })}
              placeholder="e.g. Consultation: {{ contact.name }}"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <FieldBlock label="Event Description">
            <Textarea
              value={(cfg.description as string) ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="e.g. Booking scheduled via AI booking assistant."
              className="min-h-16 bg-slate-800 border-slate-700 text-white font-sans"
            />
          </FieldBlock>
          <FieldBlock label="Duration (minutes)">
            <Input
              type="number"
              min={5}
              value={(cfg.duration_minutes as number) ?? 30}
              onChange={(e) => set({ duration_minutes: Math.max(5, Number(e.target.value)) })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
        </>
      )
    case "ai_reply":
    case "ai_agent":
      return (
        <>
          <FieldBlock label="AI Provider">
            <select
              value={(cfg.provider as string) ?? "routing_default"}
              onChange={(e) => set({ provider: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="routing_default">Use Routing Default</option>
              <option value="openai">OpenAI ChatGPT</option>
              <option value="gemini">Google Gemini</option>
              <option value="claude">Anthropic Claude</option>
              <option value="grok">xAI Grok</option>
              <option value="deepseek">DeepSeek AI</option>
              <option value="ollama">Ollama Local AI</option>
            </select>
          </FieldBlock>
          {cfg.provider && cfg.provider !== "routing_default" && (
            <FieldBlock label="AI Model">
              <select
                value={(cfg.model as string) ?? ""}
                onChange={(e) => set({ model: e.target.value })}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
              >
                <option value="">Default model</option>
                {cfg.provider === "openai" && (
                  <>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                    <option value="gpt-5-preview">gpt-5-preview</option>
                  </>
                )}
                {cfg.provider === "gemini" && (
                  <>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  </>
                )}
                {cfg.provider === "claude" && (
                  <>
                    <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                    <option value="claude-3-opus">claude-3-opus</option>
                  </>
                )}
                {cfg.provider === "grok" && <option value="grok-beta">grok-beta</option>}
                {cfg.provider === "deepseek" && (
                  <>
                    <option value="deepseek-chat">deepseek-chat</option>
                    <option value="deepseek-coder">deepseek-coder</option>
                  </>
                )}
                {cfg.provider === "ollama" && (
                  <>
                    <option value="llama3">llama3</option>
                    <option value="mistral">mistral</option>
                  </>
                )}
              </select>
            </FieldBlock>
          )}
          <FieldBlock label="Prompt Template / Instructions">
            <Textarea
              value={(cfg.prompt_template as string) ?? ""}
              onChange={(e) => set({ prompt_template: e.target.value })}
              placeholder="System guidelines or responder objectives..."
              className="min-h-20 bg-slate-800 border-slate-700 text-white font-sans text-xs"
            />
          </FieldBlock>
          <FieldBlock label="Response Tone">
            <select
              value={(cfg.tone as string) ?? "professional"}
              onChange={(e) => set({ tone: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="luxury">Luxury</option>
              <option value="casual">Casual</option>
              <option value="sales-focused">Sales-focused</option>
              <option value="medical">Medical</option>
              <option value="corporate">Corporate</option>
            </select>
          </FieldBlock>
          <FieldBlock label="Max Response Tokens">
            <Input
              type="number"
              min={10}
              max={2000}
              value={(cfg.max_tokens as number) ?? 300}
              onChange={(e) => set({ max_tokens: Math.max(10, Number(e.target.value)) })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </FieldBlock>
          <div className="flex flex-col gap-2 p-2 bg-slate-950/40 rounded border border-slate-850">
            <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.enable_memory !== false}
                onChange={(e) => set({ enable_memory: e.target.checked })}
                className="accent-purple-500 rounded"
              />
              Enable Context Memory
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.enable_crm_context !== false}
                onChange={(e) => set({ enable_crm_context: e.target.checked })}
                className="accent-purple-500 rounded"
              />
              Enable CRM Context
            </label>
          </div>
        </>
      )
    default:
      return null
  }
}

function FieldBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="mb-1 block text-xs font-semibold text-slate-400">{label}</label>
      {children}
    </div>
  )
}

function previewFor(step: BuilderStep): string {
  switch (step.step_type) {
    case "send_message":
      return (step.step_config.text as string) || "no text yet"
    case "send_template":
      return (step.step_config.template_name as string) || "pick a template"
    case "wait":
      return `${step.step_config.amount ?? "?"} ${step.step_config.unit ?? ""}`
    case "condition":
      return `when ${step.step_config.subject ?? "?"}`
    case "send_webhook":
      return (step.step_config.url as string) || "no url"
    case "google_calendar_create_event":
      return `Create event: ${(step.step_config.summary as string) || "no title yet"}`
    case "create_appointment":
      return `Book: ${(step.step_config.service as string) || "Consultation"}`
    case "generate_token":
      return `Token: Prefix=${(step.step_config.branch_prefix as string) || "A"}`
    case "check_availability":
      return `Check: ${(step.step_config.service as string) || "Consultation"}`
    case "send_reminder":
      return `Reminder: ${(step.step_config.reminder_type as string) || "before_2h"}`
    case "reschedule_appointment":
      return `Reschedule Appt`
    case "cancel_booking":
      return `Cancel Appt: ${(step.step_config.reason as string) || "Requested"}`
    case "assign_agent":
      return `Assign: ${(step.step_config.mode as string) || "round_robin"}`
    case "add_calendar_event":
      return `Calendar: ${(step.step_config.summary as string) || "Meeting"}`
    case "ai_reply":
      return `AI Reply: ${(step.step_config.tone as string) || "professional"} tone`
    case "ai_agent":
      return `AI Agent: ${(step.step_config.provider as string) || "default"}`
    default:
      return ""
  }
}

// ------------------------------------------------------------
// Serialize builder tree → API payload (flattened shape)
// ------------------------------------------------------------

interface ApiStep {
  step_type: string
  step_config: Record<string, unknown>
  branches?: { yes?: ApiStep[]; no?: ApiStep[] }
}

export function toApiSteps(steps: BuilderStep[]): ApiStep[] {
  return steps.map((s) => ({
    step_type: s.step_type,
    step_config: s.step_config,
    branches: s.branches
      ? { yes: toApiSteps(s.branches.yes), no: toApiSteps(s.branches.no) }
      : undefined,
  }))
}

/**
 * Convert server-returned step tree (from loadStepsTree) into the
 * builder-local shape with client ids.
 */
export interface ServerStepNode {
  id: string
  step_type: string
  step_config: Record<string, unknown>
  branches: { yes: ServerStepNode[]; no: ServerStepNode[] }
}

export function fromServerSteps(nodes: ServerStepNode[]): BuilderStep[] {
  return nodes.map((n) => ({
    cid: generateCid(),
    step_type: n.step_type as AutomationStepType,
    step_config: n.step_config ?? {},
    branches:
      n.step_type === "condition"
        ? {
            yes: fromServerSteps(n.branches?.yes ?? []),
            no: fromServerSteps(n.branches?.no ?? []),
          }
        : undefined,
  }))
}
