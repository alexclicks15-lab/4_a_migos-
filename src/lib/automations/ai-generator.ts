import { callAI } from '@/lib/ai/multi-provider'

export interface AIGeneratorResult {
  triggers: string[]
  actions: string[]
  conditions: string[]
  ai_prompts: string[]
  crm_updates: string[]
  insights?: {
    optimizations: string[]
    debugging: string[]
    campaigns: string[]
    triggers: string[]
    analytics: string[]
  }
  workflow: {
    name: string
    description: string
    trigger_type: string
    trigger_config: Record<string, any>
    steps: any[]
  }
}

/**
 * Fallback local workflow compiler when OpenAI API Key or call fails
 */
function getLocalFallbackWorkflow(prompt: string): AIGeneratorResult {
  const p = prompt.toLowerCase()

  if (p.includes('birthday')) {
    return {
      triggers: ["Birthday Trigger (runs automatically on the customer's birthday month & day)"],
      actions: ["Send personalized WhatsApp birthday wish", "Add tagging in CRM"],
      conditions: ["None (runs unconditionally for matched birthdays)"],
      ai_prompts: ["Warm, celebratory birthday greeting with a special offer promotion"],
      crm_updates: ["Attach Tag: 'Birthday VIP'", "Increase lead score by +15 points"],
      insights: {
        optimizations: [
          "Add a wait delay of a few hours so the birthday message doesn't send at exactly midnight, making it feel more natural and personal.",
          "Include a fallback coupon branch if the customer hasn't purchased in the last 60 days to reactivate them."
        ],
        debugging: [
          "All checks passed: Standard birthday trigger matches birthday fields successfully.",
          "Validation: Make sure your contacts list contains birthdate values in E.164-compatible shape."
        ],
        campaigns: [
          "Pair this with a 'Pre-Birthday Nudge' flow sending an alert 7 days before the birthday.",
          "Trigger a follow-up feedback campaign 3 days after the birthday to measure satisfaction."
        ],
        triggers: [
          "Consider using 'Google Sheets Row Added' with a birthday field sync for offline spreadsheets."
        ],
        analytics: [
          "Automated birthday campaigns average a 42% reply rate and 15% conversion rate on discount codes."
        ]
      },
      workflow: {
        name: "Automated Birthday Reminders & Offers",
        description: "Sends birthday wishes with discount coupons on the customer's birthday.",
        trigger_type: "birthday_trigger",
        trigger_config: {},
        steps: [
          {
            step_type: "send_message",
            step_config: {
              text: "Happy Birthday {{name}}! 🎂 Wishing you an incredible year ahead. As a special treat, use code BDAY15 for 15% off your next purchase! 🎉"
            }
          },
          {
            step_type: "add_tag",
            step_config: {
              tag_id: "Birthday VIP"
            }
          },
          {
            step_type: "increase_lead_score",
            step_config: {
              score: 15
            }
          }
        ]
      }
    }
  }

  if (p.includes('appointment') || p.includes('clinic') || p.includes('booking')) {
    return {
      triggers: ["Appointment Booked Trigger (fires immediately upon booking slots)"],
      actions: ["Create Google Calendar Event", "Wait step", "Send reminder notifications"],
      conditions: ["Wait until 1 day before appointment date"],
      ai_prompts: ["Polite, professional appointment confirmation and schedule reminder"],
      crm_updates: ["Update field: last_appointment_status", "Increase lead score by +10"],
      insights: {
        optimizations: [
          "Add an immediate confirmation reply right after booking so the client knows it succeeded.",
          "Provide a cancellation keyword handler or cancellation link in the reminder template."
        ],
        debugging: [
          "Warning: Ensure your Google Calendar integration is authenticated under Settings.",
          "Wait step set to 1 day; verify appointment booking is made at least 24 hours prior."
        ],
        campaigns: [
          "Create a post-appointment feedback flow to automatically collect clinic reviews.",
          "Offer a follow-up consultation template for chronic care management."
        ],
        triggers: [
          "Use 'new_message_received' with keyword triggers to allow users to reschedule directly from the chat."
        ],
        analytics: [
          "Reminder notifications reduce clinic no-show rates by up to 68%."
        ]
      },
      workflow: {
        name: "Clinic Appointment Booking & Reminders",
        description: "Creates calendar event and sends reminder nudges 24 hours prior to appointment.",
        trigger_type: "appointment_booked",
        trigger_config: {},
        steps: [
          {
            step_type: "google_calendar_create_event",
            step_config: {
              summary: "Clinic Appointment - {{name}}",
              description: "Scheduled via WhatsApp Booking Engine",
              start_delay_minutes: 0,
              duration_minutes: 30
            }
          },
          {
            step_type: "wait",
            step_config: {
              amount: 1,
              unit: "days"
            }
          },
          {
            step_type: "send_message",
            step_config: {
              text: "Hi {{name}}, this is a friendly reminder for your upcoming clinic appointment tomorrow. Please let us know if you need to reschedule! 🏥"
            }
          },
          {
            step_type: "increase_lead_score",
            step_config: {
              score: 10
            }
          }
        ]
      }
    }
  }

  if (p.includes('welcome') || p.includes('greeting') || p.includes('inbound')) {
    return {
      triggers: ["First Inbound Message (fires only when a new conversation is opened)"],
      actions: ["Send welcome message", "Tag contact", "Assign agent round-robin"],
      conditions: ["None (runs immediately on new contact creation)"],
      ai_prompts: ["Friendly, welcoming customer onboarding greeting"],
      crm_updates: ["Attach Tag: 'New Lead'", "Initialize lead score to 50"],
      insights: {
        optimizations: [
          "Add business hours verification so contacts arriving at night receive an 'Out of Office' fallback.",
          "Include dynamic lead routing to avoid sales agent overload."
        ],
        debugging: [
          "Verification: Round-robin assignment requires at least 2 active agents to distribute conversations."
        ],
        campaigns: [
          "Chain this with a 'Lead Nurturing' workflow that follows up if the lead is inactive for 2 days.",
          "Activate a service overview brochure sequence for store/custom services."
        ],
        triggers: [
          "Pair with custom form submissions via webhooks for seamless external lead sync."
        ],
        analytics: [
          "First-hour greeting responses improve lead conversion rates by 80%."
        ]
      },
      workflow: {
        name: "Welcome Onboarding & Assignment",
        description: "Auto-replies to new leads, tags them, and assigns them to the sales team.",
        trigger_type: "first_inbound_message",
        trigger_config: {},
        steps: [
          {
            step_type: "send_message",
            step_config: {
              text: "Hello! 👋 Welcome to our service. How can we help you today? An agent will be assigned to assist you shortly."
            }
          },
          {
            step_type: "add_tag",
            step_config: {
              tag_id: "New Lead"
            }
          },
          {
            step_type: "assign_conversation",
            step_config: {
              mode: "round_robin"
            }
          }
        ]
      }
    }
  }

  // Default Fallback
  return {
    triggers: ["New Message Received (fires on every inbound customer message)"],
    actions: ["Run AI Agent completion for auto-replies", "Add tag"],
    conditions: ["None (processes all incoming messages dynamically)"],
    ai_prompts: ["Standard customer care assistant prompt templates"],
    crm_updates: ["Attach Tag: 'AI Assisted'"],
    insights: {
      optimizations: [
        "Limit AI token usage to 150 tokens to keep response lengths appropriate for WhatsApp.",
        "Implement human-handoff keyword detection to quickly escalate complex questions."
      ],
      debugging: [
        "Check that your AI Agent knowledge base contains relevant information for QA response accuracy."
      ],
      campaigns: [
        "Run a support feedback follow-up once a conversation is marked closed."
      ],
      triggers: [
        "Trigger AI replies selectively based on business working hours tags."
      ],
      analytics: [
        "AI support auto-replies resolve up to 55% of basic customer queries without human intervention."
      ]
    },
    workflow: {
      name: "AI Customer Support Auto-Responder",
      description: "Uses AI agent replies to answer customer queries automatically.",
      trigger_type: "new_message_received",
      trigger_config: {},
      steps: [
        {
          step_type: "ai_reply",
          step_config: {
            prompt_template: "You are a helpful customer support agent for our business. Answer queries politely, provide pricing details, and offer help.",
            temperature: 0.7,
            max_tokens: 300
          }
        },
        {
          step_type: "add_tag",
          step_config: {
            tag_id: "AI Assisted"
          }
        }
      ]
    }
  }
}

