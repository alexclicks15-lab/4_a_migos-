export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: string;
  /**
   * Opted-in beta feature keys for this account. The column survives
   * for future beta gates; no current feature reads it (Flows was
   * the last user and went to soft-GA in PR #134). Defaults to `[]`
   * for every profile; toggled per-account via a direct UPDATE on
   * the `profiles` row.
   */
  beta_features?: string[];
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  company_id?: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactTag {
  id: string;
  contact_id: string;
  tag_id: string;
}

export interface CustomField {
  id: string;
  user_id: string;
  field_name: string;
  field_type: string;
  field_options?: Record<string, unknown>;
  created_at: string;
}

export interface ContactCustomValue {
  id: string;
  contact_id: string;
  custom_field_id: string;
  value?: string;
}

export interface ContactNote {
  id: string;
  contact_id: string;
  user_id: string;
  note_text: string;
  created_at: string;
}

export type ConversationStatus = 'open' | 'pending' | 'closed';

export interface Conversation {
  id: string;
  user_id: string;
  contact_id: string;
  status: ConversationStatus;
  assigned_agent_id?: string;
  last_message_text?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
  contact?: Contact;
}

export type SenderType = 'customer' | 'agent' | 'bot';
export type ContentType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'location'
  | 'template'
  /** Customer tapped a reply button or list row on a message we sent. */
  | 'interactive';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id?: string;
  content_type: ContentType;
  content_text?: string;
  media_url?: string;
  template_name?: string;
  message_id?: string;
  status: MessageStatus;
  created_at: string;
  reply_to_message_id?: string;
  /**
   * Only set when `content_type === 'interactive'` — the stable id of
   * the button or list row the customer tapped. The Flows engine uses
   * this to route the next node; the inbox bubble uses it as a styling
   * cue (renders with a "↩ button reply" affordance).
   */
  interactive_reply_id?: string;
}

export type ReactionActor = 'customer' | 'agent';

export interface MessageReaction {
  id: string;
  message_id: string;
  conversation_id: string;
  actor_type: ReactionActor;
  actor_id?: string;
  emoji: string;
  created_at: string;
}

export interface WhatsAppConfig {
  id: string;
  user_id: string;
  phone_number_id: string;
  waba_id?: string;
  access_token: string;
  verify_token?: string;
  status: 'connected' | 'disconnected';
  connected_at?: string;
}

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  category: 'Marketing' | 'Utility' | 'Authentication';
  language?: string;
  header_type?: 'text' | 'image' | 'video' | 'document';
  header_content?: string;
  body_text: string;
  footer_text?: string;
  buttons?: Record<string, unknown>[];
  status?: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

export interface Pipeline {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
  created_at: string;
}

export type DealStatus = 'open' | 'won' | 'lost';

export interface Deal {
  id: string;
  user_id: string;
  pipeline_id: string;
  stage_id: string;
  /**
   * Nullable after migration 004 — becomes NULL when the referenced
   * contact is deleted (ON DELETE SET NULL). History preserved.
   */
  contact_id: string | null;
  conversation_id?: string;
  assigned_to?: string;
  title: string;
  value: number;
  currency?: string;
  notes?: string;
  expected_close_date?: string;
  status?: DealStatus;
  created_at: string;
  updated_at?: string;
  contact?: Contact;
  stage?: PipelineStage;
  assignee?: Profile;
}

export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export type RecipientStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed';

export interface Broadcast {
  id: string;
  user_id: string;
  name: string;
  template_name: string;
  template_language: string;
  template_variables?: Record<string, unknown>;
  audience_filter?: Record<string, unknown>;
  scheduled_at?: string;
  status: BroadcastStatus;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  failed_count: number;
  created_at: string;
}

export interface BroadcastRecipient {
  id: string;
  broadcast_id: string;
  /**
   * Nullable after migration 004 — becomes NULL when the referenced
   * contact is deleted (ON DELETE SET NULL). History preserved; the
   * UI renders "Unknown" for orphaned rows.
   */
  contact_id: string | null;
  status: RecipientStatus;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  replied_at?: string;
  error_message?: string;
  /**
   * Meta's message id, persisted when the broadcast send succeeds so
   * the webhook can mirror status updates back onto the recipient row.
   * Added in migration 003.
   */
  whatsapp_message_id?: string;
  created_at: string;
  contact?: Contact;
}

