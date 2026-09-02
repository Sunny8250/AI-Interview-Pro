import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import LinkedInProvider from "next-auth/providers/linkedin";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import crypto from "crypto";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from '@/lib/ipHelper';

// MED-09 Fix: Fail-fast with entropy check — presence alone is not enough.
// A weak/default secret in production would allow session token forgery.
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!NEXTAUTH_SECRET) {
  throw new Error(
    '[FATAL] NEXTAUTH_SECRET environment variable is not set. ' +
    'Generate one with: openssl rand -base64 64'
  );
}
if (NEXTAUTH_SECRET.length < 32) {
  throw new Error(
    '[FATAL] NEXTAUTH_SECRET is too short (minimum 32 characters). ' +
    'Generate a strong secret with: openssl rand -base64 64'
  );
}
// Warn loudly if a known weak/default value is detected
if (
  NEXTAUTH_SECRET.toLowerCase().includes('secret') ||
  NEXTAUTH_SECRET.toLowerCase().includes('dev') ||
  NEXTAUTH_SECRET.toLowerCase().includes('default') ||
  NEXTAUTH_SECRET.toLowerCase().includes('example')
) {
  console.warn(
    '[SECURITY WARNING] NEXTAUTH_SECRET appears to be a weak or default value! ' +
    'Run `openssl rand -base64 64` and replace it immediately.'
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    ] : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? [
      GithubProvider({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      })
    ] : []),
    ...(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET ? [
      LinkedInProvider({
        clientId: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        authorization: {
          params: { scope: 'openid profile email' },
        },
      })
    ] : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const cleanEmail = credentials.email.toLowerCase().trim();
        
        // Rate limit both the network source and the target account. The latter
        // remains effective even if an attacker rotates source addresses.
        try {
          const ip = getClientIp(request);
          const emailHash = crypto.createHash('sha256').update(cleanEmail).digest('hex');
          const [ipRateCheck, emailRateCheck] = await Promise.all([
            checkRateLimit(`login_ip_${ip}`, 5, 60_000),
            checkRateLimit(`login_email_${emailHash}`, 10, 15 * 60_000),
          ]);
          if (!ipRateCheck.allowed || !emailRateCheck.allowed) {
            throw new Error("Too many login attempts. Please wait and try again.");
          }
        } catch (rlErr: any) {
          if (rlErr.message.includes("Too many login attempts")) {
            throw rlErr; // Pass custom error message through
          }
        }

        if (process.env.MONGODB_URI) {
          try {
            await connectToDatabase();
            const dbUser = await User.findOne({ email: cleanEmail });
            if (dbUser && dbUser.password) {
              if (dbUser.isBanned) {
                throw new Error("Account has been banned");
              }
              const isMatch = await bcrypt.compare(credentials.password, dbUser.password);
              if (isMatch) {
                // CRIT-04 Fix: DO NOT auto-promote admin at runtime.
                // Admin role must be set manually in the DB by a superuser.
                // Auto-promotion based on email match is a privilege-escalation vector.
                return { 
                  id: dbUser._id.toString(), 
                  name: dbUser.name, 
                  email: dbUser.email,
                  isVerified: Boolean(dbUser.isVerified),
                  role: dbUser.role || 'USER',
                  tier: dbUser.tier || 'free'
                };
              }
              return null;
            }
          } catch (dbErr) {
            const errorId = `ERR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            console.error(`[${errorId}] MongoDB Auth Error:`, dbErr);
            throw new Error(`Authentication service unavailable. Reference ID: ${errorId}`);
          }
        }
        return null;
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (user?.email && process.env.MONGODB_URI) {
        try {
          await connectToDatabase();
          const cleanEmail = user.email.toLowerCase().trim();
          let dbUser = await User.findOne({ email: cleanEmail });

          if (dbUser?.isBanned) {
            return false;
          }

          const isOauth = account?.provider !== 'credentials';
          
          let db = null;
          try {
            db = mongoose.connection.db;
          } catch (e) {
            console.warn('Could not get native db connection for OAuth userdatas sync', e);
          }

          // CRIT-04 Fix: Never auto-promote to ADMIN at runtime based on email match.
          // Admin role must be set manually in the DB (e.g., via a seed script or
          // MongoDB Atlas UI). Auto-promotion is a privilege escalation attack vector.

          if (!dbUser) {
            const myReferralCode = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
            // Mongoose pre('save') hook handles hashing now
            const dummyPassword = crypto.randomBytes(32).toString('hex');
            
            dbUser = await User.create({
              name: user.name || cleanEmail.split('@')[0],
              email: cleanEmail,
              password: dummyPassword,
              role: 'USER', // Always USER — set ADMIN manually in DB
              tier: 'free',
              aiCredits: 10.0,
              creditsResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              referralCode: myReferralCode,
              lastLoginDate: new Date(),
              loginStreak: 1,
              isVerified: isOauth ? true : false, // OAuth sign-ins are pre-verified by provider
            });
            
            if (db) {
              await db.collection('userdatas').updateOne(
                { email: cleanEmail },
                {
                  $set: {
                    name: user.name || cleanEmail.split('@')[0],
                    email: cleanEmail,
                    tier: 'free',
                    aiCredits: 10.0,
                    referralCode: myReferralCode,
                    loginStreak: 1,
                    isVerified: isOauth ? true : false,
                    lastLoginDate: new Date(),
                  }
                },
                { upsert: true }
              );
            }
          } else {
            let modified = false;
            if (!dbUser.tier) { dbUser.tier = 'free'; modified = true; }
            if (typeof dbUser.aiCredits !== 'number') { dbUser.aiCredits = 10.0; modified = true; }
            if (isOauth && !dbUser.isVerified) { dbUser.isVerified = true; modified = true; }
            // CRIT-04 Fix: Removed `if (isAdmin && dbUser.role !== 'ADMIN')` block.
            // Admin role is never auto-granted — only changed by a DB admin directly.
            if (!dbUser.referralCode) { 
              dbUser.referralCode = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase(); 
              modified = true; 
            }
            if (modified) await dbUser.save();
            
            // Sync with UserData
            if (db && modified) {
              await db.collection('userdatas').updateOne(
                { email: cleanEmail },
                { $set: { 
                  tier: dbUser.tier, 
                  role: dbUser.role,
                  aiCredits: dbUser.aiCredits,
                  isVerified: dbUser.isVerified,
                  referralCode: dbUser.referralCode
                }},
                { upsert: true }
              );
            }
          }
          
          // Inject role and tier into user object for JWT callback
          (user as any).role = dbUser.role;
          (user as any).tier = dbUser.tier;
        } catch (err) {
          console.error('Error syncing OAuth user to MongoDB:', err);
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.isVerified = (user as any).isVerified ?? true;
        token.role = (user as any).role || 'USER';
        token.tier = (user as any).tier || 'free';
      }
      if (trigger === "update") {
        try {
          await connectToDatabase();
          const dbUser = await User.findOne({ email: token.email });
          if (dbUser) {
            token.isVerified = dbUser.isVerified ?? true;
            token.role = dbUser.role || 'USER';
            token.tier = dbUser.tier || 'free';
          }
        } catch (e) {
          console.error("Error refreshing token from DB on update:", e);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session?.user && token?.email) {
        session.user.email = token.email as string;
        (session.user as any).isVerified = Boolean(token.isVerified);
        (session.user as any).role = token.role as string;
        (session.user as any).tier = token.tier as string;
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
