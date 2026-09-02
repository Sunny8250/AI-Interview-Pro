import { getClientIp } from "@/lib/ipHelper";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { checkRateLimit } from "@/lib/rateLimit";
import crypto from "crypto";

function emailRateLimitKey(scope: string, email: string): string {
  return `${scope}_${crypto.createHash("sha256").update(email).digest("hex")}`;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimitCheck = await checkRateLimit(
      `otp_ip_${ip}`,
      5,
      15 * 60 * 1000,
    );
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 },
      );
    }

    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and 6-digit verification code are required" },
        { status: 400 },
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanCode = String(code).trim();
    if (cleanEmail.length > 254 || !/^\d{6}$/.test(cleanCode)) {
      return NextResponse.json(
        { error: "Email and a valid 6-digit verification code are required" },
        { status: 400 },
      );
    }

    const accountRateLimit = await checkRateLimit(
      emailRateLimitKey("otp_email", cleanEmail),
      5,
      15 * 60 * 1000,
    );
    if (!accountRateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many verification attempts. Please request a new code or try again later.",
        },
        { status: 429 },
      );
    }

    await connectToDatabase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 400 },
      );
    }

    if (user.isVerified) {
      return NextResponse.json({
        success: true,
        message: "Account is already verified!",
      });
    }

    if (
      user.verificationCodeExpires &&
      new Date(user.verificationCodeExpires) < new Date()
    ) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 },
      );
    }

    if (
      !user.verificationCode ||
      !(await bcrypt.compare(cleanCode, user.verificationCode))
    ) {
      return NextResponse.json(
        { error: "Invalid verification code. Please check and try again." },
        { status: 400 },
      );
    }

    // Code is valid! Mark verified in MongoDB Atlas atomically to prevent referral races
    const result = await User.updateOne(
      { email: cleanEmail, isVerified: { $ne: true } },
      {
        $set: { isVerified: true },
        $unset: { verificationCode: "", verificationCodeExpires: "" },
      },
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({
        success: true,
        message: "Account is already verified!",
      });
    }

    const db = mongoose.connection.db;

    if (user.referredBy) {
      // Atomically cap rewards at ten, including legacy referrers without a counter.
      const referrer = await User.findOneAndUpdate(
        {
          email: user.referredBy,
          $expr: { $lt: [{ $ifNull: ["$referralRewardCount", 0] }, 10] },
        },
        [
          {
            $set: {
              aiCredits: { $add: [{ $ifNull: ["$aiCredits", 0] }, 5.0] },
              referralRewardCount: {
                $add: [{ $ifNull: ["$referralRewardCount", 0] }, 1],
              },
            },
          },
        ],
        { new: true },
      );
      if (referrer && db) {
        await db
          .collection("userdatas")
          .updateOne(
            { email: referrer.email },
            { $inc: { aiCredits: 5.0, referralRewardCount: 1 } },
            { upsert: true },
          );
      }
    }

    if (db) {
      await db.collection("userdatas").updateOne(
        { email: cleanEmail },
        {
          $set: { isVerified: true },
          $unset: { verificationCode: "", verificationCodeExpires: "" },
        },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Account verified successfully! You can now access all app features.",
    });
  } catch (error: any) {
    const errorId = `ERR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    console.error(`[${errorId}] Error verifying code:`, error);
    return NextResponse.json(
      { error: `Verification failed. Reference: ${errorId}` },
      { status: 500 },
    );
  }
}
