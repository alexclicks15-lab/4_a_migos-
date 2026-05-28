import { describe, expect, it, vi } from "vitest"
import { generateWorkflowFromText } from "./ai-generator"

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        insert: () => chain
      }
      return chain
    }
  })
}))

describe("generateWorkflowFromText local fallback", () => {
  it("generates birthday reminder flow", async () => {
    const res = await generateWorkflowFromText("Send cake reorder reminders every year before birthday")
    expect(res.triggers).toBeDefined()
    expect(res.actions).toBeDefined()
    expect(res.conditions).toBeDefined()
    expect(res.ai_prompts).toBeDefined()
    expect(res.crm_updates).toBeDefined()
    
    expect(res.workflow).toBeDefined()
    expect(res.workflow.name).toContain("Birthday")
    expect(res.workflow.trigger_type).toBe("birthday_trigger")
    expect(res.workflow.steps.length).toBeGreaterThan(0)
  })

  it("generates clinic appointment flow", async () => {
    const res = await generateWorkflowFromText("I need appointment reminders for my clinic")
    expect(res.workflow.name).toContain("Appointment")
    expect(res.workflow.trigger_type).toBe("appointment_booked")
    expect(res.workflow.steps.some(s => s.step_type === "google_calendar_create_event")).toBe(true)
  })

  it("generates welcome greeting flow", async () => {
    const res = await generateWorkflowFromText("welcome new users and assign them round robin")
    expect(res.workflow.trigger_type).toBe("first_inbound_message")
    expect(res.workflow.steps.some(s => s.step_type === "assign_conversation")).toBe(true)
  })

  it("generates default fallback support flow for random prompts", async () => {
    const res = await generateWorkflowFromText("something completely random")
    expect(res.workflow.trigger_type).toBe("new_message_received")
    expect(res.workflow.steps.some(s => s.step_type === "ai_reply")).toBe(true)
  })
})
