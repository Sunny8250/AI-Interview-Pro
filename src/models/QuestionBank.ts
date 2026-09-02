import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestionBank extends Document {
  question: string;
  answer: string;
  category: string;
  difficulty: 'Entry' | 'Mid' | 'Senior';
  sourceDocument?: string;
  createdAt: Date;
}

const QuestionBankSchema: Schema = new Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String, default: 'General' },
  difficulty: { type: String, enum: ['Entry', 'Mid', 'Senior'], default: 'Mid' },
  sourceDocument: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.QuestionBank || mongoose.model<IQuestionBank>('QuestionBank', QuestionBankSchema);
