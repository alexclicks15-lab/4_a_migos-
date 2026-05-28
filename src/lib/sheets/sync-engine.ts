import type { SupabaseClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { normalizePhone } from '@/lib/whatsapp/phone-utils'

type SheetRow = Record<string, string | number | boolean | null | undefined>
type JsonRecord = Record<string, unknown>

interface TriggerRule {
  id: string
  label: string
  type: string
  field: string
  enabled: boolean
  offsetDays: number
  recurrence: 'none' | 'yearly' | 'monthly' | 'custom_interval'
  intervalDays?: number
  template: string
}

interface TriggerMatch {
  rule: TriggerRule
  sourceDate: Date
  targetDate: Date
  message: string
}

interface ProcessOptions {
  configId?: string
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

function isGoogleDemoMode(): boolean {
  return !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET
}

function asString(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown execution error'
}

function getMappedValue(row: SheetRow, mapping: Record<string, string>, field: string): string {
  const header = mapping[field]
  return header ? asString(row[header]) : ''
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === '') return null

  if (typeof value === 'number') {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpoch + value * 24 * 60 * 60 * 1000)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const raw = String(value).trim()
  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(.+))?$/)
  if (slash) {
    const first = Number(slash[1])
    const second = Number(slash[2])
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3])
    const dayFirst = first > 12
    const month = dayFirst ? second - 1 : first - 1
    const day = dayFirst ? first : second
    const parsed = new Date(year, month, day)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateOnly(date: Date): string {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString().slice(0, 10)
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000)
}

function sameDay(a: Date, b: Date): boolean {
  return dateOnly(a) === dateOnly(b)
}

function interpolate(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((message, [key, value]) => {
    return message.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), value)
  }, template)
}

function defaultTriggerRules(triggerConfig: JsonRecord): TriggerRule[] {
  const rules: TriggerRule[] = [
    {
      id: 'birthday',
      label: 'Birthday wish',
      type: 'birthday_trigger',
      field: 'birthday',
      enabled: Boolean(triggerConfig.birthday_enabled),
      offsetDays: 0,
      recurrence: 'yearly',
      template: asString(triggerConfig.birthday_template) || 'Happy Birthday {{name}}! Wishing you an amazing year ahead.',
    },
    {
      id: 'anniversary',
      label: 'Wedding anniversary',
      type: 'anniversary_trigger',
      field: 'anniversary',
      enabled: Boolean(triggerConfig.anniversary_enabled),
      offsetDays: 0,
      recurrence: 'yearly',
      template: asString(triggerConfig.anniversary_template) || 'Happy Wedding Anniversary {{name}}. Enjoy a special offer from us.',
    },
    {
      id: 'cake_reorder',
      label: 'Cake reorder',
      type: 'cake_reorder_trigger',
      field: 'birthday',
      enabled: Boolean(triggerConfig.cake_reorder_enabled),
      offsetDays: -7,
      recurrence: 'yearly',
      template: asString(triggerConfig.cake_reorder_template) || 'Hi {{name}}, would you like to order your birthday cake again this year?',
    },
    {
      id: 'appointment_1d',
      label: 'Appointment 1 day before',
      type: 'appointment_reminder',
      field: 'appointment_date',
      enabled: Boolean(triggerConfig.appointment_enabled),
      offsetDays: -1,
      recurrence: 'none',
      template: asString(triggerConfig.appointment_template) || 'Reminder: Your appointment is tomorrow at {{appointment_time}}.',
    },
    {
      id: 'appointment_2h',
      label: 'Appointment 2 hours before',
      type: 'appointment_reminder_2h',
      field: 'appointment_date',
      enabled: Boolean(triggerConfig.appointment_2h_enabled),
      offsetDays: 0,
      recurrence: 'none',
      template: asString(triggerConfig.appointment_2h_template) || 'Reminder: Your appointment is today at {{appointment_time}}.',
    },
    {
      id: 'medicine_refill',
      label: 'Medicine refill',
      type: 'refill_trigger',
      field: 'medicine_end_date',
      enabled: Boolean(triggerConfig.refill_enabled),
      offsetDays: -2,
      recurrence: 'none',
      template: asString(triggerConfig.refill_template) || 'Your medicine may finish in 2 days. Would you like to reorder?',
    },
    {
      id: 'subscription_expiry',
      label: 'Subscription renewal',
      type: 'expiry_trigger',
      field: 'subscription_expiry',
      enabled: Boolean(triggerConfig.expiry_enabled),
      offsetDays: -3,
      recurrence: 'none',
      template: asString(triggerConfig.expiry_template) || 'Your subscription expires in 3 days. Renew now to continue uninterrupted service.',
    },
    {
      id: 'last_visit',
      label: 'Last visit follow-up',
      type: 'inactivity_trigger',
      field: 'last_visit_date',
      enabled: Boolean(triggerConfig.inactivity_enabled),
      offsetDays: 30,
      recurrence: 'none',
      template: asString(triggerConfig.inactivity_template) || 'It has been a while since your last visit. Would you like to book another appointment?',
    },
    {
      id: 'custom_reminder',
      label: 'Custom reminder',
      type: 'custom_date_trigger',
      field: 'custom_reminder_date',
      enabled: Boolean(triggerConfig.custom_enabled),
      offsetDays: Number(triggerConfig.custom_offset_days ?? 0),
      recurrence: (asString(triggerConfig.custom_recurrence) as TriggerRule['recurrence']) || 'none',
      intervalDays: Number(triggerConfig.custom_interval_days || 0) || undefined,
      template: asString(triggerConfig.custom_template) || 'Hi {{name}}, this is your reminder for {{custom_reminder_date}}.',
    },
  ]

  const customRules = Array.isArray(triggerConfig.rules) ? triggerConfig.rules : []
  for (const rule of customRules) {
    if (!rule || typeof rule !== 'object') continue
    const data = rule as JsonRecord
    rules.push({
      id: asString(data.id) || `custom_${rules.length}`,
      label: asString(data.label) || 'Custom workflow',
      type: asString(data.type) || 'custom_date_trigger',
      field: asString(data.field) || 'custom_reminder_date',
      enabled: data.enabled !== false,
      offsetDays: Number(data.offsetDays ?? 0),
      recurrence: (asString(data.recurrence) as TriggerRule['recurrence']) || 'none',
      intervalDays: Number(data.intervalDays || 0) || undefined,
      template: asString(data.template) || 'Hi {{name}}, this is your reminder.',
    })
  }

  return rules.filter((rule) => rule.enabled)
}

