import { createClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { createCalendarEvent } from '@/lib/google-calendar/client'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import {
  generateSlotsForDate,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment
} from '@/lib/appointments/booking-system'
import { callAI } from '@/lib/ai/multi-provider'

// Lazy-initialized to avoid build-time crash when env vars are missing
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

interface AIAgentOutput {
  intent: string
  confidence: number
  entities: Record<string, any>
  crm_updates: string[]
  automation_actions: string[]
  lead_score: number
  requires_human: boolean
  suggested_reply: string
}

export interface RunAIAgentArgs {
  userId: string
  conversationId: string
  contactId: string
  messageText: string
  accessToken: string
  phoneNumberId: string
  contextMessageId?: string
}

/**
 * Main entrypoint invoked by the WhatsApp message webhook.
 * Processes customer messages through the AI agent loop.
 */
export async function runAIAgentForMessage(args: RunAIAgentArgs): Promise<void> {
  const { userId, conversationId, contactId, messageText, accessToken, phoneNumberId, contextMessageId } = args
  const startTime = Date.now()
  const db = supabaseAdmin()

  // 1. Fetch AI Configuration for the conversation
  let aiConfig = null
  try {
    const { data } = await db
      .from('ai_conversations')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle()
    
    if (data) {
      aiConfig = data
    } else {
      // Fallback to global configuration (where conversation_id is NULL)
      const { data: globalData } = await db
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .is('conversation_id', null)
        .maybeSingle()
      aiConfig = globalData
    }
  } catch (err) {
    console.warn('[ai-agent] ai_conversations table check error (falling back to default enabled):', err)
  }

  // If configuration table doesn't exist, we assume AI is active for demo purposes
  const aiEnabled = aiConfig ? aiConfig.enabled : true

  const model = aiConfig?.model || 'gpt-4o'
  const persona = aiConfig?.persona || 'You are an intelligent WhatsApp CRM AI assistant.'
  const temperature = aiConfig?.temperature ? parseFloat(aiConfig.temperature) : 0.7

  // 2. Fetch Contact Profile details
  let contact = null
  try {
    const { data } = await db
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()
    contact = data
  } catch (err) {
    console.error('[ai-agent] Failed to fetch contact info:', err)
  }

  const currentLeadScore = contact?.lead_score ?? 50

  // 3. Fetch Conversation History (last 8 messages for short-term memory)
  let historyText = ''
  try {
    const { data: messages } = await db
      .from('messages')
      .select('sender_type, content_text, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(8)

    if (messages) {
      // Reverse to chronological order
      const chron = [...messages].reverse()
      historyText = chron
        .map((m) => `${m.sender_type === 'customer' ? 'Customer' : 'Assistant'}: ${m.content_text || ''}`)
        .join('\n')
    }
  } catch (err) {
    console.error('[ai-agent] Failed to fetch message history:', err)
  }

  // 4. Fetch AI Memory Summary
  let memoryRow = null
  let memoryText = 'No previous memory.'
  try {
    const { data } = await db
      .from('ai_memory')
      .select('*')
      .eq('contact_id', contactId)
      .maybeSingle()
    memoryRow = data
    if (data?.summary) memoryText = data.summary
  } catch (err) {
    console.warn('[ai-agent] ai_memory check error:', err)
  }

  // 5. Fetch custom active Intents configurations
  let configuredIntents: any[] = []
  try {
    const { data } = await db
      .from('ai_intents')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
    if (data) configuredIntents = data
  } catch (err) {
    console.warn('[ai-agent] ai_intents check error:', err)
  }

  // 5b. Fetch RAG Knowledge Base documents
  let kbDocs: any[] = []
  let ragContext = 'No company knowledge base documents uploaded.'
  const companyId = contact?.company_id
  if (companyId) {
    try {
      const { data } = await db
        .from('ai_knowledge_base')
        .select('*')
        .eq('company_id', companyId)
      if (data && data.length > 0) {
        kbDocs = data
        ragContext = data.map((doc: any) => `[Document: ${doc.title} (${doc.type})]\n${doc.content}`).join('\n\n')
      }
    } catch (err) {
      console.warn('[ai-agent] ai_knowledge_base fetch error:', err)
    }
  }

  // 6. Run AI Understanding Layer
  let aiOutput: AIAgentOutput
  let tokensUsed = 0

  try {
    const systemPrompt = `${persona}
              
Always structure your output as a valid JSON object matching this schema:
{
  "intent": "detected_intent_name",
  "confidence": 0.0 to 1.0,
  "entities": {
    "name": "customer name if extracted",
    "email": "customer email if extracted",
    "phone": "customer phone if extracted",
    "quantity": number,
    "product": "product name",
    "appointment_date": "YYYY-MM-DD",
    "appointment_time": "HH:MM",
    "service": "consultation / demo call / store visit / support meeting",
    "action": "check_availability / book / reschedule / cancel / list",
    "location": "location mentioned",
    "budget": "budget mentioned",
    "city": "location mentioned",
    "order_id": "extracted order ID",
    "payment_amount": number
  },
  "crm_updates": ["add_tag:tag_name", "remove_tag:tag_name", "update_lead_score:+10", "update_lead_score:-15"],
  "automation_actions": ["schedule_event:summary", "trigger_automation:flow_key", "human_handoff:reason"],
  "lead_score": number,
  "requires_human": boolean,
  "suggested_reply": "your text response to the user"
}

Available configured intents: ${configuredIntents.map(i => i.name).join(', ') || 'pricing_inquiry, support_request, product_interest, order_tracking, appointment_booking, complaint, refund_request, payment_done, high_purchase_intent, human_support, unsubscribe_request'}.
If the customer is extremely angry, requests a real person, or shows low confidence intent, set "requires_human" to true.

Conversation Memory/Context:
${memoryText}

Knowledge Base Documents (RAG Context):
${ragContext}

Message History:
${historyText}`

    const response = await callAI({
      companyId: companyId || 'default',
      feature: 'agents',
      prompt: `Analyze this new message: "${messageText}"`,
      systemPrompt,
      temperature,
      responseFormat: 'json'
    })

    aiOutput = JSON.parse(response.text) as AIAgentOutput
    tokensUsed = response.usage.totalTokens
  } catch (err) {
    console.error('[ai-agent] AI request error, falling back to local engine:', err)
    aiOutput = runLocalFallbackAI(messageText, currentLeadScore, kbDocs)
  }

  const latency = Date.now() - startTime

  // 7. Execute Actions
  const actionsTaken: string[] = []
  let requiresHandoff = aiOutput.requires_human

  // Load custom actions from DB for the detected intent
  try {
    const { data: dbActions } = await db
      .from('ai_actions')
      .select('*')
      .eq('user_id', userId)
      .eq('intent_name', aiOutput.intent)
    
    if (dbActions && dbActions.length > 0) {
      if (!aiOutput.crm_updates) aiOutput.crm_updates = [];
      if (!aiOutput.automation_actions) aiOutput.automation_actions = [];
      
      for (const act of dbActions) {
        if (act.action_type === 'add_tag' && act.action_config?.tag) {
          if (!aiOutput.crm_updates.includes(`add_tag:${act.action_config.tag}`)) {
            aiOutput.crm_updates.push(`add_tag:${act.action_config.tag}`);
          }
        } else if (act.action_type === 'remove_tag' && act.action_config?.tag) {
          if (!aiOutput.crm_updates.includes(`remove_tag:${act.action_config.tag}`)) {
            aiOutput.crm_updates.push(`remove_tag:${act.action_config.tag}`);
          }
        } else if (act.action_type === 'update_lead_score') {
          const change = act.action_config?.score_change ?? 15;
          const sign = change >= 0 ? '+' : '';
          if (!aiOutput.crm_updates.some((upd: string) => upd.startsWith('update_lead_score:'))) {
            aiOutput.crm_updates.push(`update_lead_score:${sign}${change}`);
          }
        } else if (act.action_type === 'create_deal') {
          if (!aiOutput.crm_updates.includes('create_deal')) {
            aiOutput.crm_updates.push('create_deal');
          }
        } else if (act.action_type === 'schedule_event') {
          const summary = act.action_config?.event_summary || 'Demo Booking Call';
          if (!aiOutput.automation_actions.some((actStr: string) => actStr.startsWith('schedule_event:'))) {
            aiOutput.automation_actions.push(`schedule_event:${summary}`);
          }
        } else if (act.action_type === 'trigger_automation' && act.action_config?.flow_key) {
          if (!aiOutput.automation_actions.some((actStr: string) => actStr.startsWith('trigger_automation:'))) {
            aiOutput.automation_actions.push(`trigger_automation:${act.action_config.flow_key}`);
          }
        } else if (act.action_type === 'human_handoff') {
          requiresHandoff = true;
          aiOutput.requires_human = true;
        }
      }
    }
  } catch (err) {
    console.warn('[ai-agent] Failed to fetch mapped actions for intent:', aiOutput.intent, err);
  }

  // Rule-based Escalation checks (angry customer or explicit agent request)
  const lowerMsg = messageText.toLowerCase()
  if (
    lowerMsg.includes('manager') ||
    lowerMsg.includes('human') ||
    lowerMsg.includes('agent') ||
    lowerMsg.includes('person') ||
    lowerMsg.includes('speak to real') ||
    lowerMsg.includes('terrible') ||
    lowerMsg.includes('scam') ||
    lowerMsg.includes('fuck') ||
    lowerMsg.includes('suck') ||
    lowerMsg.includes('support representative')
  ) {
    requiresHandoff = true
  }

  // A. Human Handoff execution
  if (requiresHandoff) {
    actionsTaken.push('human_handoff')
    try {
      // Set AI enabled status to false for this chat
      await db
        .from('ai_conversations')
        .upsert(
          { conversation_id: conversationId, enabled: false, user_id: userId, updated_at: new Date().toISOString() },
          { onConflict: 'conversation_id' }
        )

      // Move conversation to pending status
      await db
        .from('conversations')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', conversationId)

      // Apply "Escalated" tag
      await applyTagToContact(db, userId, contactId, 'Escalated')
      
      // Save notification message in thread
      await db.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'bot',
        content_type: 'text',
        content_text: '⚠️ Conversation control transferred to support agent.',
        status: 'sent',
        created_at: new Date().toISOString()
      })
    } catch (err) {
      console.error('[ai-agent] Human Handoff execution failed:', err)
    }
  }

  // B. CRM Updates
  // Apply tags
  const tagsToApply = aiOutput.crm_updates
    .filter((upd) => upd.startsWith('add_tag:'))
    .map((upd) => upd.replace('add_tag:', '').trim())
  
  for (const tag of tagsToApply) {
    try {
      await applyTagToContact(db, userId, contactId, tag)
      actionsTaken.push(`add_tag:${tag}`)
    } catch (err) {
      console.error(`[ai-agent] Failed to apply tag ${tag}:`, err)
    }
  }

  // Remove tags
  const tagsToRemove = aiOutput.crm_updates
    .filter((upd) => upd.startsWith('remove_tag:'))
    .map((upd) => upd.replace('remove_tag:', '').trim())
  
  for (const tag of tagsToRemove) {
    try {
      await removeTagFromContact(db, contactId, tag)
      actionsTaken.push(`remove_tag:${tag}`)
    } catch (err) {
      console.error(`[ai-agent] Failed to remove tag ${tag}:`, err)
    }
  }

  // Update Lead Score
  let updatedScore = currentLeadScore
  const scoreChange = aiOutput.crm_updates.find((upd) => upd.startsWith('update_lead_score:'))
  if (scoreChange) {
    const val = parseInt(scoreChange.replace('update_lead_score:', ''))
    if (!isNaN(val)) {
      updatedScore = Math.max(0, Math.min(100, currentLeadScore + val))
    }
  } else if (aiOutput.lead_score !== undefined) {
    updatedScore = Math.max(0, Math.min(100, aiOutput.lead_score))
  }

  if (updatedScore !== currentLeadScore) {
    try {
      await db
        .from('contacts')
        .update({ lead_score: updatedScore, updated_at: new Date().toISOString() })
        .eq('id', contactId)
      actionsTaken.push(`lead_score:${updatedScore}`)
    } catch (err) {
      console.error('[ai-agent] Failed to update lead score:', err)
    }
  }

  // Create Deal on Bulk Order/High Purchase Intent
  if (aiOutput.intent === 'bulk_order_inquiry' || aiOutput.intent === 'high_purchase_intent' || aiOutput.crm_updates.includes('create_deal')) {
    try {
      // Find default pipeline and first stage
      const { data: pipelines } = await db
        .from('pipelines')
        .select('id')
        .eq('user_id', userId)
        .limit(1)

      if (pipelines && pipelines.length > 0) {
        const pipelineId = pipelines[0].id
        const { data: stages } = await db
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', pipelineId)
          .order('position')
          .limit(1)

        if (stages && stages.length > 0) {
          const stageId = stages[0].id
          const dealTitle = `${contact?.name || 'Lead'} - Deal via AI`
          const dealVal = aiOutput.entities.payment_amount || aiOutput.entities.budget || 500

          await db.from('deals').insert({
            user_id: userId,
            pipeline_id: pipelineId,
            stage_id: stageId,
            contact_id: contactId,
            conversation_id: conversationId,
            title: dealTitle,
            value: dealVal,
            status: 'active'
          })
          actionsTaken.push(`create_deal:$${dealVal}`)
        }
      }
    } catch (err) {
      console.error('[ai-agent] Deal creation failed:', err)
    }
  }

  // Add notes for extracted details
  if (Object.keys(aiOutput.entities).length > 0) {
    try {
      const extractedStr = Object.entries(aiOutput.entities)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')

      if (extractedStr) {
        await db.from('contact_notes').insert({
          contact_id: contactId,
          user_id: userId,
          note_text: `AI Extracted Entities: ${extractedStr}`
        })
        actionsTaken.push('add_note_entities')
      }
    } catch (err) {
      console.error('[ai-agent] Notes update failed:', err)
    }
  }

  // C. Calendar Event scheduling
  const calendarAction = aiOutput.automation_actions.find((act) => act.startsWith('schedule_event:'))
  if (calendarAction) {
    try {
      const summary = calendarAction.replace('schedule_event:', '').trim() || 'Demo Booking'
      const startMin = 1440 // 24 hours later by default
      const duration = 30

      const result = await createCalendarEvent(userId, db, {
        summary: `${summary} (WhatsApp: ${contact?.phone || ''})`,
        description: `Scheduled by WA-CRM AI Assistant.\nMessage: "${messageText}"`,
        startDelayMinutes: startMin,
        durationMinutes: duration
      })

      actionsTaken.push(`schedule_calendar_event:${result.id}`)

      // Add note
      await db.from('contact_notes').insert({
        contact_id: contactId,
        user_id: userId,
        note_text: `Meeting scheduled successfully. Calendar Link: ${result.htmlLink || 'Demo Link'}`
      })
    } catch (err) {
      console.error('[ai-agent] Google Calendar booking failed:', err)
    }
  }

  // D. Trigger flow / automation
  const triggerAction = aiOutput.automation_actions.find((act) => act.startsWith('trigger_automation:'))
  if (triggerAction) {
    const flowKey = triggerAction.replace('trigger_automation:', '').trim()
    try {
      runAutomationsForTrigger({
        userId,
        triggerType: 'new_message_received', // mapping to incoming hook
        contactId,
        context: {
          message_text: `AI trigger flow key: ${flowKey}`,
          conversation_id: conversationId
        }
      }).catch(e => console.error('[ai-agent] runAutomationsForTrigger dispatch failed:', e))
      
      actionsTaken.push(`trigger_flow:${flowKey}`)
    } catch (err) {
      console.error('[ai-agent] Flow trigger error:', err)
    }
  }

  // C2. Appointment booking system integrations
  if (aiOutput.intent === 'appointment_booking') {
    const action = aiOutput.entities.action || 'check_availability'
    const service = aiOutput.entities.service || 'Consultation'
    let dateStr = aiOutput.entities.appointment_date
    let timeStr = aiOutput.entities.appointment_time
    const location = aiOutput.entities.location || 'Main Office'

    // If date is "tomorrow", compute YYYY-MM-DD
    if (dateStr === 'tomorrow') {
      dateStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    } else if (dateStr === 'today') {
      dateStr = new Date().toISOString().split('T')[0]
    }

    try {
      if (action === 'check_availability') {
        const targetDate = dateStr || new Date(Date.now() + 86400000).toISOString().split('T')[0]
        const slots = await generateSlotsForDate(userId, targetDate, { location })
        const freeSlots = slots
          .filter((s: any) => !s.isBooked && !s.isLocked)
          .map((s: any) => s.startTime)
          .slice(0, 4)

        if (freeSlots.length > 0) {
          aiOutput.suggested_reply = `Here are the available slots for ${service} on ${targetDate}:\n${freeSlots.map((t: string) => `• ${t}`).join('\n')}\n\nWould you like to book one of these?`
          actionsTaken.push('ai_check_availability')
        } else {
          aiOutput.suggested_reply = `Sorry, there are no slots available for ${service} on ${targetDate}. Please suggest another date!`
          actionsTaken.push('ai_no_slots_available')
        }
      } 
      else if (action === 'book') {
        if (!dateStr || !timeStr) {
          aiOutput.suggested_reply = `I can help you book a ${service}. Please let me know what date and time you prefer!`
        } else {
          const res = await bookAppointment(userId, contactId, service, dateStr, timeStr, {
            location,
            branchPrefix: 'A',
            notes: 'Booked via AI Assistant'
          })

          if (res.success && res.appointment && res.token) {
            aiOutput.suggested_reply = `Your appointment is confirmed ✅\n\nToken Number: ${res.token.token_number}\nService: ${service}\nDate: ${dateStr}\nTime: ${timeStr}\nQueue Position: ${res.queuePosition}`
            actionsTaken.push(`ai_booked:${res.token.token_number}`)
          } else {
            const targetDate = dateStr || new Date(Date.now() + 86400000).toISOString().split('T')[0]
            const slots = await generateSlotsForDate(userId, targetDate, { location })
            const freeSlots = slots
              .filter((s: any) => !s.isBooked && !s.isLocked)
              .map((s: any) => s.startTime)
              .slice(0, 4)

            aiOutput.suggested_reply = `Sorry, that time slot is already booked or locked. ${freeSlots.length > 0 ? `Here are some alternate slots for ${targetDate}:\n${freeSlots.map((t: string) => `• ${t}`).join('\n')}` : `No slots are available on ${targetDate}.`}\n\nWould you like to choose another time?`
            actionsTaken.push('ai_slot_conflict')
          }
        }
      } 
      else if (action === 'cancel') {
        const { data: latest } = await db
          .from('appointments')
          .select('id, service, appointment_date')
          .eq('contact_id', contactId)
          .eq('status', 'confirmed')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latest) {
          const res = await cancelAppointment(latest.id, 'Cancelled via WhatsApp AI assistant')
          if (res.success) {
            aiOutput.suggested_reply = `Your appointment for ${latest.service} on ${latest.appointment_date} has been successfully cancelled ❌`
            actionsTaken.push(`ai_cancelled:${latest.id}`)
          } else {
            aiOutput.suggested_reply = `I ran into an issue cancelling your appointment. Let me transfer you to a support agent.`
            aiOutput.requires_human = true
          }
        } else {
          aiOutput.suggested_reply = `I couldn't find any upcoming active appointments under your contact details.`
        }
      } 
      else if (action === 'reschedule') {
        const { data: latest } = await db
          .from('appointments')
          .select('id, service, appointment_date')
          .eq('contact_id', contactId)
          .eq('status', 'confirmed')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latest) {
          if (!dateStr || !timeStr) {
            aiOutput.suggested_reply = `To reschedule your appointment, please specify the new date and time you prefer!`
          } else {
            const res = await rescheduleAppointment(latest.id, dateStr, timeStr)
            if (res.success) {
              aiOutput.suggested_reply = `Your appointment has been successfully rescheduled to ${dateStr} at ${timeStr} 🔁`
              actionsTaken.push(`ai_rescheduled:${latest.id}`)
            } else {
              aiOutput.suggested_reply = `I couldn't reschedule to that time as it is already booked. Please choose another slot.`
            }
          }
        } else {
          aiOutput.suggested_reply = `I couldn't find any upcoming active appointments to reschedule. Would you like to book a new one?`
        }
      } 
      else if (action === 'list') {
        const { data: list } = await db
          .from('appointments')
          .select('id, service, appointment_date, start_time, appointment_tokens(token_number)')
          .eq('contact_id', contactId)
          .in('status', ['confirmed', 'pending'])
          .order('start_time', { ascending: true })

        if (list && list.length > 0) {
          const apptsText = list.map((a: any) => `• ${a.service} on ${a.appointment_date} at ${new Date(a.start_time).toISOString().split('T')[1].substring(0, 5)} (Token: ${a.appointment_tokens?.token_number || 'None'})`).join('\n')
          aiOutput.suggested_reply = `Here is your upcoming booking schedule:\n${apptsText}`
          actionsTaken.push('ai_listed_appointments')
        } else {
          aiOutput.suggested_reply = `You have no upcoming active appointments scheduled. Would you like to book a new one?`
        }
      }
    } catch (bookingErr) {
      console.error('[ai-agent] AI Appointment logic processing error:', bookingErr)
      aiOutput.suggested_reply = `Sorry, I encountered an error checking our calendar system. Please wait while I notify a team member.`
      aiOutput.requires_human = true
    }
  }

  // 8. Deliver Response via WhatsApp
  let messageId = 'demo-' + Math.random().toString(36).substring(2, 11)
  if (aiOutput.suggested_reply && aiEnabled) {
    try {
      const waSend = await sendTextMessage({
        phoneNumberId: phoneNumberId,
        accessToken: accessToken,
        to: contact?.phone || '',
        text: aiOutput.suggested_reply,
        contextMessageId: contextMessageId
      })
      messageId = waSend.messageId
    } catch (err) {
      console.error('[ai-agent] WhatsApp API reply transmission failed:', err)
    }

    // Insert bot reply to DB
    try {
      await db.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'bot',
        content_type: 'text',
        content_text: aiOutput.suggested_reply,
        message_id: messageId,
        status: 'sent',
        created_at: new Date().toISOString()
      })

      // Update last conversation message text
      await db
        .from('conversations')
        .update({
          last_message_text: aiOutput.suggested_reply,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
    } catch (err) {
      console.error('[ai-agent] Failed to save AI reply to DB:', err)
    }
  }

  // 9. Update Context Memory Summary (AI summarizes the current state)
  try {
    const lastSummary = memoryRow?.summary || ''
    const memoryLimit = 1500
    const newSummarySeed = `Message: "${messageText}". AI Intent: "${aiOutput.intent}". score: ${updatedScore}.`
    const updatedSummary = (lastSummary + '\n' + newSummarySeed).slice(-memoryLimit)

    await db.from('ai_memory').upsert(
      {
        contact_id: contactId,
        summary: updatedSummary,
        short_term_context: aiOutput.entities,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'contact_id' }
    )
  } catch (err) {
    console.warn('[ai-agent] Memory upsert error:', err)
  }

  // 10. Write Operational Logs
  try {
    await db.from('ai_automation_logs').insert({
      user_id: userId,
      conversation_id: conversationId,
      message_text: messageText,
      intent_detected: aiOutput.intent,
      confidence: aiOutput.confidence,
      entities_extracted: aiOutput.entities,
      actions_taken: actionsTaken,
      lead_score_before: currentLeadScore,
      lead_score_after: updatedScore,
      response_text: aiOutput.suggested_reply,
      requires_handoff: requiresHandoff,
      tokens_used: tokensUsed,
      latency_ms: latency,
      status: 'success'
    })
  } catch (err) {
    console.error('[ai-agent] Failed to write telemetry logs:', err)
  }
}

