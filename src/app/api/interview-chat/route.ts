import { getClientIp } from "@/lib/ipHelper";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateUnifiedAIResponse } from "@/lib/multiAiProvider";
import { parseAiError } from "@/lib/parseAiError";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  checkAndDeductCredit,
  getActiveTier,
  refundCredit,
} from "@/lib/creditGuard";
import { sanitizePromptInput } from "@/lib/securitySanitizer";

export async function POST(request: Request) {
  let creditDeducted = false;
  let userEmailForRefund: string | null = null;
  let ipForRefund = "guest";
  try {
    // 1. Rate Limiting Check
    const ip = getClientIp(request);
    const rateCheck = await checkRateLimit(`interview_chat_${ip}`, 30, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. Please wait a moment before sending another message.",
        },
        { status: 429 },
      );
    }

    const body = await request.json();
    const {
      role,
      experience,
      mode,
      company,
      persona,
      lang,
      jd,
      context,
      messages,
      userEmail: _bodyEmail,
    } = body;

    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    // Resolve the entitlement server-side. JWT tier claims may remain stale
    // after cancellation, expiry, or a successful payment.
    const userTier = await getActiveTier(userEmail);

    if (
      typeof role !== "string" ||
      !role.trim() ||
      (experience !== undefined && typeof experience !== "string") ||
      (typeof experience === "string" && experience.length > 50) ||
      !Array.isArray(messages)
    ) {
      return NextResponse.json(
        { error: "Role and messages are required" },
        { status: 400 },
      );
    }
    if (
      role.length > 100 ||
      messages.length > 50 ||
      messages.some(
        (message: any) =>
          !message ||
          !["user", "ai"].includes(message.role) ||
          typeof message.content !== "string" ||
          message.content.length > 4000,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid interview messages. Submit 1-50 user/AI messages of at most 4,000 characters each.",
        },
        { status: 400 },
      );
    }

    // Feature Gating Check — evaluated BEFORE any credit deduction (Bug #4 Fix)
    const isProCompany =
      company &&
      ["google", "amazon", "meta", "microsoft", "apple"].includes(company);
    const isProPersona = persona && ["architect", "startup"].includes(persona);

    if ((isProCompany || isProPersona) && userTier !== "pro") {
      return NextResponse.json(
        {
          error: `Target Company modes (${company}) and Advanced Personas require a Pro Membership! Upgrade to unlock.`,
          code: "PRO_FEATURE_LOCKED",
        },
        { status: 403 },
      );
    }

    // 2. AI Credit Deduction (0.5 Credits per message)
    const creditCheck = await checkAndDeductCredit(userEmail, 0.5, ip);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error:
            creditCheck.error ||
            "You have used all your free AI Credits! Upgrade to Pro for unlimited AI interviews.",
          code: "OUT_OF_CREDITS",
        },
        { status: 402 },
      );
    }

    creditDeducted = true;
    userEmailForRefund = userEmail ?? null;
    ipForRefund = ip;
    const remainingCredits = creditCheck.remainingCredits;

    const cleanRole = sanitizePromptInput(role.slice(0, 100));
    const cleanLang =
      typeof lang === "string" ? sanitizePromptInput(lang.slice(0, 20)) : "";
    const cleanJd =
      typeof jd === "string" ? sanitizePromptInput(jd.slice(0, 5000)) : "";
    const cleanContext =
      typeof context === "string"
        ? sanitizePromptInput(context.slice(0, 8000))
        : "";

    const languageNames: { [key: string]: string } = {
      "en-US": "English",
      "hi-IN": "Hindi (हिन्दी)",
      "es-ES": "Spanish (Español)",
      "fr-FR": "French (Français)",
      "de-DE": "German (Deutsch)",
      "ja-JP": "Japanese (日本語)",
    };
    const selectedLanguage =
      typeof lang === "string" && languageNames[lang] ? lang : "en-US";
    const targetLang = languageNames[selectedLanguage];
    const safeLang = cleanLang || selectedLanguage;

    let companyInstruction = "";
    switch (company) {
      case "google":
        companyInstruction = `TARGET COMPANY: Google.
Adopt Google's rigorous engineering bar. Focus heavily on algorithmic efficiency (Big-O analysis), clean data structures, high-scale system design, open-ended problem solving, and "Googleyness" (intellectual humility, collaboration).`;
        break;
      case "amazon":
        companyInstruction = `TARGET COMPANY: Amazon.
Adhere strictly to Amazon's 16 Leadership Principles (Customer Obsession, Ownership, Invent & Simplify, Bias for Action, Dive Deep, Earn Trust, Have Backbone; Disagree & Commit). Ask probing follow-ups requiring data-driven metrics and STAR format answers.`;
        break;
      case "microsoft":
        companyInstruction = `TARGET COMPANY: Microsoft.
Focus on practical engineering design, OOP principles, robust edge-case handling, system architecture trade-offs, team collaboration, and customer empathy.`;
        break;
      case "meta":
        companyInstruction = `TARGET COMPANY: Meta (Facebook).
Focus on rapid, high-throughput problem solving, ultra-high-scale distributed systems architecture, performance optimization, and pragmatic product-driven engineering.`;
        break;
      case "apple":
        companyInstruction = `TARGET COMPANY: Apple.
Focus on extreme attention to detail, low-level OS/memory fundamentals, security/privacy principles, elegant code design, and deep technical mastery.`;
        break;
      case "itservices":
        companyInstruction = `TARGET COMPANY: Indian IT Services (Infosys / TCS / Wipro / HCL).
Focus on core computer science fundamentals (OOPs concepts, DBMS & SQL queries, Java/C++/Python basics, OS threads, SDLC), candidate project deep-dives, and logical reasoning.`;
        break;
      default:
        companyInstruction = `TARGET COMPANY: General Tech Industry Standard.
Conduct a realistic tech company interview covering industry-standard engineering practices.`;
    }

    let modeInstruction = "";
    switch (mode) {
      case "technical":
        modeInstruction = `INTERVIEW FOCUS MODE: Technical & System Design.
Focus EXCLUSIVELY on technical depth, core algorithms, data structures, framework internal mechanics, architecture tradeoffs, and system design questions relevant to a ${cleanRole}. Do not ask HR or behavioral questions.`;
        break;
      case "rapidfire":
        modeInstruction = `INTERVIEW FOCUS MODE: Rapid-Fire Technical Drill.
Ask exactly 1 high-yield, fast-paced technical question at a time. Keep your evaluation of the candidate's previous answer to 1 single concise sentence, then IMMEDIATELY ask the next rapid technical question. Do not chat or waffle.`;
        break;
      case "behavioral":
        modeInstruction = `INTERVIEW FOCUS MODE: Behavioral (STAR Method).
Focus EXCLUSIVELY on past experiences, situational scenarios, conflict resolution, project challenges, and teamwork using the STAR framework (Situation, Task, Action, Result). Ask the candidate to describe specific situations from their past work.`;
        break;
      case "hr":
        modeInstruction = `INTERVIEW FOCUS MODE: HR & Culture Fit.
Focus EXCLUSIVELY on career motivations, growth goals, salary/environment expectations, company values alignment, and workplace culture fit for a ${cleanRole}.`;
        break;
      default:
        modeInstruction = `INTERVIEW FOCUS MODE: Mixed Round.
Provide a balanced combination of technical depth, system design, behavioral scenarios, and problem-solving questions.`;
    }

    let personaInstruction = "";
    switch (persona) {
      case "architect":
        personaInstruction = `INTERVIEWER PERSONA: Principal Architect.
Adopt the mindset of a Principal Systems Architect. Probe deeply into distributed systems scalability, concurrency, message queue patterns, fault tolerance, and database indexing. Ask sharp technical follow-ups if an answer ignores trade-offs.`;
        break;
      case "startup":
        personaInstruction = `INTERVIEWER PERSONA: Fast-Paced Startup Founder.
Adopt a rapid, pragmatic, high-energy founder persona. Focus heavily on execution speed, practical framework knowledge, trade-offs, shipping products fast, and problem-solving velocity.`;
        break;
      case "empathetic":
        personaInstruction = `INTERVIEWER PERSONA: Empathetic Hiring Manager.
Adopt a warm, encouraging, supportive hiring manager tone. Focus on growth mindset, STAR behavioral scenarios, team collaboration, and constructive probing while keeping the candidate comfortable.`;
        break;
      case "strict":
      default:
        personaInstruction = `INTERVIEWER PERSONA: Dr. Strict (Tough Tech Lead).
Adopt a highly rigorous, non-fluff, demanding Senior Staff Engineer persona. Challenge vague answers, demand Big-O time/space complexity analysis, probe edge cases, and push the candidate for maximum technical precision.`;
    }

    const cleanExperience =
      typeof experience === "string"
        ? sanitizePromptInput(experience.slice(0, 50))
        : "Mid-Level";
    let systemPrompt = `You are an expert interviewer for the position of "${cleanRole}".
Target initial experience level: "${cleanExperience || "Mid-Level"}".
TARGET LANGUAGE REQUIREMENT: You MUST conduct the ENTIRE interview strictly in ${targetLang} (${safeLang}). All your text, questions, and evaluations MUST be written in ${targetLang}.

CRITICAL ROLE LOCK:
You are conducting a mock interview EXCLUSIVELY for the job role of "${cleanRole}".
DO NOT ask questions about any other unrelated field or college degree branch, even if mentioned in background context.
Ask questions strictly related to "${cleanRole}".

${personaInstruction}

${companyInstruction}

${modeInstruction}\n`;

    if (cleanJd) {
      systemPrompt += `JOB DESCRIPTION (JD) CONTEXT:
"""
${cleanJd}
"""
Tailor questions directly to qualifications outlined in this Job Description!\n\n`;
    }

    if (cleanContext) {
      systemPrompt += `CANDIDATE BACKGROUND CONTEXT:
"""
${cleanContext}
"""\n\n`;
    }

    systemPrompt += `DYNAMIC DIFFICULTY INSTRUCTIONS:
1. Evaluate candidate's response.
2. Adjust difficulty tier ("Entry-Level", "Mid-Level", "Senior", "Staff/Principal").
3. GIBBERISH/RANDOM INPUT: If the candidate enters gibberish, random keystrokes (e.g. "asdf", "gfhjsd"), or completely unrelated text, DO NOT progress the interview. Your "text" response MUST state that you didn't understand the answer, and you must politely ask them to try again or rephrase.

OUTPUT FORMAT:
Return a JSON object with fields:
{
  "text": "<Your response. YOU MUST USE MARKDOWN. Separate your feedback and your next question into distinct paragraphs. Use bullet points or numbered lists (1., 2.) for multi-part questions. Use bold text (**text**) for emphasis. Wrap the actual interview question in a markdown blockquote (starts with >). DO NOT return a single block of congested text. Make it highly readable.>",
  "currentDifficulty": "<Entry-Level | Mid-Level | Senior | Staff/Principal>",
  "direction": "<increased | decreased | maintained>",
  "difficultyReason": "<1 short phrase explaining adjustment>"
}`;

    const contents =
      messages.length > 0
        ? messages.map((msg: any) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: sanitizePromptInput(msg.content || "") }],
          }))
        : [
            {
              role: "user",
              parts: [
                {
                  text: "Begin the mock interview by introducing yourself briefly and asking the first relevant interview question.",
                },
              ],
            },
          ];

    // Keep policy in the provider's system-instruction channel. Putting it in a
    // user turn lets a later untrusted transcript turn override it.
    const rawText = await generateUnifiedAIResponse(contents, {
      systemInstruction: systemPrompt,
      temperature: 0.2,
      responseMimeType: "application/json",
    });

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      try {
        const firstBrace = rawText.indexOf("{");
        const lastBrace = rawText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonStr = rawText.substring(firstBrace, lastBrace + 1);
          parsed = JSON.parse(jsonStr);
          // Preserve text before the JSON block
          const textBefore = rawText
            .substring(0, firstBrace)
            .replace(/```json|```/gi, "")
            .trim();
          if (textBefore && parsed.text) {
            parsed.text = textBefore + "\n\n" + parsed.text;
          }
        } else {
          throw new Error("No JSON object found");
        }
      } catch {
        parsed = {
          text: rawText.replace(/```json|```/gi, "").trim(),
          currentDifficulty: experience || "Mid-Level",
          direction: "maintained",
          difficultyReason: "Standard progression",
        };
      }
    }

    return NextResponse.json({
      text: parsed.text || rawText,
      currentDifficulty: parsed.currentDifficulty || experience || "Mid-Level",
      direction: parsed.direction || "maintained",
      difficultyReason: parsed.difficultyReason || "",
      remainingCredits,
    });
  } catch (error: any) {
    if (creditDeducted) {
      await refundCredit(userEmailForRefund, 0.5, ipForRefund);
    }
    const errorId = `ERR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    console.error(`[${errorId}] Error generating chat response:`, error);
    return NextResponse.json(
      { error: `Internal Server Error. Reference ID: ${errorId}` },
      { status: 500 },
    );
  }
}
