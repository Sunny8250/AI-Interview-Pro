import { connectToDatabase } from './mongodb';
import mongoose from 'mongoose';
import crypto from 'crypto';

// HIGH-03 Fix: In-memory fallback rate limiter that kicks in when MongoDB is
// unavailable. This makes the rate limiter fail-CLOSED (deny) instead of
// fail-OPEN (allow), eliminating the silent bypass on DB outages.
//
// Map key: identifier string → { count, resetTime (epoch ms) }
const memoryStore = new Map<string, { count: number; resetTime: number }>();

// Periodically clean up expired entries to avoid memory leaks in long-running processes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetTime <= now) memoryStore.delete(key);
  }
}, 60_000); // Sweep every 60 seconds

function checkMemoryRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTimeMs: number } {
  const now = Date.now();
  const existing = memoryStore.get(identifier);

  if (!existing || existing.resetTime <= now) {
    // New window
    memoryStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetTimeMs: windowMs };
  }

  existing.count += 1;
  const remaining = Math.max(0, maxRequests - existing.count);
  const allowed = existing.count <= maxRequests;
  return { allowed, remaining, resetTimeMs: Math.max(0, existing.resetTime - now) };
}

export async function checkRateLimit(
  ipOrIdentifier: string,
  maxRequests: number = 25,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; resetTimeMs: number }> {
  const now = new Date();

  if (!process.env.MONGODB_URI) {
    // No DB configured — fall back to in-memory (still enforced)
    return checkMemoryRateLimit(ipOrIdentifier, maxRequests, windowMs);
  }

  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return checkMemoryRateLimit(ipOrIdentifier, maxRequests, windowMs);
    }

    const resetTime = new Date(now.getTime() + windowMs);
    // Use a deterministic _id rather than a non-unique identifier field. MongoDB
    // guarantees _id uniqueness even before operational indexes are installed.
    const recordId = `ratelimit:${crypto.createHash('sha256').update(ipOrIdentifier).digest('hex')}`;
    const epoch = new Date(0);

    // BUG-09 Fix: Atomic rate limiter using an aggregation pipeline to prevent TOCTOU races
    const result = await db.collection('ratelimits').findOneAndUpdate(
      { _id: recordId },
      [
        {
          $set: {
            ip: ipOrIdentifier,
            count: {
              $cond: {
                // $convert preserves compatibility with legacy numeric timestamps
                // while storing all new values as BSON Dates for MongoDB TTL indexes.
                if: {
                  $lte: [
                    {
                      $convert: {
                        input: '$resetTime',
                        to: 'date',
                        onError: epoch,
                        onNull: epoch,
                      },
                    },
                    now,
                  ],
                },
                then: 1,
                else: { $add: [{ $ifNull: ['$count', 0] }, 1] }
              }
            },
            resetTime: {
              $cond: {
                if: {
                  $lte: [
                    {
                      $convert: {
                        input: '$resetTime',
                        to: 'date',
                        onError: epoch,
                        onNull: epoch,
                      },
                    },
                    now,
                  ],
                },
                then: resetTime,
                else: { $convert: { input: '$resetTime', to: 'date', onError: resetTime, onNull: resetTime } }
              }
            }
          }
        }
      ],
      { upsert: true, returnDocument: 'after' }
    );

    // Handle different MongoDB driver return signatures gracefully
    const activeDoc = result?.value || result;

    if (!activeDoc) {
      return checkMemoryRateLimit(ipOrIdentifier, maxRequests, windowMs);
    }

    const remaining = Math.max(0, maxRequests - activeDoc.count);
    const allowed = activeDoc.count <= maxRequests;

    return {
      allowed,
      remaining,
      resetTimeMs: Math.max(0, new Date(activeDoc.resetTime).getTime() - now.getTime())
    };
  } catch (err) {
    console.warn('Rate limit DB check error — falling back to in-memory limiter:', err);
    // HIGH-03 Fix: Fail-closed using in-memory store, NOT fail-open
    return checkMemoryRateLimit(ipOrIdentifier, maxRequests, windowMs);
  }
}
