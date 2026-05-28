import { create } from 'zustand'
import type {
  AutomationTriggerType,
  AutomationTriggerConfig,
  AutomationStepType,
  AutomationTrigger,
} from '@/types'
import { toast } from 'sonner'

export interface BuilderStep {
  cid: string
  step_type: AutomationStepType
  step_config: Record<string, unknown>
  branches?: { yes: BuilderStep[]; no: BuilderStep[] }
}

export interface BuilderTrigger {
  id?: string
  trigger_type: AutomationTriggerType
  trigger_config: Record<string, unknown>
  priority?: number
  enabled?: boolean
}

export interface BuilderInitial {
  id?: string
  name: string
  description: string
  trigger_type: AutomationTriggerType
  trigger_config: Record<string, unknown>
  triggers?: BuilderTrigger[]
  is_active: boolean
  steps: BuilderStep[]
}

export type ParentScope =
  | { kind: "root" }
  | { kind: "branch"; parentCid: string; branch: "yes" | "no" }

export type StepPath = (
  | { kind: "root"; index: number }
  | { kind: "branch"; parentCid: string; branch: "yes" | "no"; index: number }
)[]

export interface LogEntry {
  id: string
  status: 'success' | 'partial' | 'failed'
  created_at: string
  error_message?: string | null
  trigger_event: string
}

interface BuilderState {
  id?: string
  name: string
  description: string
  trigger_type: AutomationTriggerType
  trigger_config: Record<string, unknown>
  triggers: BuilderTrigger[]
  is_active: boolean
  steps: BuilderStep[]

  // UI state
  expandedId: string | null
  saving: boolean
  analyticsOpen: boolean
  triggerPickerOpen: boolean
  actionPickerOpen: boolean
  actionPickerScope: ParentScope
  actionPickerIndex: number

  // Analytics
  logs: LogEntry[]
  logsLoading: boolean
  executionCount: number
  lastExecutedAt: string | null

  // Methods
  init: (initial: BuilderInitial) => void
  patchTop: <K extends keyof BuilderInitial>(key: K, value: BuilderInitial[K]) => void
  setExpandedId: (id: string | null) => void
  setSaving: (saving: boolean) => void
  setAnalyticsOpen: (open: boolean) => void
  setTriggerPickerOpen: (open: boolean) => void
  setActionPicker: (open: boolean, scope?: ParentScope, index?: number) => void
  updateTrigger: (type: AutomationTriggerType, config?: Record<string, unknown>) => void

  // Multi-trigger mutations
  addTrigger: (type: AutomationTriggerType, config?: Record<string, unknown>) => void
  removeTrigger: (index: number) => void
  updateTriggerAt: (index: number, patch: Partial<BuilderTrigger>) => void

  // Step tree mutations
  addStepAt: (parent: ParentScope, index: number, type: AutomationStepType) => void
  deleteStepAt: (path: StepPath) => void
  moveStepAt: (path: StepPath, direction: -1 | 1) => void
  updateStep: (path: StepPath, updater: (s: BuilderStep) => BuilderStep) => void

  // Fetching analytics
  fetchAnalytics: () => Promise<void>
}

// Helper: client-side UUID generator
export function generateCid(): string {
  return (
    "c_" +
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36))
  )
}

