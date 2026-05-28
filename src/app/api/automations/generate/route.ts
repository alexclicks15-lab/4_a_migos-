import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWorkflowFromText } from '@/lib/automations/ai-generator'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let companyId: string | undefined = undefined
    if (profile) {
      const { data: cu } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('profile_id', profile.id)
        .limit(1)
        .maybeSingle()
      if (cu) {
        companyId = cu.company_id
      }
    }

    const result = await generateWorkflowFromText(body.prompt, companyId)
    
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[automations-generate] Failed to generate workflow:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
