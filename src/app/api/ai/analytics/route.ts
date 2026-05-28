import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getCompanyId(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!profile) return null

  const { data: cu } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('profile_id', profile.id)
    .limit(1)
    .maybeSingle()

  return cu ? cu.company_id : null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyId = await getCompanyId(supabase, user.id)
    if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    // Query last 30 days of logs from our db
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: logs, error } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('company_id', companyId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Compute aggregation statistics
    let totalRequests = logs?.length || 0
    let successfulRequests = 0
    let totalTokens = 0
    let promptTokens = 0
    let completionTokens = 0
    let totalCost = 0.0
    let totalLatency = 0
    let totalAccuracy = 0.0

    const providersBreakdown: Record<string, number> = {}
    const modelsBreakdown: Record<string, number> = {}
    const featuresBreakdown: Record<string, number> = {}

    for (const log of logs || []) {
      if (log.is_success) successfulRequests++
      totalTokens += log.total_tokens || 0
      promptTokens += log.prompt_tokens || 0
      completionTokens += log.completion_tokens || 0
      totalCost += parseFloat(log.cost || '0')
      totalLatency += log.latency_ms || 0
      totalAccuracy += parseFloat(log.accuracy_score || '1.0')

      providersBreakdown[log.provider] = (providersBreakdown[log.provider] || 0) + 1
      modelsBreakdown[log.model] = (modelsBreakdown[log.model] || 0) + 1
      featuresBreakdown[log.feature] = (featuresBreakdown[log.feature] || 0) + 1
    }

    const avgLatency = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0
    const avgAccuracy = totalRequests > 0 ? parseFloat((totalAccuracy / totalRequests * 100).toFixed(1)) : 100.0
    const successRate = totalRequests > 0 ? parseFloat((successfulRequests / totalRequests * 100).toFixed(1)) : 100.0

    return NextResponse.json({
      summary: {
        totalRequests,
        successRate,
        totalTokens,
        promptTokens,
        completionTokens,
        totalCost: parseFloat(totalCost.toFixed(4)),
        avgLatency,
        avgAccuracy
      },
      providers: providersBreakdown,
      models: modelsBreakdown,
      features: featuresBreakdown,
      logs: (logs || []).slice(-20) // send last 20 records for preview
    })
  } catch (err: any) {
    console.error('[api-ai-analytics-get] Failed:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
