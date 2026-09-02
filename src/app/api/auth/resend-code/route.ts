import { getClientIp } from '@/lib/ipHelper';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rateLimit';

function emailRateLimitKey(email: string): string {
  return `otp_resend_email_${crypto.createHash('sha256').update(email).digest('hex')}`;
}

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimitCheck = await checkRateLimit(`otp_resend_ip_${ip}`, 3, 15 * 60 * 1000);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: 'Too many resend attempts. Please wait a minute and try again.' }, { status: 429 });
    }

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    // M-03 Fix: Validate email length before DB query
    const rawEmail = String(email);
    if (rawEmail.length > 254) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const cleanEmail = rawEmail.toLowerCase().trim();
    const accountRateLimit = await checkRateLimit(emailRateLimitKey(cleanEmail), 3, 15 * 60 * 1000);
    if (!accountRateLimit.allowed) {
      return NextResponse.json({ success: true, message: 'If an eligible account exists, a verification email will be sent shortly.' });
    }
    await connectToDatabase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user || user.isVerified) {
      return NextResponse.json({ success: true, message: 'If an eligible account exists, a verification email will be sent shortly.' });
    }

    const newCode = generateOtp();
    // M-06 Fix: Bump OTP bcrypt rounds to 12 to match password hashing
    const newHash = await bcrypt.hash(newCode, 12);
    const newExpires = new Date(Date.now() + 15 * 60 * 1000);

    user.verificationCode = newHash;
    user.verificationCodeExpires = newExpires;
    await user.save();

    const db = mongoose.connection.db;
    if (db) {
      await db.collection('userdatas').updateOne(
        { email: cleanEmail },
        {
          $set: {
            verificationCode: newHash,
            verificationCodeExpires: newExpires,
          }
        }
      );
    }

    // Send verification email
    const emailConfigured = !!(process.env.EMAIL_FROM && process.env.EMAIL_APP_PASSWORD);
    let emailSent = false;
    if (emailConfigured) {
      try {
        await sendVerificationEmail(cleanEmail, user.name || cleanEmail.split('@')[0], newCode);
        emailSent = true;
      } catch (emailErr) {
        console.error('Failed to resend verification email');
      }
    }



    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'If an eligible account exists, a verification email will be sent shortly.'
        : 'Verification email delivery is temporarily unavailable. Please try again later.',
    });
  } catch (error: any) {
    const errorId = `ERR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    console.error(`[${errorId}] Error resending verification code:`, error);
    return NextResponse.json({ error: `Failed to resend code. Reference ID: ${errorId}` }, { status: 500 });
  }
}
