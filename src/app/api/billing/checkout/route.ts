import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StripeService } from '@/lib/saas/stripe';
import { RazorpayService } from '@/lib/saas/razorpay';
import { PlanId } from '@/lib/saas/limits';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { companyId, planId, billingPeriod, provider } = body;
    if (!companyId || !planId) {
      return NextResponse.json({ error: 'Missing companyId or planId' }, { status: 400 });
    }

    // Determine the base URL for redirects
    const origin = request.headers.get('origin') || new URL(request.url).origin;
    const successUrl = `${origin}/settings?tab=billing&checkout=success`;
    const cancelUrl = `${origin}/settings?tab=billing&checkout=canceled`;

    let checkoutUrl = '';

    if (provider === 'razorpay') {
      checkoutUrl = await RazorpayService.createCheckoutSession({
        companyId,
        planId: planId as PlanId,
        billingPeriod: billingPeriod || 'monthly',
        successUrl,
        cancelUrl,
      });
    } else {
      checkoutUrl = await StripeService.createCheckoutSession({
        companyId,
        planId: planId as PlanId,
        billingPeriod: billingPeriod || 'monthly',
        successUrl,
        cancelUrl,
      });
    }

    // In a real environment, checkoutUrl is an external link (Stripe Checkout).
    // In sandbox mode, it redirects to our mock-checkout route.
    return NextResponse.json({ checkoutUrl });
  } catch (error: any) {
    console.error('[BillingCheckoutAPI] Error generating checkout session:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
