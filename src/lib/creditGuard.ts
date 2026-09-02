import { connectToDatabase } from './mongodb';
import mongoose from 'mongoose';
import crypto from 'crypto';

export interface CreditCheckResult {
  allowed: boolean;
  tier: 'free' | 'pro';
  remainingCredits: number;
  costDeducted: number;
  error?: string;
}

export async function getActiveTier(email: string | null | undefined): Promise<'free' | 'pro'> {
  const cleanEmail = email?.toLowerCase().trim();
  if (!cleanEmail || !process.env.MONGODB_URI) return 'free';

  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return 'free';

    const [rawUserData, rawUser] = await Promise.all([
      db.collection('userdatas').findOne({ email: cleanEmail }),
      db.collection('users').findOne({ email: cleanEmail }),
    ]);
    const tier = rawUserData?.tier || rawUser?.tier || 'free';
    const expiry = rawUserData?.tierExpiryDate || rawUser?.tierExpiryDate;
    return tier === 'pro' && (!expiry || new Date(expiry) >= new Date()) ? 'pro' : 'free';
  } catch (error) {
    console.warn('Could not resolve active subscription tier:', error);
    return 'free';
  }
}


function generateShortCode(): string {
  return crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
}

function guestCreditId(clientIp: string): string {
  return `guestcredit:${crypto.createHash('sha256').update(clientIp).digest('hex')}`;
}

async function getGuestCreditDocument(db: any, clientIp: string) {
  const id = guestCreditId(clientIp);
  const canonical = await db.collection('guestcredits').findOne({ _id: id });
  if (canonical) return canonical;

  // Preserve balances created before deterministic IDs were introduced. The
  // canonical document makes all subsequent deductions race-safe.
  const legacy = await db.collection('guestcredits').findOne({ ip: clientIp });
  if (legacy) {
    await db.collection('guestcredits').updateOne(
      { _id: id },
      {
        $setOnInsert: {
          ip: clientIp,
          aiCredits: typeof legacy.aiCredits === 'number' ? legacy.aiCredits : 10.0,
          lastUpdated: legacy.lastUpdated || new Date(),
        },
      },
      { upsert: true },
    );
    return db.collection('guestcredits').findOne({ _id: id });
  }

  return null;
}

