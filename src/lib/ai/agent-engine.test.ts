import { describe, it, expect } from 'vitest'
import { runLocalFallbackAI } from './agent-engine'

describe('AI Agent Engine - Local NLP Fallback Classifier', () => {
  it('should detect pricing inquiries and increment lead score', () => {
    const result = runLocalFallbackAI('How much do your tshirts cost? Do you have a catalog?', 50)
    
    expect(result.intent).toBe('pricing_inquiry')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
    expect(result.crm_updates).toContain('add_tag:Pricing Inquiry')
    expect(result.crm_updates).toContain('update_lead_score:+10')
    expect(result.lead_score).toBe(60)
    expect(result.requires_human).toBe(false)
    expect(result.suggested_reply).toContain('t-shirts start at $15')
  })

  it('should detect appointment bookings and parse date/time', () => {
    const result = runLocalFallbackAI('Can I book a demo for tomorrow at 4 PM?', 50)
    
    expect(result.intent).toBe('appointment_booking')
    expect(result.entities.appointment_date).toBeDefined()
    expect(result.entities.appointment_time).toBe('16:00')
    expect(result.crm_updates).toContain('add_tag:Booking Request')
    expect(result.automation_actions).toContain('schedule_event:Product Demo Meeting')
    expect(result.lead_score).toBe(70)
  })

  it('should classify bulk orders and extract quantities', () => {
    const result = runLocalFallbackAI('I want to purchase 100 oversized tshirts for my brand', 50)
    
    expect(result.intent).toBe('bulk_order_inquiry')
    expect(result.entities.quantity).toBe(100)
    expect(result.entities.product).toBe('tshirt')
    expect(result.crm_updates).toContain('add_tag:Bulk Order')
    expect(result.crm_updates).toContain('add_tag:Hot Lead')
    expect(result.lead_score).toBe(95) // 50 + 15 (Hot Lead) + 30 (Bulk Order)
  })

  it('should flag complaints and request human handoff', () => {
    const result = runLocalFallbackAI('This service is terrible and I want my money back!', 80)
    
    expect(result.intent).toBe('complaint')
    expect(result.requires_human).toBe(true)
    expect(result.crm_updates).toContain('add_tag:Complaint Escalated')
    expect(result.lead_score).toBe(60) // 80 - 20 (Complaint)
  })

  it('should classify payment confirmations and trigger onboarding flow', () => {
    const result = runLocalFallbackAI('Payment done for order #5439', 50)
    
    expect(result.intent).toBe('payment_done')
    expect(result.entities.order_id).toBe('5439')
    expect(result.crm_updates).toContain('add_tag:Customer Paid')
    expect(result.automation_actions).toContain('trigger_automation:onboarding_flow')
    expect(result.lead_score).toBe(75) // 50 + 25 (Paid)
  })

  it('should process unsubscribe requests and deduct lead score', () => {
    const result = runLocalFallbackAI('Please stop sending messages, unsubscribe me', 50)
    
    expect(result.intent).toBe('unsubscribe_request')
    expect(result.crm_updates).toContain('add_tag:Opted Out')
    expect(result.lead_score).toBe(0) // 50 - 50 = 0
  })

  it('should extract emails and phone numbers from inputs', () => {
    const result = runLocalFallbackAI('My email is test@domain.com and phone is +15551234567', 50)
    
    expect(result.entities.email).toBe('test@domain.com')
    expect(result.entities.phone).toBe('+15551234567')
  })
})
