"use client"

import type { MiniKanbanData } from '@/lib/dashboard/types'
import { Briefcase, CreditCard, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

interface MiniKanbanWidgetProps {
  data: MiniKanbanData | null
  loading: boolean
}

export function MiniKanbanWidget({ data, loading }: MiniKanbanWidgetProps) {
  if (loading || !data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    )
  }

  // Calculate sum totals by stage ID
  const sumByStage = (stageId: string) => {
    return data.deals
      .filter((d) => d.stageId === stageId)
      .reduce((sum, d) => sum + d.value, 0)
  }

  const handleCardClick = (title: string, value: number) => {
    toast.info(`Opening pipeline deal details: "${title}" ($${value})`)
  }

  // Fallbacks if stages are empty
  const stages = data.stages.length > 0 ? data.stages : [
    { id: 'lead', name: 'Leads', color: '#3b82f6' },
    { id: 'contacted', name: 'Contacted', color: '#7c3aed' },
    { id: 'qualified', name: 'Qualified', color: '#d946ef' },
    { id: 'won', name: 'Won', color: '#10b981' },
  ]

  const deals = data.deals.length > 0 ? data.deals : [
    { id: 'd1', title: 'Enterprise Onboarding', value: 8500, contactName: 'Mila K.', contactPhone: '+123', stageId: stages[0].id },
    { id: 'd2', title: 'Templates package', value: 450, contactName: 'John Doe', contactPhone: '+234', stageId: stages[1].id },
    { id: 'd3', title: 'Consulting Retainer', value: 3000, contactName: 'Sarah J.', contactPhone: '+345', stageId: stages[2].id },
    { id: 'd4', title: 'Agency onboarding', value: 12000, contactName: 'Alex Rivera', contactPhone: '+456', stageId: stages[3].id },
  ]

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden flex flex-col h-full shadow-lg">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">Pipeline Kanban Preview</h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Sales Stages & Deals</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
          <span>{deals.length} active deals</span>
        </div>
      </header>

      {/* Kanban columns viewport */}
      <div className="p-5 flex-1 flex gap-4 overflow-x-auto min-h-[300px] select-none max-h-[500px]">
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stageId === stage.id)
          const stageSum = sumByStage(stage.id) || stageDeals.reduce((sum, d) => sum + d.value, 0)
          
          return (
            <div
              key={stage.id}
              className="flex-1 min-w-[200px] max-w-[280px] rounded-lg border border-slate-850 bg-slate-950/20 p-3 flex flex-col h-full"
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h3 className="text-xs font-bold text-white truncate">{stage.name}</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                  {stageDeals.length}
                </span>
              </div>

              {/* Deals container */}
              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    onClick={() => handleCardClick(deal.title, deal.value)}
                    className="rounded-lg border border-slate-800 bg-slate-900 p-2.5 cursor-pointer shadow-sm hover:border-slate-700 hover:bg-slate-850 hover:shadow-md transition-all space-y-1.5"
                  >
                    <h4 className="text-[11px] font-bold text-white leading-normal line-clamp-1">{deal.title}</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-500 font-semibold truncate max-w-[100px]">
                        {deal.contactName}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400">${deal.value.toLocaleString()}</span>
                    </div>
                  </div>
                ))}

                {stageDeals.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-[10px] text-slate-600 font-medium">
                    No open deals
                  </div>
                )}
              </div>

              {/* Stage Footer sum total */}
              {stageSum > 0 && (
                <div className="border-t border-slate-850 pt-2 mt-3 flex justify-between items-center text-[10px] text-slate-500 font-bold">
                  <span>STAGE VALUE</span>
                  <span className="text-slate-300 font-bold">${stageSum.toLocaleString()}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