export async function checkAndDeductCredit(
  email: string | null | undefined,
  cost: number,
  clientIp: string = 'guest'
): Promise<CreditCheckResult> {
  const cleanEmail = email ? email.toLowerCase().trim() : null;

  if (process.env.MONGODB_URI) {
    try {
      await connectToDatabase();
      const db = mongoose.connection.db;

      if (db) {
        if (!cleanEmail) {
          const guestId = guestCreditId(clientIp);
          const guestDoc = await getGuestCreditDocument(db, clientIp);
          const currentGuestBalance = typeof guestDoc?.aiCredits === 'number' ? guestDoc.aiCredits : 10.0;
          
          if (currentGuestBalance < cost) {
            return {
              allowed: false,
              tier: 'free',
              remainingCredits: Math.max(0, currentGuestBalance),
              costDeducted: 0,
              error: `INSUFFICIENT_CREDITS: You need ${cost} AI credits for this feature, but only have ${currentGuestBalance.toFixed(1)} credits remaining.`,
            };
          }

          const newGuestBalance = Math.max(0, Number((currentGuestBalance - cost).toFixed(1)));
          
          // Atomic deduction: $inc with balance guard prevents TOCTOU race conditions.
          // The filter { aiCredits: { $gte: cost } } ensures only one concurrent request
          // can deduct when the balance would go negative.
          if (guestDoc) {
            const result = await db.collection('guestcredits').updateOne(
              { _id: guestId, aiCredits: { $gte: cost } },
              { $inc: { aiCredits: -cost }, $set: { lastUpdated: new Date() } }
            );
            if (result.matchedCount === 0) {
              // Either a concurrent request drained the balance or doc vanished
              return { allowed: false, tier: 'free', remainingCredits: Math.max(0, currentGuestBalance), costDeducted: 0, error: `INSUFFICIENT_CREDITS: You need ${cost} AI credits for this feature, but only have ${currentGuestBalance.toFixed(1)} credits remaining.` };
            }
          } else {
            // New guest — $setOnInsert atomically creates the doc with deducted balance.
            // If another concurrent request wins the race, their insert stands and this
            // request returns a conflict (acceptable: rare first-request edge case).
            const result = await db.collection('guestcredits').updateOne(
              { _id: guestId },
              { $setOnInsert: { ip: clientIp, aiCredits: newGuestBalance, lastUpdated: new Date() } },
              { upsert: true }
            );
            if (result.matchedCount > 0 && result.upsertedCount === 0) {
              // Concurrent request already created the doc — treat as conflict
              return { allowed: false, tier: 'free', remainingCredits: currentGuestBalance, costDeducted: 0, error: 'Concurrent request conflict. Please try again.' };
            }
          }

          return {
            allowed: true,
            tier: 'free',
            remainingCredits: newGuestBalance,
            costDeducted: cost,
          };

        }
        if (cleanEmail) {
          const rawUserData = await db.collection('userdatas').findOne({ email: cleanEmail });
          const rawUser = await db.collection('users').findOne({ email: cleanEmail });

          if (rawUser?.isBanned) {
            return {
              allowed: false,
              tier: 'free',
              remainingCredits: 0,
              costDeducted: 0,
              error: 'ACCOUNT_BANNED: This account is not permitted to use AI features.',
            };
          }

          // Prevent unverified accounts from consuming credits
          const isVerified = Boolean(rawUserData?.isVerified || rawUser?.isVerified);
          if (!isVerified) {
             return {
               allowed: false,
               tier: 'free',
               remainingCredits: 0,
               costDeducted: 0,
               error: 'ACCOUNT_UNVERIFIED: Please verify your email address to use AI features.',
             };
          }

          const tier = (rawUserData?.tier || rawUser?.tier || 'free') as 'free' | 'pro';
          const referralCode = rawUserData?.referralCode || rawUser?.referralCode || generateShortCode();

          // PRO users get unlimited usage as long as subscription is not expired
          const expiryDate = rawUserData?.tierExpiryDate || rawUser?.tierExpiryDate;
          const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;

          if (tier === 'pro' && !isExpired) {
            return {
              allowed: true,
              tier: 'pro',
              remainingCredits: 999,
              costDeducted: 0,
            };
          }

          // Calculate current balance - take STRICTEST (LOWEST) value across both collections
          let currentBalance = 10.0;
          if (typeof rawUserData?.aiCredits === 'number' && typeof rawUser?.aiCredits === 'number') {
            currentBalance = Math.min(rawUserData.aiCredits, rawUser.aiCredits);
          } else if (typeof rawUserData?.aiCredits === 'number') {
            currentBalance = rawUserData.aiCredits;
          } else if (typeof rawUser?.aiCredits === 'number') {
            currentBalance = rawUser.aiCredits;
          }

          // Insufficient credits check
          if (currentBalance < cost) {
            return {
              allowed: false,
              tier: 'free', // Since we checked they are not pro above
              remainingCredits: Math.max(0, currentBalance),
              costDeducted: 0,
              error: `INSUFFICIENT_CREDITS: You need ${cost} AI credits for this feature, but only have ${currentBalance.toFixed(1)} credits remaining.`,
            };
          }

          // Deduct credits with Atomic Compare-And-Swap (CAS)
          const newBalance = Math.max(0, Number((currentBalance - cost).toFixed(1)));
          const updates = {
            aiCredits: newBalance,
            tier,
            referralCode,
            lastUpdated: new Date(),
          };

          if (rawUserData) {
            const filter = typeof rawUserData.aiCredits === 'number'
              ? { email: cleanEmail, aiCredits: rawUserData.aiCredits }
              : { email: cleanEmail };
            const result = await db.collection('userdatas').updateOne(filter, { $set: updates });
            if (result.matchedCount === 0) {
              return { allowed: false, tier, remainingCredits: currentBalance, costDeducted: 0, error: 'Concurrent request conflict. Please try again.' };
            }
          } else {
            const result = await db.collection('userdatas').updateOne(
              { email: cleanEmail },
              { $setOnInsert: updates },
              { upsert: true }
            );
            if (result.matchedCount > 0) {
              return { allowed: false, tier, remainingCredits: currentBalance, costDeducted: 0, error: 'Concurrent request conflict. Please try again.' };
            }
          }

          // Sync to users collection best-effort
          await db.collection('users').updateOne({ email: cleanEmail }, { $set: updates }, { upsert: true });

          return {
            allowed: true,
            tier, // Fix Bug #19: return actual tier instead of hardcoded 'free'
            remainingCredits: newBalance,
            costDeducted: cost,
          };
        }
      }
    } catch (err) {
      console.warn('Credit guard DB check warning:', err);
    }
  }

  // Fallback to memory ONLY if DB is totally offline
  return {
    allowed: false,
    tier: 'free',
    remainingCredits: 0,
    costDeducted: 0,
    error: 'Database connection failed. Cannot verify AI credits.',
  };
}

export async function getGuestCredits(clientIp: string): Promise<number> {
  if (process.env.MONGODB_URI) {
    try {
      await connectToDatabase();
      const db = mongoose.connection.db;
      if (db) {
        const guestDoc = await getGuestCreditDocument(db, clientIp);
        return typeof guestDoc?.aiCredits === 'number' ? guestDoc.aiCredits : 10.0;
      }
    } catch {}
  }
  return 10.0;
}

export async function refundCredit(
  email: string | null | undefined,
  cost: number,
  clientIp: string = 'guest'
): Promise<void> {
  const cleanEmail = email ? email.toLowerCase().trim() : null;
  if (!process.env.MONGODB_URI) return;

  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return;

    if (!cleanEmail) {
      await db.collection('guestcredits').updateOne(
        { _id: guestCreditId(clientIp) },
        { $inc: { aiCredits: cost }, $set: { lastUpdated: new Date() } }
      );
    } else {
      await Promise.all([
        db.collection('userdatas').updateOne(
          { email: cleanEmail },
          { $inc: { aiCredits: cost }, $set: { lastUpdated: new Date() } }
        ),
        db.collection('users').updateOne(
          { email: cleanEmail },
          { $inc: { aiCredits: cost }, $set: { lastUpdated: new Date() } }
        )
      ]);
    }
  } catch (err) {
    console.warn('Failed to refund credits:', err);
  }
}