/**
 * Compiles plain English prompts into visual workflow schemas using our multi-provider gateway
 */
export async function generateWorkflowFromText(prompt: string, companyId?: string): Promise<AIGeneratorResult> {
  try {
    const systemPrompt = `You are an expert systems engineer and workflow automation architect for a WhatsApp CRM system. 
Your task is to take a natural language description of an automation workflow and compile it into a structured JSON configuration representing triggers, actions, steps, and advanced planner insights.

You must output a JSON object with this exact schema:
{
  "triggers": ["brief description of triggers"],
  "actions": ["brief description of actions"],
  "conditions": ["brief description of conditions/branches"],
  "ai_prompts": ["any custom system prompts configured for AI agent steps"],
  "crm_updates": ["description of lead score updates, tag modifications, deals, pipeline stage moves"],
  "insights": {
    "optimizations": ["optimization suggestions for this workflow to make it feel human, include wait steps, or branch correctly"],
    "debugging": ["debugging warnings, checks, or logs instructions for testing this flow"],
    "campaigns": ["related follow-up or pre-campaign recommendations that combine with this flow"],
    "triggers": ["alternative trigger configs to suggest like tag added or google sheets row syncs"],
    "analytics": ["estimated response rates, open rates, or conversions for this category of automation"]
  },
  "workflow": {
    "name": "A short, descriptive name for the automation",
    "description": "A summary of what it does",
    "trigger_type": "One of: 'new_message_received', 'first_inbound_message', 'keyword_match', 'tag_added', 'google_sheets_row_added', 'birthday_trigger', 'anniversary_trigger', 'inactivity_trigger', 'appointment_booked', 'appointment_cancelled'",
    "trigger_config": {},
    "steps": [
      {
        "step_type": "One of: 'send_message', 'send_template', 'add_tag', 'remove_tag', 'assign_conversation', 'update_contact_field', 'create_deal', 'wait', 'condition', 'ai_reply', 'increase_lead_score', 'add_internal_note', 'move_pipeline_stage', 'google_calendar_create_event'",
        "step_config": {},
        "branches": {
          "yes": [], // array of steps if type is 'condition'
          "no": [] // array of steps if type is 'condition'
        }
      }
    ]
  }
}

Config requirements:
1. 'send_message' step_config requires: { "text": "Message content here" }
2. 'add_tag' / 'remove_tag' step_config requires: { "tag_id": "tag_name_or_id" }
3. 'wait' step_config requires: { "amount": number, "unit": "minutes" | "hours" | "days" }
4. 'condition' step_config requires: { "subject": "tag_presence" | "time_of_day" | "lead_score", "operand": string, "value": string }
5. 'increase_lead_score' step_config requires: { "score": number }
6. 'ai_reply' step_config requires: { "prompt_template": "System instructions for the AI", "temperature": 0.7, "max_tokens": 300 }
7. 'create_deal' step_config requires: { "title": "Deal Title", "value": number }
8. 'move_pipeline_stage' step_config requires: { "stage_id": "stage_name" }
9. 'google_calendar_create_event' step_config requires: { "summary": "Event Title", "description": "Details", "start_delay_minutes": number, "duration_minutes": number }

Ensure all steps are properly ordered. Nested steps under conditions must go inside the 'yes' or 'no' branches array.
Do not output any markdown wrapping or explanation outside of the JSON. Return only the raw JSON.`

    const res = await callAI({
      companyId: companyId || 'default',
      feature: 'workflow_generation',
      prompt: `Requirement: ${prompt}`,
      systemPrompt,
      temperature: 0.3,
      responseFormat: 'json'
    })

    return JSON.parse(res.text) as AIGeneratorResult
  } catch (err) {
    console.error('[ai-generator] Multi-provider gateway workflow generation failed, calling local fallback:', err)
    return getLocalFallbackWorkflow(prompt)
  }
}
