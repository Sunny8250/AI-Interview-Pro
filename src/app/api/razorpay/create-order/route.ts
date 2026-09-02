import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import Razorpay from 'razorpay';
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

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({
        error: 'Razorpay API credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are missing in .env.local.',
        code: 'RAZORPAY_KEYS_MISSING'
      }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Pricing in INR (Razorpay uses paise: 1 INR = 100 paise)
    let amountInPaise = 39900; // Default ₹399 (~$4.99) for 25 Credits Top-Up
    let description = '25 AI Credit Top-Up Pack';
    let validatedPlan = 'topup';

    if (plan === 'pro') {
      validatedPlan = 'pro';
      if (planType === 'annual') {
        amountInPaise = 958800; // ₹799 × 12, billed annually
        description = 'AI Pro Annual Membership (₹9,588/year)';
      } else {
        amountInPaise = 149900; // ₹1499/month billed monthly (~$19/mo)
        description = 'AI Pro Monthly Membership';
      }
    } else if (plan === 'topup' || !plan) {
      validatedPlan = 'topup';
      amountInPaise = 39900;
    } else {
      return NextResponse.json({ error: 'Invalid plan specified' }, { status: 400 });
    }

    // L-01 Fix: Strict allowlist for planType to prevent unexpected values in Razorpay notes
    const ALLOWED_PLAN_TYPES = ['monthly', 'annual'];
    const validatedPlanType = validatedPlan === 'pro' && ALLOWED_PLAN_TYPES.includes(planType)
      ? planType
      : 'monthly';

    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${crypto.randomUUID()}`,
      notes: {
        email: email.toLowerCase().trim(),
        plan: validatedPlan,
        planType: validatedPlanType,
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      userEmail: email,
      description,
      plan: validatedPlan,
    });
  } catch (error: any) {
    const errorId = `ERR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    console.error(`[${errorId}] Razorpay order creation error:`, error);
    return NextResponse.json({ error: `Failed to create order. Reference: ${errorId}` }, { status: 500 });
  }
}
