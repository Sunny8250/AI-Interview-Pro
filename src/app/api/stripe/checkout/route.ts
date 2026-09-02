import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import Stripe from 'stripe';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json().catch(() => ({}));
    const { plan, planType } = body;

    const email = session?.user?.email || '';

    if (!email) {
      return NextResponse.json({ error: 'Please sign in to purchase or top-up credits' }, { status: 401 });
    }

    if (!['topup', 'pro'].includes(plan) || (plan === 'pro' && !['monthly', 'annual'].includes(planType))) {
      return NextResponse.json({ error: 'Invalid plan or billing cycle' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();


    // If Stripe API key is configured, build official checkout session
    if (process.env.STRIPE_SECRET_KEY) {
      // MED-02 Fix: Use ES import instead of runtime require() for type safety
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
      if (plan === 'topup') {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: { name: '25 AI Credit Top-Up Pack' },
            unit_amount: 499, // $4.99
          },
          quantity: 1,
        });
      } else if (planType === 'annual') {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: { name: 'AI Pro Annual Membership (Save 47%)' },
            unit_amount: 11900, // $119/yr
            recurring: { interval: 'year' },
          },
          quantity: 1,
        });
      } else {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: { name: 'AI Pro Monthly Membership' },
            unit_amount: 1900, // $19/mo
            recurring: { interval: 'month' },
          },
          quantity: 1,
        });
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: cleanEmail,
        line_items: lineItems,
        mode: plan === 'topup' ? 'payment' : 'subscription',
        success_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?payment=success`,
        cancel_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?payment=cancelled`,
      });

      return NextResponse.json({ url: checkoutSession.url });
    }

    return NextResponse.json({ error: 'Stripe is not configured on this server. Please contact support.' }, { status: 500 });
  } catch (error: any) {
    const errorId = `ERR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    console.error(`[${errorId}] Stripe checkout error:`, error);
    return NextResponse.json({ error: `Payment initiation failed. Reference: ${errorId}` }, { status: 500 });
  }
}
