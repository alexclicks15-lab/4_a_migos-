import type { AutomationTriggerType } from '@/types'

export interface TriggerMeta {
  label: string
  description: string
  category: 'Message' | 'WhatsApp' | 'CRM' | 'Ecommerce' | 'Schedule' | 'Webhook' | 'AI' | 'Automation'
  iconName: string
  /** Tailwind classes for the Badge pill on the list row. */
  pillClass: string
}

export const TRIGGER_META: Record<AutomationTriggerType, TriggerMeta> = {
  // --- Message Triggers ---
  new_message_received: {
    label: 'New Message Received',
    description: 'Triggers when any new message is received from a user',
    category: 'Message',
    iconName: 'MessageSquare',
    pillClass: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  first_inbound_message: {
    label: 'First Message From User',
    description: 'Triggers when a contact sends their first message ever',
    category: 'Message',
    iconName: 'UserPlus',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  keyword_match: {
    label: 'Keyword Match',
    description: 'Triggers when a message contains specific keywords',
    category: 'Message',
    iconName: 'Key',
    pillClass: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  exact_match: {
    label: 'Exact Match',
    description: 'Triggers when a message matches a keyword exactly',
    category: 'Message',
    iconName: 'CheckSquare',
    pillClass: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  },
  message_contains: {
    label: 'Message Contains',
    description: 'Triggers when a message contains a specific phrase',
    category: 'Message',
    iconName: 'Search',
    pillClass: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },
  media_received: {
    label: 'Media Received',
    description: 'Triggers when a message contains an image, video, or file',
    category: 'Message',
    iconName: 'Image',
    pillClass: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  },
  voice_received: {
    label: 'Voice Note Received',
    description: 'Triggers when a voice message/audio note is received',
    category: 'Message',
    iconName: 'Mic',
    pillClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  },
  regex_match: {
    label: 'Regex Match',
    description: 'Message text matches a regular expression pattern',
    category: 'Message',
    iconName: 'Code2',
    pillClass: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  media_message_received: {
    label: 'Media Received (Legacy)',
    description: 'Trigger when incoming message contains image/video/doc',
    category: 'Message',
    iconName: 'Image',
    pillClass: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  voice_message_received: {
    label: 'Voice Received (Legacy)',
    description: 'Trigger when an audio/voice note is received',
    category: 'Message',
    iconName: 'Mic',
    pillClass: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  },

  // --- WhatsApp Triggers ---
  button_clicked: {
    label: 'Button Clicked',
    description: 'Triggers when a user clicks a button in an interactive message',
    category: 'WhatsApp',
    iconName: 'Smartphone',
    pillClass: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },
  list_option_selected: {
    label: 'List Option Selected',
    description: 'Triggers when a user selects an option from a list menu',
    category: 'WhatsApp',
    iconName: 'List',
    pillClass: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },
  template_replied: {
    label: 'Template Replied',
    description: 'Triggers when a user replies to a template message',
    category: 'WhatsApp',
    iconName: 'Reply',
    pillClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
  flow_submitted: {
    label: 'Flow Submitted',
    description: 'When customer submits a native WhatsApp Flow form',
    category: 'WhatsApp',
    iconName: 'FileSpreadsheet',
    pillClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  },
  reaction_received: {
    label: 'Reaction Received',
    description: 'When customer reacts to a message with emoji',
    category: 'WhatsApp',
    iconName: 'Smile',
    pillClass: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
  },
  status_viewed: {
    label: 'Status Viewed',
    description: 'When status/story is viewed',
    category: 'WhatsApp',
    iconName: 'Eye',
    pillClass: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300',
  },
  user_opted_in: {
    label: 'User Opted In',
    description: 'Triggers when a user explicitly opts in to messages',
    category: 'WhatsApp',
    iconName: 'UserCheck',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  user_opted_out: {
    label: 'User Opted Out',
    description: 'Triggers when a user opts out or unsubscribes',
    category: 'WhatsApp',
    iconName: 'UserX',
    pillClass: 'border-red-500/30 bg-red-500/10 text-red-300',
  },

  // --- CRM Triggers ---
  new_contact_created: {
    label: 'Contact Created',
    description: 'Triggers when a new contact is created in the CRM',
    category: 'CRM',
    iconName: 'Users',
    pillClass: 'border-primary/30 bg-primary/10 text-primary',
  },
  tag_added: {
    label: 'Tag Added',
    description: 'Triggers when a specific tag is added to a contact',
    category: 'CRM',
    iconName: 'Tag',
    pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  tag_removed: {
    label: 'Tag Removed',
    description: 'Triggers when a specific tag is removed from a contact',
    category: 'CRM',
    iconName: 'TagIcon',
    pillClass: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
  deal_stage_changed: {
    label: 'Deal Stage Changed',
    description: 'Triggers when a deal is moved to a new stage in pipeline',
    category: 'CRM',
    iconName: 'TrendingUp',
    pillClass: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  conversation_assigned: {
    label: 'Conversation Assigned',
    description: 'Triggers when a conversation is assigned to an agent',
    category: 'CRM',
    iconName: 'UserCheck',
    pillClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
  contact_field_updated: {
    label: 'Field Updated',
    description: 'When a contact profile field is modified',
    category: 'CRM',
    iconName: 'PencilLine',
    pillClass: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  },
  lead_score_changed: {
    label: 'Score Changed',
    description: 'When contact lead score crosses custom threshold',
    category: 'CRM',
    iconName: 'Award',
    pillClass: 'border-lime-500/30 bg-lime-500/10 text-lime-300',
  },
  agent_replied: {
    label: 'Agent Replied',
    description: 'When an agent sends an outbound message',
    category: 'CRM',
    iconName: 'ReplyAll',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  returning_customer: {
    label: 'Returning Customer',
    description: 'First message in a new session from a known contact',
    category: 'CRM',
    iconName: 'RefreshCw',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },

  // --- Ecommerce Triggers ---
  order_created: {
    label: 'Order Created',
    description: 'Triggers when a new customer order is placed',
    category: 'Ecommerce',
    iconName: 'ShoppingCart',
    pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  order_paid: {
    label: 'Order Paid',
    description: 'Triggers when payment is completed for an order',
    category: 'Ecommerce',
    iconName: 'CreditCard',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  cart_abandoned: {
    label: 'Cart Abandoned',
    description: 'Triggers when a customer abandons their shopping cart',
    category: 'Ecommerce',
    iconName: 'ShoppingBag',
    pillClass: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
  payment_failed: {
    label: 'Payment Failed',
    description: 'Triggers when an order payment attempt fails',
    category: 'Ecommerce',
    iconName: 'AlertTriangle',
    pillClass: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  order_delivered: {
    label: 'Order Delivered',
    description: 'Triggers when an order is successfully delivered',
    category: 'Ecommerce',
    iconName: 'Package',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  cod_order_created: {
    label: 'COD Created',
    description: 'Trigger when a Cash on Delivery order is made',
    category: 'Ecommerce',
    iconName: 'DollarSign',
    pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  payment_success: {
    label: 'Payment Success',
    description: 'Trigger when a transaction completes successfully',
    category: 'Ecommerce',
    iconName: 'CheckCircle',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  refund_requested: {
    label: 'Refund Request',
    description: 'Trigger when refund is requested by a contact',
    category: 'Ecommerce',
    iconName: 'Undo2',
    pillClass: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  },

  // --- Schedule Triggers ---
  time_based: {
    label: 'Scheduled Time',
    description: 'Triggers at a specific date and time schedule',
    category: 'Schedule',
    iconName: 'Calendar',
    pillClass: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  },
  recurring_trigger: {
    label: 'Recurring Trigger',
    description: 'Triggers on a recurring interval schedule (cron)',
    category: 'Schedule',
    iconName: 'RefreshCcw',
    pillClass: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  },
  inactivity_trigger: {
    label: 'Inactivity Trigger',
    description: 'Triggers when there is no activity for a set period',
    category: 'Schedule',
    iconName: 'Clock',
    pillClass: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  },
  birthday_trigger: {
    label: 'Birthday Trigger',
    description: 'Triggers on the contact\'s birthday',
    category: 'Schedule',
    iconName: 'Cake',
    pillClass: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
  },
  anniversary_trigger: {
    label: 'Anniversary Trigger',
    description: 'Fires on custom contact milestone/anniversary',
    category: 'Schedule',
    iconName: 'Heart',
    pillClass: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
  follow_up_reminder: {
    label: 'Follow-up Reminder',
    description: 'Fires when follow-up reminder date is reached',
    category: 'Schedule',
    iconName: 'BellRing',
    pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },

  // --- API/Webhook Triggers ---
  webhook_received: {
    label: 'Incoming Webhook',
    description: 'Triggers when an external webhook payload is received',
    category: 'Webhook',
    iconName: 'Webhook',
    pillClass: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  },
  external_api_event: {
    label: 'External API Event',
    description: 'Triggers when an API event occurs',
    category: 'Webhook',
    iconName: 'Code',
    pillClass: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  zapier_trigger: {
    label: 'Zapier Trigger',
    description: 'Triggered from a Zapier integration hook',
    category: 'Webhook',
    iconName: 'Zap',
    pillClass: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  },
  shopify_event: {
    label: 'Shopify Event',
    description: 'Triggered by a webhook from Shopify store',
    category: 'Webhook',
    iconName: 'ShoppingBag',
    pillClass: 'border-green-500/30 bg-green-500/10 text-green-300',
  },
  google_sheets_row_added: {
    label: 'Sheets Row Added',
    description: 'Trigger when a new row is synced to sheets',
    category: 'Webhook',
    iconName: 'FileText',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  razorpay_payment: {
    label: 'Razorpay Event',
    description: 'Triggered by Razorpay webhook payload',
    category: 'Webhook',
    iconName: 'Wallet',
    pillClass: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },

  // --- AI Triggers ---
  intent_detected: {
    label: 'Intent Detected',
    description: 'Triggers when AI detects a specific user intent',
    category: 'AI',
    iconName: 'Brain',
    pillClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  },
  negative_sentiment: {
    label: 'Negative Sentiment',
    description: 'Triggers when negative sentiment is detected in messages',
    category: 'AI',
    iconName: 'Frown',
    pillClass: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  high_purchase_intent: {
    label: 'High Purchase Intent',
    description: 'Triggers when customer shows buying/purchase signals',
    category: 'AI',
    iconName: 'Sparkles',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  spam_detected: {
    label: 'Spam Detection',
    description: 'Triggers when AI flags a message as spam',
    category: 'AI',
    iconName: 'ShieldAlert',
    pillClass: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  language_detected: {
    label: 'Lang Detected',
    description: 'Trigger when message language is identified',
    category: 'AI',
    iconName: 'Globe2',
    pillClass: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  lead_qualified: {
    label: 'Lead Qualified',
    description: 'Triggers when AI qualifies a lead based on conversation',
    category: 'AI',
    iconName: 'Award',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  human_request: {
    label: 'Human Requested',
    description: 'Triggers when customer explicitly requests a human agent',
    category: 'AI',
    iconName: 'HandMetal',
    pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },

  // --- Automation Triggers ---
  user_entered_flow: {
    label: 'Flow Started',
    description: 'Triggers when a user enters/starts this automation flow',
    category: 'Automation',
    iconName: 'Play',
    pillClass: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  },
  user_exited_flow: {
    label: 'Flow Completed',
    description: 'Triggers when a user exits or completes this flow',
    category: 'Automation',
    iconName: 'Layers',
    pillClass: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
  flow_goal_achieved: {
    label: 'Goal Achieved',
    description: 'Triggers when a user achieves the automation goal',
    category: 'Automation',
    iconName: 'Trophy',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  conversion_trigger: {
    label: 'Conversion Event',
    description: 'Fires on business conversion tracking events',
    category: 'Automation',
    iconName: 'Target',
    pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  custom_event: {
    label: 'Custom Event',
    description: 'Fires on user-defined custom API events',
    category: 'Automation',
    iconName: 'Activity',
    pillClass: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  },
  appointment_booked: {
    label: 'Appointment Booked',
    description: 'Triggers when a customer successfully books an appointment',
    category: 'Schedule',
    iconName: 'Calendar',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  appointment_cancelled: {
    label: 'Appointment Cancelled',
    description: 'Triggers when an appointment is cancelled',
    category: 'Schedule',
    iconName: 'CalendarOff',
    pillClass: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  appointment_rescheduled: {
    label: 'Appointment Rescheduled',
    description: 'Triggers when an appointment is rescheduled to a new time',
    category: 'Schedule',
    iconName: 'CalendarDays',
    pillClass: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  appointment_completed: {
    label: 'Appointment Completed',
    description: 'Triggers when an appointment is marked completed',
    category: 'Schedule',
    iconName: 'CheckCircle',
    pillClass: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  appointment_noshow: {
    label: 'No-show Detected',
    description: 'Triggers when a customer fails to attend their appointment',
    category: 'Schedule',
    iconName: 'AlertTriangle',
    pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
}

export function triggerMeta(t: AutomationTriggerType | string): TriggerMeta {
  return (
    TRIGGER_META[t as AutomationTriggerType] ?? {
      label: t,
      description: 'Trigger event',
      category: 'Message',
      iconName: 'Zap',
      pillClass: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    }
  )
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'never'
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 2_592_000) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}