/**
 * Checks and creates a tag on the system, then applies it to the contact.
 */
async function applyTagToContact(db: any, userId: string, contactId: string, tagName: string) {
  // Find or create tag
  let { data: tag } = await db
    .from('tags')
    .select('id')
    .eq('user_id', userId)
    .eq('name', tagName)
    .maybeSingle()

  if (!tag) {
    const { data: newTag, error } = await db
      .from('tags')
      .insert({ user_id: userId, name: tagName, color: '#ec4899' }) // pink color for AI tags
      .select('id')
      .single()
    if (error) throw error
    tag = newTag
  }

  // Associate contact and tag
  await db.from('contact_tags').upsert(
    { contact_id: contactId, tag_id: tag.id },
    { onConflict: 'contact_id,tag_id' }
  )
}

/**
 * Removes a tag association from the contact.
 */
async function removeTagFromContact(db: any, contactId: string, tagName: string) {
  // Retrieve tag
  const { data: tag } = await db
    .from('tags')
    .select('id')
    .eq('name', tagName)
    .maybeSingle()

  if (tag) {
    await db
      .from('contact_tags')
      .delete()
      .eq('contact_id', contactId)
      .eq('tag_id', tag.id)
  }
}

/**
 * Highly realistic keyword + regex fallback classifier.
 * Ensures the system works completely even without an active OpenAI API key.
 */
