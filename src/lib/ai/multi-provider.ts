import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'

// Lazy admin client
let _adminClient: any = null
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

export interface AICallArgs {
  companyId: string
  feature: 'default' | 'replies' | 'automations' | 'qualification' | 'agents' | 'support_bots' | 'workflow_generation'
  prompt: string
  systemPrompt?: string
  agentId?: string
  forceModel?: { provider: string; model: string }
  temperature?: number
  responseFormat?: 'json' | 'text'
}

export interface AICallResult {
  text: string
  provider: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
  }
  latencyMs: number
}

// Token pricing mapping per 1M tokens (input / output) in USD
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-5-preview': { input: 15.00, output: 60.00 },
  // Gemini
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  // Claude
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  // Grok
  'grok-beta': { input: 2.00, output: 10.00 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  // Ollama (local - zero cost)
  'llama3': { input: 0.0, output: 0.0 },
  'mistral': { input: 0.0, output: 0.0 }
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = PRICING[model] || { input: 1.0, output: 2.0 } // default generic rates
  const inputCost = (inputTokens / 1000000) * rates.input
  const outputCost = (outputTokens / 1000000) * rates.output
  return parseFloat((inputCost + outputCost).toFixed(6))
}

/**
 * Retrieve credentials for a specific provider
 */
