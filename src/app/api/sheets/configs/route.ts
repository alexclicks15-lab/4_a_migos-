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

    const { data: configs, error } = await supabase
      .from('sheet_sync_configs')
      .select(`
        *,
        connection:sheet_connections(name, type)
      `)
      .eq('company_id', userLink.company_id)

    if (error) throw error

    return NextResponse.json(configs)
  } catch (err: any) {
    console.error('[configs-api] GET failed:', err)
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

    const body = await request.json()
    const { id, connection_id, spreadsheet_id, sheet_name, column_mapping, trigger_config, sync_interval, status } = body

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

    const record = {
      company_id: userLink.company_id,
      connection_id: connection_id || null,
      spreadsheet_id: spreadsheet_id || null,
      sheet_name: sheet_name || null,
      column_mapping: column_mapping || {},
      trigger_config: trigger_config || {},
      sync_interval: sync_interval || 'manual',
      status: status || 'active',
      updated_at: new Date().toISOString()
    }

    let resultData = null
    if (id) {
      // Update
      const { data, error } = await supabase
        .from('sheet_sync_configs')
        .update(record)
        .eq('id', id)
        .eq('company_id', userLink.company_id)
        .select()
        .single()
      if (error) throw error
      resultData = data
    } else {
      // Insert
      const { data, error } = await supabase
        .from('sheet_sync_configs')
        .insert({
          ...record,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      if (error) throw error
      resultData = data
    }

    if (resultData) {
      await supabase.from('connected_sheets').upsert({
        company_id: userLink.company_id,
        connection_id: connection_id || null,
        sync_config_id: resultData.id,
        spreadsheet_id: spreadsheet_id || null,
        sheet_name: sheet_name || null,
        status: status || 'active',
        automation_enabled: status !== 'paused',
        metadata: { sync_config_id: resultData.id },
        updated_at: new Date().toISOString()
      }, { onConflict: 'sync_config_id' })

      const mappingEntries = Object.entries(column_mapping || {})
        .filter(([, sheetColumn]) => Boolean(sheetColumn))
        .map(([crmField, sheetColumn]) => ({
          company_id: userLink.company_id,
          config_id: resultData.id,
          crm_field: crmField,
          sheet_column: String(sheetColumn),
          updated_at: new Date().toISOString()
        }))

      if (mappingEntries.length > 0) {
        await supabase.from('sheet_mappings').upsert(mappingEntries, { onConflict: 'config_id,crm_field' })
      }
    }

    return NextResponse.json(resultData)
  } catch (err: any) {
    console.error('[configs-api] POST failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Missing config ID' }, { status: 400 })
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
      .from('sheet_sync_configs')
      .delete()
      .eq('id', id)
      .eq('company_id', userLink.company_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[configs-api] DELETE failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
