import mongoose, { Schema, Document } from "mongoose";

export interface IInterview extends Document {
  userId: mongoose.Types.ObjectId;
  clientSessionId?: string;
  role: string;
  experience: string;
  messages: Array<{
    role: "user" | "ai";
    content: string;
  }>;
  feedback: any; // The analyzed report (scores, etc.)
  fallbackUsed: boolean;
  createdAt: Date;
}

const InterviewSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  clientSessionId: { type: String, index: true },
  role: { type: String, required: true },
  experience: { type: String, required: true },
  messages: [
    {
      role: { type: String, enum: ["user", "ai"], required: true },
      content: { type: String, required: true },
    },
  ],
  feedback: { type: Schema.Types.Mixed }, // Store the parsed JSON feedback
  fallbackUsed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Interview ||
  mongoose.model<IInterview>("Interview", InterviewSchema);
