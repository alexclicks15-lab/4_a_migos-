import { supabaseAdmin } from '@/lib/automations/admin-client'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar/client'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import type { Appointment, AppointmentSlot, AppointmentToken } from '@/types'

/**
 * Standard business hours configurations
 */
export interface BusinessHours {
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start: string // 'HH:MM' e.g. '09:00'
  end: string // 'HH:MM' e.g. '17:00'
  closed: boolean
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours[] = [
  { dayOfWeek: 0, start: '09:00', end: '17:00', closed: true }, // Sun
  { dayOfWeek: 1, start: '09:00', end: '17:00', closed: false }, // Mon
  { dayOfWeek: 2, start: '09:00', end: '17:00', closed: false }, // Tue
  { dayOfWeek: 3, start: '09:00', end: '17:00', closed: false }, // Wed
  { dayOfWeek: 4, start: '09:00', end: '17:00', closed: false }, // Thu
  { dayOfWeek: 5, start: '09:00', end: '17:00', closed: false }, // Fri
  { dayOfWeek: 6, start: '10:00', end: '14:00', closed: false }, // Sat
]

export const DEFAULT_HOLIDAYS = [
  '2026-01-01', // New Year
  '2026-12-25', // Christmas
]

/**
 * Dynamic Slot Generator
 * Returns slots for a specific date, checking capacity, locks, and availability.
 */
export async function generateSlotsForDate(
  userId: string,
  dateStr: string,
  options?: {
    location?: string
    slotDurationMinutes?: number
    bufferMinutes?: number
    capacity?: number
    businessHours?: BusinessHours[]
    holidays?: string[]
  }
): Promise<any[]> {
  const db = supabaseAdmin()
  const location = options?.location || 'Main Office'
  const duration = options?.slotDurationMinutes || 30
  const buffer = options?.bufferMinutes || 10
  const capacity = options?.capacity || 1
  const hoursConfig = options?.businessHours || DEFAULT_BUSINESS_HOURS
  const holidays = options?.holidays || DEFAULT_HOLIDAYS

  // 1. Holiday Check
  if (holidays.includes(dateStr)) {
    return []
  }

  // 2. Day of Week Business Hours check
  const dateObj = new Date(dateStr)
  const dayOfWeek = dateObj.getUTCDay() // UTC safe check
  const dayHours = hoursConfig.find((h) => h.dayOfWeek === dayOfWeek)
  if (!dayHours || dayHours.closed) {
    return []
  }

  // 3. Generate candidate slots
  const slots: any[] = []
  const [startH, startM] = dayHours.start.split(':').map(Number)
  const [endH, endM] = dayHours.end.split(':').map(Number)

  const startTime = new Date(dateStr)
  startTime.setUTCHours(startH, startM, 0, 0)
  
  const endTime = new Date(dateStr)
  endTime.setUTCHours(endH, endM, 0, 0)

  // Fetch persisted slots for this date and location
  const { data: dbSlots } = await db
    .from('appointment_slots')
    .select('*')
    .eq('user_id', userId)
    .eq('slot_date', dateStr)
    .eq('location', location)

  const dbSlotsMap = new Map<string, any>()
  if (dbSlots) {
    dbSlots.forEach((slot) => {
      // Keyed by start_time string 'HH:MM:SS'
      dbSlotsMap.set(slot.start_time, slot)
    })
  }

  const now = new Date()

  let current = new Date(startTime)
  while (current.getTime() + duration * 60 * 1000 <= endTime.getTime()) {
    const next = new Date(current.getTime() + duration * 60 * 1000)
    
    const startStr = current.toISOString().split('T')[1].substring(0, 5) // 'HH:MM'
    const endStr = next.toISOString().split('T')[1].substring(0, 5) // 'HH:MM'
    const startTimeDbFormat = startStr + ':00'

    // Check DB Slot status
    const dbSlot = dbSlotsMap.get(startTimeDbFormat)
    let isBooked = false
    let isLocked = false
    let bookedCount = 0
    let slotId = dbSlot?.id || null

    if (dbSlot) {
      bookedCount = dbSlot.booked_count
      isBooked = dbSlot.is_booked || bookedCount >= dbSlot.capacity
      
      if (dbSlot.locked_until) {
        const lockedUntil = new Date(dbSlot.locked_until)
        if (lockedUntil > now) {
          isLocked = true
        }
      }
    }

    // Past slot filter
    const slotDateTime = new Date(`${dateStr}T${startStr}:00.000Z`)
    const isPast = slotDateTime < now

    if (!isPast) {
      slots.push({
        id: slotId,
        date: dateStr,
        startTime: startStr,
        endTime: endStr,
        isBooked,
        isLocked,
        capacity: dbSlot?.capacity || capacity,
        bookedCount,
        location,
      })
    }

    // Advance by duration + buffer
    current = new Date(next.getTime() + buffer * 60 * 1000)
  }

  return slots
}

/**
 * Lock Slot for a temporary booking session (5 mins)
 */
export async function lockSlot(
  userId: string,
  dateStr: string,
  timeStr: string,
  contactId: string,
  location: string = 'Main Office'
): Promise<{ success: boolean; slot?: any; error?: string }> {
  const db = supabaseAdmin()
  const startTimeDb = timeStr.includes(':') && timeStr.split(':').length === 2 ? timeStr + ':00' : timeStr

  // 1. Find or create slot row
  let { data: slot, error: fetchErr } = await db
    .from('appointment_slots')
    .select('*')
    .eq('user_id', userId)
    .eq('slot_date', dateStr)
    .eq('start_time', startTimeDb)
    .eq('location', location)
    .maybeSingle()

  if (fetchErr) return { success: false, error: fetchErr.message }

  const now = new Date()
  const lockedUntil = new Date(now.getTime() + 5 * 60 * 1000).toISOString() // 5 min lock

  if (!slot) {
    // Generate end time
    const [h, m] = timeStr.split(':').map(Number)
    const endH = m + 30 >= 60 ? h + 1 : h
    const endM = m + 30 >= 60 ? (m + 30) % 60 : m + 30
    const endTimeDb = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`

    const { data: newSlot, error: insertErr } = await db
      .from('appointment_slots')
      .insert({
        user_id: userId,
        slot_date: dateStr,
        start_time: startTimeDb,
        end_time: endTimeDb,
        capacity: 1,
        booked_count: 0,
        locked_until: lockedUntil,
        locked_by_contact_id: contactId,
        location,
        is_booked: false
      })
      .select('*')
      .single()

    if (insertErr) return { success: false, error: insertErr.message }
    slot = newSlot
  } else {
    // Check if slot is already booked
    if (slot.is_booked || slot.booked_count >= slot.capacity) {
      return { success: false, error: 'Slot is already booked.' }
    }

    // Check if slot is locked by someone else
    if (slot.locked_until) {
      const dbLock = new Date(slot.locked_until)
      if (dbLock > now && slot.locked_by_contact_id !== contactId) {
        return { success: false, error: 'Slot is locked by another customer.' }
      }
    }

    // Apply/Refresh lock
    const { data: updatedSlot, error: updateErr } = await db
      .from('appointment_slots')
      .update({
        locked_until: lockedUntil,
        locked_by_contact_id: contactId
      })
      .eq('id', slot.id)
      .select('*')
      .single()

    if (updateErr) return { success: false, error: updateErr.message }
    slot = updatedSlot
  }

  return { success: true, slot }
}

/**
 * Helper to check and create/associate a tag for a contact
 */
async function addTagToContact(db: any, userId: string, contactId: string, tagName: string) {
  let { data: tag } = await db
    .from('tags')
    .select('id')
    .eq('user_id', userId)
    .eq('name', tagName)
    .maybeSingle()

  if (!tag) {
    const { data: newTag, error } = await db
      .from('tags')
      .insert({ user_id: userId, name: tagName, color: '#f43f5e' })
      .select('id')
      .single()
    if (!error && newTag) tag = newTag
  }

  if (tag) {
    await db.from('contact_tags').upsert(
      { contact_id: contactId, tag_id: tag.id },
      { onConflict: 'contact_id,tag_id' }
    )
  }
}

/**
 * Generate unique sequential token number
 */
export async function generateTokenNumber(
  userId: string,
  branchPrefix: string = 'A',
  resetDaily: boolean = true
): Promise<AppointmentToken> {
  const db = supabaseAdmin()
  
  let nextSeq = 101
  if (resetDaily) {
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    const { data } = await db
      .from('appointment_tokens')
      .select('sequence_number')
      .eq('user_id', userId)
      .eq('branch_prefix', branchPrefix)
      .gte('created_at', startOfDay.toISOString())
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      nextSeq = data.sequence_number + 1
    }
  } else {
    const { data } = await db
      .from('appointment_tokens')
      .select('sequence_number')
      .eq('user_id', userId)
      .eq('branch_prefix', branchPrefix)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      nextSeq = data.sequence_number + 1
    }
  }

  const tokenNumber = `${branchPrefix}${nextSeq}`

  const { data: tokenRecord, error } = await db
    .from('appointment_tokens')
    .insert({
      user_id: userId,
      token_number: tokenNumber,
      sequence_number: nextSeq,
      branch_prefix: branchPrefix
    })
    .select('*')
    .single()

  if (error) throw error
  return tokenRecord
}

/**
 * Calculate Queue Position
 */
export async function getQueuePosition(
  userId: string,
  dateStr: string,
  appointmentId: string,
  location: string = 'Main Office'
): Promise<number> {
  const db = supabaseAdmin()
  
  // Find target appointment start_time
  const { data: targetAppt } = await db
    .from('appointments')
    .select('start_time')
    .eq('id', appointmentId)
    .single()

  if (!targetAppt) return 1

  // Count how many confirmed/pending appointments are earlier than this start_time on the same date/location
  const { count } = await db
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('appointment_date', dateStr)
    .eq('location', location)
    .in('status', ['confirmed', 'pending'])
    .lt('start_time', targetAppt.start_time)

  return (count || 0) + 1
}

/**
 * Book Appointment
 */
export async function bookAppointment(
  userId: string,
  contactId: string,
  service: string,
  dateStr: string,
  timeStr: string,
  options?: {
    location?: string
    notes?: string
    agentId?: string
    branchPrefix?: string
    revenue?: number
  }
): Promise<{ success: boolean; appointment?: Appointment; token?: AppointmentToken; queuePosition?: number; error?: string }> {
  const db = supabaseAdmin()
  const location = options?.location || 'Main Office'
  const notes = options?.notes || ''
  const agentId = options?.agentId || null
  const branchPrefix = options?.branchPrefix || 'A'
  const revenue = options?.revenue || 0

  const startTimeDb = timeStr.includes(':') && timeStr.split(':').length === 2 ? timeStr + ':00' : timeStr

  try {
    // 1. Lock slot to secure it
    const lockRes = await lockSlot(userId, dateStr, timeStr, contactId, location)
    if (!lockRes.success || !lockRes.slot) {
      return { success: false, error: lockRes.error || 'Failed to lock slot.' }
    }
    const slot = lockRes.slot

    // 2. Generate token
    const token = await generateTokenNumber(userId, branchPrefix, true)

    // 3. Create ISO start / end times
    const startDateTime = new Date(`${dateStr}T${timeStr}:00.000Z`)
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000) // 30m duration default

    // 4. Create appointment
    const { data: appointment, error: apptErr } = await db
      .from('appointments')
      .insert({
        user_id: userId,
        contact_id: contactId,
        service,
        slot_id: slot.id,
        appointment_date: dateStr,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: 'confirmed',
        token_id: token.id,
        agent_id: agentId,
        location,
        notes,
        revenue
      })
      .select('*')
      .single()

    if (apptErr) throw apptErr

    // 5. Update slot booked_count
    const nextBookedCount = slot.booked_count + 1
    const isBooked = nextBookedCount >= slot.capacity
    await db
      .from('appointment_slots')
      .update({
        booked_count: nextBookedCount,
        is_booked: isBooked,
        locked_until: null, // clear lock
        locked_by_contact_id: null
      })
      .eq('id', slot.id)

    // 6. Update Contact profile tags & timeline note
    await addTagToContact(db, userId, contactId, 'appointment_booked')
    await addTagToContact(db, userId, contactId, 'high_intent')
    await addTagToContact(db, userId, contactId, 'consultation_lead')

    await db.from('contact_notes').insert({
      contact_id: contactId,
      user_id: userId,
      note_text: `🗓️ Appointment Booked: ${service} on ${dateStr} at ${timeStr} (${location}). Token: ${token.token_number}`
    })

    // 7. Log activity
    await db.from('appointment_logs').insert({
      appointment_id: appointment.id,
      action: 'booked',
      detail: `Token: ${token.token_number}, Service: ${service}`
    })

    // 8. Schedule reminders
    const reminders = [
      { type: 'before_24h', offsetMs: -24 * 60 * 60 * 1000 },
      { type: 'before_2h', offsetMs: -2 * 60 * 60 * 1000 },
      { type: 'before_30m', offsetMs: -30 * 60 * 1000 },
    ]

    for (const r of reminders) {
      const scheduledTime = new Date(startDateTime.getTime() + r.offsetMs)
      if (scheduledTime > new Date()) {
        await db.from('appointment_reminders').insert({
          appointment_id: appointment.id,
          reminder_type: r.type,
          scheduled_at: scheduledTime.toISOString(),
          is_sent: false
        })
      }
    }

    // 9. Sync with Google Calendar
    let updatedAppt = appointment
    try {
      const contactData = await db.from('contacts').select('phone, name').eq('id', contactId).single()
      const calendarResult = await createCalendarEvent(userId, db, {
        summary: `Appointment: ${service} - ${contactData.data?.name || 'Customer'}`,
        description: `Token: ${token.token_number}\nService: ${service}\nBranch: ${location}\nNotes: ${notes}`,
        startTime: startDateTime.toISOString(),
        durationMinutes: 30
      })

      if (calendarResult.id) {
        const { data: finalAppt } = await db
          .from('appointments')
          .update({
            google_calendar_event_id: calendarResult.id,
            google_calendar_link: calendarResult.htmlLink || null
          })
          .eq('id', appointment.id)
          .select('*')
          .single()
        if (finalAppt) updatedAppt = finalAppt
      }
    } catch (gcalErr) {
      console.error('[booking-system] Google Calendar sync failed:', gcalErr)
    }

    // 10. Queue position
    const queuePosition = await getQueuePosition(userId, dateStr, appointment.id, location)

    // 11. Trigger automation flow
    runAutomationsForTrigger({
      userId,
      triggerType: 'appointment_booked',
      contactId,
      context: {
        message_text: `Appointment booked token: ${token.token_number}`,
        vars: {
          appointment_id: appointment.id,
          appointment_service: service,
          appointment_date: dateStr,
          appointment_time: timeStr,
          appointment_token: token.token_number,
          appointment_location: location,
          queue_position: queuePosition
        }
      }
    }).catch((e) => console.error('[booking-system] Automation trigger failed:', e))

    return {
      success: true,
      appointment: updatedAppt,
      token,
      queuePosition
    }
  } catch (error: any) {
    console.error('[booking-system] bookAppointment error:', error)
    return { success: false, error: error.message || 'An unexpected error occurred during booking.' }
  }
}

/**
 * Reschedule Appointment
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newDateStr: string,
  newTimeStr: string
): Promise<{ success: boolean; appointment?: Appointment; error?: string }> {
  const db = supabaseAdmin()
  
  try {
    // 1. Fetch current appointment
    const { data: appt, error: fetchErr } = await db
      .from('appointments')
      .select('*, appointment_slots(*), appointment_tokens(*)')
      .eq('id', appointmentId)
      .single()

    if (fetchErr || !appt) return { success: false, error: 'Appointment not found.' }

    const userId = appt.user_id
    const contactId = appt.contact_id
    const location = appt.location || 'Main Office'

    // 2. Lock and book new slot
    const lockRes = await lockSlot(userId, newDateStr, newTimeStr, contactId, location)
    if (!lockRes.success || !lockRes.slot) {
      return { success: false, error: `New slot unavailable: ${lockRes.error}` }
    }
    const newSlot = lockRes.slot

    // 3. Release old slot
    if (appt.slot_id) {
      const { data: oldSlot } = await db
        .from('appointment_slots')
        .select('*')
        .eq('id', appt.slot_id)
        .maybeSingle()

      if (oldSlot) {
        const prevCount = Math.max(0, oldSlot.booked_count - 1)
        await db
          .from('appointment_slots')
          .update({
            booked_count: prevCount,
            is_booked: prevCount >= oldSlot.capacity
          })
          .eq('id', appt.slot_id)
      }
    }

    // 4. Update appointment datetime values
    const startDateTime = new Date(`${newDateStr}T${newTimeStr}:00.000Z`)
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000)

    const { data: updatedAppt, error: updateErr } = await db
      .from('appointments')
      .update({
        slot_id: newSlot.id,
        appointment_date: newDateStr,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: 'rescheduled',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .select('*')
      .single()

    if (updateErr || !updatedAppt) throw updateErr || new Error('Update failed')

    // 5. Update slot booked count
    const nextBookedCount = newSlot.booked_count + 1
    await db
      .from('appointment_slots')
      .update({
        booked_count: nextBookedCount,
        is_booked: nextBookedCount >= newSlot.capacity,
        locked_until: null,
        locked_by_contact_id: null
      })
      .eq('id', newSlot.id)

    // 6. Google Calendar Sync
    if (appt.google_calendar_event_id) {
      try {
        const contactData = await db.from('contacts').select('name').eq('id', contactId).single()
        await updateCalendarEvent(userId, db, appt.google_calendar_event_id, {
          summary: `Rescheduled: ${appt.service} - ${contactData.data?.name || 'Customer'}`,
          startTime: startDateTime.toISOString(),
          description: `Token: ${appt.appointment_tokens?.token_number}\nService: ${appt.service}\nBranch: ${location}\nNotes: ${appt.notes}`
        })
      } catch (gcalErr) {
        console.error('[booking-system] Google Calendar update failed:', gcalErr)
      }
    }

    // 7. Update timeline notes
    await db.from('contact_notes').insert({
      contact_id: contactId,
      user_id: userId,
      note_text: `🔁 Appointment Rescheduled: ${appt.service} moved to ${newDateStr} at ${newTimeStr} (${location}).`
    })

    // 8. Log activity
    await db.from('appointment_logs').insert({
      appointment_id: appointmentId,
      action: 'rescheduled',
      detail: `New date: ${newDateStr} at ${newTimeStr}`
    })

    // 9. Re-schedule reminders
    await db.from('appointment_reminders').delete().eq('appointment_id', appointmentId).eq('is_sent', false)
    const reminders = [
      { type: 'before_24h', offsetMs: -24 * 60 * 60 * 1000 },
      { type: 'before_2h', offsetMs: -2 * 60 * 60 * 1000 },
      { type: 'before_30m', offsetMs: -30 * 60 * 1000 },
    ]
    for (const r of reminders) {
      const scheduledTime = new Date(startDateTime.getTime() + r.offsetMs)
      if (scheduledTime > new Date()) {
        await db.from('appointment_reminders').insert({
          appointment_id: appointmentId,
          reminder_type: r.type,
          scheduled_at: scheduledTime.toISOString(),
          is_sent: false
        })
      }
    }

    // 10. Trigger automation
    runAutomationsForTrigger({
      userId,
      triggerType: 'appointment_rescheduled',
      contactId,
      context: {
        message_text: `Appointment rescheduled: ${appt.appointment_tokens?.token_number}`,
        vars: {
          appointment_id: appointmentId,
          appointment_service: appt.service,
          appointment_date: newDateStr,
          appointment_time: newTimeStr,
          appointment_token: appt.appointment_tokens?.token_number,
          appointment_location: location
        }
      }
    }).catch((e) => console.error('[booking-system] Automation trigger failed:', e))

    return { success: true, appointment: updatedAppt }
  } catch (error: any) {
    console.error('[booking-system] rescheduleAppointment error:', error)
    return { success: false, error: error.message || 'An unexpected error occurred during rescheduling.' }
  }
}

/**
 * Cancel Appointment
 */
export async function cancelAppointment(
  appointmentId: string,
  reason: string = 'Requested by customer'
): Promise<{ success: boolean; error?: string }> {
  const db = supabaseAdmin()
  
  try {
    const { data: appt, error: fetchErr } = await db
      .from('appointments')
      .select('*, appointment_slots(*), appointment_tokens(*)')
      .eq('id', appointmentId)
      .single()

    if (fetchErr || !appt) return { success: false, error: 'Appointment not found.' }

    const userId = appt.user_id
    const contactId = appt.contact_id

    // 1. Release Slot
    if (appt.slot_id && appt.appointment_slots) {
      const prevCount = Math.max(0, appt.appointment_slots.booked_count - 1)
      await db
        .from('appointment_slots')
        .update({
          booked_count: prevCount,
          is_booked: prevCount >= appt.appointment_slots.capacity
        })
        .eq('id', appt.slot_id)
    }

    // 2. Set status to cancelled
    await db
      .from('appointments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)

    // 3. Clear pending reminders
    await db.from('appointment_reminders').delete().eq('appointment_id', appointmentId).eq('is_sent', false)

    // 4. Delete calendar event
    if (appt.google_calendar_event_id) {
      try {
        await deleteCalendarEvent(userId, db, appt.google_calendar_event_id)
      } catch (gcalErr) {
        console.error('[booking-system] Google Calendar delete failed:', gcalErr)
      }
    }

    // 5. Update timeline tags/notes
    await db.from('contact_notes').insert({
      contact_id: contactId,
      user_id: userId,
      note_text: `❌ Appointment Cancelled: ${appt.service} scheduled on ${appt.appointment_date}. Reason: ${reason}`
    })

    // 6. Log activity
    await db.from('appointment_logs').insert({
      appointment_id: appointmentId,
      action: 'cancelled',
      detail: `Reason: ${reason}`
    })

    // 7. Trigger automation
    runAutomationsForTrigger({
      userId,
      triggerType: 'appointment_cancelled',
      contactId,
      context: {
        message_text: `Appointment cancelled: ${appt.appointment_tokens?.token_number}`,
        vars: {
          appointment_id: appointmentId,
          appointment_service: appt.service,
          appointment_date: appt.appointment_date,
          appointment_token: appt.appointment_tokens?.token_number,
          cancel_reason: reason
        }
      }
    }).catch((e) => console.error('[booking-system] Automation trigger failed:', e))

    return { success: true }
  } catch (error: any) {
    console.error('[booking-system] cancelAppointment error:', error)
    return { success: false, error: error.message || 'An unexpected error occurred during cancellation.' }
  }
}

/**
 * Check In Appointment
 */
export async function checkInAppointment(appointmentId: string): Promise<boolean> {
  const db = supabaseAdmin()
  const { data: appt } = await db.from('appointments').select('*').eq('id', appointmentId).single()
  if (!appt) return false

  const { error } = await db
    .from('appointments')
    .update({ status: 'pending', updated_at: new Date().toISOString() }) // check-in goes back to pending/waiting
    .eq('id', appointmentId)

  if (error) return false

  await db.from('contact_notes').insert({
    contact_id: appt.contact_id,
    user_id: appt.user_id,
    note_text: `🚶 Checked In: Appointment for ${appt.service} is checked in and waiting in queue.`
  })

  await db.from('appointment_logs').insert({
    appointment_id: appointmentId,
    action: 'checked_in'
  })

  return true
}

/**
 * Complete Appointment
 */
export async function completeAppointment(appointmentId: string, revenue: number = 0): Promise<boolean> {
  const db = supabaseAdmin()
  const { data: appt } = await db.from('appointments').select('*').eq('id', appointmentId).single()
  if (!appt) return false

  const { error } = await db
    .from('appointments')
    .update({ status: 'completed', revenue, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)

  if (error) return false

  await db.from('contact_notes').insert({
    contact_id: appt.contact_id,
    user_id: appt.user_id,
    note_text: `✅ Appointment Completed: ${appt.service}. Recorded Revenue: $${revenue}`
  })

  await db.from('appointment_logs').insert({
    appointment_id: appointmentId,
    action: 'completed',
    detail: `Revenue: $${revenue}`
  })

  // Schedule follow-up triggers
  // feedback: +1 hour, review: +1 day, upsell: +2 days
  const now = new Date()
  const followups = [
    { type: 'after_feedback', delay: 1 * 60 * 60 * 1000 },
    { type: 'after_review', delay: 24 * 60 * 60 * 1000 },
    { type: 'after_upsell', delay: 48 * 60 * 60 * 1000 }
  ]

  for (const f of followups) {
    await db.from('appointment_reminders').insert({
      appointment_id: appointmentId,
      reminder_type: f.type,
      scheduled_at: new Date(now.getTime() + f.delay).toISOString(),
      is_sent: false
    })
  }

  // Trigger automation
  runAutomationsForTrigger({
    userId: appt.user_id,
    triggerType: 'appointment_completed',
    contactId: appt.contact_id,
    context: {
      message_text: `Appointment completed`,
      vars: {
        appointment_id: appointmentId,
        appointment_service: appt.service,
        appointment_revenue: revenue
      }
    }
  }).catch((e) => console.error('[booking-system] Automation trigger failed:', e))

  return true
}

/**
 * No Show Appointment
 */
export async function noShowAppointment(appointmentId: string): Promise<boolean> {
  const db = supabaseAdmin()
  const { data: appt } = await db.from('appointments').select('*').eq('id', appointmentId).single()
  if (!appt) return false

  const { error } = await db
    .from('appointments')
    .update({ status: 'no_show', updated_at: new Date().toISOString() })
    .eq('id', appointmentId)

  if (error) return false

  await db.from('contact_notes').insert({
    contact_id: appt.contact_id,
    user_id: appt.user_id,
    note_text: `⚠️ No Show: Customer did not attend appointment for ${appt.service}.`
  })

  await db.from('appointment_logs').insert({
    appointment_id: appointmentId,
    action: 'no_show'
  })

  // Trigger automation
  runAutomationsForTrigger({
    userId: appt.user_id,
    triggerType: 'appointment_noshow',
    contactId: appt.contact_id,
    context: {
      message_text: `Appointment no-show`,
      vars: {
        appointment_id: appointmentId,
        appointment_service: appt.service
      }
    }
  }).catch((e) => console.error('[booking-system] Automation trigger failed:', e))

  return true
}
