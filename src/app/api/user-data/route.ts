import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/lib/mongodb';
import mongoose from 'mongoose';
import crypto from 'crypto';

function generateShortCode(): string {
  return crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const rawUserData = await db.collection('userdatas').findOne({ email: cleanEmail });
    const rawUser = await db.collection('users').findOne({ email: cleanEmail });
    const activeDoc = rawUserData || rawUser;

    if (activeDoc) {
      let aiCredits = 10.0;
      if (typeof rawUserData?.aiCredits === 'number' && typeof rawUser?.aiCredits === 'number') {
        aiCredits = Math.min(rawUserData.aiCredits, rawUser.aiCredits);
      } else if (typeof rawUserData?.aiCredits === 'number') {
        aiCredits = rawUserData.aiCredits;
      } else if (typeof rawUser?.aiCredits === 'number') {
        aiCredits = rawUser.aiCredits;
      }

      const tier = rawUserData?.tier || rawUser?.tier || 'free';
      const referralCode = rawUserData?.referralCode || rawUser?.referralCode || generateShortCode();

      return NextResponse.json({
        stats: rawUserData?.stats || null,
        history: rawUserData?.history || [],
        bookmarks: rawUserData?.bookmarks || [],
        syncTimestamp: rawUserData?.syncTimestamp || 0,
        tier,
        aiCredits,
        referralCode,
      });
    }

    // Default if not found in DB
    return NextResponse.json({
      stats: null,
      history: [],
      bookmarks: [],
      tier: 'free',
      aiCredits: 10.0,
      referralCode: generateShortCode(),
    });
  } catch (err: any) {
    const errorId = `ERR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    console.error(`[${errorId}] User-data GET error:`, err);
    return NextResponse.json({ error: `Internal server error. Reference: ${errorId}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, stats, history, bookmarks, timestamp } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const updateFields: Record<string, any> = {
      email: cleanEmail,
      lastUpdated: new Date(),
    };
    if (timestamp) updateFields.syncTimestamp = timestamp;

    // Validate payload sizes (Bug #19 Fix)
    if (stats !== undefined) {
      if (typeof stats !== 'object' || JSON.stringify(stats).length > 5000) {
        return NextResponse.json({ error: 'Stats payload too large or invalid' }, { status: 413 });
      }
      updateFields.stats = stats;
    }
    if (history !== undefined) {
      if (!Array.isArray(history) || history.length > 50 || JSON.stringify(history).length > 500000) {
        return NextResponse.json({ error: 'History payload too large or invalid (max 50 items)' }, { status: 413 });
      }
      updateFields.history = history;
    }
    if (bookmarks !== undefined) {
      if (!Array.isArray(bookmarks) || bookmarks.length > 100 || JSON.stringify(bookmarks).length > 200000) {
        return NextResponse.json({ error: 'Bookmarks payload too large or invalid (max 100 items)' }, { status: 413 });
      }
      updateFields.bookmarks = bookmarks;
    }

    await db.collection('userdatas').updateOne(
      { email: cleanEmail },
      { $set: updateFields },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const errorId = `ERR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    console.error(`[${errorId}] User-data POST error:`, err);
    return NextResponse.json({ error: `Internal server error. Reference: ${errorId}` }, { status: 500 });
  }
}
