"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { useDashboardStore, WidgetLayout } from '@/lib/dashboard/dashboard-store'
import { X, Settings, Layout, ArrowUp, ArrowDown, Eye, EyeOff, Save, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

export function DashboardCustomizer() {
  const isOpen = useDashboardStore((s) => s.customizerOpen)
  const setOpen = useDashboardStore((s) => s.toggleCustomizer)
  const widgets = useDashboardStore((s) => s.widgets)
  
  const toggleVisibility = useDashboardStore((s) => s.toggleWidgetVisibility)
  const setSize = useDashboardStore((s) => s.setWidgetSize)
  const moveWidget = useDashboardStore((s) => s.moveWidget)
  const resetLayout = useDashboardStore((s) => s.resetLayout)
  const saveLayout = useDashboardStore((s) => s.saveLayout)

  const handleSave = () => {
    saveLayout()
    toast.success('Dashboard layout saved successfully!')
    setOpen(false)
  }

  const handleReset = () => {
    resetLayout()
    toast.success('Dashboard layout reset to defaults.')
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
        />

        {/* Customizer Drawer */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative flex h-screen w-full max-w-sm flex-col border-l border-slate-800 bg-slate-900 shadow-2xl z-50"
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Customize Dashboard</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* List of Widgets */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">Active Widgets Sizing & Order</div>
            
            {widgets.map((widget, index) => (
              <div
                key={widget.id}
                className={`rounded-lg border bg-slate-950/20 p-3 space-y-2.5 transition-all ${
                  widget.visible ? 'border-slate-800 hover:border-slate-750' : 'border-slate-850 opacity-50'
                }`}
              >
                {/* Row 1: Visibility toggle, title, order controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => toggleVisibility(widget.id)}
                      className={`p-1 rounded transition-colors ${
                        widget.visible ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-800'
                      }`}
                      title={widget.visible ? "Hide Widget" : "Show Widget"}
                    >
                      {widget.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <span className="text-xs font-semibold text-white truncate">{widget.title}</span>
                  </div>

                  <div className="flex gap-0.5 shrink-0">
                    <button
                      onClick={() => moveWidget(widget.id, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveWidget(widget.id, 'down')}
                      disabled={index === widgets.length - 1}
                      className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Grid column width selectors */}
                {widget.visible && (
                  <div className="flex items-center justify-between border-t border-slate-900/60 pt-2 text-[10px]">
                    <span className="text-slate-500 font-bold uppercase">Grid Width</span>
                    <div className="flex rounded-md bg-slate-900/80 p-0.5 border border-slate-800">
                      {(['small', 'medium', 'large'] as WidgetLayout['size'][]).map((size) => (
                        <button
                          key={size}
                          onClick={() => setSize(widget.id, size)}
                          className={`rounded px-2 py-0.5 font-bold transition-all ${
                            widget.size === size
                              ? 'bg-slate-800 text-indigo-400'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {size === 'small' ? '1/3' : size === 'medium' ? '2/3' : '3/3'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer controls */}
          <footer className="border-t border-slate-800 p-5 bg-slate-900/80 flex items-center justify-between gap-3">
            <button
              onClick={handleReset}
              className="rounded-lg border border-slate-800 bg-slate-950/20 hover:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Defaults
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-indigo-500 hover:bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-500/10"
            >
              <Save className="h-3.5 w-3.5" />
              Save Layout
            </button>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
