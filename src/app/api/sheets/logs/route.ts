import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const { data: logs, error } = await supabase
      .from('sheet_sync_logs')
      .select('*')
      .eq('company_id', userLink.company_id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json(logs || [])
  } catch (err: any) {
    console.error('[logs-api] GET failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
