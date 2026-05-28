import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseAndSyncUploadedFile } from '@/lib/sheets/sync-engine'

export async function POST(request: Request) {
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const columnMappingRaw = formData.get('columnMapping') as string
    const triggerConfigRaw = formData.get('triggerConfig') as string

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const columnMapping = columnMappingRaw ? JSON.parse(columnMappingRaw) : {}
    const triggerConfig = triggerConfigRaw ? JSON.parse(triggerConfigRaw) : {}

    const buffer = Buffer.from(await file.arrayBuffer())

    // Process file
    const result = await parseAndSyncUploadedFile(
      buffer,
      file.name,
      userLink.company_id,
      columnMapping,
      triggerConfig,
      supabase
    )

    // Save configuration in sheet_sync_configs for reference
    const { data: config } = await supabase
      .from('sheet_sync_configs')
      .insert({
        company_id: userLink.company_id,
        spreadsheet_id: file.name,
        sheet_name: 'Uploaded File',
        column_mapping: columnMapping,
        trigger_config: triggerConfig,
        sync_interval: 'manual',
        status: result.success ? 'active' : 'error',
        last_synced_at: new Date().toISOString()
      })
      .select()
      .single()

    // Insert sync log
    if (config) {
      await supabase.from('sheet_sync_logs').insert({
        company_id: userLink.company_id,
        config_id: config.id,
        status: result.success ? 'success' : 'error',
        rows_processed: result.processed,
        rows_updated: result.updated,
        error_message: result.error || null
      })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[upload-api] POST failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