// Helper: initial configs for new steps
export function blankConfig(type: AutomationStepType): Record<string, unknown> {
  switch (type) {
    case "send_message":
      return { text: "" }
    case "send_template":
      return { template_name: "", language: "en_US" }
    case "add_tag":
    case "remove_tag":
      return { tag_id: "" }
    case "assign_conversation":
      return { mode: "round_robin" }
    case "update_contact_field":
      return { field: "name", value: "" }
    case "create_deal":
      return { pipeline_id: "", stage_id: "", title: "", value: 0 }
    case "wait":
      return { amount: 1, unit: "hours" }
    case "condition":
      return { subject: "tag_presence", operand: "", value: "" }
    case "send_webhook":
      return { url: "", headers: {}, body_template: "" }
    case "close_conversation":
      return {}
    case "google_calendar_create_event":
      return { summary: "", description: "", start_delay_minutes: 0, duration_minutes: 30 }
    // --- Phase 1: Advanced Actions ---
    case "ai_agent":
      return { prompt_template: "", temperature: 0.7, max_tokens: 500, auto_reply: true, update_crm: true, trigger_actions: false }
    case "ai_reply":
      return { prompt_template: "", temperature: 0.7, max_tokens: 300 }
    case "http_request":
      return { url: "", method: "POST", headers: {}, body_template: "", response_var_key: "response", retry_count: 0, timeout_ms: 10000 }
    case "send_media":
      return { media_type: "image", media_url: "", caption: "" }
    case "send_buttons":
      return { text: "", buttons: [{ id: "btn_1", title: "Option 1" }] }
    case "send_list_message":
      return { text: "", button_label: "View options", sections: [{ title: "Options", rows: [{ id: "row_1", title: "Option 1" }] }] }
    case "increase_lead_score":
      return { amount: 10 }
    case "add_internal_note":
      return { note_text: "" }
    case "move_pipeline_stage":
      return { pipeline_id: "", stage_id: "" }
    case "trigger_automation":
      return { target_automation_id: "", pass_context: true }
    case "pause_flow":
      return {}
    case "end_flow":
      return {}
    case "switch":
      return { subject: "message_content", operand: "", cases: [{ value: "", label: "Case 1" }, { value: "", label: "Case 2" }] }
    case "delay_until":
      return { until_type: "datetime", datetime: "" }
    case "loop":
      return { max_iterations: 3 }
    case "split_traffic":
      return { variants: [{ label: "A", weight: 50 }, { label: "B", weight: 50 }] }
    case "goto_step":
      return { target_step_cid: "" }
    // Human Handoff
    case "assign_human_agent":
      return { agent_id: "", pause_ai: true }
    case "notify_team":
      return { message: "" }
    case "escalate_priority":
      return { level: "high", reason: "" }
    // Ecommerce
    case "create_order":
      return { product_id: "", quantity: 1 }
    case "send_payment_link":
      return { amount: 0, currency: "INR", description: "" }
    case "verify_payment":
      return { order_id: "" }
    case "track_shipment":
      return { tracking_id: "" }
    case "generate_invoice":
      return { order_id: "" }
    // Appointments
    case "create_appointment":
      return { service: "Consultation", location: "Main Office", notes: "" }
    case "generate_token":
      return { branch_prefix: "A", reset_daily: true }
    case "check_availability":
      return { service: "Consultation", location: "Main Office" }
    case "send_reminder":
      return { reminder_type: "before_2h", template_name: "" }
    case "reschedule_appointment":
      return { notify_customer: true }
    case "cancel_booking":
      return { reason: "Cancelled by admin/system" }
    case "assign_agent":
      return { agent_id: "", mode: "round_robin" }
    case "add_calendar_event":
      return { summary: "New Appointment", description: "", duration_minutes: 30 }
    default:
      return {}
  }
}

