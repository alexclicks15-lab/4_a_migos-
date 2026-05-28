"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  FileSpreadsheet,
  History,
  Link2,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TabType = "connections" | "mapping" | "automations" | "calendar" | "logs"

interface Connection {
  id: string
  name: string
  type: "google_sheets" | "airtable" | "postgres" | "mysql" | "excel_upload"
  created_at: string
}

interface SyncConfig {
  id: string
  company_id: string
  connection_id?: string | null
  spreadsheet_id?: string | null
  sheet_name?: string | null
  column_mapping: Record<string, string>
  trigger_config: Record<string, unknown>
  sync_interval: "manual" | "15m" | "1h" | "12h" | "24h"
  last_synced_at?: string | null
  status: "active" | "paused" | "error"
  preview_rows?: Array<Record<string, string>>
  connection?: {
    name: string
    type: string
  }
}

interface SyncLog {
  id: string
  status: "success" | "warning" | "error"
  rows_processed: number
  rows_updated: number
  error_message?: string | null
  created_at: string
}

interface Analytics {
  sent: number
  delivered: number
  replies: number
  conversions: number
  revenue: number
}

interface Metadata {
  files: Array<{ id: string; name: string }>
  tabs: string[]
  headers: string[]
  preview: Array<Record<string, string>>
}

interface FieldDef {
  key: string
  label: string
  aliases: string[]
}

interface TriggerDef {
  key: string
  label: string
  field: string
  enabledKey: string
  templateKey: string
  offsetKey?: string
  recurrenceKey?: string
  defaultTemplate: string
  schedule: string
}

const FIELD_DEFS: FieldDef[] = [
  { key: "name", label: "Name", aliases: ["Name", "Customer Name", "Full Name"] },
  { key: "phone", label: "Phone Number", aliases: ["Phone", "Mobile", "Phone Number", "WhatsApp"] },
  { key: "email", label: "Email", aliases: ["Email", "Email Address"] },
  { key: "birthday", label: "Birthday", aliases: ["Birthday", "DOB", "Date of Birth"] },
  { key: "anniversary", label: "Wedding Anniversary", aliases: ["Anniversary", "Wedding Anniversary"] },
  { key: "last_order_date", label: "Last Order Date", aliases: ["Last Order Date", "Last Purchase"] },
  { key: "last_cake_order_date", label: "Last Cake Order Date", aliases: ["Last Cake Order Date", "Cake Order"] },
  { key: "appointment_date", label: "Appointment Date", aliases: ["Appointment Date", "Booking Date"] },
  { key: "follow_up_date", label: "Follow-up Date", aliases: ["Follow-up Date", "Follow Up Date"] },
  { key: "subscription_expiry", label: "Subscription Expiry", aliases: ["Subscription Expiry", "Expiry Date"] },
  { key: "medicine_end_date", label: "Medicine End Date", aliases: ["Medicine End Date", "Refill Date"] },
  { key: "last_visit_date", label: "Last Visit Date", aliases: ["Last Visit Date", "Last Visit"] },
  { key: "custom_reminder_date", label: "Custom Reminder Date", aliases: ["Custom Reminder Date", "Reminder Date"] },
  { key: "company", label: "Company", aliases: ["Company", "Organization"] },
]

