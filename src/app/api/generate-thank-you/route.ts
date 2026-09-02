import { getClientIp } from "@/lib/ipHelper";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkAndDeductCredit, refundCredit } from "@/lib/creditGuard";
import { generateUnifiedAIResponse } from "@/lib/multiAiProvider";
import { sanitizePromptInput } from "@/lib/securitySanitizer";

export async function POST(request: Request) {
  let creditDeducted = false;
  let userEmailForRefund: string | null = null;
  let ipForRefund = "guest";
  try {
    const ip = getClientIp(request);
    const rateLimitCheck = await checkRateLimit(`generate_thank_you_${ip}`);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    // Deduct 0.5 credits for generating a thank you email
    const creditCheck = await checkAndDeductCredit(userEmail, 0.5, ip);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: creditCheck.error || "Insufficient AI credits.",
          code: "OUT_OF_CREDITS",
        },
        { status: 402 },
      );
    }
    creditDeducted = true;
    userEmailForRefund = userEmail ?? null;
    ipForRefund = ip;

    const { interviewerName, role, company, keyTopics } = await request.json();

    // Sanitize user inputs to prevent injection attacks
    const sanitize = (str: string) => sanitizePromptInput(str).slice(0, 500);

    const prompt = `You are a professional executive career coach.
Write a polished, high-converting Post-Interview Thank You Email for a candidate to send to their recruiter/interviewer.

DETAILS:
- Interviewer Name: "${sanitize(interviewerName) || "Hiring Manager"}"
- Position Title: "${sanitize(role) || "Software Engineer"}"
- Target Company: "${sanitize(company) || "Tech Company"}"
- Key Topics Discussed: "${sanitize(keyTopics) || "Microservices, System Scale, Redis Caching, and Team Collaboration"}"

Format the email with a subject line, professional greeting, 2 thoughtful paragraphs referencing the key topics discussed, and a warm sign-off.
DO NOT break character or include any external formatting or explanations.`;

    const aiMessage = await generateUnifiedAIResponse(
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.7 },
    );

    const text =
      aiMessage.trim() || "Thank you for the opportunity to interview today.";
    return NextResponse.json({
      email: text,
      remainingCredits: creditCheck.remainingCredits,
    });
  } catch (error: any) {
    if (creditDeducted) {
      await refundCredit(userEmailForRefund, 0.5, ipForRefund);
    }
    console.error("Error generating thank you email:", error);
    return NextResponse.json(
      { error: "Failed to generate thank you email" },
      { status: 500 },
    );
  }
}
