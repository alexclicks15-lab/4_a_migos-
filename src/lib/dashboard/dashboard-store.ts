import { create } from 'zustand'

export interface WidgetLayout {
  id: string
  title: string
  visible: boolean
  size: 'small' | 'medium' | 'large' // maps to col-span-1, col-span-2, col-span-3
  order: number
}

interface DashboardState {
  // Global Filters
  workspace: string
  dateRange: 'today' | '7d' | '30d' | 'custom'
  customStartDate: string | null
  customEndDate: string | null
  agentFilter: string
  campaignFilter: string
  wabaFilter: string

  // UI state
  customizerOpen: boolean
  widgets: WidgetLayout[]

  // Actions
  setFilter: <K extends 'workspace' | 'dateRange' | 'agentFilter' | 'campaignFilter' | 'wabaFilter'>(
    key: K,
    value: string
  ) => void
  setCustomDateRange: (start: string | null, end: string | null) => void
  toggleCustomizer: (open: boolean) => void
  toggleWidgetVisibility: (id: string) => void
  setWidgetSize: (id: string, size: WidgetLayout['size']) => void
  moveWidget: (id: string, direction: 'up' | 'down') => void
  resetLayout: () => void
  saveLayout: () => void
  loadLayout: () => void
}

const DEFAULT_WIDGETS: WidgetLayout[] = [
  { id: 'ai-assistant', title: 'AI Assistant', visible: true, size: 'large', order: 0 },
  { id: 'whatsapp-kpis', title: 'WhatsApp KPIs', visible: true, size: 'large', order: 1 },
  { id: 'revenue-sales', title: 'Revenue & Sales', visible: true, size: 'medium', order: 2 },
  { id: 'sales-funnel', title: 'Sales Funnel', visible: true, size: 'small', order: 3 },
  { id: 'automation-perf', title: 'Automation Performance', visible: true, size: 'medium', order: 4 },
  { id: 'ai-insights', title: 'AI Sentiment & Insights', visible: true, size: 'small', order: 5 },
  { id: 'team-perf', title: 'Team Leaderboard', visible: true, size: 'medium', order: 6 },
  { id: 'broadcast-roi', title: 'Broadcast Campaigns', visible: true, size: 'small', order: 7 },
  { id: 'mini-kanban', title: 'Pipeline Kanban Preview', visible: true, size: 'medium', order: 8 },
  { id: 'activity-feed', title: 'Realtime Activity Feed', visible: true, size: 'small', order: 9 },
  { id: 'quick-actions', title: 'Smart Quick Actions', visible: true, size: 'small', order: 10 },
]

export const useDashboardStore = create<DashboardState>((set, get) => ({
  workspace: 'Default Workspace',
  dateRange: '30d',
  customStartDate: null,
  customEndDate: null,
  agentFilter: 'All',
  campaignFilter: 'All',
  wabaFilter: 'All',
  customizerOpen: false,
  widgets: DEFAULT_WIDGETS,

  setFilter: (key, value) => set({ [key]: value }),
  setCustomDateRange: (start, end) => set({ customStartDate: start, customEndDate: end, dateRange: 'custom' }),
  toggleCustomizer: (open) => set({ customizerOpen: open }),

  toggleWidgetVisibility: (id) => {
    set((state) => ({
      widgets: state.widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
    }))
  },

  setWidgetSize: (id, size) => {
    set((state) => ({
      widgets: state.widgets.map((w) => (w.id === id ? { ...w, size } : w)),
    }))
  },

  moveWidget: (id, direction) => {
    const widgets = [...get().widgets].sort((a, b) => a.order - b.order)
    const idx = widgets.findIndex((w) => w.id === id)
    if (idx === -1) return

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= widgets.length) return

    // Swap orders
    const temp = widgets[idx].order
    widgets[idx].order = widgets[targetIdx].order
    widgets[targetIdx].order = temp

    set({ widgets })
  },

  resetLayout: () => {
    set({ widgets: DEFAULT_WIDGETS })
    get().saveLayout()
  },

  saveLayout: () => {
    if (typeof window === 'undefined') return
    localStorage.setItem('dashboard_widget_layout', JSON.stringify(get().widgets))
  },

  loadLayout: () => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('dashboard_widget_layout')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as WidgetLayout[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with defaults to handle new widgets added later
          const merged = DEFAULT_WIDGETS.map((def) => {
            const match = parsed.find((p) => p.id === def.id)
            return match ? { ...def, ...match } : def
          }).sort((a, b) => a.order - b.order)
          
          set({ widgets: merged })
        }
      } catch (e) {
        console.error('Failed to parse saved widget layout', e)
      }
    }
  },
}))
