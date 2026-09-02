#!/usr/bin/env node
/**
 * MongoDB Index Setup Script
 *
 * Run this ONCE after deploying to production to create TTL indexes that
 * auto-expire old rate limit and AI cache documents. This prevents unbounded
 * collection growth and improves query performance.
 *
 * Usage:
 *   node scripts/setup-db-indexes.js
 *
 * Reads MONGODB_URI from .env.local automatically (dotenv).
 */

const mongoose = require('mongoose');

// Load .env.local automatically so the script works on all platforms (incl. PowerShell)
try { require('dotenv').config({ path: '.env.local' }); } catch (_) { /* dotenv optional */ }

async function setupIndexes() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas.');

    const db = mongoose.connection.db;
    if (!db) {
      console.error('ERROR: Could not get native DB handle from mongoose.');
      process.exit(1);
    }

    // ── 1. ratelimits collection ───────────────────────────────────────────────
    // Migrate legacy numeric epoch timestamps. MongoDB TTL indexes only work
    // with BSON Date fields.
    await db.collection('ratelimits').updateMany(
      { resetTime: { $type: 'number' } },
      [{ $set: { resetTime: { $toDate: '$resetTime' } } }]
    );
    await db.collection('aicache').updateMany(
      { timestamp: { $type: 'number' } },
      [{ $set: { timestamp: { $toDate: '$timestamp' } } }]
    );

    // TTL index auto-expires stale rate limit documents 1 hour after resetTime.
    await db.collection('ratelimits').createIndex(
      { resetTime: 1 },
      {
        expireAfterSeconds: 3600, // 1 hour after resetTime
        name: 'ttl_resetTime',
        background: true,
      }
    );
    console.log('✅ Created TTL index on ratelimits.resetTime (1h expiry)');

    // ── 2. aicache collection ──────────────────────────────────────────────────
    // TTL index auto-expires cached AI responses after 24 hours.
    await db.collection('aicache').createIndex(
      { timestamp: 1 },
      {
        expireAfterSeconds: 86400, // 24 hours
        name: 'ttl_timestamp',
        background: true,
      }
    );
    console.log('✅ Created TTL index on aicache.timestamp (24h expiry)');

    // ── 3. guestcredits collection ─────────────────────────────────────────────
    // Auto-expire guest credit records after 7 days to prevent unbounded growth.
    await db.collection('guestcredits').createIndex(
      { lastUpdated: 1 },
      {
        expireAfterSeconds: 7 * 24 * 3600, // 7 days
        name: 'ttl_lastUpdated',
        background: true,
      }
    );
    console.log('✅ Created TTL index on guestcredits.lastUpdated (7 day expiry)');

    await db.collection('public_reports').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'ttl_public_report_expiry', background: true }
    );
    console.log('✅ Created TTL index on public_reports.expiresAt');

    // ── 4. Existing collection performance indexes ─────────────────────────────
    // Ensure email lookups are fast. These may already exist under a different
    // name (e.g. Mongoose auto-created "email_1"), so we skip gracefully.
    const safeCreateIndex = async (collName, spec, opts) => {
      try {
        await db.collection(collName).createIndex(spec, opts);
        console.log(`✅ Ensured index ${opts.name} on ${collName}`);
      } catch (err) {
        if (err.code === 85) { // IndexOptionsConflict — already exists under different name
          console.log(`⏩ Index on ${collName}.${Object.keys(spec).join('+')} already exists (skipped)`);
        } else {
          throw err;
        }
      }
    };

    await safeCreateIndex('users', { email: 1 }, { unique: true, name: 'unique_email', background: true });
    await safeCreateIndex('userdatas', { email: 1 }, { unique: true, name: 'unique_email', background: true });
    await safeCreateIndex('ratelimits', { ip: 1 }, { name: 'idx_ip', background: true });
    await safeCreateIndex('aicache', { key: 1 }, { unique: true, name: 'unique_cache_key', background: true });

    console.log('\n🎉 All indexes set up successfully!');
    console.log('Note: TTL indexes are processed by MongoDB once per minute,');
    console.log('so documents may linger for up to 60 seconds after expiry.');
  } catch (err) {
    console.error('ERROR setting up indexes:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

setupIndexes();
