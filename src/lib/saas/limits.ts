import { createClient } from '@/lib/supabase/client';

export interface PlanLimits {
  contacts: number;
  ai_replies: number;
  broadcasts: number;
  workflows: number;
  team_members: number;
}

export type PlanId = 'free' | 'starter' | 'professional' | 'enterprise' | 'super_admin';

export interface Plan {
  id: PlanId;
  name: string;
  price_monthly: number;
  price_yearly: number;
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free Sandbox',
    price_monthly: 0,
    price_yearly: 0,
    limits: {
      contacts: 100,
      ai_replies: 50,
      broadcasts: 2,
      workflows: 3,
      team_members: 1,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter Plan',
    price_monthly: 29,
    price_yearly: 290,
    limits: {
      contacts: 1000,
      ai_replies: 500,
      broadcasts: 10,
      workflows: 10,
      team_members: 3,
    },
  },
  professional: {
    id: 'professional',
    name: 'Professional Plan',
    price_monthly: 79,
    price_yearly: 790,
    limits: {
      contacts: 10000,
      ai_replies: 5000,
      broadcasts: 100,
      workflows: 50,
      team_members: 10,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Plan',
    price_monthly: 249,
    price_yearly: 2490,
    limits: {
      contacts: 999999,
      ai_replies: 999999,
      broadcasts: 999999,
      workflows: 999999,
      team_members: 99,
    },
  },
  super_admin: {
    id: 'super_admin',
    name: 'Super Admin Plan',
    price_monthly: 0,
    price_yearly: 0,
    limits: {
      contacts: 999999999,
      ai_replies: 999999999,
      broadcasts: 999999999,
      workflows: 999999999,
      team_members: 999999999,
    },
  },
};

export interface UsageReport {
  contacts: { current: number; limit: number; pct: number };
  ai_replies: { current: number; limit: number; pct: number };
  broadcasts: { current: number; limit: number; pct: number };
  workflows: { current: number; limit: number; pct: number };
  team_members: { current: number; limit: number; pct: number };
}

/**
 * Check if a plan has access to a premium feature.
 */
export function hasFeatureAccess(planId: PlanId, feature: 'ai_agents' | 'custom_domain' | 'white_label' | 'api_keys'): boolean {
  if (planId === 'super_admin') return true;

  switch (feature) {
    case 'ai_agents':
      return planId !== 'free'; // Starter, Pro, Enterprise get AI agents
    case 'custom_domain':
      return planId === 'professional' || planId === 'enterprise';
    case 'white_label':
      return planId === 'enterprise';
    case 'api_keys':
      return planId === 'professional' || planId === 'enterprise';
    default:
      return false;
  }
}

/**
 * Fetch and construct the usage report for a company.
 */
export async function getCompanyUsage(companyId: string, planId: PlanId): Promise<UsageReport> {
  const supabase = createClient();
  const limits = PLANS[planId]?.limits || PLANS.free.limits;

  // 1. Fetch contact count
  const { count: contactsCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);

  // 2. Fetch team members count
  const { count: teamCount } = await supabase
    .from('company_users')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);

  // 3. Fetch workflows count
  const { count: workflowsCount } = await supabase
    .from('automations')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);

  // 4. Fetch usage logs for ephemeral metrics: broadcasts, ai_replies
  // Usually usage logs are aggregated within the current billing cycle. 
  // We'll query total values logged in usage_logs for simplicity.
  const { data: usageLogs } = await supabase
    .from('usage_logs')
    .select('metric, value')
    .eq('company_id', companyId);

  let aiRepliesCount = 0;
  let broadcastsCount = 0;

  if (usageLogs) {
    for (const log of usageLogs) {
      if (log.metric === 'ai_replies') aiRepliesCount += log.value;
      if (log.metric === 'broadcasts') broadcastsCount += log.value;
    }
  }

  const cCount = contactsCount || 0;
  const tCount = teamCount || 0;
  const wCount = workflowsCount || 0;

  return {
    contacts: {
      current: cCount,
      limit: limits.contacts,
      pct: Math.min(100, Math.round((cCount / limits.contacts) * 100)),
    },
    ai_replies: {
      current: aiRepliesCount,
      limit: limits.ai_replies,
      pct: Math.min(100, Math.round((aiRepliesCount / limits.ai_replies) * 100)),
    },
    broadcasts: {
      current: broadcastsCount,
      limit: limits.broadcasts,
      pct: Math.min(100, Math.round((broadcastsCount / limits.broadcasts) * 100)),
    },
    workflows: {
      current: wCount,
      limit: limits.workflows,
      pct: Math.min(100, Math.round((wCount / limits.workflows) * 100)),
    },
    team_members: {
      current: tCount,
      limit: limits.team_members,
      pct: Math.min(100, Math.round((tCount / limits.team_members) * 100)),
    },
  };
}

/**
 * Increment a metric in usage logs.
 */
export async function logUsageEvent(companyId: string, metric: 'ai_replies' | 'broadcasts', value = 1) {
  const supabase = createClient();
  await supabase.from('usage_logs').insert({
    company_id: companyId,
    metric,
    value,
  });
}