// ============================================================
// Automations (migration 006)
// ============================================================

export type AutomationTriggerType =
  | 'new_message_received'
  | 'first_inbound_message'
  | 'keyword_match'
  | 'exact_match'
  | 'message_contains'
  | 'media_received'
  | 'voice_received'
  | 'template_replied'
  | 'new_contact_created'
  | 'conversation_assigned'
  | 'tag_added'
  | 'time_based'
  // Essential Triggers
  | 'regex_match'
  | 'media_message_received'
  | 'voice_message_received'
  | 'returning_customer'
  | 'tag_removed'
  // WhatsApp Specific
  | 'button_clicked'
  | 'list_option_selected'
  | 'flow_submitted'
  | 'reaction_received'
  | 'status_viewed'
  | 'user_opted_in'
  | 'user_opted_out'
  // Ecommerce Triggers
  | 'order_created'
  | 'order_paid'
  | 'cart_abandoned'
  | 'cod_order_created'
  | 'payment_failed'
  | 'payment_success'
  | 'order_delivered'
  | 'refund_requested'
  // CRM Triggers
  | 'deal_stage_changed'
  | 'contact_field_updated'
  | 'lead_score_changed'
  | 'agent_replied'
  // Time-Based
  | 'recurring_trigger'
  | 'birthday_trigger'
  | 'anniversary_trigger'
  | 'inactivity_trigger'
  | 'follow_up_reminder'
  // API & Integrations
  | 'webhook_received'
  | 'external_api_event'
  | 'zapier_trigger'
  | 'shopify_event'
  | 'google_sheets_row_added'
  | 'razorpay_payment'
  // AI Triggers
  | 'intent_detected'
  | 'negative_sentiment'
  | 'high_purchase_intent'
  | 'spam_detected'
  | 'language_detected'
  | 'lead_qualified'
  | 'human_request'
  // Advanced Triggers
  | 'user_entered_flow'
  | 'user_exited_flow'
  | 'flow_goal_achieved'
  | 'conversion_trigger'
  | 'custom_event'
  // Appointment Triggers
  | 'appointment_booked'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'appointment_completed'
  | 'appointment_noshow';

export type AutomationStepType =
  | 'send_message'
  | 'send_template'
  | 'add_tag'
  | 'remove_tag'
  | 'assign_conversation'
  | 'update_contact_field'
  | 'create_deal'
  | 'wait'
  | 'condition'
  | 'send_webhook'
  | 'close_conversation'
  | 'google_calendar_create_event'
  // --- Phase 1: Advanced Actions ---
  | 'ai_agent'
  | 'http_request'
  | 'send_media'
  | 'send_buttons'
  | 'send_list_message'
  | 'ai_reply'
  | 'increase_lead_score'
  | 'add_internal_note'
  | 'move_pipeline_stage'
  | 'trigger_automation'
  | 'pause_flow'
  | 'switch'
  | 'delay_until'
  | 'loop'
  | 'split_traffic'
  | 'goto_step'
  | 'end_flow'
  // Human Handoff
  | 'assign_human_agent'
  | 'notify_team'
  | 'escalate_priority'
  // Ecommerce
  | 'create_order'
  | 'send_payment_link'
  | 'verify_payment'
  | 'track_shipment'
  | 'generate_invoice'
  // Appointment Steps
  | 'create_appointment'
  | 'generate_token'
  | 'check_availability'
  | 'send_reminder'
  | 'reschedule_appointment'
  | 'cancel_booking'
  | 'assign_agent'
  | 'add_calendar_event';

export type AutomationLogStatus = 'success' | 'partial' | 'failed';

export interface KeywordMatchTriggerConfig {
  keywords: string[];
  match_type: 'exact' | 'contains';
  case_sensitive?: boolean;
}

export interface TagTriggerConfig {
  tag_id: string;
}

export interface TimeBasedTriggerConfig {
  /** Cron expression or simple HH:mm string; engine can accept either. */
  schedule: string;
  timezone?: string;
}

export type AutomationTriggerConfig =
  | Record<string, never>
  | KeywordMatchTriggerConfig
  | TagTriggerConfig
  | TimeBasedTriggerConfig
  | Record<string, unknown>;

