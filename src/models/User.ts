import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'USER' | 'ADMIN';
  tier: 'free' | 'pro';
  tierExpiryDate?: Date;
  aiCredits: number;
  creditsResetDate: Date;
  referralCode: string;
  referredBy?: string;
  lastLoginDate?: Date;
  loginStreak?: number;
  isVerified: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  isBanned?: boolean;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: false }, // OAuth users are created with a dummy password — not required
  role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
  tier: { type: String, enum: ['free', 'pro'], default: 'free' },
  tierExpiryDate: { type: Date },
  aiCredits: { type: Number, default: 10.0 },
  creditsResetDate: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: String },
  lastLoginDate: { type: Date },
  loginStreak: { type: Number, default: 1 },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  verificationCodeExpires: { type: Date },
  isBanned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre<IUser>('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  
  // Only hash if it hasn't already been hashed (checking for bcrypt's $2a$ or $2b$ prefix)
  if (!this.password.startsWith('$2a$') && !this.password.startsWith('$2b$')) {
    // LOW-03 Fix: Bumped from 10 to 12 rounds — significantly increases brute-force
    // cost on leaked hashes while staying within an acceptable server latency budget.
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
