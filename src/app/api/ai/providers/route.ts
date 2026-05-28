import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/whatsapp/encryption'

async function getCompanyId(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!profile) return null

  const { data: cu } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('profile_id', profile.id)
    .limit(1)
    .maybeSingle()

  return cu ? cu.company_id : null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyId = await getCompanyId(supabase, user.id)
    if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    const { data } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('company_id', companyId)

    // Mask keys for security
    const sanitized = (data || []).map((item: any) => ({
      provider: item.provider,
      hasKey: !!item.api_key,
      apiUrl: item.api_url || ''
    }))

    return NextResponse.json(sanitized)
  } catch (err: any) {
    console.error('[api-ai-providers-get] Failed:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyId = await getCompanyId(supabase, user.id)
    if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    const body = await request.json().catch(() => null)
    if (!body || !body.provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 })
    }

    const { provider, apiKey, apiUrl } = body
    let encryptedKey: string | null = null

    if (apiKey && apiKey !== '••••••••') {
      encryptedKey = encrypt(apiKey)
    }

    const payload: any = {
      company_id: companyId,
      provider,
      api_url: apiUrl || null
    }

    // Only update key if explicitly supplied (not masked)
    if (encryptedKey) {
      payload.api_key = encryptedKey
    } else if (apiKey === '') {
      payload.api_key = null
    }

    const { error } = await supabase
      .from('ai_providers')
      .upsert(payload, { onConflict: 'company_id,provider' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[api-ai-providers-post] Failed:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