export interface SendMessageStepConfig {
  text: string;
}

export interface SendTemplateStepConfig {
  template_name: string;
  language?: string;
  variables?: Record<string, string>;
}

export interface TagStepConfig {
  tag_id: string;
}

export interface AssignConversationStepConfig {
  mode: 'specific' | 'round_robin';
  agent_id?: string;
}

export interface UpdateContactFieldStepConfig {
  field: string;
  value: string;
}

export interface CreateDealStepConfig {
  pipeline_id: string;
  stage_id: string;
  title: string;
  value?: number;
}

export interface WaitStepConfig {
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
}

export type ConditionSubject =
  | 'contact_field'
  | 'tag_presence'
  | 'message_content'
  | 'time_of_day';

export interface ConditionStepConfig {
  subject: ConditionSubject;
  /** e.g. field name, tag id, substring, or "HH:mm-HH:mm" depending on subject */
  operand?: string;
  /** For contact_field equals / message_content contains — comparison value */
  value?: string;
}

export interface SendWebhookStepConfig {
  url: string;
  headers?: Record<string, string>;
  body_template?: string;
}

export interface GoogleCalendarCreateEventStepConfig {
  summary: string;
  description?: string;
  start_delay_minutes?: number;
  duration_minutes?: number;
}

export type AutomationStepConfig =
  | SendMessageStepConfig
  | SendTemplateStepConfig
  | TagStepConfig
  | AssignConversationStepConfig
  | UpdateContactFieldStepConfig
  | CreateDealStepConfig
  | WaitStepConfig
  | ConditionStepConfig
  | SendWebhookStepConfig
  | GoogleCalendarCreateEventStepConfig
  // Phase 1: Advanced configs
  | AIAgentStepConfig
  | HttpRequestStepConfig
  | SendMediaStepConfig
  | SendButtonsStepConfig
  | SendListMessageStepConfig
  | IncreaseLeadScoreStepConfig
  | AddInternalNoteStepConfig
  | MovePipelineStageStepConfig
  | TriggerAutomationStepConfig
  | SwitchStepConfig
  | SplitTrafficStepConfig
  | LoopStepConfig
  | DelayUntilStepConfig
  | GotoStepConfig
  | EscalatePriorityStepConfig
  | NotifyTeamStepConfig
  // Appointment Configs
  | CreateAppointmentStepConfig
  | GenerateTokenStepConfig
  | CheckAvailabilityStepConfig
  | SendReminderStepConfig
  | RescheduleAppointmentStepConfig
  | CancelBookingStepConfig
  | AssignAgentStepConfig
  | AddCalendarEventStepConfig
  | Record<string, never>
  | Record<string, unknown>;

// ============================================================
// Multi-trigger support
// ============================================================

export interface AutomationTrigger {
  id?: string;
  trigger_type: AutomationTriggerType;
  trigger_config: AutomationTriggerConfig;
  priority?: number;
  enabled?: boolean;
}

export interface Automation {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  trigger_type: AutomationTriggerType;
  trigger_config: AutomationTriggerConfig;
  /** Additional triggers beyond the primary. Stored as JSONB in DB. */
  triggers?: AutomationTrigger[];
  is_active: boolean;
  execution_count: number;
  last_executed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Phase 1: Advanced step config interfaces
// ============================================================

export interface AIAgentStepConfig {
  prompt_template?: string;
  temperature?: number;
  max_tokens?: number;
  /** Automatically send the AI suggested reply to customer. */
  auto_reply?: boolean;
  /** Apply CRM updates returned by AI (tags, scores). */
  update_crm?: boolean;
  /** Execute automation actions returned by AI. */
  trigger_actions?: boolean;
  provider?: string;
  model?: string;
  tone?: string;
  enable_memory?: boolean;
  enable_crm_context?: boolean;
}

export interface HttpRequestStepConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body_template?: string;
  /** Store the response body in workflow vars under this key. */
  response_var_key?: string;
  retry_count?: number;
  timeout_ms?: number;
}

export interface SendMediaStepConfig {
  media_type: 'image' | 'video' | 'document' | 'audio';
  media_url: string;
  caption?: string;
}

