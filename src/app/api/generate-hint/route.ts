import { getClientIp } from "@/lib/ipHelper";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  generateUnifiedAIResponse,
  generateUnifiedAIResponseStream,
} from "@/lib/multiAiProvider";
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
    const {
      question,
      role,
      experience,
      type,
      resumeContext,
      userEmail: _bodyEmail,
    } = body;

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    // Sanitize all user inputs before AI prompt interpolation
    const cleanQuestion = sanitizePromptInput(
      (question as string).substring(0, 1000),
    );
    const cleanRole = sanitizePromptInput(
      (role || "Developer").substring(0, 100),
    );
    const cleanExperience = sanitizePromptInput(
      (experience || "Mid-Level").substring(0, 50),
    );
    const cleanResumeContext = resumeContext
      ? sanitizePromptInput((resumeContext as string).substring(0, 2000))
      : "";

    if (!cleanQuestion) {
      return NextResponse.json(
        { error: "Invalid question provided" },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email; // Fix Bug #13: Stop trusting headerEmail/bodyEmail
    const ip = getClientIp(request);

    const { checkRateLimit } = await import("@/lib/rateLimit");
    const rateCheck = await checkRateLimit(`generate_hint_${ip}`, 30, 60000); // 30 hints per minute
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a minute." },
        { status: 429 },
      );
    }

    // Credit Deduction Check (0.5 Credit for AI Hint)
    const creditCheck = await checkAndDeductCredit(userEmail, 0.5, ip);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error:
            creditCheck.error ||
            "Insufficient AI credits (0.5 Credit required for AI Hint). Upgrade to Pro for unlimited hints!",
          code: "OUT_OF_CREDITS",
        },
        { status: 402 },
      );
    }
    creditDeducted = true;
    userEmailForRefund = userEmail ?? null;
    ipForRefund = ip;

    let prompt = "";
    if (type === "hint") {
      prompt = `You are a helpful interview coach. 
Question asked to candidate for "${cleanRole}" (${cleanExperience}):
"${cleanQuestion}"
${cleanResumeContext ? `Candidate Resume Context: "${cleanResumeContext}"\n` : ""}

Provide 2-3 concise bullet point HINTS or key concepts the candidate should mention in their answer. Keep it brief (under 60 words total). ${cleanResumeContext ? "Incorporate key skills or project names from their resume where applicable." : ""}`;
    } else {
      if (cleanResumeContext) {
        prompt = `You are the candidate answering an interview question for a "${cleanRole}" (${cleanExperience}) position.
CRITICAL INSTRUCTION: Generate an ideal MODEL ANSWER spoken from the candidate's first-person perspective ("I..."). You MUST weave in their actual projects, technologies, and achievements from their uploaded resume summary below.

CANDIDATE UPLOADED RESUME SUMMARY:
"${cleanResumeContext}"

QUESTION ASKED:
"${cleanQuestion}"

Provide a concise, ideal MODEL ANSWER that directly answers every numbered question above. Keep the answers separate and easy to follow using exactly this Markdown structure:
### Answer 1
...answer to question 1...

### Answer 2
...answer to question 2...
Use one clearly labeled section for each numbered question. Do not combine answers or discuss multiple questions in one section.`;
      } else {
        prompt = `You are an expert candidate answering an interview question for a "${cleanRole}" (${cleanExperience}) position.
Question:
"${cleanQuestion}"

Provide a concise, realistic MODEL ANSWER for every numbered question above. Keep the answers separate and easy to follow using exactly this Markdown structure:
### Answer 1
...answer to question 1...

### Answer 2
...answer to question 2...
Use one clearly labeled section for each numbered question. Do not combine answers or discuss multiple questions in one section.`;
      }
    }

    const hintHash = crypto
      .createHash("sha256")
      .update(
        `${type}_${cleanQuestion}_${cleanRole}_${cleanExperience}_${cleanResumeContext}`,
      )
      .digest("hex");
    const cacheKey = `hint_${hintHash}`;

    if (type === "model") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            await generateUnifiedAIResponseStream(
              [{ role: "user", parts: [{ text: prompt }] }],
              { temperature: 0.2, cacheKey },
              (chunk) => controller.enqueue(encoder.encode(chunk)),
            );
            controller.close();
          } catch (streamError) {
            console.error("Model answer streaming failed:", streamError);
            controller.error(streamError);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Remaining-Credits": String(creditCheck.remainingCredits),
        },
      });
    }

    const resultText = await generateUnifiedAIResponse(
      [{ role: "user", parts: [{ text: prompt }] }],
      {
        temperature: 0.2,
        cacheKey,
      },
    );

    return NextResponse.json({
      result: resultText,
      remainingCredits: creditCheck.remainingCredits,
    });
  } catch (error: any) {
    if (creditDeducted) {
      await refundCredit(userEmailForRefund, 0.5, ipForRefund);
    }
    console.error("Error generating hint/model answer:", error);
    return NextResponse.json({ error: parseAiError(error) }, { status: 500 });
  }
}
