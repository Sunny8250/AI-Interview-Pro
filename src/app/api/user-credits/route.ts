import { getClientIp } from '@/lib/ipHelper';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/lib/mongodb';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { getGuestCredits } from '@/lib/creditGuard';

export const dynamic = 'force-dynamic';

function generateShortCode(): string {
  return crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = (session?.user?.email || '').toLowerCase().trim();
    const ip = getClientIp(request);

    // ── Unauthenticated users: serve guest credits without a DB round-trip ──────
    if (!email) {
      const guestBalance = await getGuestCredits(ip);
      return NextResponse.json({
        tier: 'free',
        aiCredits: guestBalance,
        unlimited: false,
        loginStreak: 1,
        referralCode: generateShortCode(),
        isUnauthenticated: true,
      });
    }

    // ── Authenticated user path ──────────────────────────────────────────────────
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const rawUserData = await db.collection('userdatas').findOne({ email });
    const rawUser = await db.collection('users').findOne({ email });
    let activeDoc: any = rawUserData || rawUser;

    // If authenticated but no DB record yet, synthesise defaults (don't fall back to guest)
    if (!activeDoc) {
      activeDoc = {
        email,
        tier: 'free',
        aiCredits: 10.0,
        loginStreak: 1,
        referralCode: generateShortCode(),
        lastLoginDate: new Date(),
      } as any; // Synthesised default — no _id because it's not yet persisted
    }

    const now = new Date();
    let aiCredits = 10.0;
    if (typeof rawUserData?.aiCredits === 'number' && typeof rawUser?.aiCredits === 'number') {
      aiCredits = Math.min(rawUserData.aiCredits, rawUser.aiCredits);
    } else if (typeof rawUserData?.aiCredits === 'number') {
      aiCredits = rawUserData.aiCredits;
    } else if (typeof rawUser?.aiCredits === 'number') {
      aiCredits = rawUser.aiCredits;
    } else if (typeof activeDoc.aiCredits === 'number') {
      aiCredits = activeDoc.aiCredits;
    }

    const storedTier = (rawUserData?.tier || rawUser?.tier || activeDoc.tier || 'free') as 'free' | 'pro';
    const tierExpiry = rawUserData?.tierExpiryDate || rawUser?.tierExpiryDate || activeDoc.tierExpiryDate;
    const tier = storedTier === 'pro' && (!tierExpiry || new Date(tierExpiry) >= now) ? 'pro' : 'free';
    let loginStreak = rawUserData?.loginStreak || rawUser?.loginStreak || activeDoc.loginStreak || 1;
    const referralCode = rawUserData?.referralCode || rawUser?.referralCode || activeDoc.referralCode || generateShortCode();
    let streakBonusApplied = false;

    const lastLogin = activeDoc.lastLoginDate ? new Date(activeDoc.lastLoginDate) : null;
    if (!lastLogin) {
      activeDoc.lastLoginDate = now;
    } else {
      const isSameDay =
        lastLogin.getUTCFullYear() === now.getUTCFullYear() &&
        lastLogin.getUTCMonth() === now.getUTCMonth() &&
        lastLogin.getUTCDate() === now.getUTCDate();

      if (!isSameDay) {
        const diffHours = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);
        if (diffHours <= 48) {
          loginStreak += 1;
        } else {
          loginStreak = 1;
        }

        if (tier === 'free') {
          streakBonusApplied = true;
          aiCredits = Number((aiCredits + 0.5).toFixed(1));
        }
      }
    }

    const setUpdates = {
      tier,
      referralCode,
      loginStreak,
      lastLoginDate: now,
    };

    const updateDoc: any = { $set: setUpdates };
    if (streakBonusApplied) {
      updateDoc.$inc = { aiCredits: 0.5 };
    }

    // Atomic CAS to prevent concurrent streak bonus exploitation
    if (activeDoc._id) {
      const filter = { email, lastLoginDate: activeDoc.lastLoginDate || null };
      const result = await db.collection('userdatas').updateOne(filter, updateDoc);
      if (result.matchedCount === 0) {
        // Conflict: Another request already updated. Return latest state without applying bonus again.
        const latest = await db.collection('userdatas').findOne({ email });
        if (latest) {
          return NextResponse.json({
            tier: latest.tier || 'free',
            aiCredits: latest.aiCredits ?? 10.0,
            unlimited: latest.tier === 'pro',
            loginStreak: latest.loginStreak || 1,
            referralCode: latest.referralCode || generateShortCode(),
            streakBonusApplied: false,
            email,
          });
        }
      }
      // Sync to users best-effort
      await db.collection('users').updateOne({ email }, updateDoc, { upsert: true });
    } else {
      await Promise.all([
        db.collection('userdatas').updateOne({ email }, updateDoc, { upsert: true }),
        db.collection('users').updateOne({ email }, updateDoc, { upsert: true }),
      ]);
    }

    return NextResponse.json({
      tier,
      aiCredits,
      unlimited: tier === 'pro',
      loginStreak,
      referralCode,
      streakBonusApplied,
      email,
    });
  } catch (error: any) {
    const errorId = `ERR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    console.error(`[${errorId}] Error fetching user credits:`, error);
    return NextResponse.json({ error: `Internal server error. Reference: ${errorId}` }, { status: 500 });
  }
}
