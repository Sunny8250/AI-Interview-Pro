import { getClientIp } from "@/lib/ipHelper";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rateLimit";
import { sanitizeNoSqlInput } from "@/lib/securitySanitizer";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

function generateShortCode(): string {
  // L-03 Fix: 8 hex chars = 4 billion possibilities, making enumeration infeasible
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 chars
}

function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateCheck = await checkRateLimit(`register_${ip}`, 5, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please wait 1 minute." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const cleanBody = sanitizeNoSqlInput(body);

    const { name, email, password, referralCode: refCodeInput } = cleanBody;

    if (
      !name ||
      !email ||
      !password ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof name !== "string"
    ) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    // H-01 Fix: Enforce strict max-length limits BEFORE bcrypt to prevent CPU-exhaustion DoS.
    // A bcrypt call on a multi-MB string can block the server thread for tens of seconds.
    if (name.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or fewer" },
        { status: 400 },
      );
    }
    if (email.length > 254) {
      // RFC 5321 max email length
      return NextResponse.json(
        { error: "Email address is too long" },
        { status: 400 },
      );
    }
    if (password.length > 128) {
      return NextResponse.json(
        { error: "Password must be 128 characters or fewer" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const otpCode = generateVerificationCode();
    // M-06 Fix: Bump OTP bcrypt rounds to 12 to match password hashing cost in User.ts
    const otpHash = await bcrypt.hash(otpCode, 12);
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // Expires in 15 minutes

    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        {
          error:
            "Registration is temporarily unavailable. Please try again later.",
        },
        { status: 503 },
      );
    }

    if (process.env.MONGODB_URI) {
      await connectToDatabase();
      const existing = await User.findOne({ email: cleanEmail });
      if (existing) {
        return NextResponse.json(
          {
            error:
              "We could not create this account. Please sign in or use a different email address.",
          },
          { status: 400 },
        );
      }

      const myReferralCode = generateShortCode();
      let initialCredits = 10.0;
      let referrerId = "";
      let db = null;

      try {
        db = mongoose.connection.db;
      } catch (e) {
        console.warn(
          "Could not get native db connection for userdatas sync",
          e,
        );
      }

      if (refCodeInput) {
        const referrer = await User.findOne({
          referralCode: String(refCodeInput).trim().toUpperCase(),
        });
        if (referrer) {
          // Bug #17: Do not award credits yet. Just record the referrerId.
          // They will get their credits when this user verifies their email in verify-code/route.ts
          referrerId = referrer.email;
          initialCredits = 15.0;
        }
      }

      const _newUser = await User.create({
        name,
        email: cleanEmail,
        password: password, // Mongoose pre('save') hook handles hashing now
        referralCode: myReferralCode,
        referredBy: referrerId || undefined,
        aiCredits: initialCredits,
        lastLoginDate: new Date(),
        loginStreak: 1,
        isVerified: false,
        verificationCode: otpHash,
        verificationCodeExpires: otpExpires,
      });

      // Also create matching userdatas doc in MongoDB Atlas
      if (db) {
        await db.collection("userdatas").updateOne(
          { email: cleanEmail },
          {
            $set: {
              name,
              email: cleanEmail,
              tier: "free",
              aiCredits: initialCredits,
              referralCode: myReferralCode,
              loginStreak: 1,
              isVerified: false,
              verificationCode: otpHash,
              verificationCodeExpires: otpExpires,
              lastLoginDate: new Date(),
            },
          },
          { upsert: true },
        );
      }

      // Bug #16: Send verification email
      try {
        await sendVerificationEmail(cleanEmail, name, otpCode);
      } catch (emailErr) {
        console.error("Failed to send verification email");
        // Continue anyway; they can request a resend later
      }
    }

    return NextResponse.json({
      success: true,
      message: "Account registered successfully!",
      email: cleanEmail,
    });
  } catch (error: any) {
    const errorId = `ERR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    console.error(`[${errorId}] Error in user registration:`, error);
    return NextResponse.json(
      { error: `Registration failed. Reference ID: ${errorId}` },
      { status: 500 },
    );
  }
}
