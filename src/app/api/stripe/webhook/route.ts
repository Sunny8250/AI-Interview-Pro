import { NextResponse } from "next/server";
import Stripe from "stripe";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import crypto from "crypto";

async function findCustomerEmail(
  stripe: Stripe,
  customerId: any,
): Promise<string | null> {
  const customer =
    typeof customerId === "string"
      ? await stripe.customers.retrieve(customerId)
      : customerId;
  return customer && !customer.deleted
    ? customer.email?.toLowerCase().trim() || null
    : null;
}

function getSubscriptionPeriodEnd(subscription: unknown): Date | null {
  const seconds = (subscription as any)?.current_period_end;
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(seconds * 1000)
    : null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!webhookSecret || !secretKey) {
      console.error("CRITICAL: Stripe webhook credentials are not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 },
      );
    }
    if (!signature)
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 },
      );

    const stripe = new Stripe(secretKey);
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error: any) {
      console.error(
        "Stripe webhook signature verification failed:",
        error.message,
      );
      return NextResponse.json(
        { error: "Webhook signature is invalid" },
        { status: 400 },
      );
    }

    if (!process.env.MONGODB_URI) {
      // Return a retryable error: acknowledging without recording entitlement
      // would permanently lose a valid payment if the database is unavailable.
      return NextResponse.json(
        { error: "Database is not configured" },
        { status: 503 },
      );
    }
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db)
      return NextResponse.json(
        { error: "Database connection error" },
        { status: 503 },
      );

    let email: string | null = null;
    let update: any = null;
    let eventKind: "payment" | "subscription" | "downgrade" | null = null;

    if (event.type === "checkout.session.completed") {
      const checkout = event.data.object as Stripe.Checkout.Session;
      email = checkout.customer_email?.toLowerCase().trim() || null;
      if (!email)
        return NextResponse.json(
          { error: "Checkout has no customer email" },
          { status: 400 },
        );

      if (checkout.mode === "payment") {
        if (checkout.payment_status !== "paid") {
          return NextResponse.json({ received: true, pending: true });
        }
        update = {
          $inc: { aiCredits: 25 },
          $set: { lastPaymentId: checkout.id, lastUpdated: new Date() },
        };
        eventKind = "payment";
      } else if (checkout.mode === "subscription" && checkout.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          String(checkout.subscription),
        );
        const tierExpiryDate = getSubscriptionPeriodEnd(subscription);
        if (!tierExpiryDate)
          return NextResponse.json(
            { error: "Subscription period is unavailable" },
            { status: 503 },
          );
        update = {
          $max: { aiCredits: 100 },
          $set: {
            tier: "pro",
            tierExpiryDate,
            stripeCustomerId: checkout.customer,
            stripeSubscriptionId: subscription.id,
            lastPaymentId: checkout.id,
            lastUpdated: new Date(),
          },
        };
        eventKind = "subscription";
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        (invoice as any).subscription ||
        (invoice as any).parent?.subscription_details?.subscription;
      if (!subscriptionId) return NextResponse.json({ received: true });
      const subscription = await stripe.subscriptions.retrieve(
        String(subscriptionId),
      );
      email = await findCustomerEmail(stripe, subscription.customer as string);
      const tierExpiryDate = getSubscriptionPeriodEnd(subscription);
      if (!email || !tierExpiryDate)
        return NextResponse.json(
          { error: "Subscription customer or period is unavailable" },
          { status: 503 },
        );
      update = {
        $max: { aiCredits: 100 },
        $set: {
          tier: "pro",
          tierExpiryDate,
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          lastPaymentId: invoice.id,
          lastUpdated: new Date(),
        },
      };
      eventKind = "subscription";
    } else if (
      event.type === "customer.subscription.deleted" ||
      event.type === "invoice.payment_failed"
    ) {
      const paymentObject = event.data.object as any;
      email = await findCustomerEmail(stripe, paymentObject.customer || null);
      if (!email) return NextResponse.json({ received: true });
      update = {
        $set: {
          tier: "free",
          tierExpiryDate: new Date(),
          lastUpdated: new Date(),
        },
      };
      eventKind = "downgrade";
    } else {
      return NextResponse.json({ received: true });
    }

    if (!email || !update || !eventKind)
      return NextResponse.json({ received: true });

    const transaction = mongoose.connection.getClient().startSession();
    try {
      await transaction.withTransaction(async () => {
        // The immutable Stripe event ID is globally unique. Inserting it inside
        // the transaction makes duplicate deliveries safe, including races.
        await db.collection("payment_events").insertOne(
          {
            _id: `stripe:${event.id}`,
            provider: "stripe",
            email,
            eventType: event.type,
            eventKind,
            processedAt: new Date(),
          },
          { session: transaction },
        );

        const userUpdate = await db
          .collection("users")
          .updateOne({ email }, update, { session: transaction });
        if (userUpdate.matchedCount === 0) throw new Error("ACCOUNT_NOT_FOUND");
        await db
          .collection("userdatas")
          .updateOne({ email }, update, { upsert: true, session: transaction });
      });
    } catch (error: any) {
      if (error?.code === 11000)
        return NextResponse.json({ received: true, duplicate: true });
      if (error?.message === "ACCOUNT_NOT_FOUND") {
        console.error(
          `Stripe event ${event.id} references a missing user: ${email}`,
        );
        return NextResponse.json(
          { error: "Account no longer exists" },
          { status: 409 },
        );
      }
      throw error;
    } finally {
      await transaction.endSession();
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    const errorId = `ERR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    console.error(`[${errorId}] Stripe webhook error:`, error);
    return NextResponse.json(
      { error: `Webhook processing failed. Reference: ${errorId}` },
      { status: 500 },
    );
  }
}