export interface SendButtonsStepConfig {
  text: string;
  buttons: Array<{ id: string; title: string }>;
}

export interface SendListMessageStepConfig {
  text: string;
  button_label: string;
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export interface IncreaseLeadScoreStepConfig {
  amount: number;
}

export interface AddInternalNoteStepConfig {
  note_text: string;
}

export interface MovePipelineStageStepConfig {
  pipeline_id: string;
  stage_id: string;
  deal_id?: string;
}

export interface TriggerAutomationStepConfig {
  target_automation_id: string;
  pass_context?: boolean;
}

export interface SwitchStepConfig {
  subject: ConditionSubject;
  operand?: string;
  cases: Array<{ value: string; label?: string }>;
}

export interface SplitTrafficStepConfig {
  variants: Array<{ label: string; weight: number }>;
}

export interface LoopStepConfig {
  max_iterations: number;
  break_condition?: { subject: ConditionSubject; operand?: string; value?: string };
}

export interface DelayUntilStepConfig {
  until_type: 'datetime' | 'field' | 'condition';
  datetime?: string;
  field?: string;
  condition?: { subject: ConditionSubject; operand?: string; value?: string };
}

export interface GotoStepConfig {
  target_step_cid: string;
}

export interface SendPaymentLinkStepConfig {
  amount: number;
  currency?: string;
  description?: string;
}

export interface EscalatePriorityStepConfig {
  level: 'high' | 'urgent' | 'critical';
  reason?: string;
}

export interface NotifyTeamStepConfig {
  message: string;
  channel?: string;
}

export interface AutomationStep {
  id: string;
  automation_id: string;
  parent_step_id?: string | null;
  branch?: 'yes' | 'no' | null;
  step_type: AutomationStepType;
  step_config: AutomationStepConfig;
  position: number;
  created_at: string;
}

export interface AutomationLogStepResult {
  step_id: string;
  step_type: AutomationStepType;
  status: 'success' | 'skipped' | 'failed';
  detail?: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  user_id: string;
  contact_id: string | null;
  trigger_event: string;
  steps_executed: AutomationLogStepResult[];
  status: AutomationLogStatus;
  error_message?: string | null;
  created_at: string;
  contact?: Contact;
}

// ============================================================
// Appointment Booking Configs & Types
// ============================================================

export interface CreateAppointmentStepConfig {
  service: string;
  location?: string;
  notes?: string;
}

export interface GenerateTokenStepConfig {
  branch_prefix?: string;
  reset_daily?: boolean;
}

export interface CheckAvailabilityStepConfig {
  service: string;
  location?: string;
}

export interface SendReminderStepConfig {
  reminder_type: 'before_24h' | 'before_2h' | 'before_30m' | 'after_feedback' | 'after_review' | 'after_upsell';
  template_name?: string;
}

export interface RescheduleAppointmentStepConfig {
  notify_customer?: boolean;
}

export interface CancelBookingStepConfig {
  reason?: string;
}

export interface AssignAgentStepConfig {
  agent_id?: string;
  mode?: 'specific' | 'round_robin';
}

export interface AddCalendarEventStepConfig {
  summary: string;
  description?: string;
  duration_minutes?: number;
}

export interface AppointmentSlot {
  id: string;
  user_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  capacity: number;
  booked_count: number;
  locked_until?: string | null;
  locked_by_contact_id?: string | null;
  location?: string | null;
  created_at: string;
}

export interface AppointmentToken {
  id: string;
  user_id: string;
  token_number: string;
  sequence_number: number;
  branch_prefix?: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  contact_id: string;
  service: string;
  slot_id?: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | 'no_show' | 'waitlist';
  token_id?: string | null;
  agent_id?: string | null;
  location?: string | null;
  notes?: string | null;
  revenue?: number;
  google_calendar_event_id?: string | null;
  google_calendar_link?: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
}

export interface AppointmentReminder {
  id: string;
  appointment_id: string;
  reminder_type: 'before_24h' | 'before_2h' | 'before_30m' | 'after_feedback' | 'after_review' | 'after_upsell';
  scheduled_at: string;
  is_sent: boolean;
  created_at: string;
}

export interface AppointmentLog {
  id: string;
  appointment_id: string;
  action: string;
  detail?: string | null;
  created_at: string;
}