const TRIGGER_DEFS: TriggerDef[] = [
  {
    key: "birthday",
    label: "Birthday automation",
    field: "birthday",
    enabledKey: "birthday_enabled",
    templateKey: "birthday_template",
    defaultTemplate: "Happy Birthday {{name}}! Wishing you an amazing year ahead.",
    schedule: "same month and day every year",
  },
  {
    key: "anniversary",
    label: "Wedding anniversary",
    field: "anniversary",
    enabledKey: "anniversary_enabled",
    templateKey: "anniversary_template",
    defaultTemplate: "Happy Wedding Anniversary {{name}}. Enjoy a special offer from us.",
    schedule: "same month and day every year",
  },
  {
    key: "cake_reorder",
    label: "Cake reorder reminder",
    field: "birthday",
    enabledKey: "cake_reorder_enabled",
    templateKey: "cake_reorder_template",
    defaultTemplate: "Hi {{name}}, would you like to order your birthday cake again this year?",
    schedule: "7 days before birthday",
  },
  {
    key: "appointment",
    label: "Appointment reminder",
    field: "appointment_date",
    enabledKey: "appointment_enabled",
    templateKey: "appointment_template",
    defaultTemplate: "Reminder: Your appointment is tomorrow at {{appointment_time}}.",
    schedule: "1 day before appointment",
  },
  {
    key: "appointment_2h",
    label: "Appointment 2-hour nudge",
    field: "appointment_date",
    enabledKey: "appointment_2h_enabled",
    templateKey: "appointment_2h_template",
    defaultTemplate: "Reminder: Your appointment is today at {{appointment_time}}.",
    schedule: "same day appointment nudge",
  },
  {
    key: "refill",
    label: "Medicine refill",
    field: "medicine_end_date",
    enabledKey: "refill_enabled",
    templateKey: "refill_template",
    defaultTemplate: "Your medicine may finish in 2 days. Would you like to reorder?",
    schedule: "2 days before medicine end date",
  },
  {
    key: "expiry",
    label: "Subscription renewal",
    field: "subscription_expiry",
    enabledKey: "expiry_enabled",
    templateKey: "expiry_template",
    defaultTemplate: "Your subscription expires in 3 days. Renew now to continue uninterrupted service.",
    schedule: "3 days before expiry",
  },
  {
    key: "inactivity",
    label: "Last visit follow-up",
    field: "last_visit_date",
    enabledKey: "inactivity_enabled",
    templateKey: "inactivity_template",
    defaultTemplate: "It has been a while since your last visit. Would you like to book another appointment?",
    schedule: "30 days after last visit",
  },
  {
    key: "custom",
    label: "Custom date workflow",
    field: "custom_reminder_date",
    enabledKey: "custom_enabled",
    templateKey: "custom_template",
    offsetKey: "custom_offset_days",
    recurrenceKey: "custom_recurrence",
    defaultTemplate: "Hi {{name}}, this is your reminder for {{custom_reminder_date}}.",
    schedule: "custom offset and recurrence",
  },
]

const DEFAULT_MAPPING = FIELD_DEFS.reduce<Record<string, string>>((acc, field) => {
  acc[field.key] = field.aliases[0]
  return acc
}, {})

const DEFAULT_TRIGGERS: Record<string, unknown> = {
  use_ai: true,
  birthday_enabled: true,
  birthday_template: TRIGGER_DEFS[0].defaultTemplate,
  anniversary_enabled: true,
  anniversary_template: TRIGGER_DEFS[1].defaultTemplate,
  cake_reorder_enabled: true,
  cake_reorder_template: TRIGGER_DEFS[2].defaultTemplate,
  appointment_enabled: true,
  appointment_template: TRIGGER_DEFS[3].defaultTemplate,
  appointment_2h_enabled: false,
  appointment_2h_template: TRIGGER_DEFS[4].defaultTemplate,
  refill_enabled: true,
  refill_template: TRIGGER_DEFS[5].defaultTemplate,
  expiry_enabled: true,
  expiry_template: TRIGGER_DEFS[6].defaultTemplate,
  inactivity_enabled: true,
  inactivity_template: TRIGGER_DEFS[7].defaultTemplate,
  custom_enabled: false,
  custom_offset_days: 0,
  custom_recurrence: "none",
  custom_template: TRIGGER_DEFS[8].defaultTemplate,
}

function newConfig(): Partial<SyncConfig> {
  return {
    connection_id: "",
    spreadsheet_id: "",
    sheet_name: "Sheet1",
    column_mapping: DEFAULT_MAPPING,
    trigger_config: DEFAULT_TRIGGERS,
    sync_interval: "24h",
    status: "active",
  }
}