async function getProviderConfig(companyId: string, provider: string) {
  const db = getAdminClient()
  try {
    const { data } = await db
      .from('ai_providers')
      .select('*')
      .eq('company_id', companyId)
      .eq('provider', provider)
      .maybeSingle()

    if (data) {
      let decryptedKey: string | null = null
      if (data.api_key) {
        try {
          decryptedKey = decrypt(data.api_key)
        } catch (e) {
          console.warn('[multi-provider] Failed to decrypt saved API key:', e)
          decryptedKey = data.api_key // fallback if plain text
        }
      }
      return {
        apiKey: decryptedKey,
        apiUrl: data.api_url || null
      }
    }
  } catch (err) {
    console.warn('[multi-provider] Failed to query ai_providers table:', err)
  }

  // Fallback to global environment variables
  switch (provider) {
    case 'openai':
      return { apiKey: process.env.OPENAI_API_KEY || null, apiUrl: null }
    case 'gemini':
      return { apiKey: process.env.GEMINI_API_KEY || null, apiUrl: null }
    case 'claude':
      return { apiKey: process.env.CLAUDE_API_KEY || null, apiUrl: null }
    case 'grok':
      return { apiKey: process.env.GROK_API_KEY || null, apiUrl: null }
    case 'deepseek':
      return { apiKey: process.env.DEEPSEEK_API_KEY || null, apiUrl: null }
    case 'ollama':
      return { apiKey: 'ollama', apiUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434' }
    default:
      return { apiKey: null, apiUrl: null }
  }
}

/**
 * Executes a call to the mapped AI provider API
 */
async function executeProviderCall(
  provider: string,
  model: string,
  config: { apiKey: string | null; apiUrl: string | null },
  prompt: string,
  systemPrompt: string,
  temperature: number,
  responseFormat?: 'json' | 'text'
): Promise<any> {
  const isJson = responseFormat === 'json'

  if (provider === 'openai' || provider === 'grok' || provider === 'deepseek') {
    let endpoint = 'https://api.openai.com/v1/chat/completions'
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    }

    if (provider === 'grok') {
      endpoint = 'https://api.x.ai/v1/chat/completions'
    } else if (provider === 'deepseek') {
      endpoint = config.apiUrl || 'https://api.deepseek.com/chat/completions'
    }

    const body: any = {
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    }

    if (isJson) {
      body.response_format = { type: 'json_object' }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errTxt = await res.text()
      throw new Error(`${provider.toUpperCase()} API error (status ${res.status}): ${errTxt}`)
    }

    const payload = await res.json()
    const content = payload.choices?.[0]?.message?.content || ''
    const usage = {
      promptTokens: payload.usage?.prompt_tokens || 0,
      completionTokens: payload.usage?.completion_tokens || 0,
      totalTokens: payload.usage?.total_tokens || 0
    }

    return { content, usage }
  }

  if (provider === 'gemini') {
    // Gemini OpenAI compatibility endpoint or native endpoint
    // We will use native REST endpoint as it is highly stable
    const apiKey = config.apiKey
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    
    // Convert prompts into Gemini structure
    const contents = []
    if (systemPrompt) {
      // For older gemini model format, system instruction goes in systemInstruction block
      // We pass it in contents or as systemInstruction depending on API requirements
    }

    const reqBody: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt ? systemPrompt + '\n\n' : ''}User Message:\n${prompt}` }]
        }
      ],
      generationConfig: {
        temperature
      }
    }

    if (isJson) {
      reqBody.generationConfig.responseMimeType = 'application/json'
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody)
    })

    if (!res.ok) {
      const errTxt = await res.text()
      throw new Error(`GEMINI API error (status ${res.status}): ${errTxt}`)
    }

    const payload = await res.json()
    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Estimate tokens if usageMetadata is not present
    const promptLen = (systemPrompt + prompt).length
    const completionLen = content.length
    const promptTokens = payload.usageMetadata?.promptTokenCount || Math.ceil(promptLen / 4)
    const completionTokens = payload.usageMetadata?.candidatesTokenCount || Math.ceil(completionLen / 4)

    return {
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      }
    }
  }

  if (provider === 'claude') {
    // Anthropic Claude Messages API
    const endpoint = 'https://api.anthropic.com/v1/messages'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!res.ok) {
      const errTxt = await res.text()
      throw new Error(`CLAUDE API error (status ${res.status}): ${errTxt}`)
    }

    const payload = await res.json()
    const content = payload.content?.[0]?.text || ''
    const usage = {
      promptTokens: payload.usage?.input_tokens || 0,
      completionTokens: payload.usage?.output_tokens || 0,
      totalTokens: (payload.usage?.input_tokens || 0) + (payload.usage?.output_tokens || 0)
    }

    return { content, usage }
  }

  if (provider === 'ollama') {
    // Ollama Local Chat Completion
    const baseUrl = config.apiUrl || 'http://localhost:11434'
    const endpoint = `${baseUrl}/api/chat`
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        options: { temperature },
        stream: false,
        format: isJson ? 'json' : undefined
      })
    })

    if (!res.ok) {
      const errTxt = await res.text()
      throw new Error(`OLLAMA API error (status ${res.status}): ${errTxt}`)
    }

    const payload = await res.json()
    const content = payload.message?.content || ''
    
    // Estimate tokens for local executions
    const promptLen = (systemPrompt + prompt).length
    const completionLen = content.length
    const promptTokens = Math.ceil(promptLen / 4)
    const completionTokens = Math.ceil(completionLen / 4)

    return {
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      }
    }
  }

  throw new Error(`Unsupported provider: ${provider}`)
}

/**
 * Main AI Gateway Call function
 */
export async function callAI(args: AICallArgs): Promise<AICallResult> {
  const { companyId, feature, prompt, systemPrompt = '', agentId, forceModel, temperature = 0.7, responseFormat = 'text' } = args
  const startTime = Date.now()
  const db = getAdminClient()

  // 1. Resolve model and routing
  let selectedProvider = 'openai'
  let selectedModel = 'gpt-4o'
  let fallbackProvider: string | null = null
  let fallbackModel: string | null = null

  if (forceModel) {
    selectedProvider = forceModel.provider
    selectedModel = forceModel.model
  } else {
    try {
      // Query specific routing configs
      // A. Agent + Feature Specific
      let routingRule = null
      if (agentId) {
        const { data } = await db
          .from('ai_routing')
          .select('*')
          .eq('company_id', companyId)
          .eq('agent_id', agentId)
          .eq('feature', feature)
          .maybeSingle()
        routingRule = data
      }

      // B. Feature Specific
      if (!routingRule) {
        const { data } = await db
          .from('ai_routing')
          .select('*')
          .eq('company_id', companyId)
          .is('agent_id', null)
          .eq('feature', feature)
          .maybeSingle()
        routingRule = data
      }

      // C. Default Company
      if (!routingRule) {
        const { data } = await db
          .from('ai_routing')
          .select('*')
          .eq('company_id', companyId)
          .is('agent_id', null)
          .eq('feature', 'default')
          .maybeSingle()
        routingRule = data
      }

      if (routingRule) {
        selectedProvider = routingRule.provider
        selectedModel = routingRule.model
        fallbackProvider = routingRule.fallback_provider || null
        fallbackModel = routingRule.fallback_model || null
      }
    } catch (err) {
      console.warn('[multi-provider] Routing table query failed, using defaults:', err)
    }
  }

  // 2. Fetch API keys
  let config = await getProviderConfig(companyId, selectedProvider)

  // 3. Execute with fallback
  let content = ''
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  let success = true
  let errorMsg = ''
  let finalProvider = selectedProvider
  let finalModel = selectedModel

  try {
    if (!config.apiKey && selectedProvider !== 'ollama') {
      throw new Error(`API key for provider "${selectedProvider}" is not configured.`)
    }
    const res = await executeProviderCall(
      selectedProvider,
      selectedModel,
      config,
      prompt,
      systemPrompt,
      temperature,
      responseFormat
    )
    content = res.content
    usage = res.usage
  } catch (primaryErr: any) {
    console.warn(`[multi-provider] Primary call failed (${selectedProvider}/${selectedModel}):`, primaryErr.message)
    
    // Switch to fallback if configured
    if (fallbackProvider && fallbackModel) {
      console.log(`[multi-provider] Switching to fallback provider: ${fallbackProvider}/${fallbackModel}`)
      try {
        finalProvider = fallbackProvider
        finalModel = fallbackModel
        config = await getProviderConfig(companyId, fallbackProvider)
        
        if (!config.apiKey && fallbackProvider !== 'ollama') {
          throw new Error(`API key for fallback provider "${fallbackProvider}" is not configured.`)
        }

        const res = await executeProviderCall(
          fallbackProvider,
          fallbackModel,
          config,
          prompt,
          systemPrompt,
          temperature,
          responseFormat
        )
        content = res.content
        usage = res.usage
      } catch (fallbackErr: any) {
        console.error('[multi-provider] Fallback call also failed:', fallbackErr.message)
        success = false
        errorMsg = `Primary: ${primaryErr.message}. Fallback: ${fallbackErr.message}`
      }
    } else {
      success = false
      errorMsg = primaryErr.message
    }
  }

  const latency = Date.now() - startTime
  const cost = success ? calculateCost(finalModel, usage.promptTokens, usage.completionTokens) : 0.0

  // 4. Log usage analytics in the background
  try {
    await db.from('ai_usage_logs').insert({
      company_id: companyId,
      feature,
      provider: finalProvider,
      model: finalModel,
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      total_tokens: usage.totalTokens,
      cost,
      latency_ms: latency,
      is_success: success,
      error_log: success ? null : errorMsg,
      accuracy_score: success ? 1.0 : 0.0,
      converted: false
    })
  } catch (logErr) {
    console.error('[multi-provider] Failed to write usage analytics log:', logErr)
  }

  if (!success) {
    throw new Error(`AI Call failed: ${errorMsg}`)
  }

  return {
    text: content,
    provider: finalProvider,
    model: finalModel,
    usage: {
      ...usage,
      cost
    },
    latencyMs: latency
  }
}
