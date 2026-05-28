import type {
  Automation,
  AutomationLogStepResult,
  AutomationStep,
  AutomationTriggerType,
  AutomationTrigger,
  ConditionStepConfig,
  KeywordMatchTriggerConfig,
  SendMessageStepConfig,
  SendTemplateStepConfig,
  SendWebhookStepConfig,
  TagStepConfig,
  UpdateContactFieldStepConfig,
  WaitStepConfig,
  CreateDealStepConfig,
  AssignConversationStepConfig,
  GoogleCalendarCreateEventStepConfig,
  AIAgentStepConfig,
  HttpRequestStepConfig,
  SendMediaStepConfig,
  IncreaseLeadScoreStepConfig,
  AddInternalNoteStepConfig,
  MovePipelineStageStepConfig,
  TriggerAutomationStepConfig,
  SwitchStepConfig,
  SplitTrafficStepConfig,
  LoopStepConfig,
  DelayUntilStepConfig,
  EscalatePriorityStepConfig,
  NotifyTeamStepConfig,
  SendPaymentLinkStepConfig,
} from '@/types'
import { supabaseAdmin } from './admin-client'
import { engineSendText, engineSendTemplate } from './meta-send'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar/client'
import { runLocalFallbackAI } from '@/lib/ai/agent-engine'
import { callAI } from '@/lib/ai/multi-provider'
import {
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
  generateSlotsForDate,
  generateTokenNumber,
  checkInAppointment,
  completeAppointment,
  noShowAppointment
} from '@/lib/appointments/booking-system'

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

export interface AutomationContext {
  /** Raw message text, for keyword_match + message_content conditions. */
  message_text?: string
  /** Conversation the event belongs to, if any. */
  conversation_id?: string
  /** Arbitrary variables accumulated during execution. */
  vars?: Record<string, unknown>
  /** The tag id that was added, for tag_added trigger. */
  tag_id?: string
  /** Agent the conversation was assigned to, for conversation_assigned. */
  agent_id?: string
  /** AI classified intent, for intent_detected trigger. */
  intent?: string
  /** Interactive button ID, for button_clicked trigger. */
  button_id?: string
  /** Interactive button text label, for button_clicked trigger. */
  button_text?: string
  /** Interactive list option ID, for list_option_selected trigger. */
  option_id?: string
  /** Interactive list option text, for list_option_selected trigger. */
  option_text?: string
  /** CRM updated field name, for contact_field_updated trigger. */
  updated_field?: string
  /** CRM updated field value, for contact_field_updated trigger. */
  updated_value?: string
  /** Interactive reply ID mapped from webhooks. */
  interactive_reply_id?: string
}

export interface DispatchInput {
  userId: string
  triggerType: AutomationTriggerType
  contactId?: string | null
  context?: AutomationContext
}

/**
 * Fire all active automations matching the given trigger for a user.
 *
 * Must never throw — callers use fire-and-forget from the webhook.
 * All errors are caught and logged; per-automation failures are
 * recorded into automation_logs with status='failed'.
 */
export async function runAutomationsForTrigger(input: DispatchInput): Promise<void> {
  try {
    const db = supabaseAdmin()
    // Query automations matching the primary trigger_type
    const { data: automations, error } = await db
      .from('automations')
      .select('*')
      .eq('user_id', input.userId)
      .eq('is_active', true)

    if (error) {
      console.error('[automations] fetch failed:', error)
      return
    }
    if (!automations || automations.length === 0) return

    for (const automation of automations as Automation[]) {
      // Check primary trigger match
      const primaryMatch = automation.trigger_type === input.triggerType &&
        triggerMatches(automation, input.context)

      // Check additional triggers (multi-trigger support)
      const additionalMatch = (automation.triggers ?? []).some((t: AutomationTrigger) => {
        if (t.enabled === false) return false
        if (t.trigger_type !== input.triggerType) return false
        // Build a synthetic automation to reuse triggerMatches
        const synthetic = { ...automation, trigger_type: t.trigger_type, trigger_config: t.trigger_config }
        return triggerMatches(synthetic as Automation, input.context)
      })

      if (!primaryMatch && !additionalMatch) continue

      try {
        await executeAutomation(automation, input)
      } catch (err) {
        console.error('[automations] execute failed:', automation.id, err)
      }
    }
  } catch (err) {
    console.error('[automations] dispatch failed:', err)
  }
}

/**
 * Resume a run that was parked at a wait step. Called from the cron
 * endpoint after it grabs a due `automation_pending_executions` row.
 */
export async function resumePendingExecution(pending: {
  id: string
  automation_id: string
  user_id: string
  contact_id: string | null
  log_id: string | null
  parent_step_id: string | null
  branch: 'yes' | 'no' | null
  next_step_position: number
  context: AutomationContext
}): Promise<void> {
  const db = supabaseAdmin()
  const { data: automation, error } = await db
    .from('automations')
    .select('*')
    .eq('id', pending.automation_id)
    .single()

  if (error || !automation) {
    console.error('[automations] resume: missing automation', pending.automation_id, error)
    await markPending(pending.id, 'failed')
    return
  }

  try {
    await executeStepsFrom({
      automation: automation as Automation,
      contactId: pending.contact_id,
      context: pending.context ?? {},
      parentStepId: pending.parent_step_id,
      branch: pending.branch,
      startPosition: pending.next_step_position,
      logId: pending.log_id,
      triggerEvent: 'resumed_wait',
    })
    await markPending(pending.id, 'done')
  } catch (err) {
    console.error('[automations] resume failed:', err)
    await markPending(pending.id, 'failed')
  }
}

// ------------------------------------------------------------
// Internal execution
// ------------------------------------------------------------

async function executeAutomation(automation: Automation, input: DispatchInput) {
  const db = supabaseAdmin()

  const { data: log, error: logErr } = await db
    .from('automation_logs')
    .insert({
      automation_id: automation.id,
      user_id: automation.user_id,
      contact_id: input.contactId ?? null,
      trigger_event: input.triggerType,
      steps_executed: [],
      status: 'success',
    })
    .select()
    .single()

  if (logErr || !log) {
    console.error('[automations] cannot create log:', logErr)
    return
  }

  await executeStepsFrom({
    automation,
    contactId: input.contactId ?? null,
    context: input.context ?? {},
    parentStepId: null,
    branch: null,
    startPosition: 0,
    logId: log.id,
    triggerEvent: input.triggerType,
  })

  // Atomic counter update via the SQL function from migration 007.
  // Doing this with a client-side read-modify-write raced when the
  // same automation fired for two contacts simultaneously — both
  // would read N and both write N+1, losing one count permanently.
  const { error: rpcErr } = await db.rpc('increment_automation_execution_count', {
    p_automation_id: automation.id,
  })
  if (rpcErr) {
    console.error('[automations] increment counter failed:', rpcErr)
  }
}

interface ExecuteArgs {
  automation: Automation
  contactId: string | null
  context: AutomationContext
  parentStepId: string | null
  branch: 'yes' | 'no' | null
  startPosition: number
  logId: string | null
  triggerEvent: string
}

