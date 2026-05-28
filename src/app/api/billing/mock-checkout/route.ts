import { NextResponse } from 'next/server';
import { StripeService } from '@/lib/saas/stripe';
import { RazorpayService } from '@/lib/saas/razorpay';
import { PlanId } from '@/lib/saas/limits';

export async function GET(request: Request) {
  // If GET, redirect to the frontend checkout page
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') || 'stripe';
  const planId = searchParams.get('planId') || 'free';
  const companyId = searchParams.get('companyId');
  const billingPeriod = searchParams.get('billingPeriod') || 'monthly';
  const successUrl = searchParams.get('successUrl') || '/settings?tab=billing';
  const cancelUrl = searchParams.get('cancelUrl') || '/settings?tab=billing';

  const params = new URLSearchParams({
    provider,
    planId,
    companyId: companyId || '',
    billingPeriod,
    successUrl,
    cancelUrl,
  });

  return NextResponse.redirect(new URL(`/mock-checkout?${params.toString()}`, request.url));
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { companyId, planId, billingPeriod, provider } = body;
    if (!companyId || !planId) {
      return NextResponse.json({ error: 'Missing companyId or planId' }, { status: 400 });
    }

    if (provider === 'razorpay') {
      await RazorpayService.activateMockSubscription(companyId, planId as PlanId, billingPeriod);
    } else {
      await StripeService.activateMockSubscription(companyId, planId as PlanId, billingPeriod);
    }

    return NextResponse.json({ success: true, message: 'Mock payment processed successfully' });
  } catch (error: any) {
    console.error('[MockCheckoutAPI] Error processing mock checkout:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
