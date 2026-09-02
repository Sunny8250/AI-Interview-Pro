import { getClientIp } from "@/lib/ipHelper";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateUnifiedAIResponse } from "@/lib/multiAiProvider";
import { parseAiError } from "@/lib/parseAiError";
import { checkAndDeductCredit, refundCredit } from "@/lib/creditGuard";
import { sanitizePromptInput } from "@/lib/securitySanitizer";
import crypto from "crypto";

export async function POST(request: Request) {
  let creditDeducted = false;
  let userEmailForRefund: string | null = null;
  let ipForRefund = "guest";
  try {
    const body = await request.json();
    const { topic, difficulty } = body;

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    // HIGH-05 Fix: Sanitize user inputs before embedding in AI prompt
    const cleanTopic = sanitizePromptInput((topic as string).substring(0, 200));
    const cleanDifficulty = sanitizePromptInput(
      ((difficulty as string) || "Mid-Level").substring(0, 50),
    );

    if (!cleanTopic) {
      return NextResponse.json(
        { error: "Invalid topic provided" },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const ip = getClientIp(request);

    const { checkRateLimit } = await import("@/lib/rateLimit");
    const rateCheck = await checkRateLimit(`generate_quiz_${ip}`, 15, 60000); // 15 quizzes per minute
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a minute." },
        { status: 429 },
      );
    }

    // Credit Deduction Check (1.5 Credits for AI Quiz)
    const creditCheck = await checkAndDeductCredit(userEmail, 1.5, ip);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error:
            creditCheck.error ||
            "Insufficient AI credits (1.5 Credits required for AI Quiz). Upgrade to Pro for unlimited quizzes!",
          code: "OUT_OF_CREDITS",
        },
        { status: 402 },
      );
    }
    creditDeducted = true;
    userEmailForRefund = userEmail ?? null;
    ipForRefund = ip;

    const prompt = `You are an expert interviewer and technical assessor. 
Create a 5-question multiple-choice quiz about "${cleanTopic}" at a "${cleanDifficulty}" level.
Return ONLY a raw JSON array of objects. Do not include markdown formatting like \`\`\`json outside the array.
IMPORTANT: If the question, options, or explanation contain code snippets or keywords, you MUST wrap them in markdown backticks.
For single words/keywords, use single backticks (e.g. \`code\`). 
For multi-line code blocks, use triple backticks with the language identifier (e.g. \`\`\`java \\n code \\n\`\`\`).
Each object should have this exact structure:
{
  "question": "The question text.\\n\\n\`\`\`java\\nSystem.out.println('test');\\n\`\`\`",
  "options": ["option 1", "option 2", "option 3", "option 4"],
  "correctAnswerIndex": 0,
  "explanation": "Brief explanation of why the answer is correct"
}`;

    // MED-07 Fix: Hash-based cache key — never embed raw user input directly.
    // This bounds key size and prevents cache poisoning via crafted topic strings.
    const cacheHash = crypto
      .createHash("sha256")
      .update(`${cleanTopic}:${cleanDifficulty}`)
      .digest("hex");
    const cacheKey = `quiz_${cacheHash}`;

    const rawText = await generateUnifiedAIResponse(prompt, {
      cacheKey,
    });

    let cleanText = rawText;
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText
        .replace(/```json\n?/, "")
        .replace(/```$/, "")
        .trim();
    }

    const questions = JSON.parse(cleanText);
    return NextResponse.json({
      questions,
      remainingCredits: creditCheck.remainingCredits,
    });
  } catch (error: any) {
    if (creditDeducted) {
      await refundCredit(userEmailForRefund, 1.5, ipForRefund);
    }
    console.error("Error generating quiz:", error);
    return NextResponse.json({ error: parseAiError(error) }, { status: 500 });
  }
}
