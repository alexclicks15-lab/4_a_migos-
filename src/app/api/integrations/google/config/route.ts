import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDecryptedAccessToken, isDemoMode } from '@/lib/google-calendar/client'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: config, error: configError } = await supabase
      .from('google_calendar_config')
      .select('calendar_id, access_token, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (configError) {
      console.error('Error fetching google_calendar_config:', configError)
      return NextResponse.json(
        { connected: false, error: 'Database error' },
        { status: 500 }
      )
    }

    if (!config) {
      return NextResponse.json({
        connected: false,
        demoMode: isDemoMode(),
      })
    }

    // Check if token is healthy
    const token = await getDecryptedAccessToken(user.id, supabase)
    if (!token || config.status === 'disconnected') {
      return NextResponse.json({
        connected: false,
        needsReconnect: true,
        demoMode: isDemoMode(),
      })
    }

    return NextResponse.json({
      connected: true,
      calendarId: config.calendar_id,
      demo: config.access_token === 'demo_access_token',
      demoMode: isDemoMode(),
    })
  } catch (error) {
    console.error('Error in Google config GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: deleteError } = await supabase
      .from('google_calendar_config')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting google_calendar_config:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in Google config DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