function boolValue(value: unknown): boolean {
  return value === true
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value || 0)
}

function autoMap(headers: string[]) {
  const next = { ...DEFAULT_MAPPING }
  for (const field of FIELD_DEFS) {
    const match = headers.find((header) =>
      field.aliases.some((alias) => alias.toLowerCase() === header.toLowerCase())
    )
    if (match) next[field.key] = match
  }
  return next
}

export function SheetsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("connections")
  const [connections, setConnections] = useState<Connection[]>([])
  const [configs, setConfigs] = useState<SyncConfig[]>([])
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [analytics, setAnalytics] = useState<Analytics>({ sent: 0, delivered: 0, replies: 0, conversions: 0, revenue: 0 })
  const [metadata, setMetadata] = useState<Metadata>({ files: [], tabs: [], headers: [], preview: [] })
  const [activeConfig, setActiveConfig] = useState<Partial<SyncConfig>>(newConfig())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const selectedConfig = useMemo(() => {
    if (!activeConfig.id) return null
    return configs.find((config) => config.id === activeConfig.id) || null
  }, [activeConfig.id, configs])

  const enabledTriggers = useMemo(() => {
    return TRIGGER_DEFS.filter((trigger) => boolValue(activeConfig.trigger_config?.[trigger.enabledKey]))
  }, [activeConfig.trigger_config])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [connectionRes, configRes, logRes, analyticsRes] = await Promise.all([
        fetch("/api/sheets/connections"),
        fetch("/api/sheets/configs"),
        fetch("/api/sheets/logs"),
        fetch("/api/sheets/analytics"),
      ])

      if (connectionRes.ok) setConnections(await connectionRes.json())
      if (configRes.ok) {
        const data = await configRes.json() as SyncConfig[]
        setConfigs(data)
        if (!activeConfig.id && data[0]) setActiveConfig(data[0])
      }
      if (logRes.ok) setLogs(await logRes.json())
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json())
    } catch (error) {
      console.error("Failed to load sheets dashboard data:", error)
      toast.error("Failed to load Sheets automation data")
    } finally {
      setLoading(false)
    }
  }, [activeConfig.id])

  const loadMetadata = async (connectionId?: string | null, spreadsheetId?: string | null, sheetName?: string | null) => {
    const params = new URLSearchParams()
    if (connectionId) params.set("connectionId", connectionId)
    if (spreadsheetId) params.set("spreadsheetId", spreadsheetId)
    if (sheetName) params.set("sheetName", sheetName)
    const response = await fetch(`/api/sheets/metadata?${params.toString()}`)
    if (!response.ok) return
    const data = await response.json() as Metadata
    setMetadata(data)
    if (data.headers.length > 0) {
      setActiveConfig((current) => ({
        ...current,
        column_mapping: { ...current.column_mapping, ...autoMap(data.headers) },
      }))
    }
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    loadMetadata(activeConfig.connection_id, activeConfig.spreadsheet_id, activeConfig.sheet_name)
  }, [activeConfig.connection_id, activeConfig.spreadsheet_id, activeConfig.sheet_name])

  const handleGoogleConnect = () => {
    window.location.href = `/api/integrations/google-sheets/auth?siteUrl=${encodeURIComponent(window.location.origin)}`
  }

  const setMapping = (field: string, value: string) => {
    setActiveConfig((current) => ({
      ...current,
      column_mapping: { ...(current.column_mapping || {}), [field]: value },
    }))
  }

  const setTriggerValue = (key: string, value: unknown) => {
    setActiveConfig((current) => ({
      ...current,
      trigger_config: { ...(current.trigger_config || {}), [key]: value },
    }))
  }

  const handleSaveConfig = async () => {
    try {
      setSaving(true)
      const response = await fetch("/api/sheets/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeConfig),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to save configuration")
      toast.success("Sheet automation saved")
      setActiveConfig(payload)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleSyncNow = async (configId: string) => {
    try {
      setSyncingId(configId)
      const response = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Sync failed")
      toast.success(`Scanned ${result.processed} rows and triggered ${result.triggered || 0} reminders`)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed")
    } finally {
      setSyncingId(null)
    }
  }

  const handleDeleteConnection = async (id: string) => {
    if (!confirm("Remove this sheet connection?")) return
    const response = await fetch(`/api/sheets/connections?id=${id}`, { method: "DELETE" })
    if (response.ok) {
      toast.success("Connection removed")
      await loadData()
    } else {
      toast.error("Failed to remove connection")
    }
  }

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true)
      const formData = new FormData()
      formData.append("file", file)
      formData.append("columnMapping", JSON.stringify(activeConfig.column_mapping || DEFAULT_MAPPING))
      formData.append("triggerConfig", JSON.stringify(activeConfig.trigger_config || DEFAULT_TRIGGERS))

      const response = await fetch("/api/sheets/upload", { method: "POST", body: formData })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Upload sync failed")
      toast.success(`Imported ${result.processed} rows and triggered ${result.triggered || 0} reminders`)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const statCards = [
    { label: "Reminders sent", value: analytics.sent, icon: CheckCircle2, tone: "text-emerald-400" },
    { label: "Delivery rate", value: analytics.sent ? `${Math.round((analytics.delivered / analytics.sent) * 100)}%` : "100%", icon: Activity, tone: "text-cyan-400" },
    { label: "Reply rate", value: analytics.sent ? `${Math.round((analytics.replies / analytics.sent) * 100)}%` : "0%", icon: BarChart3, tone: "text-indigo-400" },
    { label: "Revenue", value: `$${analytics.revenue.toLocaleString()}`, icon: Sparkles, tone: "text-amber-400" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <FileSpreadsheet className="h-4 w-4" />
            Sheets Automations
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Google Sheets reminder engine</h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect sheets, map date columns, and send WhatsApp reminders from CRM context.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setActiveConfig(newConfig())} variant="outline" className="border-slate-700 text-slate-200">
            New Automation
          </Button>
          <Button onClick={handleGoogleConnect} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">
            <Link2 className="h-4 w-4 mr-2" />
            Connect Google
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{card.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                </div>
                <Icon className={`h-5 w-5 ${card.tone}`} />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-800">
        {[
          { id: "connections", label: "Connections", icon: Database },
          { id: "mapping", label: "Column Mapping", icon: Settings2 },
          { id: "automations", label: "Automation Builder", icon: Bot },
          { id: "calendar", label: "Trigger Preview", icon: CalendarDays },
          { id: "logs", label: "Logs", icon: History },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="h-80 flex items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading Sheets automation system...
        </div>
      ) : (
        <>
          {activeTab === "connections" && (
            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Connected Google Sheets</CardTitle>
                  <CardDescription className="text-slate-400">Add multiple Google accounts, sheets, and worksheet tabs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {connections.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-slate-400">
                      No sheet connections yet.
                    </div>
                  ) : (
                    connections.map((connection) => (
                      <div key={connection.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                            <FileSpreadsheet className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-white">{connection.name}</p>
                            <p className="text-xs text-slate-500">{connection.type} connected {new Date(connection.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteConnection(connection.id)} className="p-2 text-slate-500 hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Excel import</CardTitle>
                  <CardDescription className="text-slate-400">Use the same mappings for uploaded XLSX/CSV files.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Label htmlFor="sheet-upload" className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center hover:border-emerald-500">
                    {uploading ? <Loader2 className="h-7 w-7 animate-spin text-emerald-400" /> : <Upload className="h-7 w-7 text-emerald-400" />}
                    <span className="mt-3 text-sm font-semibold text-white">Upload spreadsheet</span>
                    <span className="mt-1 text-xs text-slate-500">XLSX, XLS, CSV, TSV</span>
                  </Label>
                  <input
                    id="sheet-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv,.tsv"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void handleFileUpload(file)
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "mapping" && (
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Sheet selection</CardTitle>
                  <CardDescription className="text-slate-400">Choose a connection, spreadsheet, worksheet tab, and sync cadence.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Connection</Label>
                    <select
                      value={activeConfig.connection_id || ""}
                      onChange={(event) => setActiveConfig({ ...activeConfig, connection_id: event.target.value })}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Sandbox Google Sheets</option>
                      {connections.map((connection) => (
                        <option key={connection.id} value={connection.id}>{connection.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Spreadsheet</Label>
                    <select
                      value={activeConfig.spreadsheet_id || ""}
                      onChange={(event) => setActiveConfig({ ...activeConfig, spreadsheet_id: event.target.value })}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select spreadsheet</option>
                      {metadata.files.map((file) => (
                        <option key={file.id} value={file.id}>{file.name}</option>
                      ))}
                    </select>
                    <Input
                      value={activeConfig.spreadsheet_id || ""}
                      onChange={(event) => setActiveConfig({ ...activeConfig, spreadsheet_id: event.target.value })}
                      placeholder="Or paste spreadsheet ID"
                      className="bg-slate-950 border-slate-800 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Worksheet tab</Label>
                      <Input
                        list="worksheet-tabs"
                        value={activeConfig.sheet_name || ""}
                        onChange={(event) => setActiveConfig({ ...activeConfig, sheet_name: event.target.value })}
                        className="bg-slate-950 border-slate-800 text-white"
                      />
                      <datalist id="worksheet-tabs">
                        {metadata.tabs.map((tab) => <option key={tab} value={tab} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Sync schedule</Label>
                      <select
                        value={activeConfig.sync_interval || "24h"}
                        onChange={(event) => setActiveConfig({ ...activeConfig, sync_interval: event.target.value as SyncConfig["sync_interval"] })}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                      >
                        <option value="manual">Manual only</option>
                        <option value="15m">Every 15 minutes</option>
                        <option value="1h">Hourly</option>
                        <option value="12h">Every 12 hours</option>
                        <option value="24h">Daily</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Visual column mapping</CardTitle>
                  <CardDescription className="text-slate-400">Map Google Sheet columns to CRM date and contact fields.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {FIELD_DEFS.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs text-slate-300">{field.label}</Label>
                      <Input
                        list="sheet-headers"
                        value={activeConfig.column_mapping?.[field.key] || ""}
                        onChange={(event) => setMapping(field.key, event.target.value)}
                        className="bg-slate-950 border-slate-800 text-white"
                        placeholder={field.aliases[0]}
                      />
                    </div>
                  ))}
                  <datalist id="sheet-headers">
                    {metadata.headers.map((header) => <option key={header} value={header} />)}
                  </datalist>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "automations" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Date automation builder</CardTitle>
                    <CardDescription className="text-slate-400">Enable birthday, anniversary, appointment, refill, renewal, follow-up, and custom workflows.</CardDescription>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-purple-300">
                    <input
                      type="checkbox"
                      checked={boolValue(activeConfig.trigger_config?.use_ai)}
                      onChange={(event) => setTriggerValue("use_ai", event.target.checked)}
                    />
                    AI personalization
                  </label>
                </CardHeader>
                <CardContent className="space-y-3">
                  {TRIGGER_DEFS.map((trigger) => {
                    const enabled = boolValue(activeConfig.trigger_config?.[trigger.enabledKey])
                    return (
                      <div key={trigger.key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{trigger.label}</p>
                            <p className="text-xs text-slate-500">{trigger.schedule} from {FIELD_DEFS.find((field) => field.key === trigger.field)?.label}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) => setTriggerValue(trigger.enabledKey, event.target.checked)}
                            className="mt-1"
                          />
                        </div>
                        {enabled && (
                          <div className="mt-3 space-y-3">
                            <textarea
                              value={stringValue(activeConfig.trigger_config?.[trigger.templateKey]) || trigger.defaultTemplate}
                              onChange={(event) => setTriggerValue(trigger.templateKey, event.target.value)}
                              className="h-20 w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
                            />
                            {trigger.key === "custom" && (
                              <div className="grid grid-cols-2 gap-3">
                                <Input
                                  type="number"
                                  value={numberValue(activeConfig.trigger_config?.custom_offset_days)}
                                  onChange={(event) => setTriggerValue("custom_offset_days", Number(event.target.value))}
                                  className="bg-slate-900 border-slate-800 text-white"
                                  placeholder="Offset days"
                                />
                                <select
                                  value={stringValue(activeConfig.trigger_config?.custom_recurrence) || "none"}
                                  onChange={(event) => setTriggerValue("custom_recurrence", event.target.value)}
                                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
                                >
                                  <option value="none">Exact date</option>
                                  <option value="yearly">Yearly</option>
                                  <option value="monthly">Monthly</option>
                                  <option value="custom_interval">Custom interval</option>
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Automation actions</CardTitle>
                  <CardDescription className="text-slate-400">Actions are dispatched after a reminder is sent.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {["Send WhatsApp message", "Create or update CRM contact", "Save reminder history", "Trigger AI automation", "Notify sales team via existing workflows", "Prevent duplicate sends"].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Reminder calendar</CardTitle>
                  <CardDescription className="text-slate-400">Enabled triggers for the selected sheet automation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {enabledTriggers.length === 0 ? (
                    <p className="text-sm text-slate-500">No triggers enabled.</p>
                  ) : (
                    enabledTriggers.map((trigger) => (
                      <div key={trigger.key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-emerald-400" />
                          <p className="text-sm font-semibold text-white">{trigger.label}</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{trigger.schedule}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Sheet preview</CardTitle>
                    <CardDescription className="text-slate-400">Preview imported data before the scheduler scans it.</CardDescription>
                  </div>
                  <Button onClick={handleSaveConfig} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full min-w-[620px] text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          {(metadata.headers.length ? metadata.headers : Object.values(activeConfig.column_mapping || {}).filter(Boolean)).slice(0, 8).map((header) => (
                            <th key={header} className="px-3 py-2 font-semibold">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {(metadata.preview.length ? metadata.preview : selectedConfig?.preview_rows || []).slice(0, 5).map((row, index) => (
                          <tr key={index}>
                            {(metadata.headers.length ? metadata.headers : Object.values(activeConfig.column_mapping || {}).filter(Boolean)).slice(0, 8).map((header) => (
                              <td key={header} className="px-3 py-2">{row[header] || ""}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {configs.map((config) => (
                      <Button
                        key={config.id}
                        onClick={() => handleSyncNow(config.id)}
                        disabled={syncingId === config.id}
                        variant="outline"
                        className="border-slate-700 text-slate-200"
                      >
                        {syncingId === config.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Sync {config.sheet_name || "Sheet"}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "logs" && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Sync and error logs</CardTitle>
                <CardDescription className="text-slate-400">Manual syncs, scheduled scans, and failed reminder attempts.</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-slate-500">No logs yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="py-2">Time</th>
                          <th className="py-2">Status</th>
                          <th className="py-2 text-center">Rows</th>
                          <th className="py-2 text-center">Updated</th>
                          <th className="py-2">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {logs.map((log) => (
                          <tr key={log.id}>
                            <td className="py-2 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="py-2">
                              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
                                log.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                              }`}>
                                {log.status === "success" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                {log.status}
                              </span>
                            </td>
                            <td className="py-2 text-center">{log.rows_processed}</td>
                            <td className="py-2 text-center">{log.rows_updated}</td>
                            <td className="py-2 text-red-300">{log.error_message || "OK"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
