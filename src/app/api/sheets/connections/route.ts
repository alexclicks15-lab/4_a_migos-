import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/whatsapp/encryption'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Resolve active company from company_users
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userLink } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('profile_id', (await supabase.from('profiles').select('id').eq('user_id', user.id).single()).data?.id)
      .limit(1)
      .maybeSingle()

    if (!userLink) {
      return NextResponse.json({ error: 'No company resolved' }, { status: 400 })
    }

    const { data: connections, error } = await supabase
      .from('sheet_connections')
      .select('id, name, type, created_at')
      .eq('company_id', userLink.company_id)

    if (error) throw error

    return NextResponse.json(connections)
  } catch (err: any) {
    console.error('[connections-api] GET failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, type, credentials } = await request.json()
    if (!name || !type) {
      return NextResponse.json({ error: 'Name and Type are required' }, { status: 400 })
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

    // Encrypt sensitive credential fields
    const encryptedCreds: Record<string, any> = { ...credentials }
    if (credentials.access_token) {
      encryptedCreds.access_token = encrypt(credentials.access_token)
    }
    if (credentials.refresh_token) {
      encryptedCreds.refresh_token = encrypt(credentials.refresh_token)
    }
    if (credentials.api_key) {
      encryptedCreds.api_key = encrypt(credentials.api_key)
    }
    if (credentials.password) {
      encryptedCreds.password = encrypt(credentials.password)
    }

    const { data: newConn, error } = await supabase
      .from('sheet_connections')
      .insert({
        company_id: userLink.company_id,
        name,
        type,
        credentials: encryptedCreds
      })
      .select('id, name, type, created_at')
      .single()

    if (error) throw error

    return NextResponse.json(newConn)
  } catch (err: any) {
    console.error('[connections-api] POST failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Missing connection ID' }, { status: 400 })
    }

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

    const { error } = await supabase
      .from('sheet_connections')
      .delete()
      .eq('id', id)
      .eq('company_id', userLink.company_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[connections-api] DELETE failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
