import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mongoose from 'mongoose';
import { generateUnifiedAIResponse } from '../src/lib/multiAiProvider';

const QuestionBankSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String, default: 'General' },
  difficulty: { type: String, enum: ['Entry', 'Mid', 'Senior'], default: 'Mid' },
  sourceDocument: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const QuestionBank = mongoose.models.QuestionBank || mongoose.model('QuestionBank', QuestionBankSchema);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const questions = await QuestionBank.find({
    $or: [
      { difficulty: 'Mid' },
      { difficulty: { $exists: false } },
      { difficulty: null }
    ]
  });
  console.log(`Found ${questions.length} questions to process`);

  let updatedCount = 0;
  for (const q of questions) {
    console.log(`Processing: ${q.question.substring(0, 50)}...`);
    const prompt = `Analyze this interview question and estimate its difficulty level as "Entry", "Mid", or "Senior".
Question: ${q.question}
Answer: ${q.answer}
Respond with strictly the difficulty string ("Entry", "Mid", or "Senior") and nothing else.`;

    try {
      // Use the unified orchestrator which supports OpenAI/Groq fallbacks
      const aiResponse = await generateUnifiedAIResponse(prompt, { temperature: 0.1 });
      let difficulty = aiResponse.trim().replace(/['"]/g, '');
      if (difficulty.includes('Entry')) difficulty = 'Entry';
      else if (difficulty.includes('Senior')) difficulty = 'Senior';
      else difficulty = 'Mid';

      q.difficulty = difficulty;
      await q.save();
      console.log(` -> Marked as ${difficulty}`);
      updatedCount++;
      
      // Wait 6 seconds between requests to avoid hitting the 15 Requests Per Minute limit on Gemini Free Tier!
      await delay(6000);
    } catch (e: any) {
      console.log(` -> Error: ${e.message}`);
      // Wait extra long if we hit a hard error to let the quota reset
      await delay(15000);
    }
  }

  console.log(`Done. Updated ${updatedCount} questions.`);
  process.exit(0);
}

run();
