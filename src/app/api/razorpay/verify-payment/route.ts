import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";

function signaturesMatch(expected: string, received: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex"),
  );
}

export async function POST(request: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      await request.json();
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { error: "Please sign in to verify a payment." },
        { status: 401 },
      );
    }
    if (
      ![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(
        (value) => typeof value === "string" && value.length > 0,
      )
    ) {
      return NextResponse.json(
        { error: "Missing required Razorpay payment verification parameters" },
        { status: 400 },
      );
    }

    const keyId =
      process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay is not configured on this server" },
        { status: 503 },
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (!signaturesMatch(expectedSignature, razorpay_signature)) {
      return NextResponse.json(
        { error: "Invalid Razorpay payment signature. Transaction rejected." },
        { status: 400 },
      );
    }

    const authorization = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
    const [orderRes, paymentRes] = await Promise.all([
      fetch(
        `https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpay_order_id)}`,
        { headers: { Authorization: authorization } },
      ),
      fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,
        { headers: { Authorization: authorization } },
      ),
    ]);
    if (!orderRes.ok || !paymentRes.ok) {
      return NextResponse.json(
        { error: "Unable to verify the payment with Razorpay" },
        { status: 400 },
      );
    }

    const [orderData, paymentData] = await Promise.all([
      orderRes.json(),
      paymentRes.json(),
    ]);
    const verifiedPlan = orderData.notes?.plan;
    const verifiedPlanType = orderData.notes?.planType;
    const expectedAmount = verifiedPlan === "topup"
      ? 39900
      : verifiedPlanType === "annual"
        ? 958800
        : 149900;
    const paidStatuses = new Set(["captured"]);
    if (
      orderData.notes?.email?.toLowerCase().trim() !== email ||
      paymentData.order_id !== razorpay_order_id ||
      !paidStatuses.has(paymentData.status) ||
      orderData.currency !== "INR" ||
      paymentData.currency !== "INR" ||
      orderData.amount !== expectedAmount ||
      paymentData.amount !== expectedAmount ||
      !["topup", "pro"].includes(verifiedPlan) ||
      (verifiedPlan === "pro" &&
        !["monthly", "annual"].includes(verifiedPlanType))
    ) {
      return NextResponse.json(
        { error: "Payment details do not match this account or plan." },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db)
      return NextResponse.json(
        { error: "Database connection error" },
        { status: 500 },
      );

    const paymentEventId = `razorpay:${razorpay_payment_id}`;
    const transaction = mongoose.connection.getClient().startSession();
    try {
      await transaction.withTransaction(async () => {
        const user = await db
          .collection("users")
          .findOne({ email }, { session: transaction });
        if (!user) throw new Error("ACCOUNT_NOT_FOUND");

        // _id has a unique index by default, reserving this payment globally,
        // rather than only on the document for the current account.
        await db.collection("payment_events").insertOne(
          {
            _id: paymentEventId,
            provider: "razorpay",
            providerOrderId: razorpay_order_id,
            email,
            plan: verifiedPlan,
            processedAt: new Date(),
          },
          { session: transaction },
        );

        const update: any =
          verifiedPlan === "topup"
            ? {
                $inc: { aiCredits: 25 },
                $set: {
                  lastPaymentId: razorpay_payment_id,
                  lastUpdated: new Date(),
                },
              }
            : {
                $max: { aiCredits: 100 },
                $set: {
                  tier: "pro",
                  tierExpiryDate: new Date(
                    Date.now() +
                      (verifiedPlanType === "annual" ? 365 : 30) *
                        24 *
                        60 *
                        60 *
                        1000,
                  ),
                  lastPaymentId: razorpay_payment_id,
                  lastUpdated: new Date(),
                },
              };

        await db
          .collection("users")
          .updateOne({ email }, update, { session: transaction });
        await db
          .collection("userdatas")
          .updateOne({ email }, update, { upsert: true, session: transaction });
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        return NextResponse.json(
          { error: "Payment has already been processed." },
          { status: 409 },
        );
      }
      if (error?.message === "ACCOUNT_NOT_FOUND") {
        return NextResponse.json(
          {
            error:
              "Account no longer exists. Please contact support with your payment ID.",
          },
          { status: 409 },
        );
      }
      throw error;
    } finally {
      await transaction.endSession();
    }

    const user = await db
      .collection("users")
      .findOne({ email }, { projection: { aiCredits: 1, tier: 1 } });
    return NextResponse.json({
      success: true,
      message:
        verifiedPlan === "topup"
          ? "Payment verified. Added 25 AI credits to your account."
          : "Payment verified. Your Pro membership is active.",
      newCredits: user?.aiCredits ?? 0,
      tier: user?.tier ?? "free",
    });
  } catch (error: any) {
    const errorId = `ERR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    console.error(`[${errorId}] Razorpay payment verification error:`, error);
    return NextResponse.json(
      { error: `Payment verification failed. Reference: ${errorId}` },
      { status: 500 },
    );
  }
}
