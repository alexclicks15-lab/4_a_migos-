"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Search, Brain, Trash2, Calendar, FileText, User } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface MemoryItem {
  id: string
  contact_id: string
  summary: string
  short_term_context: Record<string, any>
  updated_at: string
  contact?: {
    name?: string
    phone: string
    avatar_url?: string
  }
}

export function AIMemoryInspector() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [search, setSearch] = useState('')

  const fetchMemories = async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('ai_memory')
        .select('*, contact:contacts(name, phone, avatar_url)')
        .order('updated_at', { ascending: false })

      if (!error && data) {
        setMemories(data as MemoryItem[])
      }
    } catch (err) {
      console.warn('Failed to load memory rows:', err)
      // Fallback mock items
      setMemories([
        {
          id: 'mem-1',
          contact_id: 'c-1',
          summary: 'Message: "I need 50 tshirts for Kochi delivery next Friday". AI Intent: "bulk_order_inquiry". score: 85.\nMessage: "Do you offer logo printing?". AI Intent: "pricing_inquiry". score: 95.',
          short_term_context: { product: 'tshirt', quantity: 50, location: 'Kochi', delivery_date: 'next Friday' },
          updated_at: new Date().toISOString(),
          contact: { name: 'Alex Rivera', phone: '+1234567890' }
        },
        {
          id: 'mem-2',
          contact_id: 'c-2',
          summary: 'Message: "book a demo tomorrow at 2 PM". AI Intent: "appointment_booking". score: 70.',
          short_term_context: { appointment_date: 'tomorrow', appointment_time: '2 PM' },
          updated_at: new Date(Date.now() - 3600000).toISOString(),
          contact: { name: 'Mila K.', phone: '+1987654321' }
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMemories()
  }, [user])

  const handleClearMemory = async (memoryId: string, contactName: string) => {
    const confirmClear = window.confirm(`Are you sure you want to clear AI context memory for ${contactName}?`)
    if (!confirmClear) return

    const supabase = createClient()
    try {
      const { error } = await supabase.from('ai_memory').delete().eq('id', memoryId)
      if (error) throw error
      
      setMemories(prev => prev.filter(m => m.id !== memoryId))
      toast.success(`AI Memory for ${contactName} cleared successfully!`)
    } catch (err: any) {
      console.error('Failed to delete memory:', err)
      toast.error(`Clear failed: ${err.message || 'database exception'}`)
    }
  }

  const filteredMemories = memories.filter(m => {
    const name = m.contact?.name || ''
    const phone = m.contact?.phone || ''
    const summary = m.summary || ''
    const query = search.toLowerCase()
    return name.toLowerCase().includes(query) || phone.includes(query) || summary.toLowerCase().includes(query)
  })

  return (
    <div className="space-y-6">
      {/* Search and control bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Contact AI Memory Context</h3>
          <p className="text-xs text-slate-400 mt-0.5">Audit summaries and short-term variables stored dynamically during chats.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search contact or summary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500 text-xs italic">
          No memory records found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredMemories.map((mem) => {
            const displayName = mem.contact?.name || mem.contact?.phone || 'Contact'
            const initials = displayName.charAt(0).toUpperCase()
            
            return (
              <div key={mem.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Contact Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-xs font-bold text-white">{displayName}</h4>
                        <span className="truncate text-[10px] text-slate-500 font-mono">{mem.contact?.phone}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleClearMemory(mem.id, displayName)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors shrink-0 cursor-pointer"
                      title="Clear Context Memory"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  {/* Summary Block */}
                  <div className="space-y-1 bg-slate-950/20 border border-slate-850 p-3 rounded-lg">
                    <div className="text-[9px] uppercase font-bold text-purple-400 flex items-center gap-1">
                      <Brain className="h-3 w-3" />
                      Interaction Thread Summary
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line mt-1">
                      {mem.summary}
                    </p>
                  </div>

                  {/* Extracted Slots / JSON context */}
                  {mem.short_term_context && Object.keys(mem.short_term_context).length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">Short-term Variables Context</span>
                      <div className="mt-1.5 grid grid-cols-2 gap-2 bg-slate-950/20 border border-slate-850 p-2.5 rounded-lg text-[10px] font-mono text-slate-400">
                        {Object.entries(mem.short_term_context)
                          .filter(([_, v]) => v !== undefined && v !== null && v !== "")
                          .map(([k, v]) => (
                            <div key={k} className="truncate">
                              <span className="text-slate-500">{k}:</span> {String(v)}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Updated Timestamp */}
                <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="h-3.5 w-3.5" />
                    Updated: {format(new Date(mem.updated_at), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
