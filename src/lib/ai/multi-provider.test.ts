import { describe, expect, it, vi, beforeEach } from "vitest"
import { callAI } from "./multi-provider"
import { decrypt, encrypt } from "@/lib/whatsapp/encryption"

// Mock Supabase client
const mockDb = {
  routingData: null as any,
  providerData: null as any,
  from(table: string) {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      maybeSingle: async () => {
        if (table === 'ai_routing') return { data: mockDb.routingData, error: null }
        if (table === 'ai_providers') return { data: mockDb.providerData, error: null }
        return { data: null, error: null }
      },
      single: async () => {
        if (table === 'ai_routing') return { data: mockDb.routingData, error: null }
        if (table === 'ai_providers') return { data: mockDb.providerData, error: null }
        return { data: null, error: null }
      },
      insert: () => chain,
      update: () => chain,
      delete: () => chain,
      then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve)
    }
    return chain
  }
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockDb
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("callAI multi-provider gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = "sk-fake-openai-key"
    process.env.GEMINI_API_KEY = "fake-gemini-key"
    mockDb.routingData = null
    mockDb.providerData = null
  })

  it("falls back to global OpenAI API key when no specific company provider is configured", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "AI Reply Text" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      })
    })

    const res = await callAI({
      companyId: "company-uuid",
      feature: "replies",
      prompt: "Hello AI",
      systemPrompt: "You are a bot"
    })

    expect(res.text).toBe("AI Reply Text")
    expect(res.provider).toBe("openai")
    expect(res.model).toBe("gpt-4o")
    expect(res.usage.cost).toBeGreaterThan(0)
    expect(mockFetch).toHaveBeenCalled()
  })

  it("applies fallback when primary provider fails", async () => {
    // Return routing rule with fallback
    mockDb.routingData = {
      provider: "openai",
      model: "gpt-4o",
      fallback_provider: "gemini",
      fallback_model: "gemini-1.5-flash"
    }

    // First fetch fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Error"
    })

    // Second fetch (Gemini) succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Gemini Fallback Text" }] } }],
        usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 10 }
      })
    })

    const res = await callAI({
      companyId: "company-uuid",
      feature: "replies",
      prompt: "Hello AI"
    })

    expect(res.text).toBe("Gemini Fallback Text")
    expect(res.provider).toBe("gemini")
    expect(res.model).toBe("gemini-1.5-flash")
  })
})
