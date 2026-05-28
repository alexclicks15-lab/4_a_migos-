import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      .from('ai_routing')
      .select('*')
      .eq('company_id', companyId)

    return NextResponse.json(data || [])
  } catch (err: any) {
    console.error('[api-ai-routing-get] Failed:', err)
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
    if (!body || !body.feature || !body.provider || !body.model) {
      return NextResponse.json({ error: 'Missing required routing fields' }, { status: 400 })
    }

    const { feature, provider, model, fallbackProvider, fallbackModel, agentId } = body

    const payload: any = {
      company_id: companyId,
      agent_id: agentId || null,
      feature,
      provider,
      model,
      fallback_provider: fallbackProvider || null,
      fallback_model: fallbackModel || null,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('ai_routing')
      .upsert(payload, { onConflict: 'company_id,agent_id,feature' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[api-ai-routing-post] Failed:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
