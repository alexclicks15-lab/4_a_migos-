import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/whatsapp/encryption'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // Contains the user_id

    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || state

    if (!userId) {
      console.error('[sheets-callback] No user resolved')
      return NextResponse.redirect(new URL('/sheets?error=Unauthorized', request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/sheets?error=Missing code', request.url))
    }

    const siteUrl = new URL(request.url).origin
    const redirectUri = `${siteUrl}/api/integrations/google-sheets/callback`

    const profile = await supabase.from('profiles').select('id').eq('user_id', userId).single()
    const { data: userLink } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('profile_id', profile.data?.id)
      .limit(1)
      .maybeSingle()

    if (!userLink) {
      console.error('[sheets-callback] No company resolved for profile:', profile.data?.id)
      return NextResponse.redirect(new URL('/sheets?error=No company resolved', request.url))
    }

    const companyId = userLink.company_id

    // 1. Sandbox mode / Demo redirect
    if (!GOOGLE_CLIENT_ID || code === 'demo_token_123') {
      const { error } = await supabase.from('sheet_connections').insert({
        company_id: companyId,
        name: 'Sandbox Google Sheets',
        type: 'google_sheets',
        credentials: {
          access_token: 'demo_token',
          refresh_token: 'demo_refresh_token',
          expiry_date: new Date(Date.now() + 3600 * 1000).toISOString()
        }
      })

      if (error) {
        console.error('[sheets-callback] Demo connection insert failed:', error)
        return NextResponse.redirect(new URL(`/sheets?error=${encodeURIComponent(error.message)}`, request.url))
      }

      return NextResponse.redirect(new URL('/sheets?connected=true', request.url))
    }

    // 2. Real Token Exchange
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
      console.error('[sheets-callback] OAuth exchange failed:', payload)
      return NextResponse.redirect(
        new URL(`/sheets?error=${encodeURIComponent(payload.error_description || 'Failed to exchange token')}`, request.url)
      )
    }

    const accessToken = payload.access_token
    const refreshToken = payload.refresh_token
    const expiresIn = payload.expires_in || 3600

    const encryptedAccessToken = encrypt(accessToken)
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null
    const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString()

    const { error: upsertError } = await supabase.from('sheet_connections').insert({
      company_id: companyId,
      name: 'Google Sheets Connection',
      type: 'google_sheets',
      credentials: {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expiry_date: expiryDate
      }
    })

    if (upsertError) {
      console.error('[sheets-callback] Connection insert failed:', upsertError)
      return NextResponse.redirect(new URL(`/sheets?error=${encodeURIComponent(upsertError.message)}`, request.url))
    }

    return NextResponse.redirect(new URL('/sheets?connected=true', request.url))
  } catch (err: any) {
    console.error('[sheets-callback] Exception in callback:', err)
    return NextResponse.redirect(new URL(`/sheets?error=${encodeURIComponent(err.message || 'Internal error')}`, request.url))
  }
}
