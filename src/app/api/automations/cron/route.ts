import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { resumePendingExecution } from '@/lib/automations/engine'
import type { AutomationContext } from '@/lib/automations/engine'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp/meta-api'

/**
 * Drain due `automation_pending_executions` rows. Meant to be hit
 * on a schedule (Vercel Cron / external pinger) — requires a shared
 * secret via the `x-cron-secret` header to match
 * `AUTOMATION_CRON_SECRET`.
 *
 * The claim step (status = 'running') serves as a simple lock so
 * overlapping invocations don't double-process rows. Best-effort
 * only; expensive SELECT ... FOR UPDATE is avoided in favor of a
 * two-step UPDATE-by-id.
 */
export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  const supplied = request.headers.get('x-cron-secret')
  if (supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const now = new Date()

  // --- 1. Process Scheduled Manual Smart Follow-ups ---
  try {
    const { data: dueFollowups } = await admin
      .from('smart_followups')
      .select('*, contacts(*)')
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString())
      .limit(50)

    if (dueFollowups && dueFollowups.length > 0) {
      for (const row of dueFollowups) {
        // Claim the row immediately
        const { data: claimed } = await admin
          .from('smart_followups')
          .update({ status: 'sent', updated_at: now.toISOString() })
          .eq('id', row.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()

        if (!claimed) continue

        try {
          // Fetch user's whatsapp config to get token and phone id
          const { data: config } = await admin
            .from('whatsapp_config')
            .select('*')
            .eq('user_id', row.contacts?.user_id)
            .maybeSingle()

          if (!config) {
            throw new Error(`WhatsApp credentials missing for user ${row.contacts?.user_id}`)
          }

          const accessToken = decrypt(config.access_token)
          const phoneNumberId = config.phone_number_id
          const toPhone = row.contacts?.phone

          if (!toPhone) {
            throw new Error('Contact phone number missing')
          }

          let messageId = ''
          if (row.template_name) {
            const sendRes = await sendTemplateMessage({
              phoneNumberId,
              accessToken,
              to: toPhone,
              templateName: row.template_name,
              params: Array.isArray(row.template_params) ? row.template_params.map(String) : []
            })
            messageId = sendRes.messageId
          } else if (row.custom_message) {
            const sendRes = await sendTextMessage({
              phoneNumberId,
              accessToken,
              to: toPhone,
              text: row.custom_message
            })
            messageId = sendRes.messageId
          } else {
            throw new Error('Template name or custom message is required to send follow-up')
          }

          // Insert outbound message to thread
          const msgText = row.custom_message || `[Template: ${row.template_name}]`
          await admin.from('messages').insert({
            conversation_id: row.conversation_id,
            sender_type: 'bot',
            content_type: row.template_name ? 'template' : 'text',
            content_text: msgText,
            template_name: row.template_name || null,
            message_id: messageId || `system-${Math.random().toString(36).substring(2, 11)}`,
            status: 'sent',
            created_at: now.toISOString()
          })

          // Update last conversation message text
          if (row.conversation_id) {
            await admin
              .from('conversations')
              .update({
                last_message_text: msgText,
                last_message_at: now.toISOString(),
                updated_at: now.toISOString()
              })
              .eq('id', row.conversation_id)
          }

        } catch (err: any) {
          console.error(`[cron-followup] Failed to dispatch follow-up ID ${row.id}:`, err)
          await admin
            .from('smart_followups')
            .update({
              status: 'failed',
              error_message: err.message || 'Meta API error',
              updated_at: now.toISOString()
            })
            .eq('id', row.id)
        }
      }
    }
  } catch (err) {
    console.error('[cron-followup] Scheduled manual follow-ups sweep failed:', err)
  }

  // --- 2. Process Automated Inactivity Smart Follow-ups ---
  try {
    // Fetch all active global or conversation-specific configurations where inactivity nudges are enabled
    const { data: configs } = await admin
      .from('ai_conversations')
      .select('*')
      .eq('inactivity_followup_enabled', true)

    if (configs && configs.length > 0) {
      for (const config of configs) {
        // Query conversations matching this config
        const query = admin
          .from('conversations')
          .select('*, contacts(*)')
          .in('status', ['open', 'pending'])
        
        if (config.conversation_id) {
          query.eq('id', config.conversation_id)
        } else {
          // Global config - filter conversations belonging to this user
          query.eq('contacts.user_id', config.user_id)
        }

        const { data: conversations } = await query

        if (conversations && conversations.length > 0) {
          for (const conv of conversations) {
            if (!conv.contacts) continue;

            const cutoffTime = new Date(now.getTime() - config.inactivity_hours * 60 * 60 * 1000)
            const lastMessageAt = new Date(conv.last_message_at || conv.updated_at)

            // Check if conversation has been inactive for longer than inactivity_hours
            if (lastMessageAt > cutoffTime) continue;

            // Load last few messages to verify if the last message was from the agent/bot
            const { data: lastMsgs } = await admin
              .from('messages')
              .select('sender_type, created_at')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: false })
              .limit(1)

            if (!lastMsgs || lastMsgs.length === 0) continue;
            const lastMsg = lastMsgs[0];

            // If the last message is from the customer, then the customer is waiting for US, skip nudge
            if (lastMsg.sender_type === 'customer') continue;

            // Find the last customer message timestamp to check if we already followed up since then
            const { data: customerMsgs } = await admin
              .from('messages')
              .select('created_at')
              .eq('conversation_id', conv.id)
              .eq('sender_type', 'customer')
              .order('created_at', { ascending: false })
              .limit(1)

            const lastCustomerMsgTime = customerMsgs && customerMsgs.length > 0
              ? new Date(customerMsgs[0].created_at)
              : new Date(conv.created_at)

            // Check if we have already sent a follow-up since the last customer message
            const { data: existingFollowup } = await admin
              .from('smart_followups')
              .select('id')
              .eq('conversation_id', conv.id)
              .eq('status', 'sent')
              .gt('created_at', lastCustomerMsgTime.toISOString())
              .limit(1)
              .maybeSingle()

            if (existingFollowup) {
              // Already nudged for this session, skip to avoid spam
              continue;
            }

            // We are good to nudge!
            try {
              // Load user's credentials
              const { data: waConfig } = await admin
                .from('whatsapp_config')
                .select('*')
                .eq('user_id', config.user_id)
                .maybeSingle()

              if (!waConfig) {
                throw new Error(`WhatsApp credentials missing for user ${config.user_id}`)
              }

              const accessToken = decrypt(waConfig.access_token)
              const phoneNumberId = waConfig.phone_number_id
              const toPhone = conv.contacts.phone

              if (!toPhone) {
                throw new Error('Contact phone number missing')
              }

              const templateName = config.inactivity_template_name || 'hello_world'
              const templateParams = Array.isArray(config.inactivity_template_params)
                ? config.inactivity_template_params.map(String)
                : []

              // Send the WhatsApp template nudge
              const sendRes = await sendTemplateMessage({
                phoneNumberId,
                accessToken,
                to: toPhone,
                templateName,
                params: templateParams
              })

              const msgText = `[Automated Inactivity Nudge: ${templateName}]`

              // Write outbound message record to DB
              await admin.from('messages').insert({
                conversation_id: conv.id,
                sender_type: 'bot',
                content_type: 'template',
                content_text: msgText,
                template_name: templateName,
                message_id: sendRes.messageId,
                status: 'sent',
                created_at: now.toISOString()
              })

              // Update last conversation message metadata
              await admin
                .from('conversations')
                .update({
                  last_message_text: msgText,
                  last_message_at: now.toISOString(),
                  updated_at: now.toISOString()
                })
                .eq('id', conv.id)

              // Record the follow-up execution in smart_followups
              await admin.from('smart_followups').insert({
                company_id: conv.contacts.company_id,
                contact_id: conv.contacts.id,
                conversation_id: conv.id,
                scheduled_at: now.toISOString(),
                template_name: templateName,
                template_params: templateParams,
                status: 'sent',
                created_at: now.toISOString(),
                updated_at: now.toISOString()
              })

              console.log(`[cron-followup] Successfully nudged inactive customer for conversation ${conv.id}`)
            } catch (err: any) {
              console.error(`[cron-followup] Automated inactivity nudge failed for conv ${conv.id}:`, err)
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[cron-followup] Automated inactivity follow-ups sweep failed:', err)
  }

  // --- 3. Process Scheduled Spreadsheet & Sheet Automations ---
  try {
    const { data: configs } = await admin
      .from('sheet_sync_configs')
      .select('*')
      .eq('status', 'active')
      .neq('sync_interval', 'manual')

    if (configs && configs.length > 0) {
      for (const config of configs) {
        const lastSync = config.last_synced_at ? new Date(config.last_synced_at) : null
        let isDue = false

        if (!lastSync) {
          isDue = true
        } else {
          const diffMs = now.getTime() - lastSync.getTime()
          let intervalMs = 0
          if (config.sync_interval === '15m') intervalMs = 15 * 60 * 1000
          else if (config.sync_interval === '1h') intervalMs = 60 * 60 * 1000
          else if (config.sync_interval === '12h') intervalMs = 12 * 60 * 60 * 1000
          else if (config.sync_interval === '24h') intervalMs = 24 * 60 * 60 * 1000

          if (diffMs >= intervalMs) {
            isDue = true
          }
        }

        if (isDue) {
          console.log(`[cron-sheets] Syncing configuration ID ${config.id} for company ${config.company_id}`)
          const { syncSpreadsheet } = await import('@/lib/sheets/sync-engine')
          await syncSpreadsheet(config.id, config.company_id, admin)
        }
      }
    }
  } catch (err) {
    console.error('[cron-sheets] Scheduled spreadsheet sync failed:', err)
  }

  // --- 4. Process Standard Pending Automations ---
  const { data: due, error } = await admin
    .from('automation_pending_executions')
    .select('*')
    .eq('status', 'pending')
    .lte('run_at', now.toISOString())
    .order('run_at', { ascending: true })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due || due.length === 0) return NextResponse.json({ processed: 0 })

  let processed = 0
  for (const row of due) {
    const { data: claim } = await admin
      .from('automation_pending_executions')
      .update({ status: 'running' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (!claim) continue

    await resumePendingExecution({
      id: row.id as string,
      automation_id: row.automation_id as string,
      user_id: row.user_id as string,
      contact_id: (row.contact_id as string | null) ?? null,
      log_id: (row.log_id as string | null) ?? null,
      parent_step_id: (row.parent_step_id as string | null) ?? null,
      branch: (row.branch as 'yes' | 'no' | null) ?? null,
      next_step_position: row.next_step_position as number,
      context: (row.context as AutomationContext) ?? {},
    })
    processed++
  }

  return NextResponse.json({ processed })
}