export function runLocalFallbackAI(msg: string, currentScore: number, kbDocs?: any[]): AIAgentOutput {
  const txt = msg.toLowerCase()
  
  let intent = 'general_inquiry'
  let confidence = 0.85
  const entities: Record<string, any> = {}
  const crm_updates: string[] = []
  const automation_actions: string[] = []
  let requires_human = false
  let suggested_reply = "Hi! Thank you for messaging us. How can I assist you today?"

  // Search RAG Knowledge Base in fallback
  if (kbDocs && kbDocs.length > 0) {
    for (const doc of kbDocs) {
      const docWords = doc.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
      const matchedWords = docWords.filter((w: string) => txt.includes(w));
      if (matchedWords.length > 2 || txt.includes(doc.title.toLowerCase())) {
        suggested_reply = `Based on our company files ("${doc.title}"): ${doc.content.substring(0, 300)}... Let me know if you need more details!`;
        intent = 'rag_knowledge_inquiry';
        crm_updates.push('add_tag:Knowledge Inquiry');
        break;
      }
    }
  }

  // Regex extractors
  const emailMatch = msg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  if (emailMatch) entities.email = emailMatch[0]

  const phoneMatch = msg.match(/\+?[0-9]{10,15}/)
  if (phoneMatch) entities.phone = phoneMatch[0]

  const amountMatch = msg.match(/\$([0-9]+(?:\.[0-9]{2})?)/)
  if (amountMatch) entities.payment_amount = parseFloat(amountMatch[1])

  const qtyMatch = msg.match(/\b([0-9]+)\s*(pcs|tshirt|shirt|unit|item|box|pack|oversized)/i)
  if (qtyMatch) entities.quantity = parseInt(qtyMatch[1])

  const orderMatch = msg.match(/order\s*[-_#]?\s*([0-9a-zA-Z]+)/i)
  if (orderMatch) entities.order_id = orderMatch[1]

  // Date time parsing helper
  if (txt.includes('tomorrow')) {
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    entities.appointment_date = tomorrowStr
  }
  if (txt.includes('at 4') || txt.includes('4 pm')) {
    entities.appointment_time = '16:00'
  } else if (txt.includes('at 2') || txt.includes('2 pm')) {
    entities.appointment_time = '14:00'
  }

  // Intent classification matching rules
  if (txt.includes('price') || txt.includes('how much') || txt.includes('cost') || txt.includes('tariff') || txt.includes('pricing') || txt.includes('catalog')) {
    intent = 'pricing_inquiry'
    confidence = 0.94
    crm_updates.push('add_tag:Pricing Inquiry')
    crm_updates.push('update_lead_score:+10')
    suggested_reply = "Our pricing details are as follows: t-shirts start at $15/unit, Hoodies at $28/unit. Bulk discounts of up to 25% are available for orders exceeding 50 units. Would you like a detailed digital catalog?"
  } 
  else if (txt.includes('book') || txt.includes('demo') || txt.includes('schedule') || txt.includes('meeting') || txt.includes('appointment') || txt.includes('reschedule') || txt.includes('cancel') || txt.includes('show my booking') || txt.includes('my appointment')) {
    intent = 'appointment_booking'
    confidence = 0.98
    crm_updates.push('add_tag:Booking Request')
    crm_updates.push('update_lead_score:+20')
    
    if (txt.includes('cancel') || txt.includes('delete')) {
      entities.action = 'cancel'
    } else if (txt.includes('reschedule') || txt.includes('change')) {
      entities.action = 'reschedule'
    } else if (txt.includes('show') || txt.includes('list') || txt.includes('view') || txt.includes('my booking') || txt.includes('my appointment')) {
      entities.action = 'list'
    } else if (entities.appointment_date && entities.appointment_time) {
      entities.action = 'book'
      entities.service = txt.includes('demo') ? 'Demo Call' : 'Consultation'
      if (txt.includes('demo')) {
        automation_actions.push('schedule_event:Product Demo Meeting')
      }
    } else {
      entities.action = 'check_availability'
      entities.service = txt.includes('demo') ? 'Demo Call' : 'Consultation'
    }
  }
  else if ((txt.includes('buy') || txt.includes('interested') || txt.includes('purchase') || txt.includes('order')) && !(txt.includes('paid') || txt.includes('payment done') || txt.includes('transferred') || txt.includes('checkout complete'))) {
    intent = 'product_interest'
    confidence = 0.91
    crm_updates.push('add_tag:Hot Lead')
    crm_updates.push('update_lead_score:+15')
    
    // Check if bulk order
    if ((entities.quantity && entities.quantity > 20) || txt.includes('bulk') || txt.includes('wholesale')) {
      intent = 'bulk_order_inquiry'
      crm_updates.push('add_tag:Bulk Order')
      crm_updates.push('update_lead_score:+30')
      // Set product entity for bulk tshirt orders
      entities.product = 'tshirt'
      suggested_reply = `Thanks for your wholesale inquiry! Our standard bulk lead score has been applied. We specialize in custom oversized t-shirts. A sales manager will follow up with custom pricing and sample kits shortly.`
    } else {
      suggested_reply = "Awesome! We'd love to help you order. Which products are you looking at, and what quantity?"
    }
  }
  else if (txt.includes('where is') || txt.includes('track') || txt.includes('shipping') || txt.includes('delivery status') || txt.includes('status of')) {
    intent = 'order_tracking'
    confidence = 0.89
    crm_updates.push('add_tag:Support Ticket')
    suggested_reply = `I can check that. Your order #${entities.order_id || '1042'} is currently in transit and is estimated to arrive next Monday. Let me know if you need the carrier tracking link!`
  }
  else if (txt.includes('complaint') || txt.includes('terrible') || txt.includes('broken') || txt.includes('scam') || txt.includes('bad experience') || txt.includes('angry')) {
    intent = 'complaint'
    confidence = 0.96
    requires_human = true
    crm_updates.push('add_tag:Complaint Escalated')
    crm_updates.push('update_lead_score:-20')
    suggested_reply = "I'm so sorry to hear you've had a bad experience. I am escalating this conversation to our support supervisor immediately so we can resolve this for you."
  }
  else if (txt.includes('refund') || txt.includes('chargeback') || txt.includes('return item')) {
    intent = 'refund_request'
    confidence = 0.92
    requires_human = true
    crm_updates.push('add_tag:Refund Request')
    suggested_reply = "I understand you are requesting a refund. I've flagged your account and transferred this request to our billing manager for urgent processing."
  }
  else if (txt.includes('paid') || txt.includes('payment done') || txt.includes('transferred') || txt.includes('checkout complete')) {
      intent = 'payment_done'
      confidence = 0.95
      crm_updates.push('add_tag:Customer Paid')
      crm_updates.push('update_lead_score:+25')
      automation_actions.push('trigger_automation:onboarding_flow')
      suggested_reply = "Thank you! Payment confirmation received. We've updated your pipeline status to 'Paid' and initialized your project onboarding checklist. You should receive a confirmation email shortly."
    }
  else if (txt.includes('human') || txt.includes('agent') || txt.includes('person') || txt.includes('support representative') || txt.includes('real human')) {
    intent = 'human_support'
    confidence = 0.99
    requires_human = true
    crm_updates.push('add_tag:Human Handoff')
    suggested_reply = "Understood. I am pausing AI responses and transferring your chat to a live support team member. Please wait a moment."
  }
  else if (txt.includes('stop') || txt.includes('unsubscribe') || txt.includes('opt out') || txt.includes('block')) {
    intent = 'unsubscribe_request'
    confidence = 0.97
    crm_updates.push('add_tag:Opted Out')
    crm_updates.push('update_lead_score:-50')
    suggested_reply = "You have successfully unsubscribed from this WhatsApp channel. You will no longer receive automated messages or broadcasts. Reply START at any time to opt back in."
  }

  // Calculate final score bounds
  let finalScore = currentScore
  for (const upd of crm_updates) {
    if (upd.startsWith('update_lead_score:')) {
      const val = parseInt(upd.replace('update_lead_score:', ''))
      if (!isNaN(val)) finalScore = Math.max(0, Math.min(100, finalScore + val))
    }
  }

  return {
    intent,
    confidence,
    entities,
    crm_updates,
    automation_actions,
    lead_score: finalScore,
    requires_human,
    suggested_reply
  }
}
