import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeAuthCode } from '@/lib/google-calendar/client'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // Contains the user_id

    // Fallback/Resolve authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const userId = user?.id || state

    if (!userId) {
      console.error('[google-callback] No user resolved from auth or state')
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&error=Unauthorized', request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&error=Missing code', request.url)
      )
    }

    const siteUrl = new URL(request.url).origin

    const result = await exchangeAuthCode(code, userId, siteUrl, supabase)

    if (!result.success) {
      return NextResponse.redirect(
        new URL(
          `/settings?tab=integrations&error=${encodeURIComponent(result.error || 'Failed to exchange tokens')}`,
          request.url
        )
      )
    }

    return NextResponse.redirect(
      new URL('/settings?tab=integrations&connected=true', request.url)
    )
  } catch (error) {
    console.error('Error in Google auth callback:', error)
    return NextResponse.redirect(
      new URL('/settings?tab=integrations&error=Internal server error', request.url)
    )
  }
}
