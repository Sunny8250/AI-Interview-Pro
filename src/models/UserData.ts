import mongoose, { Schema, Document } from 'mongoose';

export interface IUserData extends Document {
  email: string;
  tier: 'free' | 'pro';
  aiCredits: number;
  creditsResetDate: Date;
  referralCode: string;
  referredBy?: string;
  lastLoginDate?: Date;
  name?: string;
  isVerified?: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  syncTimestamp?: number;
  lastPaymentId?: string;
  loginStreak?: number;
  stats: {
    interviewsTaken: number;
    totalQuizzes: number;
    totalQuizScore: number;
    totalQuizQuestions: number;
    hoursPracticed: number;
    currentStreak: number;
    lastPracticeDate: string;
  };
  history: Array<{
    id: string;
    role: string;
    experience: string;
    date: string;
    durationMinutes: number;
    messageCount: number;
    overallScore: number | null;
    messages: Array<{ role: 'user' | 'ai'; content: string }>;
  }>;
  bookmarks: Array<{
    id: string;
    question: string;
    role: string;
    date: string;
  }>;
  lastUpdated: Date;
}

const UserDataSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  tier: { type: String, enum: ['free', 'pro'], default: 'free' },
  aiCredits: { type: Number, default: 10.0 },
  creditsResetDate: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  referralCode: { type: String },
  referredBy: { type: String },
  lastLoginDate: { type: Date },
  name: { type: String },
  isVerified: { type: Boolean },
  verificationCode: { type: String },
  verificationCodeExpires: { type: Date },
  syncTimestamp: { type: Number },
  lastPaymentId: { type: String },
  loginStreak: { type: Number, default: 1 },
  stats: {
    interviewsTaken: { type: Number, default: 0 },
    totalQuizzes: { type: Number, default: 0 },
    totalQuizScore: { type: Number, default: 0 },
    totalQuizQuestions: { type: Number, default: 0 },
    hoursPracticed: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    lastPracticeDate: { type: String, default: '' },
  },
  history: { type: Array, default: [] },
  bookmarks: { type: Array, default: [] },
  lastUpdated: { type: Date, default: Date.now },
}, { strict: true });

export default (mongoose.models.UserData as mongoose.Model<IUserData>) || mongoose.model<IUserData>('UserData', UserDataSchema);
