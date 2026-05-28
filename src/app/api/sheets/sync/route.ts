import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncSpreadsheet } from '@/lib/sheets/sync-engine'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { configId } = await request.json()
    if (!configId) {
      return NextResponse.json({ error: 'configId is required' }, { status: 400 })
    }

    const profile = await supabase.from('profiles').select('id').eq('user_id', user.id).single()
    const { data: userLink } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('profile_id', profile.data?.id)
      .limit(1)
      .maybeSingle()

    if (!userLink) {
      return NextResponse.json({ error: 'No company resolved' }, { status: 400 })
    }

    const result = await syncSpreadsheet(configId, userLink.company_id, supabase)
    
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[sync-api] execution failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
