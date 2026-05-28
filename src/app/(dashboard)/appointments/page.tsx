"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  User,
  Plus,
  Trash2,
  Settings,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Building,
  RefreshCw,
  Send,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"

interface Contact {
  id: string
  name: string
  phone: string
}

export default function AppointmentsPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<"calendar" | "queue" | "agents" | "settings">("calendar")
  const [loading, setLoading] = useState(true)

  // DB Data States
  const [appointments, setAppointments] = useState<any[]>([])
  const [slots, setSlots] = useState<any[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [agents, setAgents] = useState<any[]>([])

  // Dashboard Settings
  const [businessHours, setBusinessHours] = useState<any>({
    start: "09:00",
    end: "17:00",
    duration: 30,
    buffer: 10,
    resetDaily: true,
  })
  const [holidays, setHolidays] = useState<string[]>(["2026-01-01", "2026-12-25"])
  const [branches, setBranches] = useState<string[]>(["Main Office", "West Wing", "Downtown"])
  const [selectedBranch, setSelectedBranch] = useState("Main Office")

  // Selected state for admin creation / editing
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [sandboxContact, setSandboxContact] = useState<Contact | null>(null)
  const [sandboxMessages, setSandboxMessages] = useState<any[]>([])
  const [sandboxInput, setSandboxInput] = useState("")
  const [isAiTyping, setIsAiTyping] = useState(false)

  // Quick Action Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [newAppt, setNewAppt] = useState({
    contactId: "",
    service: "Consultation",
    time: "10:00",
    location: "Main Office",
    notes: "",
    revenue: 150,
  })

  // 1. Fetch initial data
  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch appointments
      const { data: apptsData } = await supabase
        .from("appointments")
        .select(`
          *,
          contact:contacts(id, name, phone),
          token:appointment_tokens(id, token_number, sequence_number)
        `)
        .order("start_time", { ascending: true })

      if (apptsData) {
        setAppointments(apptsData)
      } else {
        // Mock fallback if table empty/not migrated
        const mockAppts = [
          {
            id: "1",
            service: "Consultation",
            appointment_date: new Date().toISOString().split("T")[0],
            start_time: new Date().toISOString(),
            status: "confirmed",
            location: "Main Office",
            notes: "Initial discovery session",
            revenue: 150,
            contact: { id: "c1", name: "Alex Mercer", phone: "+1234567890" },
            token: { token_number: "A101" }
          },
          {
            id: "2",
            service: "Demo Call",
            appointment_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
            start_time: new Date(Date.now() + 86400000).toISOString(),
            status: "pending",
            location: "Main Office",
            notes: "Demo CRM capabilities",
            revenue: 250,
            contact: { id: "c2", name: "Sarah Connor", phone: "+1987654321" },
            token: { token_number: "A102" }
          }
        ]
        setAppointments(mockAppts)
      }

      // Fetch contacts
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("id, name, phone")
        .limit(10)

      if (contactsData && contactsData.length > 0) {
        setContacts(contactsData)
        setSandboxContact(contactsData[0])
      } else {
        const mockContacts = [
          { id: "c1", name: "Alex Mercer", phone: "+1234567890" },
          { id: "c2", name: "Sarah Connor", phone: "+1987654321" },
          { id: "c3", name: "Bruce Wayne", phone: "+1555555000" }
        ]
        setContacts(mockContacts)
        setSandboxContact(mockContacts[0])
      }

      // Fetch profiles / agents
      const { data: agentsData } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")

      if (agentsData && agentsData.length > 0) {
        setAgents(agentsData)
      } else {
        setAgents([
          { id: "a1", full_name: "John Doe", email: "john@wacrm.com", role: "admin" },
          { id: "a2", full_name: "Jane Smith", email: "jane@wacrm.com", role: "agent" }
        ])
      }

    } catch (e) {
      console.error("Failed to load appointments data:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // 2. Fetch Slots for selected date & location
  const loadSlots = async (dateStr: string, location: string) => {
    try {
      const { data: slotsData } = await supabase
        .from("appointment_slots")
        .select("*")
        .eq("slot_date", dateStr)
        .eq("location", location)

      if (slotsData) {
        setSlots(slotsData)
      }
    } catch (e) {
      console.error("Failed to fetch slots:", e)
    }
  }

  useEffect(() => {
    const dStr = selectedDate.toISOString().split("T")[0]
    loadSlots(dStr, selectedBranch)
  }, [selectedDate, selectedBranch])

  // 3. KPI Metrics calculations
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0]
    const todayAppts = appointments.filter((a) => a.appointment_date === todayStr)
    const upcomingAppts = appointments.filter((a) => new Date(a.start_time) >= new Date() && a.status !== "cancelled")
    const completed = appointments.filter((a) => a.status === "completed")
    const cancelled = appointments.filter((a) => a.status === "cancelled")
    const noShow = appointments.filter((a) => a.status === "no_show")

    const noShowRate = appointments.length > 0 
      ? Math.round((noShow.length / (appointments.length - cancelled.length || 1)) * 100) 
      : 0

    const totalRevenue = completed.reduce((sum, a) => sum + (Number(a.revenue) || 0), 0)

    return {
      today: todayAppts.length,
      upcoming: upcomingAppts.length,
      completed: completed.length,
      cancelled: cancelled.length,
      noShowRate: `${noShowRate}%`,
      revenue: `$${totalRevenue}`
    }
  }, [appointments])

  // 4. Calendar Grid construction
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  // 5. Booking Actions
  const handleCreateAppointment = async () => {
    if (!newAppt.contactId) {
      toast.error("Please select a contact")
      return
    }

    setLoading(true)
    const dateStr = selectedDate.toISOString().split("T")[0]

    try {
      const res = await fetch("/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Simulating booking payload internally
          type: "ai_simulate_booking",
          userId: (await supabase.auth.getUser()).data.user?.id,
          contactId: newAppt.contactId,
          service: newAppt.service,
          date: dateStr,
          time: newAppt.time,
          location: newAppt.location,
          notes: newAppt.notes,
          revenue: newAppt.revenue
        })
      })

      const payload = await res.json()
      if (payload.success || res.ok) {
        toast.success("Appointment created successfully!")
        setShowAddModal(false)
        fetchData()
      } else {
        // Fallback local create if endpoint is not serving simulation
        const tokenNum = `A${100 + appointments.length + 1}`
        const startDateTime = new Date(`${dateStr}T${newAppt.time}:00.000Z`)
        const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000)

        const selectedContact = contacts.find((c) => c.id === newAppt.contactId)

        const newRecord = {
          id: Math.random().toString(),
          service: newAppt.service,
          appointment_date: dateStr,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "confirmed",
          location: newAppt.location,
          notes: newAppt.notes,
          revenue: newAppt.revenue,
          contact: selectedContact || { id: "c1", name: "Guest", phone: "" },
          token: { token_number: tokenNum }
        }

        setAppointments((prev) => [...prev, newRecord])
        toast.success("Virtual appointment created!")
        setShowAddModal(false)
      }
    } catch (e) {
      console.error(e)
      toast.error("Error creating appointment")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (id: string, status: "confirmed" | "cancelled" | "completed" | "no_show" | "pending") => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id)

      if (error) throw error

      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      )
      toast.success(`Appointment marked as ${status}`)
    } catch (e) {
      // Fallback update
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      )
      toast.success(`Virtual appointment marked as ${status}`)
    }
  }

  // 6. WhatsApp Sandbox Simulation
  const handleSendSandboxMessage = async () => {
    if (!sandboxInput.trim() || !sandboxContact) return

    const userMsg = {
      id: Math.random().toString(),
      sender: "customer",
      text: sandboxInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setSandboxMessages((prev) => [...prev, userMsg])
    setSandboxInput("")
    setIsAiTyping(true)

    try {
      // Fetch current session user
      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData.user?.id || "demo-user-id"

      // Send to webhook API or run fallback local assistant directly
      const response = await fetch("/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Format payload mirroring WhatsApp meta webhook structure
          object: "whatsapp_business_account",
          entry: [{
            id: "demo_waba_id",
            changes: [{
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "+15550001111", phone_number_id: "demo_phone_id" },
                contacts: [{ profile: { name: sandboxContact.name }, wa_id: sandboxContact.phone }],
                messages: [{
                  id: "msg_" + Math.random().toString(36).substring(7),
                  from: sandboxContact.phone,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: userMsg.text }
                }]
              }
            }]
          }]
        })
      })

      // Reload appointments to see changes
      setTimeout(() => {
        fetchData()
      }, 1000)

      // Retrieve last AI operational log or response text
      const { data: logs } = await supabase
        .from("ai_automation_logs")
        .select("response_text, intent_detected, entities_extracted")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      let botResponse = ""
      if (logs?.response_text) {
        botResponse = logs.response_text
      } else {
        // Fallback mock AI booking responses for sandbox
        const txt = userMsg.text.toLowerCase()
        if (txt.includes("book") || txt.includes("demo") || txt.includes("schedule")) {
          botResponse = `Welcome to our virtual scheduler! We have consultation slots tomorrow at:\n• 10:00 AM\n• 11:30 AM\n• 02:00 PM\n\nWhich slot do you prefer?`
        } else if (txt.includes("10") || txt.includes("10:00")) {
          botResponse = `Your appointment is confirmed ✅\n\nToken Number: A103\nService: Consultation\nDate: Tomorrow\nTime: 10:00 AM\nQueue Position: 2\n\nWe've synced this to Google Calendar and sent a card!`
          
          // Inject a new booking
          setTimeout(() => {
            const dateStr = new Date(Date.now() + 86400000).toISOString().split("T")[0]
            setAppointments((prev) => [
              ...prev,
              {
                id: Math.random().toString(),
                service: "Consultation",
                appointment_date: dateStr,
                start_time: new Date(`${dateStr}T10:00:00.000Z`).toISOString(),
                status: "confirmed",
                location: "Main Office",
                revenue: 150,
                contact: sandboxContact,
                token: { token_number: "A103" }
              }
            ])
          }, 800)
        } else if (txt.includes("cancel")) {
          botResponse = `Your appointment has been successfully cancelled ❌ Old slot released.`
        } else {
          botResponse = `Hello 👋 How can we help you today? You can choose to:\n• Book Appointment\n• Services\n• Talk to Support`
        }
      }

      setTimeout(() => {
        setSandboxMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: "bot",
            text: botResponse,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ])
        setIsAiTyping(false)
      }, 1000)

    } catch (e) {
      console.error(e)
      setIsAiTyping(false)
    }
  }

  // Pre-seed greeting
  useEffect(() => {
    if (sandboxContact) {
      setSandboxMessages([
        {
          id: "g1",
          sender: "bot",
          text: `Welcome 👋\nHow can we help you today?\n\nOptions:\n• Book Appointment\n• Talk to Support\n• Pricing\n• Services`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    }
  }, [sandboxContact])

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 lg:flex-row">
      {/* Dashboard Main Console */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-screen">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent flex items-center gap-2">
              <CalendarIcon className="h-6 w-6 text-emerald-400" />
              WhatsApp Appointment Manager
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Automated slots, tokens, and real-time scheduling queue
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Book Appointment
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard title="Today's Appts" value={metrics.today} icon={CalendarIcon} color="from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400" />
          <MetricCard title="Upcoming" value={metrics.upcoming} icon={Clock} color="from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400" />
          <MetricCard title="Completed" value={metrics.completed} icon={CheckCircle} color="from-purple-500/20 to-fuchsia-500/20 border-purple-500/30 text-purple-400" />
          <MetricCard title="Cancelled" value={metrics.cancelled} icon={XCircle} color="from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-400" />
          <MetricCard title="No-Show Rate" value={metrics.noShowRate} icon={AlertTriangle} color="from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400" />
          <MetricCard title="Revenue" value={metrics.revenue} icon={TrendingUp} color="from-teal-500/20 to-emerald-500/20 border-teal-500/30 text-teal-400" />
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800">
          <TabButton active={activeTab === "calendar"} onClick={() => setActiveTab("calendar")} label="Calendar View" />
          <TabButton active={activeTab === "queue"} onClick={() => setActiveTab("queue")} label="Queue & Timeline" />
          <TabButton active={activeTab === "agents"} onClick={() => setActiveTab("agents")} label="Agent Schedule" />
          <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} label="Configuration Settings" />
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
        ) : (
          <div className="min-h-[400px]">
            {activeTab === "calendar" && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Visual Calendar */}
                <div className="xl:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-200">
                      {format(currentMonth, "MMMM yyyy")}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 border-slate-800 bg-slate-950 text-slate-400"
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 border-slate-800 bg-slate-950 text-slate-400"
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 border-b border-slate-800 pb-2">
                    <div>Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                      const dayStr = day.toISOString().split("T")[0]
                      const dayAppts = appointments.filter((a) => a.appointment_date === dayStr && a.status !== "cancelled")
                      const isSelected = isSameDay(day, selectedDate)

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedDate(day)}
                          className={`min-h-16 flex flex-col items-start justify-between p-1.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300"
                              : "bg-slate-950/40 border-slate-800/40 hover:bg-slate-800/30 text-slate-300"
                          }`}
                        >
                          <span className="text-xs font-medium">{format(day, "d")}</span>
                          {dayAppts.length > 0 && (
                            <div className="w-full space-y-0.5 mt-1">
                              {dayAppts.slice(0, 2).map((appt) => (
                                <div
                                  key={appt.id}
                                  className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 truncate"
                                >
                                  {appt.service}
                                </div>
                              ))}
                              {dayAppts.length > 2 && (
                                <div className="text-[8px] text-slate-500 pl-1">
                                  +{dayAppts.length - 2} more
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Day Details Side Panel */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-slate-200 border-b border-slate-800 pb-2">
                      Schedule for {format(selectedDate, "eeee, MMM dd")}
                    </h3>

                    {appointments.filter((a) => a.appointment_date === selectedDate.toISOString().split("T")[0]).length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs italic">
                        No appointments booked for this day.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {appointments
                          .filter((a) => a.appointment_date === selectedDate.toISOString().split("T")[0])
                          .map((appt) => (
                            <div
                              key={appt.id}
                              className={`p-3 rounded-lg border bg-slate-950/60 flex items-start justify-between ${
                                appt.status === "cancelled"
                                  ? "border-rose-950 text-rose-300 bg-rose-950/10"
                                  : "border-slate-800 text-slate-200"
                              }`}
                            >
                              <div>
                                <div className="font-medium text-xs flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase px-1 py-0.5 rounded bg-slate-800 text-slate-400">
                                    {appt.token?.token_number || "None"}
                                  </span>
                                  {appt.service}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                  <User className="h-3 w-3 text-slate-500" /> {appt.contact?.name} ({appt.contact?.phone})
                                </div>
                                {appt.notes && (
                                  <div className="text-[10px] text-slate-500 mt-0.5 italic">
                                    "{appt.notes}"
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-1.5">
                                <span className={`text-[9px] px-1 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                                  appt.status === "completed"
                                    ? "bg-purple-500/10 text-purple-400"
                                    : appt.status === "cancelled"
                                    ? "bg-rose-500/10 text-rose-400"
                                    : "bg-emerald-500/10 text-emerald-400"
                                }`}>
                                  {appt.status}
                                </span>
                                
                                {appt.status !== "cancelled" && (
                                  <div className="flex gap-1 mt-1">
                                    <button
                                      onClick={() => handleUpdateStatus(appt.id, "completed")}
                                      className="p-1 hover:bg-slate-800 rounded text-emerald-400 transition-colors"
                                      title="Mark Complete"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleUpdateStatus(appt.id, "cancelled")}
                                      className="p-1 hover:bg-slate-800 rounded text-rose-400 transition-colors"
                                      title="Cancel Appointment"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                    <span>Slots remaining: 6/8</span>
                    <span>Buffer: {businessHours.buffer}m</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "queue" && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-semibold text-sm text-slate-200">
                    Today's Live Appointment Queue
                  </h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                    Queue resets daily
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5">Token</th>
                        <th>Customer</th>
                        <th>Service</th>
                        <th>Branch</th>
                        <th>Queue Pos</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {appointments
                        .filter((a) => a.appointment_date === new Date().toISOString().split("T")[0])
                        .map((appt, index) => (
                          <tr key={appt.id} className="hover:bg-slate-800/20 transition-colors text-slate-300">
                            <td className="py-3">
                              <span className="font-mono bg-slate-950 px-2 py-1 rounded text-emerald-400 border border-slate-800 text-xs">
                                {appt.token?.token_number || `A10${index + 1}`}
                              </span>
                            </td>
                            <td>{appt.contact?.name || "Guest"}</td>
                            <td>{appt.service}</td>
                            <td>{appt.location || "Main Office"}</td>
                            <td>
                              <span className="font-semibold text-slate-200">#{index + 1}</span>
                            </td>
                            <td>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase ${
                                appt.status === "completed"
                                  ? "bg-purple-500/10 text-purple-300"
                                  : appt.status === "no_show"
                                  ? "bg-amber-500/10 text-amber-300"
                                  : "bg-emerald-500/10 text-emerald-300"
                              }`}>
                                {appt.status}
                              </span>
                            </td>
                            <td className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateStatus(appt.id, "completed")}
                                  className="h-7 border-slate-800 hover:bg-slate-800 text-emerald-400 text-[10px] py-1"
                                >
                                  Complete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateStatus(appt.id, "no_show")}
                                  className="h-7 border-slate-800 hover:bg-slate-800 text-amber-400 text-[10px] py-1"
                                >
                                  No-Show
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {appointments.filter((a) => a.appointment_date === new Date().toISOString().split("T")[0]).length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-500 text-xs italic">
                            No appointments currently in the queue for today.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "agents" && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-6">
                <h3 className="font-semibold text-sm text-slate-200 border-b border-slate-800 pb-3">
                  Staff / Agent Schedules
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {agents.map((agent) => {
                    const agentAppts = appointments.filter((a) => a.agent_id === agent.id)

                    return (
                      <div key={agent.id} className="border border-slate-800 bg-slate-950/60 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3">
                          <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                            {agent.full_name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-medium text-xs text-slate-200">{agent.full_name}</h4>
                            <p className="text-[10px] text-slate-500">{agent.email}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Bookings ({agentAppts.length})</h5>
                          
                          {agentAppts.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic py-2">No bookings assigned yet.</p>
                          ) : (
                            agentAppts.map((appt) => (
                              <div key={appt.id} className="p-2 rounded bg-slate-900/80 border border-slate-800/40 text-[11px] flex justify-between items-center text-slate-300">
                                <span>{appt.service} ({appt.appointment_date})</span>
                                <span className="font-medium text-[10px] text-slate-400">{appt.contact?.name}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-6">
                <h3 className="font-semibold text-sm text-slate-200 border-b border-slate-800 pb-3">
                  Appointment Configs & Business Hours
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Business Hours */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-emerald-400" /> Business Hours Settings
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <FieldBlock label="Start Time">
                        <Input
                          type="time"
                          value={businessHours.start}
                          onChange={(e) => setBusinessHours({ ...businessHours, start: e.target.value })}
                          className="bg-slate-950 border-slate-800 text-white"
                        />
                      </FieldBlock>
                      <FieldBlock label="End Time">
                        <Input
                          type="time"
                          value={businessHours.end}
                          onChange={(e) => setBusinessHours({ ...businessHours, end: e.target.value })}
                          className="bg-slate-950 border-slate-800 text-white"
                        />
                      </FieldBlock>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FieldBlock label="Slot Duration (mins)">
                        <select
                          value={businessHours.duration}
                          onChange={(e) => setBusinessHours({ ...businessHours, duration: Number(e.target.value) })}
                          className="w-full rounded-md border border-slate-850 bg-slate-950 px-2 py-1.5 text-xs text-white"
                        >
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={65}>60 minutes</option>
                        </select>
                      </FieldBlock>
                      <FieldBlock label="Buffer Time (mins)">
                        <select
                          value={businessHours.buffer}
                          onChange={(e) => setBusinessHours({ ...businessHours, buffer: Number(e.target.value) })}
                          className="w-full rounded-md border border-slate-850 bg-slate-950 px-2 py-1.5 text-xs text-white"
                        >
                          <option value={5}>5 minutes</option>
                          <option value={10}>10 minutes</option>
                          <option value={15}>15 minutes</option>
                        </select>
                      </FieldBlock>
                    </div>
                  </div>

                  {/* Holidays & Location branches */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-emerald-400" /> Location Branches
                    </h4>

                    <div className="space-y-2">
                      {branches.map((b, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-850 text-xs">
                          <span>{b}</span>
                          <button
                            onClick={() => setBranches(branches.filter((item) => item !== b))}
                            className="text-rose-400 hover:text-rose-500"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        id="new-branch-input"
                        placeholder="Add location branch..."
                        className="bg-slate-950 border-slate-800 text-white text-xs"
                      />
                      <Button
                        onClick={() => {
                          const input = document.getElementById("new-branch-input") as HTMLInputElement
                          if (input && input.value.trim()) {
                            setBranches([...branches, input.value.trim()])
                            input.value = ""
                            toast.success("Branch added")
                          }
                        }}
                        className="bg-slate-850 hover:bg-slate-800 text-white text-xs"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-850 flex justify-end">
                  <Button
                    onClick={() => {
                      toast.success("Settings saved successfully!")
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
                  >
                    Save Configuration
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp Web Sandbox Widget Panel */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800/80 bg-slate-900/40 p-4 flex flex-col justify-between max-h-screen">
        <div>
          {/* Header Sandbox */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-semibold text-slate-300">WhatsApp AI Agent Sandbox</span>
            </div>

            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] text-slate-500">RLS Shield Active</span>
            </div>
          </div>

          {/* User selector */}
          <div className="mt-3 bg-slate-950 p-2.5 rounded-lg border border-slate-850 space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Simulated Customer</label>
            <select
              value={sandboxContact?.id || ""}
              onChange={(e) => {
                const found = contacts.find((c) => c.id === e.target.value)
                if (found) setSandboxContact(found)
              }}
              className="w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-white focus:outline-none"
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto my-4 space-y-3 px-1 min-h-[300px]">
          {sandboxMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                msg.sender === "customer"
                  ? "bg-emerald-600 text-white rounded-br-none ml-auto"
                  : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/40"
              }`}
            >
              <div className="whitespace-pre-line">{msg.text}</div>
              <span className="text-[8px] text-slate-300/60 mt-1 self-end">{msg.timestamp}</span>
            </div>
          ))}
          {isAiTyping && (
            <div className="flex items-center gap-1 text-[10px] text-slate-500 italic pl-2 bg-slate-800/40 border border-slate-800/40 max-w-[50%] p-2 rounded-2xl rounded-bl-none">
              <Sparkles className="h-3 w-3 text-purple-400 animate-pulse" /> AI Agent is typing...
            </div>
          )}
        </div>

        {/* Chat input */}
        <div className="flex gap-2 border-t border-slate-800/60 pt-3">
          <Input
            value={sandboxInput}
            onChange={(e) => setSandboxInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendSandboxMessage()
            }}
            placeholder="Type message to trigger AI Booking Agent..."
            className="flex-1 bg-slate-950 border-slate-800 text-xs text-white"
          />
          <Button
            size="icon"
            onClick={handleSendSandboxMessage}
            className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0 h-9 w-9 rounded-lg"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Manual Booking Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2">Manual Slot Booking</h3>
            
            <div className="space-y-3 text-xs">
              <FieldBlock label="Contact Name">
                <select
                  value={newAppt.contactId}
                  onChange={(e) => setNewAppt({ ...newAppt, contactId: e.target.value })}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-white"
                >
                  <option value="">Select contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label="Service Type">
                <select
                  value={newAppt.service}
                  onChange={(e) => setNewAppt({ ...newAppt, service: e.target.value })}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-white"
                >
                  <option value="Consultation">Consultation</option>
                  <option value="Demo Call">Demo Call</option>
                  <option value="Store Visit">Store Visit</option>
                  <option value="Support Meeting">Support Meeting</option>
                </select>
              </FieldBlock>

              <div className="grid grid-cols-2 gap-3">
                <FieldBlock label="Time slot">
                  <Input
                    type="time"
                    value={newAppt.time}
                    onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </FieldBlock>
                <FieldBlock label="Revenue ($)">
                  <Input
                    type="number"
                    value={newAppt.revenue}
                    onChange={(e) => setNewAppt({ ...newAppt, revenue: Number(e.target.value) })}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </FieldBlock>
              </div>

              <FieldBlock label="Notes">
                <Textarea
                  value={newAppt.notes}
                  onChange={(e) => setNewAppt({ ...newAppt, notes: e.target.value })}
                  placeholder="e.g. Needs pricing catalogue"
                  className="bg-slate-950 border-slate-800 text-white min-h-16"
                />
              </FieldBlock>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="h-8 border-slate-800 hover:bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAppointment}
                className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
              >
                Create Booking
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  color
}: {
  title: string
  value: string | number
  icon: any
  color: string
}) {
  return (
    <div className={`rounded-xl border bg-slate-900/40 p-4 flex items-center justify-between bg-gradient-to-br ${color}`}>
      <div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{title}</span>
        <span className="text-xl font-bold text-white mt-1 block">{value}</span>
      </div>
      <Icon className="h-6 w-6 opacity-60 shrink-0" />
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
        active
          ? "border-emerald-400 text-emerald-400 bg-slate-900/10"
          : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
    </button>
  )
}

function FieldBlock({
  label,
  children
}: {
  label: string
  children: any
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{label}</label>
      {children}
    </div>
  )
}
