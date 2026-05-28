import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import type { SupabaseClient } from '@supabase/supabase-js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export function isDemoMode(): boolean {
  return !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET
}

export function getGoogleAuthUrl(userId: string, siteUrl: string): string {
  const redirectUri = `${siteUrl}/api/integrations/google/callback`

  if (isDemoMode()) {
    // Generate an instant redirect for demo connection
    return `${siteUrl}/api/integrations/google/callback?code=demo_code_123&state=${userId}`
  }

  return (
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID!)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar.events')}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(userId)}`
  )
}

export interface TokenExchangeResult {
  success: boolean
  demo?: boolean
  error?: string
}

export async function exchangeAuthCode(
  code: string,
  userId: string,
  siteUrl: string,
  db: SupabaseClient
): Promise<TokenExchangeResult> {
  if (isDemoMode() || code === 'demo_code_123') {
    // Save dummy configurations for demo mode
    const { error } = await db.from('google_calendar_config').upsert(
      {
        user_id: userId,
        access_token: 'demo_access_token',
        refresh_token: 'demo_refresh_token',
        expiry_date: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
        calendar_id: 'primary',
        status: 'connected',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.error('[google-calendar] Demo config upsert failed:', error)
      return { success: false, error: error.message }
    }

    return { success: true, demo: true }
  }

  const redirectUri = `${siteUrl}/api/integrations/google/callback`

  try {
    const params = new URLSearchParams()
    params.append('code', code)
    params.append('client_id', GOOGLE_CLIENT_ID!)
    params.append('client_secret', GOOGLE_CLIENT_SECRET!)
    params.append('redirect_uri', redirectUri)
    params.append('grant_type', 'authorization_code')

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const payload = await response.json()

    if (!response.ok) {
      console.error('[google-calendar] Token exchange error response:', payload)
      return { success: false, error: payload.error_description || payload.error || 'Failed to exchange token' }
    }

    const accessToken = payload.access_token
    const refreshToken = payload.refresh_token // Note: only returned on first consent or prompt=consent
    const expiresIn = payload.expires_in || 3600

    const encryptedAccessToken = encrypt(accessToken)
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null
    const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Retrieve existing config to preserve refresh token if Google didn't send a new one
    const { data: existing } = await db
      .from('google_calendar_config')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle()

    const finalRefreshToken = encryptedRefreshToken || existing?.refresh_token || null

    const { error: upsertError } = await db.from('google_calendar_config').upsert(
      {
        user_id: userId,
        access_token: encryptedAccessToken,
        refresh_token: finalRefreshToken,
        expiry_date: expiryDate,
        calendar_id: 'primary',
        status: 'connected',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) {
      console.error('[google-calendar] Config upsert failed:', upsertError)
      return { success: false, error: upsertError.message }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[google-calendar] Token exchange exception:', err)
    return { success: false, error: msg }
  }
}

export async function getDecryptedAccessToken(
  userId: string,
  db: SupabaseClient
): Promise<string | null> {
  const { data: config, error } = await db
    .from('google_calendar_config')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !config) {
    return null
  }

  if (config.access_token === 'demo_access_token') {
    return 'demo_access_token'
  }

  const expiry = new Date(config.expiry_date)
  const bufferTime = 60 * 1000 // 1 minute buffer
  const now = new Date()

  // Token is still valid
  if (expiry.getTime() - now.getTime() > bufferTime) {
    try {
      return decrypt(config.access_token)
    } catch (err) {
      console.error('[google-calendar] Token decryption failed:', err)
      return null
    }
  }

  // Token is expired, try to refresh
  if (!config.refresh_token) {
    console.warn('[google-calendar] Token expired and no refresh token available.')
    await db
      .from('google_calendar_config')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    return null
  }

  try {
    let decryptedRefreshToken: string
    try {
      decryptedRefreshToken = decrypt(config.refresh_token)
    } catch (err) {
      console.error('[google-calendar] Refresh token decryption failed:', err)
      return null
    }

    const params = new URLSearchParams()
    params.append('client_id', GOOGLE_CLIENT_ID!)
    params.append('client_secret', GOOGLE_CLIENT_SECRET!)
    params.append('refresh_token', decryptedRefreshToken)
    params.append('grant_type', 'refresh_token')

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const payload = await response.json()

    if (!response.ok) {
      console.error('[google-calendar] Token refresh error response:', payload)
      await db
        .from('google_calendar_config')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      return null
    }

    const newAccessToken = payload.access_token
    const newRefreshToken = payload.refresh_token
    const expiresIn = payload.expires_in || 3600
    const newExpiryDate = new Date(Date.now() + expiresIn * 1000).toISOString()

    const encryptedAccessToken = encrypt(newAccessToken)
    const encryptedRefreshToken = newRefreshToken ? encrypt(newRefreshToken) : config.refresh_token

    await db.from('google_calendar_config').update({
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expiry_date: newExpiryDate,
      status: 'connected',
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)

    return newAccessToken
  } catch (err) {
    console.error('[google-calendar] Token refresh exception:', err)
    return null
  }
}

export interface GoogleEventResponse {
  id: string
  htmlLink?: string
  status?: string
}

export async function createCalendarEvent(
  userId: string,
  db: SupabaseClient,
  event: {
    summary: string
    description?: string
    startDelayMinutes?: number
    durationMinutes?: number
    startTime?: string // Explicit ISO date time string
  }
): Promise<GoogleEventResponse> {
  const accessToken = await getDecryptedAccessToken(userId, db)

  if (!accessToken) {
    throw new Error('Google Calendar integration is not connected or authorization expired.')
  }

  if (accessToken === 'demo_access_token') {
    // Return mock response in demo mode
    return {
      id: 'demo_event_' + Math.random().toString(36).substring(2, 11),
      htmlLink: 'https://calendar.google.com/calendar/r/eventedit',
      status: 'confirmed',
    }
  }

  const duration = event.durationMinutes || 30
  let startTimeObj: Date
  if (event.startTime) {
    startTimeObj = new Date(event.startTime)
  } else {
    const startDelay = event.startDelayMinutes || 0
    startTimeObj = new Date(Date.now() + startDelay * 60 * 1000)
  }
  const endTimeObj = new Date(startTimeObj.getTime() + duration * 60 * 1000)

  const body = {
    summary: event.summary,
    description: event.description || 'Created automatically via Automation Builder',
    start: {
      dateTime: startTimeObj.toISOString(),
    },
    end: {
      dateTime: endTimeObj.toISOString(),
    },
  }

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  const payload = await response.json()

  if (!response.ok) {
    console.error('[google-calendar] Create event error response:', payload)
    throw new Error(payload?.error?.message || 'Failed to create Google Calendar event')
  }

  return {
    id: payload.id,
    htmlLink: payload.htmlLink,
    status: payload.status,
  }
}

export async function updateCalendarEvent(
  userId: string,
  db: SupabaseClient,
  eventId: string,
  event: {
    summary: string
    description?: string
    startTime: string // Explicit ISO date time string
    durationMinutes?: number
  }
): Promise<GoogleEventResponse> {
  const accessToken = await getDecryptedAccessToken(userId, db)

  if (!accessToken) {
    throw new Error('Google Calendar integration is not connected or authorization expired.')
  }

  if (accessToken === 'demo_access_token' || eventId.startsWith('demo_event_')) {
    return {
      id: eventId,
      htmlLink: 'https://calendar.google.com/calendar/r/eventedit',
      status: 'confirmed',
    }
  }

  const duration = event.durationMinutes || 30
  const startTimeObj = new Date(event.startTime)
  const endTimeObj = new Date(startTimeObj.getTime() + duration * 60 * 1000)

  const body = {
    summary: event.summary,
    description: event.description || 'Updated automatically via WA-CRM',
    start: {
      dateTime: startTimeObj.toISOString(),
    },
    end: {
      dateTime: endTimeObj.toISOString(),
    },
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  const payload = await response.json()

  if (!response.ok) {
    console.error('[google-calendar] Update event error response:', payload)
    throw new Error(payload?.error?.message || 'Failed to update Google Calendar event')
  }

  return {
    id: payload.id,
    htmlLink: payload.htmlLink,
    status: payload.status,
  }
}

export async function deleteCalendarEvent(
  userId: string,
  db: SupabaseClient,
  eventId: string
): Promise<void> {
  const accessToken = await getDecryptedAccessToken(userId, db)

  if (!accessToken) {
    throw new Error('Google Calendar integration is not connected or authorization expired.')
  }

  if (accessToken === 'demo_access_token' || eventId.startsWith('demo_event_')) {
    return
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok && response.status !== 404) {
    const payload = await response.json().catch(() => ({}))
    console.error('[google-calendar] Delete event error response:', payload)
    throw new Error(payload?.error?.message || 'Failed to delete Google Calendar event')
  }
}