function isRuleDue(rule: TriggerRule, sourceDate: Date, today: Date): Date | null {
  if (rule.recurrence === 'yearly') {
    const target = addDays(new Date(today.getFullYear(), sourceDate.getMonth(), sourceDate.getDate()), rule.offsetDays)
    return sameDay(target, today) ? target : null
  }

  if (rule.recurrence === 'monthly') {
    const target = addDays(new Date(today.getFullYear(), today.getMonth(), sourceDate.getDate()), rule.offsetDays)
    return sameDay(target, today) ? target : null
  }

  if (rule.recurrence === 'custom_interval' && rule.intervalDays && rule.intervalDays > 0) {
    const diff = daysBetween(today, sourceDate)
    if (diff >= 0 && diff % rule.intervalDays === Math.abs(rule.offsetDays)) return today
    return null
  }

  const target = addDays(sourceDate, rule.offsetDays)
  return sameDay(target, today) ? target : null
}

function evaluateDateTriggers(
  row: SheetRow,
  mapping: Record<string, string>,
  triggerConfig: JsonRecord,
  variables: Record<string, string>,
  today = new Date()
): TriggerMatch[] {
  const matches: TriggerMatch[] = []

  for (const rule of defaultTriggerRules(triggerConfig)) {
    const rawDate = getMappedValue(row, mapping, rule.field)
    const sourceDate = parseDate(rawDate)
    if (!sourceDate) continue

    const targetDate = isRuleDue(rule, sourceDate, today)
    if (!targetDate) continue

    const message = interpolate(rule.template, {
      ...variables,
      [rule.field]: rawDate,
      appointment_time: sourceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      target_date: dateOnly(targetDate),
    })

    matches.push({ rule, sourceDate, targetDate, message })
  }

  return matches
}

