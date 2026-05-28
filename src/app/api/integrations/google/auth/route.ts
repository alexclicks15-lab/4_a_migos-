import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleAuthUrl } from '@/lib/google-calendar/client'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const siteUrl = searchParams.get('siteUrl') || new URL(request.url).origin

    const authUrl = getGoogleAuthUrl(user.id, siteUrl)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Error in Google auth GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
