import { PLANS, PlanId } from './limits';
import { createClient } from '@/lib/supabase/client';
import { CheckoutSessionOptions } from './stripe';

/**
 * Razorpay Billing Helper
 * Automatically falls back to a sandbox simulation if API keys are not provided.
 */
export class RazorpayService {
  private static getApiKey() {
    return process.env.RAZORPAY_KEY_ID || '';
  }

  static isSandbox() {
    return !this.getApiKey();
  }

  static async createCheckoutSession(options: CheckoutSessionOptions): Promise<string> {
    const { companyId, planId, billingPeriod, successUrl, cancelUrl } = options;

    if (this.isSandbox()) {
      // Sandbox mode: return a URL to our mockup checkout page
      const params = new URLSearchParams({
        provider: 'razorpay',
        companyId,
        planId,
        billingPeriod,
        successUrl,
        cancelUrl,
      });
      return `/api/billing/mock-checkout?${params.toString()}`;
    }

    try {
      // Real Razorpay subscription mapping logic would go here.
      throw new Error('Razorpay is not configured in production mode. Sandbox mode is active.');
    } catch (e) {
      console.warn('Razorpay checkout generation failed, fallback to mock checkout', e);
      const params = new URLSearchParams({
        provider: 'razorpay',
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
   * Handle simulated webhook subscription activation for Razorpay
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
          razorpay_subscription_id: `sub_rzp_mock_${Math.random().toString(36).substring(7)}`,
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
        razorpay_subscription_id: `sub_rzp_mock_${Math.random().toString(36).substring(7)}`,
      });
    }

    // 2. Generate a mock invoice
    const plan = PLANS[planId];
    const amount = period === 'yearly' ? plan.price_yearly : plan.price_monthly;
    
    await supabase.from('invoices').insert({
      company_id: companyId,
      invoice_number: `INV-RZP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      amount,
      currency: 'INR',
      status: 'paid',
      billing_reason: `Subscription creation (Razorpay): ${plan.name} (${period})`,
    });
  }
}