async function fetchGoogleSheetsRows(spreadsheetId: string, sheetName: string, accessToken: string): Promise<SheetRow[]> {
  const range = encodeURIComponent(sheetName || 'Sheet1')
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({} as JsonRecord))
    const message = typeof payload.error === 'object' && payload.error && 'message' in payload.error
      ? String((payload.error as JsonRecord).message)
      : `Failed to fetch Google Sheet: status ${response.status}`
    throw new Error(message)
  }

  const payload = await response.json() as { values?: string[][] }
  const rows = payload.values || []
  if (rows.length === 0) return []

  const headers = rows[0]
  return rows.slice(1).map((row) => {
    const record: SheetRow = {}
    headers.forEach((header, index) => {
      record[header] = row[index] ?? ''
    })
    return record
  })
}

async function fetchAirtableRows(baseId: string, tableName: string, apiKey: string): Promise<SheetRow[]> {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })

  if (!response.ok) {
    throw new Error(`Failed to fetch Airtable: status ${response.status}`)
  }

  const payload = await response.json() as { records?: Array<{ id: string; fields: SheetRow }> }
  return (payload.records || []).map((record) => ({ id: record.id, ...record.fields }))
}

function getSimulatedRows(): SheetRow[] {
  const today = new Date()
  const tomorrow = addDays(today, 1)
  const refill = addDays(today, 2)
  const expiry = addDays(today, 3)

  return [
    {
      Name: 'Alex Carter',
      Phone: '+1555102030',
      Birthday: today.toISOString(),
      Anniversary: '2018-09-12',
      'Last Cake Order Date': '2025-05-18',
      'Appointment Date': tomorrow.toISOString(),
      'Medicine End Date': refill.toISOString(),
      'Subscription Expiry': expiry.toISOString(),
      'Last Visit Date': addDays(today, -30).toISOString(),
      'Custom Reminder Date': today.toISOString(),
    },
    {
      Name: 'Sarah Jenkins',
      Phone: '+1555102040',
      Birthday: '1990-11-04',
      Anniversary: today.toISOString(),
      'Appointment Date': addDays(today, 5).toISOString(),
    },
  ]
}