export const useAutomationStore = create<BuilderState>((set, get) => ({
  id: undefined,
  name: '',
  description: '',
  trigger_type: 'new_message_received',
  trigger_config: {},
  triggers: [],
  is_active: false,
  steps: [],

  expandedId: null,
  saving: false,
  analyticsOpen: false,
  triggerPickerOpen: false,
  actionPickerOpen: false,
  actionPickerScope: { kind: 'root' } as ParentScope,
  actionPickerIndex: 0,

  logs: [],
  logsLoading: false,
  executionCount: 0,
  lastExecutedAt: null,

  init: (initial) => {
    set({
      id: initial.id,
      name: initial.name,
      description: initial.description,
      trigger_type: initial.trigger_type,
      trigger_config: initial.trigger_config,
      triggers: initial.triggers ?? [],
      is_active: initial.is_active,
      steps: initial.steps,
      expandedId: null,
      analyticsOpen: false,
      triggerPickerOpen: false,
      actionPickerOpen: false,
      actionPickerScope: { kind: 'root' },
      actionPickerIndex: 0,
      logs: [],
      logsLoading: false,
    })
    // Fetch execution count and logs initially if there is an existing ID
    if (initial.id) {
      get().fetchAnalytics()
    }
  },

  patchTop: (key, value) => {
    set((state) => ({ ...state, [key]: value }))
  },

  setExpandedId: (id) => set({ expandedId: id }),
  setSaving: (saving) => set({ saving }),
  setAnalyticsOpen: (open) => set({ analyticsOpen: open }),
  setTriggerPickerOpen: (open) => set({ triggerPickerOpen: open }),
  setActionPicker: (open, scope, index) => set({
    actionPickerOpen: open,
    ...(scope ? { actionPickerScope: scope } : {}),
    ...(index !== undefined ? { actionPickerIndex: index } : {}),
  }),

  updateTrigger: (type, config = {}) => {
    set({
      trigger_type: type,
      trigger_config: config,
      triggerPickerOpen: false,
    })
    toast.success(`Trigger type set to: ${type.replace(/_/g, ' ')}`)
  },

  // Multi-trigger mutations
  addTrigger: (type, config = {}) => {
    set((state) => ({
      triggers: [...state.triggers, { trigger_type: type, trigger_config: config, priority: 0, enabled: true }],
    }))
    toast.success(`Additional trigger added: ${type.replace(/_/g, ' ')}`)
  },

  removeTrigger: (index) => {
    set((state) => ({
      triggers: state.triggers.filter((_, i) => i !== index),
    }))
    toast.success('Trigger removed')
  },

  updateTriggerAt: (index, patch) => {
    set((state) => ({
      triggers: state.triggers.map((t, i) => i === index ? { ...t, ...patch } : t),
    }))
  },

  addStepAt: (parent, index, type) => {
    const node: BuilderStep = {
      cid: generateCid(),
      step_type: type,
      step_config: blankConfig(type),
      branches: type === "condition" ? { yes: [], no: [] } : undefined,
    }
    const currentSteps = get().steps
    set({
      steps: insertAt(currentSteps, parent, index, node),
      expandedId: node.cid,
    })
  },

  deleteStepAt: (path) => {
    const currentSteps = get().steps
    set({ steps: removeAt(currentSteps, path) })
  },

  moveStepAt: (path, direction) => {
    const currentSteps = get().steps
    set({ steps: moveAt(currentSteps, path, direction) })
  },

  updateStep: (path, updater) => {
    const currentSteps = get().steps
    set({ steps: mapAtPath(currentSteps, path, updater) })
  },

  fetchAnalytics: async () => {
    const { id } = get()
    if (!id) return

    set({ logsLoading: true })
    try {
      const res = await fetch(`/api/automations/${id}`)
      if (res.ok) {
        const data = await res.json()
        set({
          logs: data.logs ?? [],
          executionCount: data.automation?.execution_count ?? 0,
          lastExecutedAt: data.automation?.last_executed_at ?? null,
        })
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      set({ logsLoading: false })
    }
  },
}))

// --- Immutable tree mutation helper functions ---

function insertAt(
  steps: BuilderStep[],
  parent: ParentScope,
  index: number,
  node: BuilderStep,
): BuilderStep[] {
  if (parent.kind === "root") {
    const copy = [...steps]
    copy.splice(index, 0, node)
    return copy
  }
  return steps.map((s) => {
    if (s.cid !== parent.parentCid || !s.branches) return s
    const list = [...s.branches[parent.branch]]
    list.splice(index, 0, node)
    return { ...s, branches: { ...s.branches, [parent.branch]: list } }
  })
}

function mapAtPath(
  steps: BuilderStep[],
  path: StepPath,
  updater: (s: BuilderStep) => BuilderStep,
): BuilderStep[] {
  if (path.length === 0) return steps
  const head = path[0]
  const rest = path.slice(1)

  if (head.kind === "root") {
    return steps.map((s, i) => {
      if (i !== head.index) return s
      return rest.length === 0
        ? updater(s)
        : { ...s, branches: walkBranches(s.branches, rest, updater) }
    })
  }
  return steps.map((s) => {
    if (s.cid !== head.parentCid || !s.branches) return s
    const bucket = s.branches[head.branch]
    const updated = bucket.map((child, i) => {
      if (i !== head.index) return child
      return rest.length === 0
        ? updater(child)
        : { ...child, branches: walkBranches(child.branches, rest, updater) }
    })
    return { ...s, branches: { ...s.branches, [head.branch]: updated } }
  })
}

function walkBranches(
  branches: BuilderStep["branches"],
  path: StepPath,
  updater: (s: BuilderStep) => BuilderStep,
): BuilderStep["branches"] {
  if (!branches) return branches
  const head = path[0]
  if (head.kind !== "branch") return branches
  const bucket = branches[head.branch]
  const rest = path.slice(1)
  const updated = bucket.map((child, i) => {
    if (i !== head.index) return child
    return rest.length === 0
      ? updater(child)
      : { ...child, branches: walkBranches(child.branches, rest, updater) }
  })
  return { ...branches, [head.branch]: updated }
}

function removeAt(steps: BuilderStep[], path: StepPath): BuilderStep[] {
  if (path.length === 0) return steps
  const head = path[0]
  const rest = path.slice(1)
  if (head.kind === "root") {
    if (rest.length === 0) return steps.filter((_, i) => i !== head.index)
    return steps.map((s, i) =>
      i !== head.index ? s : { ...s, branches: removeFromBranches(s.branches, rest) },
    )
  }
  return steps.map((s) => {
    if (s.cid !== head.parentCid || !s.branches) return s
    const bucket = s.branches[head.branch]
    const next =
      rest.length === 0
        ? bucket.filter((_, i) => i !== head.index)
        : bucket.map((child, i) =>
            i !== head.index
              ? child
              : { ...child, branches: removeFromBranches(child.branches, rest) },
          )
    return { ...s, branches: { ...s.branches, [head.branch]: next } }
  })
}

function removeFromBranches(
  branches: BuilderStep["branches"],
  path: StepPath,
): BuilderStep["branches"] {
  if (!branches) return branches
  const head = path[0]
  if (head.kind !== "branch") return branches
  const rest = path.slice(1)
  const bucket = branches[head.branch]
  const next =
    rest.length === 0
      ? bucket.filter((_, i) => i !== head.index)
      : bucket.map((child, i) =>
          i !== head.index
            ? child
            : { ...child, branches: removeFromBranches(child.branches, rest) },
        )
  return { ...branches, [head.branch]: next }
}

function moveAt(
  steps: BuilderStep[],
  path: StepPath,
  direction: -1 | 1,
): BuilderStep[] {
  if (path.length === 0) return steps
  const head = path[0]
  const rest = path.slice(1)
  const swap = <T,>(arr: T[], i: number) => {
    const j = i + direction
    if (j < 0 || j >= arr.length) return arr
    const copy = [...arr]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    return copy
  }
  if (head.kind === "root") {
    if (rest.length === 0) return swap(steps, head.index)
    return steps.map((s, i) =>
      i !== head.index ? s : { ...s, branches: moveInBranches(s.branches, rest, direction) },
    )
  }
  return steps.map((s) => {
    if (s.cid !== head.parentCid || !s.branches) return s
    const bucket = s.branches[head.branch]
    const next = rest.length === 0 ? swap(bucket, head.index) : bucket
    return { ...s, branches: { ...s.branches, [head.branch]: next } }
  })
}

function moveInBranches(
  branches: BuilderStep["branches"],
  path: StepPath,
  direction: -1 | 1,
): BuilderStep["branches"] {
  if (!branches) return branches
  const head = path[0]
  if (head.kind !== "branch") return branches
  const rest = path.slice(1)
  const bucket = branches[head.branch]
  const swap = <T,>(arr: T[], i: number) => {
    const j = i + direction
    if (j < 0 || j >= arr.length) return arr
    const copy = [...arr]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    return copy
  }
  const next = rest.length === 0 ? swap(bucket, head.index) : bucket
  return { ...branches, [head.branch]: next }
}
