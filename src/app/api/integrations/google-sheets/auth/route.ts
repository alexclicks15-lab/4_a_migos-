import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const siteUrlRaw = searchParams.get('siteUrl')
    const siteUrl = siteUrlRaw || new URL(request.url).origin
    const redirectUri = `${siteUrl}/api/integrations/google-sheets/callback`

    if (!GOOGLE_CLIENT_ID) {
      // Direct Sandbox mock redirect
      return NextResponse.redirect(
        `${siteUrl}/api/integrations/google-sheets/callback?code=demo_token_123&state=${user.id}`
      )
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID!)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly')}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(user.id)}`

    return NextResponse.redirect(authUrl)
  } catch (err: any) {
    console.error('[sheets-auth] Redirect failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