export async function personalizeMessage(
  templateText: string,
  variables: Record<string, string>,
  useAI: boolean
): Promise<string> {
  const message = interpolate(templateText, variables)
  if (!useAI || !process.env.OPENAI_API_KEY) return message

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Rewrite WhatsApp reminder messages so they are concise, warm, personalized, and preserve the original offer, date, and call to action.',
          },
          {
            role: 'user',
            content: `Template: ${templateText}\nVariables: ${JSON.stringify(variables)}\nDraft: ${message}\nReturn only the rewritten message.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 220,
      }),
    })

    if (!response.ok) return message
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    return payload.choices?.[0]?.message?.content?.trim() || message
  } catch (error) {
    console.error('[sync-engine] AI personalization failed:', error)
    return message
  }
}

async function resolveOwnerUserId(db: SupabaseClient, companyId: string): Promise<string | null> {
  const { data: userLink } = await db
    .from('company_users')
    .select('profile_id')
    .eq('company_id', companyId)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle()

  if (!userLink?.profile_id) return null

  const { data: profile } = await db
    .from('profiles')
    .select('user_id')
    .eq('id', userLink.profile_id)
    .maybeSingle()

  return profile?.user_id || null
}

async function upsertContact(
  db: SupabaseClient,
  companyId: string,
  ownerUserId: string | null,
  phone: string,
  name: string,
  email: string,
  company: string
): Promise<{ contactId: string | null; updated: boolean }> {
  const { data: existing } = await db
    .from('contacts')
    .select('id')
    .eq('company_id', companyId)
    .eq('phone', phone)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await db
      .from('contacts')
      .update({ name, email, company, updated_at: new Date().toISOString() })
      .eq('id', existing.id)

    return { contactId: existing.id, updated: !error }
  }

  const { data: created, error } = await db
    .from('contacts')
    .insert({
      company_id: companyId,
      user_id: ownerUserId,
      phone,
      name,
      email,
      company,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  return { contactId: error ? null : created?.id || null, updated: !error && Boolean(created?.id) }
}

async function alreadySent(
  db: SupabaseClient,
  companyId: string,
  configId: string | undefined,
  contactId: string,
  match: TriggerMatch
): Promise<boolean> {
  if (!configId) return false

  const { data } = await db
    .from('reminder_history')
    .select('id')
    .eq('company_id', companyId)
    .eq('config_id', configId)
    .eq('contact_id', contactId)
    .eq('trigger_type', match.rule.type)
    .eq('target_date', dateOnly(match.targetDate))
    .limit(1)
    .maybeSingle()

  return Boolean(data?.id)
}

async function logReminder(
  db: SupabaseClient,
  payload: {
    companyId: string
    configId?: string
    contactId: string
    phone: string
    match: TriggerMatch
    message: string
    status: 'sent' | 'failed' | 'skipped'
    error?: string
  }
) {
  await db.from('reminder_history').insert({
    company_id: payload.companyId,
    config_id: payload.configId || null,
    contact_id: payload.contactId,
    trigger_type: payload.match.rule.type,
    source_field: payload.match.rule.field,
    target_date: dateOnly(payload.match.targetDate),
    recipient_phone: payload.phone,
    message: payload.message,
    status: payload.status,
    error_message: payload.error || null,
    metadata: {
      rule_id: payload.match.rule.id,
      source_date: payload.match.sourceDate.toISOString(),
    },
  })
}

async function recordSyncedContact(
  db: SupabaseClient,
  companyId: string,
  configId: string | undefined,
  contactId: string,
  phone: string,
  row: SheetRow
) {
  if (!configId) return

  await db.from('synced_contacts').upsert(
    {
      company_id: companyId,
      config_id: configId,
      contact_id: contactId,
      source_row_key: phone,
      source_snapshot: row,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,config_id,source_row_key' }
  )
}

async function ensureConversation(
  db: SupabaseClient,
  companyId: string,
  ownerUserId: string | null,
  contactId: string
): Promise<string | null> {
  const { data: existing } = await db
    .from('conversations')
    .select('id')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: created } = await db
    .from('conversations')
    .insert({
      company_id: companyId,
      user_id: ownerUserId,
      contact_id: contactId,
      status: 'open',
      unread_count: 0,
    })
    .select('id')
    .single()

  return created?.id || null
}

async function incrementAnalytics(db: SupabaseClient, companyId: string, configId: string | undefined) {
  const { data: existing } = await db
    .from('sheet_reminders_analytics')
    .select('id, sent_count, delivered_count')
    .eq('company_id', companyId)
    .eq('config_id', configId || null)
    .maybeSingle()

  if (existing?.id) {
    await db
      .from('sheet_reminders_analytics')
      .update({
        sent_count: (existing.sent_count || 0) + 1,
        delivered_count: (existing.delivered_count || 0) + 1,
      })
      .eq('id', existing.id)
  } else {
    await db.from('sheet_reminders_analytics').insert({
      company_id: companyId,
      config_id: configId || null,
      sent_count: 1,
      delivered_count: 1,
    })
  }
}

export async function processSheetRows(
  rows: SheetRow[],
  companyId: string,
  columnMapping: Record<string, string>,
  triggerConfig: JsonRecord,
  db: SupabaseClient,
  options: ProcessOptions = {}
): Promise<{ processed: number; updated: number; triggered: number; results: JsonRecord[] }> {
  let processed = 0
  let updated = 0
  let triggered = 0
  const results: JsonRecord[] = []
  const ownerUserId = await resolveOwnerUserId(db, companyId)

  const { data: whatsappConfig } = await db
    .from('whatsapp_config')
    .select('access_token, phone_number_id')
    .eq('company_id', companyId)
    .maybeSingle()

  const accessToken = whatsappConfig?.access_token ? decrypt(whatsappConfig.access_token) : ''
  const phoneNumberId = whatsappConfig?.phone_number_id || ''

  for (const row of rows) {
    const rawPhone = getMappedValue(row, columnMapping, 'phone')
    const phone = normalizePhone(rawPhone)
    if (!phone) continue

    const name = getMappedValue(row, columnMapping, 'name') || 'Customer'
    const email = getMappedValue(row, columnMapping, 'email')
    const company = getMappedValue(row, columnMapping, 'company')
    const variables = {
      name,
      phone,
      email,
      company,
      birthday: getMappedValue(row, columnMapping, 'birthday'),
      anniversary: getMappedValue(row, columnMapping, 'anniversary'),
      last_order_date: getMappedValue(row, columnMapping, 'last_order_date'),
      last_cake_order_date: getMappedValue(row, columnMapping, 'last_cake_order_date'),
      appointment_date: getMappedValue(row, columnMapping, 'appointment_date'),
      follow_up_date: getMappedValue(row, columnMapping, 'follow_up_date'),
      subscription_expiry: getMappedValue(row, columnMapping, 'subscription_expiry'),
      medicine_end_date: getMappedValue(row, columnMapping, 'medicine_end_date'),
      custom_reminder_date: getMappedValue(row, columnMapping, 'custom_reminder_date'),
      last_visit_date: getMappedValue(row, columnMapping, 'last_visit_date'),
    }

    processed += 1

    const contact = await upsertContact(db, companyId, ownerUserId, phone, name, email, company)
    if (!contact.contactId) {
      results.push({ phone, name, status: 'failed_contact_sync' })
      continue
    }

    if (contact.updated) updated += 1
    await recordSyncedContact(db, companyId, options.configId, contact.contactId, phone, row)

    const matches = evaluateDateTriggers(row, columnMapping, triggerConfig, variables)
    if (matches.length === 0) {
      results.push({ phone, name, status: 'synced_crm_only' })
      continue
    }

    for (const match of matches) {
      if (await alreadySent(db, companyId, options.configId, contact.contactId, match)) {
        await logReminder(db, {
          companyId,
          configId: options.configId,
          contactId: contact.contactId,
          phone,
          match,
          message: match.message,
          status: 'skipped',
        })
        results.push({ phone, name, status: 'duplicate_skipped', trigger: match.rule.type })
        continue
      }

      const message = await personalizeMessage(match.message, variables, Boolean(triggerConfig.use_ai))

      if (!accessToken || !phoneNumberId) {
        await logReminder(db, {
          companyId,
          configId: options.configId,
          contactId: contact.contactId,
          phone,
          match,
          message,
          status: 'skipped',
          error: 'WhatsApp credentials are not configured',
        })
        results.push({ phone, name, status: 'ready_no_whatsapp_config', trigger: match.rule.type })
        continue
      }

      try {
        const conversationId = await ensureConversation(db, companyId, ownerUserId, contact.contactId)
        const sendResult = await sendTextMessage({ phoneNumberId, accessToken, to: phone, text: message })

        if (conversationId) {
          await db.from('messages').insert({
            conversation_id: conversationId,
            company_id: companyId,
            sender_type: 'bot',
            content_type: 'text',
            content_text: message,
            message_id: sendResult.messageId || `sheet-${crypto.randomUUID()}`,
            status: 'sent',
          })

          await db
            .from('conversations')
            .update({ last_message_text: message, last_message_at: new Date().toISOString() })
            .eq('id', conversationId)
        }

        await logReminder(db, {
          companyId,
          configId: options.configId,
          contactId: contact.contactId,
          phone,
          match,
          message,
          status: 'sent',
        })
        await incrementAnalytics(db, companyId, options.configId)

        if (ownerUserId) {
          await runAutomationsForTrigger({
            userId: ownerUserId,
            triggerType: 'google_sheets_row_added',
            contactId: contact.contactId,
            context: {
              message_text: message,
              conversation_id: conversationId || undefined,
              vars: { ...row, triggeredType: match.rule.type },
            },
          })
        }

        triggered += 1
        results.push({ phone, name, status: 'triggered', trigger: match.rule.type })
      } catch (error) {
        const errorMessage = getErrorMessage(error)
        await logReminder(db, {
          companyId,
          configId: options.configId,
          contactId: contact.contactId,
          phone,
          match,
          message,
          status: 'failed',
          error: errorMessage,
        })
        results.push({ phone, name, status: 'failed_sending', trigger: match.rule.type, error: errorMessage })
      }
    }
  }

  return { processed, updated, triggered, results }
}

export async function syncSpreadsheet(
  configId: string,
  companyId: string,
  db: SupabaseClient
): Promise<{ success: boolean; processed: number; updated: number; triggered?: number; error?: string }> {
  try {
    const { data: config, error: configError } = await db
      .from('sheet_sync_configs')
      .select('*')
      .eq('id', configId)
      .eq('company_id', companyId)
      .single()

    if (configError || !config) throw new Error(`Configuration not found: ${configError?.message || ''}`)
    if (config.status === 'paused' || config.automation_enabled === false) {
      return { success: true, processed: 0, updated: 0, triggered: 0 }
    }

    const { data: connection, error: connectionError } = await db
      .from('sheet_connections')
      .select('*')
      .eq('id', config.connection_id)
      .single()

    if (connectionError || !connection) throw new Error(`Connection not found: ${connectionError?.message || ''}`)

    let rows: SheetRow[] = []
    if (connection.type === 'google_sheets') {
      if (isGoogleDemoMode() || connection.credentials?.access_token === 'demo_token') {
        rows = getSimulatedRows()
      } else {
        const token = connection.credentials?.access_token ? decrypt(connection.credentials.access_token) : ''
        rows = await fetchGoogleSheetsRows(config.spreadsheet_id, config.sheet_name, token)
      }
    } else if (connection.type === 'airtable') {
      if (connection.credentials?.api_key === 'demo_key') {
        rows = getSimulatedRows()
      } else {
        const apiKey = connection.credentials?.api_key ? decrypt(connection.credentials.api_key) : ''
        rows = await fetchAirtableRows(config.spreadsheet_id, config.sheet_name, apiKey)
      }
    } else {
      rows = getSimulatedRows()
    }

    const previewRows = rows.slice(0, 5)
    const result = await processSheetRows(rows, companyId, config.column_mapping || {}, config.trigger_config || {}, db, {
      configId,
    })

    await db.from('sheet_sync_logs').insert({
      company_id: companyId,
      config_id: configId,
      status: 'success',
      rows_processed: result.processed,
      rows_updated: result.updated,
    })

    await db.from('scheduler_logs').insert({
      company_id: companyId,
      config_id: configId,
      status: 'success',
      job_type: 'sheet_sync',
      message: `Scanned ${result.processed} rows and triggered ${result.triggered} reminders.`,
      rows_scanned: result.processed,
      reminders_triggered: result.triggered,
    })

    await db
      .from('sheet_sync_configs')
      .update({
        last_synced_at: new Date().toISOString(),
        status: 'active',
        preview_rows: previewRows,
      })
      .eq('id', configId)

    await db
      .from('sheet_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id)

    return { success: true, processed: result.processed, updated: result.updated, triggered: result.triggered }
  } catch (error) {
    const message = getErrorMessage(error)
    console.error('[sync-engine] spreadsheet sync execution failed:', error)

    await db.from('sheet_sync_logs').insert({
      company_id: companyId,
      config_id: configId,
      status: 'error',
      error_message: message,
    })

    await db.from('scheduler_logs').insert({
      company_id: companyId,
      config_id: configId,
      status: 'error',
      job_type: 'sheet_sync',
      message,
    })

    await db.from('sheet_sync_configs').update({ status: 'error' }).eq('id', configId)
    return { success: false, processed: 0, updated: 0, triggered: 0, error: message }
  }
}

export async function parseAndSyncUploadedFile(
  fileBuffer: Buffer,
  fileName: string,
  companyId: string,
  columnMapping: Record<string, string>,
  triggerConfig: JsonRecord,
  db: SupabaseClient
): Promise<{ success: boolean; processed: number; updated: number; triggered: number; results: JsonRecord[]; error?: string }> {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<SheetRow>(worksheet, { defval: '' })

    if (rows.length === 0) throw new Error(`Spreadsheet "${fileName}" appears to be empty`)

    const result = await processSheetRows(rows, companyId, columnMapping, triggerConfig, db)
    return { success: true, ...result }
  } catch (error) {
    const message = getErrorMessage(error)
    console.error('[sync-engine] Excel upload sync failed:', error)
    return { success: false, processed: 0, updated: 0, triggered: 0, results: [], error: message }
  }
}
