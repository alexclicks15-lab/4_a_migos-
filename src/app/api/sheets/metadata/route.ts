import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'

type JsonRecord = Record<string, unknown>

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

async function resolveCompanyId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const profile = await supabase.from('profiles').select('id').eq('user_id', user.id).single()
  const { data: userLink } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('profile_id', profile.data?.id)
    .limit(1)
    .maybeSingle()

  if (!userLink) return { supabase, error: NextResponse.json({ error: 'No company resolved' }, { status: 400 }) }
  return { supabase, companyId: userLink.company_id as string }
}

function demoPayload() {
  return {
    files: [
      { id: 'demo-bakery-birthdays', name: 'Bakery Birthday Customers' },
      { id: 'demo-clinic-refills', name: 'Clinic Appointments and Refills' },
      { id: 'demo-subscriptions', name: 'Subscription Renewals' },
    ],
    tabs: ['Customers', 'Appointments', 'Renewals'],
    headers: [
      'Name',
      'Phone',
      'Birthday',
      'Anniversary',
      'Last Cake Order Date',
      'Appointment Date',
      'Medicine End Date',
      'Subscription Expiry',
      'Last Visit Date',
      'Custom Reminder Date',
    ],
    preview: [
      {
        Name: 'Alex Carter',
        Phone: '+1555102030',
        Birthday: new Date().toISOString().slice(0, 10),
        'Appointment Date': new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        'Medicine End Date': new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      },
      {
        Name: 'Sarah Jenkins',
        Phone: '+1555102040',
        Anniversary: new Date().toISOString().slice(0, 10),
        'Subscription Expiry': new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      },
    ],
  }
}

export async function GET(request: Request) {
  const resolved = await resolveCompanyId()
  if ('error' in resolved && resolved.error) return resolved.error

  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')
    const spreadsheetId = searchParams.get('spreadsheetId')
    const sheetName = searchParams.get('sheetName') || 'Sheet1'

    if (!connectionId) return NextResponse.json(demoPayload())

    const { data: connection, error } = await resolved.supabase
      .from('sheet_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('company_id', resolved.companyId)
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    if (connection.credentials?.access_token === 'demo_token') {
      return NextResponse.json(demoPayload())
    }

    const accessToken = connection.credentials?.access_token ? decrypt(connection.credentials.access_token) : ''
    if (!accessToken) return NextResponse.json(demoPayload())

    const filesResponse = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)&pageSize=25",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const filesPayload = await filesResponse.json().catch(() => ({} as JsonRecord)) as { files?: Array<{ id: string; name: string }> }
    const files = filesPayload.files || []

    if (!spreadsheetId) {
      return NextResponse.json({ files, tabs: [], headers: [], preview: [] })
    }

    const metadataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title,sheetId))`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const metadata = await metadataResponse.json().catch(() => ({} as JsonRecord)) as {
      sheets?: Array<{ properties?: { title?: string } }>
    }
    const tabs = (metadata.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean)

    const valuesResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const valuesPayload = await valuesResponse.json().catch(() => ({} as JsonRecord)) as { values?: string[][] }
    const rows = valuesPayload.values || []
    const headers = rows[0] || []
    const preview = rows.slice(1, 6).map((row) => {
      const record: Record<string, string> = {}
      headers.forEach((header, index) => {
        record[header] = row[index] || ''
      })
      return record
    })

    return NextResponse.json({ files, tabs, headers, preview })
  } catch (error) {
    console.error('[sheets-metadata] GET failed:', error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
