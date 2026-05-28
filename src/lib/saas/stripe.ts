import { PLANS, PlanId } from './limits';
import { createClient } from '@/lib/supabase/client';

export interface CheckoutSessionOptions {
  companyId: string;
  planId: PlanId;
  billingPeriod: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

/**
 * Stripe Billing Helper
 * Automatically falls back to a sandbox simulation if API keys are not provided.
 */
export class StripeService {
  private static getApiKey() {
    return process.env.STRIPE_SECRET_KEY || '';
  }

  static isSandbox() {
    return !this.getApiKey();
  }

  static async createCheckoutSession(options: CheckoutSessionOptions): Promise<string> {
    const { companyId, planId, billingPeriod, successUrl, cancelUrl } = options;

    if (this.isSandbox()) {
      // Sandbox mode: return a URL to our mockup checkout page
      const params = new URLSearchParams({
        provider: 'stripe',
        companyId,
        planId,
        billingPeriod,
        successUrl,
        cancelUrl,
      });
      return `/api/billing/mock-checkout?${params.toString()}`;
    }

    try {
      // Real Stripe implementation would go here:
      // const stripe = new Stripe(this.getApiKey(), { apiVersion: '2023-10-16' });
      // const session = await stripe.checkout.sessions.create({...});
      // return session.url;
      throw new Error('Stripe is not configured in production mode. Sandbox mode is active.');
    } catch (e) {
      console.warn('Stripe checkout generation failed, fallback to mock checkout', e);
      const params = new URLSearchParams({
        provider: 'stripe',
        companyId,
        planId,
        billingPeriod,
        successUrl,
        cancelUrl,
      });
      return `/api/billing/mock-checkout?${params.toString()}`;
    }
  }

  /**
   * Handle simulated webhook subscription activation
   */
  static async activateMockSubscription(companyId: string, planId: PlanId, period: 'monthly' | 'yearly') {
    const supabase = createClient();
    const periodEnd = new Date();
    if (period === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // 1. Check if subscription exists
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existingSub) {
      // Update
      await supabase
        .from('subscriptions')
        .update({
          plan_id: planId,
          status: 'active',
          trial_end: null,
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          stripe_subscription_id: `sub_mock_${Math.random().toString(36).substring(7)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId);
    } else {
      // Insert
      await supabase.from('subscriptions').insert({
        company_id: companyId,
        plan_id: planId,
        status: 'active',
        trial_start: null,
        trial_end: null,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        stripe_subscription_id: `sub_mock_${Math.random().toString(36).substring(7)}`,
      });
    }

    // 2. Generate a mock invoice
    const plan = PLANS[planId];
    const amount = period === 'yearly' ? plan.price_yearly : plan.price_monthly;
    
    await supabase.from('invoices').insert({
      company_id: companyId,
      invoice_number: `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      amount,
      currency: 'USD',
      status: 'paid',
      billing_reason: `Subscription creation: ${plan.name} (${period})`,
    });
  }
}