async function executeStepsFrom(args: ExecuteArgs): Promise<void> {
  const db = supabaseAdmin()

  const baseQuery = db
    .from('automation_steps')
    .select('*')
    .eq('automation_id', args.automation.id)
    .gte('position', args.startPosition)
    .order('position', { ascending: true })

  const scoped =
    args.parentStepId === null
      ? baseQuery.is('parent_step_id', null)
      : baseQuery.eq('parent_step_id', args.parentStepId).eq('branch', args.branch ?? 'yes')

  const { data: steps, error: stepsErr } = await scoped

  if (stepsErr) {
    await finalizeLog(args.logId, 'failed', stepsErr.message)
    return
  }
  if (!steps || steps.length === 0) {
    if (args.parentStepId === null && args.logId) {
      await finalizeLog(args.logId, 'success', null)
    }
    return
  }

  const results: AutomationLogStepResult[] = []
  let status: 'success' | 'partial' | 'failed' = 'success'
  let errorMessage: string | null = null

  for (const step of steps as AutomationStep[]) {
    // `wait` is the suspension point: enqueue and stop processing this
    // scope. The cron endpoint will pick it up later.
    if (step.step_type === 'wait') {
      const cfg = step.step_config as WaitStepConfig
      const ms = waitMs(cfg)
      await db.from('automation_pending_executions').insert({
        automation_id: args.automation.id,
        user_id: args.automation.user_id,
        contact_id: args.contactId,
        log_id: args.logId,
        parent_step_id: args.parentStepId,
        branch: args.branch,
        next_step_position: step.position + 1,
        context: args.context,
        run_at: new Date(Date.now() + ms).toISOString(),
        status: 'pending',
      })
      results.push({
        step_id: step.id,
        step_type: step.step_type,
        status: 'success',
        detail: `waiting ${cfg.amount} ${cfg.unit}`,
      })
      status = 'partial'
      await appendResults(args.logId, results, status, errorMessage)
      return
    }

    try {
      if (step.step_type === 'condition') {
        const cfg = step.step_config as ConditionStepConfig
        const taken = await evaluateCondition(cfg, args)
        results.push({
          step_id: step.id,
          step_type: 'condition',
          status: 'success',
          detail: `branch=${taken ? 'yes' : 'no'}`,
        })
        // Recurse into the chosen branch at position 0 (children use their
        // own ordering within the branch scope).
        await executeStepsFrom({
          ...args,
          parentStepId: step.id,
          branch: taken ? 'yes' : 'no',
          startPosition: 0,
          logId: args.logId,
        })
        continue
      }

      const detail = await runStep(step, args)
      results.push({
        step_id: step.id,
        step_type: step.step_type,
        status: 'success',
        detail,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({
        step_id: step.id,
        step_type: step.step_type,
        status: 'failed',
        detail: msg,
      })
      status = 'failed'
      errorMessage = msg
      break
    }
  }

  if (args.parentStepId === null) {
    await appendResults(args.logId, results, status, errorMessage)
  } else {
    // Nested branch — just append results; parent scope decides final status.
    await appendResults(args.logId, results, null, errorMessage)
  }
}

async function runStep(step: AutomationStep, args: ExecuteArgs): Promise<string> {
  const db = supabaseAdmin()

  switch (step.step_type) {
    case 'send_message': {
      const cfg = step.step_config as SendMessageStepConfig
      if (!args.contactId) throw new Error('send_message needs a contact')
      const text = interpolate(cfg.text, args)
      if (!text.trim()) throw new Error('send_message has empty text')
      const conversationId = await resolveConversationId(args)
      const { whatsapp_message_id } = await engineSendText({
        userId: args.automation.user_id,
        conversationId,
        contactId: args.contactId,
        text,
      })
      return `sent via Meta (${whatsapp_message_id})`
    }

    case 'send_template': {
      const cfg = step.step_config as SendTemplateStepConfig
      if (!args.contactId) throw new Error('send_template needs a contact')
      if (!cfg.template_name) throw new Error('send_template needs template_name')
      const conversationId = await resolveConversationId(args)
      // Meta templates use positional {{1}}, {{2}}, … placeholders, so
      // we MUST emit params in strict numeric order. Lexicographic sort
      // of "1", "2", …, "10" yields "1", "10", "2", … which silently
      // scrambles every template with ≥10 variables.
      const params = cfg.variables
        ? Object.keys(cfg.variables)
            .sort((a, b) => {
              const na = Number(a)
              const nb = Number(b)
              const aNum = Number.isFinite(na)
              const bNum = Number.isFinite(nb)
              if (aNum && bNum) return na - nb
              if (aNum) return -1
              if (bNum) return 1
              return a.localeCompare(b)
            })
            .map((k) => String(cfg.variables![k]))
        : []
      const { whatsapp_message_id } = await engineSendTemplate({
        userId: args.automation.user_id,
        conversationId,
        contactId: args.contactId,
        templateName: cfg.template_name,
        language: cfg.language,
        params,
      })
      return `template sent via Meta (${whatsapp_message_id})`
    }

    case 'add_tag': {
      const cfg = step.step_config as TagStepConfig
      if (!args.contactId || !cfg.tag_id) throw new Error('add_tag needs contact + tag_id')
      await db
        .from('contact_tags')
        .upsert(
          { contact_id: args.contactId, tag_id: cfg.tag_id },
          { onConflict: 'contact_id,tag_id', ignoreDuplicates: true },
        )
      return `tag ${cfg.tag_id} added`
    }

    case 'remove_tag': {
      const cfg = step.step_config as TagStepConfig
      if (!args.contactId || !cfg.tag_id) throw new Error('remove_tag needs contact + tag_id')
      await db
        .from('contact_tags')
        .delete()
        .eq('contact_id', args.contactId)
        .eq('tag_id', cfg.tag_id)
      return `tag ${cfg.tag_id} removed`
    }

    case 'assign_conversation': {
      const cfg = step.step_config as AssignConversationStepConfig
      if (!args.contactId) throw new Error('assign_conversation needs a contact')
      let agentId = cfg.agent_id
      if (cfg.mode === 'round_robin') {
        const { data: profiles } = await db
          .from('profiles')
          .select('user_id')
          .eq('user_id', args.automation.user_id)
          .limit(1)
        agentId = profiles?.[0]?.user_id
      }
      if (!agentId) return 'no agent resolved'
      await db
        .from('conversations')
        .update({ assigned_agent_id: agentId })
        .eq('user_id', args.automation.user_id)
        .eq('contact_id', args.contactId)
      return `assigned to ${agentId}`
    }

    case 'update_contact_field': {
      const cfg = step.step_config as UpdateContactFieldStepConfig
      if (!args.contactId) throw new Error('update_contact_field needs a contact')
      const allowed = new Set(['name', 'email', 'company'])
      if (!allowed.has(cfg.field)) {
        return `field ${cfg.field} not writable from automations`
      }
      await db
        .from('contacts')
        .update({ [cfg.field]: cfg.value, updated_at: new Date().toISOString() })
        .eq('id', args.contactId)
      return `${cfg.field} updated`
    }

    case 'create_deal': {
      const cfg = step.step_config as CreateDealStepConfig
      if (!cfg.pipeline_id || !cfg.stage_id) throw new Error('create_deal needs pipeline + stage')
      await db.from('deals').insert({
        user_id: args.automation.user_id,
        pipeline_id: cfg.pipeline_id,
        stage_id: cfg.stage_id,
        contact_id: args.contactId,
        title: interpolate(cfg.title, args),
        value: cfg.value ?? 0,
        status: 'open',
      })
      return 'deal created'
    }

    case 'send_webhook': {
      const cfg = step.step_config as SendWebhookStepConfig
      if (!cfg.url) throw new Error('send_webhook needs url')
      const body = cfg.body_template ? interpolate(cfg.body_template, args) : JSON.stringify(args.context)
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(cfg.headers ?? {}) },
        body,
      })
      if (!res.ok) throw new Error(`webhook returned ${res.status}`)
      return `webhook ${res.status}`
    }

    case 'close_conversation': {
      if (!args.contactId) throw new Error('close_conversation needs a contact')
      await db
        .from('conversations')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('user_id', args.automation.user_id)
        .eq('contact_id', args.contactId)
      return 'conversation closed'
    }

    // --- Phase 1: Advanced Action Handlers ---

    case 'ai_agent': {
      const cfg = step.step_config as AIAgentStepConfig
      const messageText = (args.context.message_text ?? '').toString()
      if (!messageText) return 'ai_agent: no message text'

      const {
        contact,
        currentScore,
        companyId,
        crmContextStr,
        historyText,
        memoryText,
        ragContext
      } = await getAIExecutionContext(
        db,
        args.contactId,
        args.automation.user_id,
        args,
        cfg.enable_memory,
        cfg.enable_crm_context
      )

      let aiResult: any
      const forceModel = cfg.provider && cfg.provider !== 'routing_default'
        ? {
            provider: cfg.provider,
            model: cfg.model || (
              cfg.provider === 'openai' ? 'gpt-4o' :
              cfg.provider === 'gemini' ? 'gemini-1.5-flash' :
              cfg.provider === 'claude' ? 'claude-3-5-sonnet' :
              cfg.provider === 'grok' ? 'grok-beta' :
              cfg.provider === 'deepseek' ? 'deepseek-chat' :
              cfg.provider === 'ollama' ? 'llama3' : 'gpt-4o'
            )
          }
        : undefined

      try {
        const persona = cfg.prompt_template || 'You are an intelligent WhatsApp CRM AI assistant.'
        let systemPrompt = persona
        
        // Tone instruction
        const toneStr = cfg.tone ? (TONE_INSTRUCTIONS[cfg.tone] || '') : ''
        if (toneStr) {
          systemPrompt += `\n\nTone Instruction: ${toneStr}`
        }

        // CRM context
        if (cfg.enable_crm_context !== false) {
          systemPrompt += `\n\nCRM Context:\n${crmContextStr}`
        }

        // Memory & history context
        if (cfg.enable_memory !== false) {
          systemPrompt += `\n\nShort-term Conversation History:\n${historyText}`
          systemPrompt += `\n\nLong-term Memory/Summary:\n${memoryText}`
        }

        // RAG context
        systemPrompt += `\n\nKnowledge Base Articles (RAG Context):\n${ragContext}`

        // JSON format instruction
        systemPrompt += `\n\nIMPORTANT: You must output a valid JSON object matching the following structure exactly, with no additional text or formatting.
{
  "intent": "string",
  "confidence": number (between 0.0 and 1.0),
  "entities": { "fieldName": "extractedValue" },
  "crm_updates": ["add_tag:TagName", "update_lead_score:number", "create_deal:PipelineID:StageID:Title:Value", "add_internal_note:NoteText"],
  "requires_human": boolean,
  "suggested_reply": "string (your generated reply using the tone instructions and retrieved context)"
}`

        const response = await callAI({
          companyId: companyId || 'default',
          feature: 'automations',
          prompt: `Analyze message: "${messageText}"`,
          systemPrompt: systemPrompt,
          temperature: cfg.temperature ?? 0.7,
          responseFormat: 'json',
          forceModel
        })
        aiResult = JSON.parse(response.text)
      } catch (err) {
        console.warn('[automations] AI Agent call failed, calling local fallback:', err)
        aiResult = runLocalFallbackAI(messageText, currentScore)
      }

      // Store AI results in workflow vars for downstream steps
      args.context.vars = {
        ...args.context.vars,
        ai_intent: aiResult.intent,
        ai_confidence: aiResult.confidence,
        ai_entities: JSON.stringify(aiResult.entities || {}),
        ai_reply: aiResult.suggested_reply,
        ai_requires_human: String(aiResult.requires_human),
        ai_lead_score: String(aiResult.lead_score),
      }

      // Auto-apply CRM updates if configured
      if (cfg.update_crm !== false && args.contactId) {
        if (Array.isArray(aiResult.crm_updates)) {
          for (const update of aiResult.crm_updates) {
            if (typeof update === 'string') {
              if (update.startsWith('add_tag:')) {
                const tagName = update.replace('add_tag:', '').trim()
                if (tagName) {
                  const { data: tag } = await db
                    .from('tags')
                    .select('id')
                    .eq('user_id', args.automation.user_id)
                    .eq('name', tagName)
                    .maybeSingle()
                  if (tag) {
                    await db
                      .from('contact_tags')
                      .upsert(
                        { contact_id: args.contactId, tag_id: tag.id },
                        { onConflict: 'contact_id,tag_id', ignoreDuplicates: true },
                      )
                  }
                }
              } else if (update.startsWith('update_lead_score:')) {
                const delta = parseInt(update.replace('update_lead_score:', ''))
                if (!isNaN(delta)) {
                  const newScore = Math.max(0, Math.min(100, currentScore + delta))
                  await db
                    .from('contacts')
                    .update({ lead_score: newScore })
                    .eq('id', args.contactId)
                }
              } else if (update.startsWith('create_deal:')) {
                // format: create_deal:PipelineID:StageID:Title:Value
                const parts = update.replace('create_deal:', '').split(':')
                const pipelineId = parts[0]?.trim()
                const stageId = parts[1]?.trim()
                const title = parts[2]?.trim() || 'AI Generated Deal'
                const value = parseFloat(parts[3]?.trim() || '0')
                if (pipelineId && stageId) {
                  await db.from('deals').insert({
                    user_id: args.automation.user_id,
                    pipeline_id: pipelineId,
                    stage_id: stageId,
                    contact_id: args.contactId,
                    title: title,
                    value: isNaN(value) ? 0 : value,
                    status: 'open',
                  })
                }
              } else if (update.startsWith('add_internal_note:')) {
                const noteText = update.replace('add_internal_note:', '').trim()
                if (noteText) {
                  await db.from('contact_notes').insert({
                    contact_id: args.contactId,
                    user_id: args.automation.user_id,
                    note_text: noteText,
                  })
                }
              }
            } else if (update && typeof update === 'object') {
              const type = update.type || update.action
              if (type === 'add_tag') {
                const tagName = (update.name || update.tag || '').trim()
                if (tagName) {
                  const { data: tag } = await db
                    .from('tags')
                    .select('id')
                    .eq('user_id', args.automation.user_id)
                    .eq('name', tagName)
                    .maybeSingle()
                  if (tag) {
                    await db
                      .from('contact_tags')
                      .upsert(
                        { contact_id: args.contactId, tag_id: tag.id },
                        { onConflict: 'contact_id,tag_id', ignoreDuplicates: true },
                      )
                  }
                }
              } else if (type === 'update_lead_score' || type === 'lead_score') {
                const delta = parseInt(update.value || update.amount || update.delta || '0')
                if (!isNaN(delta)) {
                  const newScore = Math.max(0, Math.min(100, currentScore + delta))
                  await db
                    .from('contacts')
                    .update({ lead_score: newScore })
                    .eq('id', args.contactId)
                }
              } else if (type === 'create_deal' || type === 'deal') {
                const pipelineId = update.pipeline_id || update.pipeline
                const stageId = update.stage_id || update.stage
                const title = update.title || 'AI Generated Deal'
                const value = parseFloat(update.value || update.amount || '0')
                if (pipelineId && stageId) {
                  await db.from('deals').insert({
                    user_id: args.automation.user_id,
                    pipeline_id: pipelineId,
                    stage_id: stageId,
                    contact_id: args.contactId,
                    title: title,
                    value: isNaN(value) ? 0 : value,
                    status: 'open',
                  })
                }
              } else if (type === 'add_internal_note' || type === 'note') {
                const noteText = (update.note_text || update.text || '').trim()
                if (noteText) {
                  await db.from('contact_notes').insert({
                    contact_id: args.contactId,
                    user_id: args.automation.user_id,
                    note_text: noteText,
                  })
                }
              }
            }
          }
        }

        // Direct deal/note fields on aiResult
        if (aiResult.deal && typeof aiResult.deal === 'object') {
          const deal = aiResult.deal
          const pipelineId = deal.pipeline_id || deal.pipeline
          const stageId = deal.stage_id || deal.stage
          const title = deal.title || 'AI Generated Deal'
          const value = parseFloat(deal.value || deal.amount || '0')
          if (pipelineId && stageId) {
            await db.from('deals').insert({
              user_id: args.automation.user_id,
              pipeline_id: pipelineId,
              stage_id: stageId,
              contact_id: args.contactId,
              title: title,
              value: isNaN(value) ? 0 : value,
              status: 'open',
            })
          }
        }

        if (aiResult.note && typeof aiResult.note === 'string') {
          const noteText = aiResult.note.trim()
          if (noteText) {
            await db.from('contact_notes').insert({
              contact_id: args.contactId,
              user_id: args.automation.user_id,
              note_text: noteText,
            })
          }
        }
      }

      // Auto-send reply if configured
      if (cfg.auto_reply !== false && aiResult.suggested_reply && args.contactId) {
        try {
          const conversationId = await resolveConversationId(args)
          await engineSendText({
            userId: args.automation.user_id,
            conversationId,
            contactId: args.contactId,
            text: aiResult.suggested_reply,
          })
        } catch (e) {
          console.warn('[automations] ai_agent auto-reply failed:', e)
        }
      }

      // Trigger human handoff if urgency / low confidence detected
      const requiresHandoff = aiResult.requires_human === true || (aiResult.confidence !== undefined && aiResult.confidence < 0.4)
      if (requiresHandoff && args.contactId) {
        try {
          const conversationId = await resolveConversationId(args).catch(() => null)
          if (conversationId) {
            // Set AI enabled status to false for this chat
            await db
              .from('ai_conversations')
              .upsert(
                { conversation_id: conversationId, enabled: false, user_id: args.automation.user_id, updated_at: new Date().toISOString() },
                { onConflict: 'conversation_id' }
              )

            // Move conversation to pending status
            await db
              .from('conversations')
              .update({ status: 'pending', updated_at: new Date().toISOString() })
              .eq('id', conversationId)

            // Apply "Escalated" tag
            let { data: tag } = await db
              .from('tags')
              .select('id')
              .eq('user_id', args.automation.user_id)
              .eq('name', 'Escalated')
              .maybeSingle()

            if (!tag) {
              const { data: newTag } = await db
                .from('tags')
                .insert({ user_id: args.automation.user_id, name: 'Escalated', color: '#ec4899' })
                .select('id')
                .single()
              tag = newTag
            }

            if (tag) {
              await db.from('contact_tags').upsert(
                { contact_id: args.contactId, tag_id: tag.id },
                { onConflict: 'contact_id,tag_id' }
              )
            }

            // Save notification message in thread
            await db.from('messages').insert({
              conversation_id: conversationId,
              sender_type: 'bot',
              content_type: 'text',
              content_text: '⚠️ Conversation control transferred to support agent.',
              status: 'sent',
              created_at: new Date().toISOString()
            })
          }
        } catch (handoffErr) {
          console.error('[automations-engine] Handoff execution failed:', handoffErr)
        }
      }

      return `AI: intent=${aiResult.intent} conf=${aiResult.confidence?.toFixed(2) || '0.00'} human=${requiresHandoff}`
    }

    case 'ai_reply': {
      const cfg = step.step_config as AIAgentStepConfig
      const messageText = (args.context.message_text ?? '').toString()
      if (!messageText || !args.contactId) return 'ai_reply: no message or contact'

      const {
        contact,
        currentScore,
        companyId,
        crmContextStr,
        historyText,
        memoryText,
        ragContext
      } = await getAIExecutionContext(
        db,
        args.contactId,
        args.automation.user_id,
        args,
        cfg.enable_memory,
        cfg.enable_crm_context
      )

      let aiResult: any
      const forceModel = cfg.provider && cfg.provider !== 'routing_default'
        ? {
            provider: cfg.provider,
            model: cfg.model || (
              cfg.provider === 'openai' ? 'gpt-4o' :
              cfg.provider === 'gemini' ? 'gemini-1.5-flash' :
              cfg.provider === 'claude' ? 'claude-3-5-sonnet' :
              cfg.provider === 'grok' ? 'grok-beta' :
              cfg.provider === 'deepseek' ? 'deepseek-chat' :
              cfg.provider === 'ollama' ? 'llama3' : 'gpt-4o'
            )
          }
        : undefined

      try {
        const persona = cfg.prompt_template || 'You are a helpful customer support agent for our business. Answer queries politely, provide details, and offer help.'
        let systemPrompt = persona
        
        // Tone instruction
        const toneStr = cfg.tone ? (TONE_INSTRUCTIONS[cfg.tone] || '') : ''
        if (toneStr) {
          systemPrompt += `\n\nTone Instruction: ${toneStr}`
        }

        // CRM context
        if (cfg.enable_crm_context !== false) {
          systemPrompt += `\n\nCRM Context:\n${crmContextStr}`
        }

        // Memory & history context
        if (cfg.enable_memory !== false) {
          systemPrompt += `\n\nShort-term Conversation History:\n${historyText}`
          systemPrompt += `\n\nLong-term Memory/Summary:\n${memoryText}`
        }

        // RAG context
        systemPrompt += `\n\nKnowledge Base Articles (RAG Context):\n${ragContext}`

        const response = await callAI({
          companyId: companyId || 'default',
          feature: 'replies',
          prompt: `Generate direct reply to message: "${messageText}"`,
          systemPrompt: systemPrompt,
          temperature: cfg.temperature ?? 0.7,
          forceModel
        })
        aiResult = {
          suggested_reply: response.text,
          intent: 'auto_reply',
          confidence: 1.0,
          entities: {},
          crm_updates: [],
          requires_human: false
        }
      } catch (err) {
        console.warn('[automations] AI Reply step failed, calling local fallback:', err)
        aiResult = runLocalFallbackAI(messageText, 50)
      }

      if (aiResult.suggested_reply) {
        const conversationId = await resolveConversationId(args)
        await engineSendText({
          userId: args.automation.user_id,
          conversationId,
          contactId: args.contactId,
          text: aiResult.suggested_reply,
        })
      }
      return `ai_reply sent: ${aiResult.intent}`
    }

    case 'http_request': {
      const cfg = step.step_config as HttpRequestStepConfig
      if (!cfg.url) throw new Error('http_request needs url')
      const body = cfg.body_template ? interpolate(cfg.body_template, args) : undefined
      const maxRetries = cfg.retry_count ?? 0
      let lastError = ''
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), cfg.timeout_ms ?? 10000)
          const res = await fetch(cfg.url, {
            method: cfg.method || 'POST',
            headers: { 'content-type': 'application/json', ...(cfg.headers ?? {}) },
            body: cfg.method !== 'GET' ? body : undefined,
            signal: controller.signal,
          })
          clearTimeout(timeout)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          if (cfg.response_var_key) {
            const responseText = await res.text()
            args.context.vars = { ...args.context.vars, [cfg.response_var_key]: responseText }
          }
          return `http_request ${cfg.method} ${res.status} (attempt ${attempt + 1})`
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err)
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          }
        }
      }
      throw new Error(`http_request failed after ${maxRetries + 1} attempts: ${lastError}`)
    }

    case 'send_media': {
      // Placeholder — actual media sending requires WhatsApp media API
      const cfg = step.step_config as SendMediaStepConfig
      if (!args.contactId) throw new Error('send_media needs a contact')
      return `send_media: ${cfg.media_type} queued (${cfg.media_url})`
    }

    case 'send_buttons': {
      if (!args.contactId) throw new Error('send_buttons needs a contact')
      return 'send_buttons: interactive message queued'
    }

    case 'send_list_message': {
      if (!args.contactId) throw new Error('send_list_message needs a contact')
      return 'send_list_message: interactive list queued'
    }

    case 'increase_lead_score': {
      const cfg = step.step_config as IncreaseLeadScoreStepConfig
      if (!args.contactId) throw new Error('increase_lead_score needs a contact')
      const { data: contact } = await db
        .from('contacts')
        .select('lead_score')
        .eq('id', args.contactId)
        .maybeSingle()
      const current = contact?.lead_score ?? 0
      const newScore = Math.max(0, Math.min(100, current + (cfg.amount ?? 10)))
      await db
        .from('contacts')
        .update({ lead_score: newScore, updated_at: new Date().toISOString() })
        .eq('id', args.contactId)
      return `lead_score: ${current} → ${newScore}`
    }

    case 'add_internal_note': {
      const cfg = step.step_config as AddInternalNoteStepConfig
      if (!args.contactId) throw new Error('add_internal_note needs a contact')
      const text = interpolate(cfg.note_text || '', args)
      await db.from('contact_notes').insert({
        contact_id: args.contactId,
        user_id: args.automation.user_id,
        note_text: text,
      })
      return `note added: ${text.slice(0, 40)}…`
    }

    case 'move_pipeline_stage': {
      const cfg = step.step_config as MovePipelineStageStepConfig
      if (!cfg.stage_id) throw new Error('move_pipeline_stage needs stage_id')
      const dealQuery = cfg.deal_id
        ? db.from('deals').update({ stage_id: cfg.stage_id }).eq('id', cfg.deal_id)
        : db.from('deals').update({ stage_id: cfg.stage_id })
            .eq('user_id', args.automation.user_id)
            .eq('contact_id', args.contactId ?? '')
            .eq('status', 'open')
      await dealQuery
      return `pipeline stage moved to ${cfg.stage_id}`
    }

    case 'trigger_automation': {
      const cfg = step.step_config as TriggerAutomationStepConfig
      // Depth guard to prevent infinite recursion
      const depth = Number(args.context.vars?._trigger_depth) || 0
      if (depth >= 5) throw new Error('Max trigger depth exceeded (5 levels)')
      const childContext = cfg.pass_context
        ? { ...args.context, vars: { ...args.context.vars, _trigger_depth: String(depth + 1) } }
        : { vars: { _trigger_depth: String(depth + 1) } }
      // Fire the target automation directly
      const { data: target } = await db
        .from('automations')
        .select('*')
        .eq('id', cfg.target_automation_id)
        .eq('is_active', true)
        .maybeSingle()
      if (target) {
        await executeAutomation(target as Automation, {
          userId: args.automation.user_id,
          triggerType: target.trigger_type,
          contactId: args.contactId,
          context: childContext as AutomationContext,
        })
      }
      return `triggered automation ${cfg.target_automation_id}`
    }

    case 'switch': {
      const cfg = step.step_config as SwitchStepConfig
      // Evaluate the subject, find matching case, recurse into that branch
      let subjectValue = ''
      if (cfg.subject === 'message_content') {
        subjectValue = (args.context.message_text ?? '').toString().toLowerCase()
      } else if (cfg.subject === 'contact_field' && cfg.operand && args.contactId) {
        const { data } = await db
          .from('contacts')
          .select(cfg.operand)
          .eq('id', args.contactId)
          .maybeSingle()
        subjectValue = String((data as unknown as Record<string, unknown>)?.[cfg.operand] ?? '')
      }
      const matchedCase = (cfg.cases ?? []).findIndex((c) =>
        subjectValue.includes(c.value.toLowerCase())
      )
      const branch = matchedCase >= 0 ? 'yes' : 'no'
      await executeStepsFrom({
        ...args,
        parentStepId: step.id,
        branch,
        startPosition: 0,
      })
      return `switch: matched case ${matchedCase >= 0 ? matchedCase : 'default'}`
    }

    case 'split_traffic': {
      const cfg = step.step_config as SplitTrafficStepConfig
      const totalWeight = (cfg.variants ?? []).reduce((s, v) => s + v.weight, 0)
      const rand = Math.random() * totalWeight
      let cumulative = 0
      let chosen = 0
      for (let i = 0; i < (cfg.variants ?? []).length; i++) {
        cumulative += cfg.variants[i].weight
        if (rand <= cumulative) { chosen = i; break }
      }
      args.context.vars = { ...args.context.vars, _split_variant: String(chosen) }
      return `split_traffic: variant ${cfg.variants?.[chosen]?.label ?? chosen}`
    }

    case 'loop': {
      const cfg = step.step_config as LoopStepConfig
      const maxIter = cfg.max_iterations ?? 3
      for (let i = 0; i < maxIter; i++) {
        args.context.vars = { ...args.context.vars, _loop_index: String(i) }
        await executeStepsFrom({
          ...args,
          parentStepId: step.id,
          branch: 'yes',
          startPosition: 0,
        })
      }
      return `loop: completed ${maxIter} iterations`
    }

    case 'delay_until': {
      const cfg = step.step_config as DelayUntilStepConfig
      if (cfg.until_type === 'datetime' && cfg.datetime) {
        const target = new Date(cfg.datetime).getTime()
        const now = Date.now()
        if (target > now) {
          // Schedule as pending execution
          await db.from('automation_pending_executions').insert({
            automation_id: args.automation.id,
            user_id: args.automation.user_id,
            contact_id: args.contactId,
            log_id: args.logId,
            parent_step_id: args.parentStepId,
            branch: args.branch,
            next_step_position: step.position + 1,
            context: args.context,
            run_at: cfg.datetime,
            status: 'pending',
          })
          return `delay_until: scheduled for ${cfg.datetime}`
        }
      }
      return 'delay_until: condition already met'
    }

    case 'assign_human_agent': {
      if (!args.contactId) throw new Error('assign_human_agent needs a contact')
      const cfg = step.step_config as Record<string, unknown>
      const agentId = cfg.agent_id as string | undefined
      if (agentId) {
        await db
          .from('conversations')
          .update({ assigned_agent_id: agentId })
          .eq('user_id', args.automation.user_id)
          .eq('contact_id', args.contactId)
      }
      return `human agent assigned: ${agentId ?? 'round-robin'}`
    }

    case 'notify_team': {
      const cfg = step.step_config as NotifyTeamStepConfig
      const text = interpolate(cfg.message || '', args)
      // Store as internal notification (could be extended to Slack/email)
      console.log(`[automations] TEAM NOTIFICATION: ${text}`)
      return `notify_team: ${text.slice(0, 50)}`
    }

    case 'escalate_priority': {
      const cfg = step.step_config as EscalatePriorityStepConfig
      if (args.contactId) {
        await db
          .from('conversations')
          .update({ priority: cfg.level || 'high', updated_at: new Date().toISOString() })
          .eq('user_id', args.automation.user_id)
          .eq('contact_id', args.contactId)
      }
      return `escalated to ${cfg.level}`
    }

    case 'send_payment_link': {
      const cfg = step.step_config as SendPaymentLinkStepConfig
      // Placeholder — would integrate with Razorpay/Stripe
      return `payment_link: ${cfg.currency ?? 'INR'} ${cfg.amount}`
    }

    case 'create_order':
    case 'verify_payment':
    case 'track_shipment':
    case 'generate_invoice': {
      // Ecommerce placeholders — will be wired to actual integrations
      return `${step.step_type}: executed (placeholder)`
    }

    case 'pause_flow': {
      return 'flow paused'
    }

    case 'end_flow': {
      return 'flow ended'
    }

    case 'goto_step': {
      const cfg = step.step_config as Record<string, unknown>
      return `goto: ${cfg.target_step_cid ?? 'unknown'}`
    }

    case 'google_calendar_create_event': {
      const cfg = step.step_config as GoogleCalendarCreateEventStepConfig
      if (!cfg.summary) throw new Error('google_calendar_create_event needs summary')

      // Resolve contact details for custom interpolation
      let contactName = 'Unknown Contact'
      let contactEmail = ''
      let contactPhone = ''
      if (args.contactId) {
        const { data: contact } = await db
          .from('contacts')
          .select('name, email, phone')
          .eq('id', args.contactId)
          .maybeSingle()
        if (contact) {
          contactName = contact.name || 'Unknown Contact'
          contactEmail = contact.email || ''
          contactPhone = contact.phone || ''
        }
      }

      const replaceContactPlaceholder = (text: string) => {
        return text
          .replace(/\{\{\s*contact\.name\s*\}\}/g, contactName)
          .replace(/\{\{\s*contact\.email\s*\}\}/g, contactEmail)
          .replace(/\{\{\s*contact\.phone\s*\}\}/g, contactPhone)
      }

      const summary = replaceContactPlaceholder(interpolate(cfg.summary, args))
      const description = cfg.description
        ? replaceContactPlaceholder(interpolate(cfg.description, args))
        : undefined

      const result = await createCalendarEvent(args.automation.user_id, db, {
        summary,
        description,
        startDelayMinutes: cfg.start_delay_minutes,
        durationMinutes: cfg.duration_minutes,
      })

      return `event created: ${result.id} (${result.htmlLink || 'no link'})`
    }

    case 'create_appointment': {
      const cfg = step.step_config as any
      if (!args.contactId) throw new Error('create_appointment needs a contact')
      
      const dateStr = (args.context.vars?.appointment_date as string) || 
                      (args.context.vars?.ai_entities ? JSON.parse(args.context.vars.ai_entities as string).appointment_date : null) || 
                      new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const timeStr = (args.context.vars?.appointment_time as string) || 
                      (args.context.vars?.ai_entities ? JSON.parse(args.context.vars.ai_entities as string).appointment_time : null) || 
                      '10:00'

      const res = await bookAppointment(args.automation.user_id, args.contactId, cfg.service || 'Consultation', dateStr, timeStr, {
        location: cfg.location || 'Main Office',
        notes: interpolate(cfg.notes || '', args)
      })

      if (!res.success) {
        throw new Error(res.error || 'Failed to book appointment')
      }

      args.context.vars = {
        ...args.context.vars,
        booked_token: res.token?.token_number,
        booked_id: res.appointment?.id,
        queue_position: res.queuePosition?.toString()
      }

      return `appointment booked: token=${res.token?.token_number} pos=${res.queuePosition}`
    }

    case 'generate_token': {
      const cfg = step.step_config as any
      const token = await generateTokenNumber(args.automation.user_id, cfg.branch_prefix || 'A', cfg.reset_daily !== false)
      
      args.context.vars = {
        ...args.context.vars,
        generated_token: token.token_number
      }

      return `token generated: ${token.token_number}`
    }

    case 'check_availability': {
      const cfg = step.step_config as any
      
      const dateStr = (args.context.vars?.appointment_date as string) || 
                      (args.context.vars?.ai_entities ? JSON.parse(args.context.vars.ai_entities as string).appointment_date : null) || 
                      new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const slots = await generateSlotsForDate(args.automation.user_id, dateStr, {
        location: cfg.location || 'Main Office'
      })

      const freeSlots = slots
        .filter((s) => !s.isBooked && !s.isLocked)
        .map((s) => s.startTime)
        .slice(0, 4)
        .join(', ')

      args.context.vars = {
        ...args.context.vars,
        available_slots: freeSlots || 'none'
      }

      return `checked availability for ${dateStr}: [${freeSlots || 'none'}]`
    }

    case 'send_reminder': {
      const cfg = step.step_config as any
      if (!args.contactId) throw new Error('send_reminder needs a contact')
      
      const token = (args.context.vars?.booked_token as string) || 'A101'
      const date = (args.context.vars?.appointment_date as string) || 'tomorrow'
      const time = (args.context.vars?.appointment_time as string) || '10:00 AM'
      
      const text = `Friendly reminder: You have a scheduled appointment (${cfg.reminder_type}) on ${date} at ${time}. Token: ${token}.`
      
      const conversationId = await resolveConversationId(args)
      await engineSendText({
        userId: args.automation.user_id,
        conversationId,
        contactId: args.contactId,
        text,
      })

      return `reminder (${cfg.reminder_type}) sent`
    }

    case 'reschedule_appointment': {
      const appointmentId = (args.context.vars?.appointment_id as string)
      if (!appointmentId) throw new Error('reschedule_appointment needs appointment_id in vars')

      const dateStr = (args.context.vars?.appointment_date as string) || 
                      (args.context.vars?.ai_entities ? JSON.parse(args.context.vars.ai_entities as string).appointment_date : null)
      const timeStr = (args.context.vars?.appointment_time as string) || 
                      (args.context.vars?.ai_entities ? JSON.parse(args.context.vars.ai_entities as string).appointment_time : null)

      if (!dateStr || !timeStr) throw new Error('reschedule_appointment needs new date and time')

      const res = await rescheduleAppointment(appointmentId, dateStr, timeStr)
      if (!res.success) throw new Error(res.error || 'Failed to reschedule appointment')

      return `appointment rescheduled to ${dateStr} at ${timeStr}`
    }

    case 'cancel_booking': {
      const cfg = step.step_config as any
      const appointmentId = (args.context.vars?.appointment_id as string)
      if (!appointmentId) throw new Error('cancel_booking needs appointment_id in vars')

      const res = await cancelAppointment(appointmentId, cfg.reason || 'Cancelled by system')
      if (!res.success) throw new Error(res.error || 'Failed to cancel appointment')

      return 'appointment cancelled'
    }

    case 'assign_agent': {
      const cfg = step.step_config as any
      if (!args.contactId) throw new Error('assign_agent needs a contact')
      
      let agentId = cfg.agent_id
      if (cfg.mode === 'round_robin') {
        const { data: profiles } = await db
          .from('profiles')
          .select('user_id')
          .eq('user_id', args.automation.user_id)
          .limit(1)
        agentId = profiles?.[0]?.user_id
      }
      
      if (!agentId) return 'no agent resolved'
      
      const appointmentId = (args.context.vars?.appointment_id as string)
      if (appointmentId) {
        await db
          .from('appointments')
          .update({ agent_id: agentId })
          .eq('id', appointmentId)
      }
      
      await db
        .from('conversations')
        .update({ assigned_agent_id: agentId })
        .eq('user_id', args.automation.user_id)
        .eq('contact_id', args.contactId)

      return `assigned to ${agentId}`
    }

    case 'add_calendar_event': {
      const cfg = step.step_config as any
      
      const dateStr = (args.context.vars?.appointment_date as string) || 
                      new Date(Date.now() + 86400000).toISOString().split('T')[0]
      const timeStr = (args.context.vars?.appointment_time as string) || '10:00'
      const startDateTime = new Date(`${dateStr}T${timeStr}:00.000Z`)

      let contactName = 'Unknown'
      if (args.contactId) {
        const { data } = await db.from('contacts').select('name').eq('id', args.contactId).single()
        if (data?.name) contactName = data.name
      }

      const result = await createCalendarEvent(args.automation.user_id, db, {
        summary: interpolate(cfg.summary, args).replace(/\{\{\s*contact\.name\s*\}\}/g, contactName),
        description: cfg.description ? interpolate(cfg.description, args).replace(/\{\{\s*contact\.name\s*\}\}/g, contactName) : '',
        startTime: startDateTime.toISOString(),
        durationMinutes: cfg.duration_minutes || 30
      })

      return `event added: ${result.id}`
    }

    default:
      return `unknown step: ${step.step_type}`
  }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Pick the conversation a send-type step should use. Prefer the id the
 * webhook handed us (it's the one that just got the inbound message);
 * fall back to the contact's conversation for resumed/wait paths and
 * manual engine POSTs. Throws if none exists — send steps have
 * no meaningful target without a conversation.
 */
async function resolveConversationId(args: ExecuteArgs): Promise<string> {
  const fromCtx = args.context.conversation_id
  if (fromCtx) return fromCtx
  if (!args.contactId) throw new Error('cannot resolve conversation: no contact')
  const { data, error } = await supabaseAdmin()
    .from('conversations')
    .select('id')
    .eq('user_id', args.automation.user_id)
    .eq('contact_id', args.contactId)
    .maybeSingle()
  if (error) throw new Error(`conversation lookup failed: ${error.message}`)
  if (!data?.id) throw new Error('no conversation for contact')
  return data.id as string
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: 'Maintain a professional, polite, and helpful tone. Avoid slang or overly informal language.',
  friendly: 'Use a warm, welcoming, and friendly tone. Be supportive and conversational.',
  luxury: 'Adopt a highly polished, sophisticated, and premium tone suitable for high-end clientele. Be elegant and refined.',
  casual: 'Keep it casual, relaxed, and conversational. Use friendly, approachable language.',
  'sales-focused': 'Be energetic, persuasive, and proactive. Highlight benefits, call-to-actions, and address customer pain points to drive conversions.',
  medical: 'Maintain a highly professional, clinical, empathetic, and reassuring tone. Prioritize clarity and accuracy, and keep it formal.',
  corporate: 'Use a formal, direct, and structured corporate communication style. Focus on business alignment and clarity.'
}

async function getAIExecutionContext(
  db: any,
  contactId: string | null,
  userId: string,
  args: ExecuteArgs,
  enableMemory: boolean = true,
  enableCrmContext: boolean = true
) {
  let contact: any = null
  let currentScore = 50
  let companyId = 'default'
  let crmContextStr = 'No CRM context available.'

  if (contactId && enableCrmContext) {
    try {
      const { data } = await db
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .maybeSingle()
      if (data) {
        contact = data
        if (data.lead_score != null) currentScore = data.lead_score
        if (data.company_id != null) companyId = data.company_id
        
        // Fetch contact tags
        const { data: contactTags } = await db
          .from('contact_tags')
          .select('tag_id')
          .eq('contact_id', contactId)
        
        const tagIds = contactTags ? contactTags.map((ct: any) => ct.tag_id) : []
        let tagNames: string[] = []
        if (tagIds.length > 0) {
          const { data: tagsList } = await db
            .from('tags')
            .select('name')
            .in('id', tagIds)
          if (tagsList) {
            tagNames = tagsList.map((t: any) => t.name)
          }
        }

        crmContextStr = `Contact Profile:
- Name: ${data.name || 'Unknown'}
- Email: ${data.email || 'N/A'}
- Phone: ${data.phone || 'N/A'}
- Lead Score: ${currentScore}
- Tags: ${tagNames.join(', ') || 'None'}`
      }
    } catch (err) {
      console.error('[automations-engine] Failed to fetch contact info:', err)
    }
  }

  // Resolve conversation history (last 8 messages)
  let historyText = 'No conversation history.'
  if (contactId && enableMemory) {
    try {
      const conversationId = await resolveConversationId(args).catch(() => null)
      if (conversationId) {
        const { data: messages } = await db
          .from('messages')
          .select('sender_type, content_text, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(8)

        if (messages && messages.length > 0) {
          const chron = [...messages].reverse()
          historyText = chron
            .map((m) => `${m.sender_type === 'customer' ? 'Customer' : 'Assistant'}: ${m.content_text || ''}`)
            .join('\n')
        }
      }
    } catch (err) {
      console.warn('[automations-engine] Failed to fetch conversation history:', err)
    }
  }

  // Fetch long-term memory summary
  let memoryText = 'No previous memory.'
  if (contactId && enableMemory) {
    try {
      const { data } = await db
        .from('ai_memory')
        .select('summary')
        .eq('contact_id', contactId)
        .maybeSingle()
      if (data?.summary) memoryText = data.summary
    } catch (err) {
      console.warn('[automations-engine] ai_memory fetch error:', err)
    }
  }

  // Fetch RAG knowledge base context
  let ragContext = 'No company knowledge base documents uploaded.'
  if (companyId && companyId !== 'default') {
    try {
      const { data } = await db
        .from('ai_knowledge_base')
        .select('*')
        .eq('company_id', companyId)
      if (data && data.length > 0) {
        ragContext = data.map((doc: any) => `[Document: ${doc.title} (${doc.type})]\n${doc.content}`).join('\n\n')
      }
    } catch (err) {
      console.warn('[automations-engine] ai_knowledge_base fetch error:', err)
    }
  }

  return {
    contact,
    currentScore,
    companyId,
    crmContextStr,
    historyText,
    memoryText,
    ragContext
  }
}


function triggerMatches(automation: Automation, ctx: AutomationContext | undefined): boolean {
  if (!ctx) return true

  const type = automation.trigger_type
  const cfg = automation.trigger_config as Record<string, any>

  if (type === 'keyword_match') {
    if (!cfg?.keywords || cfg.keywords.length === 0) return false
    const text = (ctx.message_text ?? '').toString()
    if (!text) return false
    const haystack = cfg.case_sensitive ? text : text.toLowerCase()
    return (cfg.keywords as string[]).some((raw: string) => {
      const k = cfg.case_sensitive ? raw : raw.toLowerCase()
      return cfg.match_type === 'exact' ? haystack === k : haystack.includes(k)
    })
  }

  if (type === 'exact_match') {
    if (!cfg?.keywords || cfg.keywords.length === 0) return false
    const text = (ctx.message_text ?? '').toString()
    if (!text) return false
    const haystack = cfg.case_sensitive ? text : text.toLowerCase()
    return (cfg.keywords as string[]).some((raw: string) => {
      const k = cfg.case_sensitive ? raw : raw.toLowerCase()
      return haystack === k
    })
  }

  if (type === 'message_contains') {
    if (!cfg?.keywords || cfg.keywords.length === 0) return false
    const text = (ctx.message_text ?? '').toString()
    if (!text) return false
    const haystack = cfg.case_sensitive ? text : text.toLowerCase()
    return (cfg.keywords as string[]).some((raw: string) => {
      const k = cfg.case_sensitive ? raw : raw.toLowerCase()
      return haystack.includes(k)
    })
  }

  if (type === 'template_replied') {
    if (cfg?.template_name && ctx.vars?.template_name !== cfg.template_name) return false
    return true
  }

  if (type === 'media_received' || type === 'media_message_received') {
    return true
  }

  if (type === 'voice_received' || type === 'voice_message_received') {
    return true
  }

  if (type === 'regex_match') {
    if (!cfg?.pattern) return false
    const text = (ctx.message_text ?? '').toString()
    if (!text) return false
    try {
      const regex = new RegExp(cfg.pattern, cfg.case_sensitive ? '' : 'i')
      return regex.test(text)
    } catch {
      return false
    }
  }

  if (type === 'intent_detected') {
    if (!cfg?.intent) return false
    const ctxIntent = (ctx.intent ?? '').toString().toLowerCase()
    return ctxIntent === cfg.intent.toString().toLowerCase()
  }

  if (type === 'button_clicked') {
    const ctxBtnId = ctx.button_id || ctx.interactive_reply_id
    if (cfg?.button_id && ctxBtnId !== cfg.button_id) return false
    if (cfg?.button_text && ctx.button_text !== cfg.button_text) return false
    return true
  }

  if (type === 'list_option_selected') {
    const ctxOptId = ctx.option_id || ctx.interactive_reply_id
    if (cfg?.option_id && ctxOptId !== cfg.option_id) return false
    if (cfg?.option_text && ctx.option_text !== cfg.option_text) return false
    return true
  }

  if (type === 'tag_added' || type === 'tag_removed') {
    if (cfg?.tag_id && ctx.tag_id !== cfg.tag_id) return false
    return true
  }

  if (type === 'contact_field_updated') {
    if (cfg?.field && ctx.updated_field !== cfg.field) return false
    return true
  }

  return true
}

async function evaluateCondition(cfg: ConditionStepConfig, args: ExecuteArgs): Promise<boolean> {
  const db = supabaseAdmin()
  switch (cfg.subject) {
    case 'tag_presence': {
      if (!args.contactId || !cfg.operand) return false
      const { count } = await db
        .from('contact_tags')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', args.contactId)
        .eq('tag_id', cfg.operand)
      return (count ?? 0) > 0
    }
    case 'contact_field': {
      if (!args.contactId || !cfg.operand) return false
      const { data } = await db
        .from('contacts')
        .select(cfg.operand)
        .eq('id', args.contactId)
        .maybeSingle()
      const v = (data as Record<string, unknown> | null)?.[cfg.operand]
      return v != null && String(v) === String(cfg.value ?? '')
    }
    case 'message_content': {
      const text = (args.context.message_text ?? '').toString()
      return text.toLowerCase().includes((cfg.value ?? '').toLowerCase())
    }
    case 'time_of_day': {
      // operand form "HH:mm-HH:mm" — true if now is within that window
      // (supports over-midnight ranges like "18:00-09:00").
      const [from, to] = (cfg.operand ?? '').split('-')
      if (!from || !to) return false
      const now = new Date()
      const mins = now.getHours() * 60 + now.getMinutes()
      const parse = (s: string) => {
        const [h, m] = s.split(':').map(Number)
        return (h || 0) * 60 + (m || 0)
      }
      const f = parse(from)
      const t = parse(to)
      return f <= t ? mins >= f && mins < t : mins >= f || mins < t
    }
    default:
      return false
  }
}

function waitMs(cfg: WaitStepConfig): number {
  const unitMs = cfg.unit === 'days' ? 86_400_000 : cfg.unit === 'hours' ? 3_600_000 : 60_000
  return Math.max(1_000, cfg.amount * unitMs)
}

function interpolate(s: string, args: ExecuteArgs): string {
  return s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const [ns, prop] = String(key).split('.')
    if (ns === 'message' && prop === 'text') return String(args.context.message_text ?? '')
    if (ns === 'vars' && prop) return String(args.context.vars?.[prop] ?? '')
    return ''
  })
}

async function appendResults(
  logId: string | null,
  newItems: AutomationLogStepResult[],
  status: 'success' | 'partial' | 'failed' | null,
  errorMessage: string | null,
) {
  if (!logId) return
  const db = supabaseAdmin()
  const { data: existing } = await db
    .from('automation_logs')
    .select('steps_executed, status')
    .eq('id', logId)
    .single()
  const merged = [
    ...((existing?.steps_executed as AutomationLogStepResult[] | undefined) ?? []),
    ...newItems,
  ]
  const update: Record<string, unknown> = { steps_executed: merged }
  // Only overwrite status on the outermost scope — nested branches pass null.
  if (status !== null) {
    update.status = status
  }
  if (errorMessage) update.error_message = errorMessage
  await db.from('automation_logs').update(update).eq('id', logId)
}

async function finalizeLog(
  logId: string | null,
  status: 'success' | 'partial' | 'failed',
  errorMessage: string | null,
) {
  if (!logId) return
  await supabaseAdmin()
    .from('automation_logs')
    .update({ status, error_message: errorMessage })
    .eq('id', logId)
}

async function markPending(id: string, status: 'done' | 'failed') {
  await supabaseAdmin()
    .from('automation_pending_executions')
    .update({ status })
    .eq('id', id)
}
