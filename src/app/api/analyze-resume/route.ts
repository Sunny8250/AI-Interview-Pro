import {
  sanitizePromptInput,
  validateExtractedText,
  validatePdfBuffer,
} from "@/lib/securitySanitizer";
import { getClientIp } from "@/lib/ipHelper";
import { NextResponse } from "next/server";
import PDFParser from "pdf2json";
import { generateUnifiedAIResponse } from "@/lib/multiAiProvider";
import { parseAiError } from "@/lib/parseAiError";
import { checkRateLimit } from "@/lib/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { checkAndDeductCredit, refundCredit } from "@/lib/creditGuard";
import crypto from "crypto";

const MAX_EXTRACTED_RESUME_CHARS = 60_000;

export async function POST(request: Request) {
  let creditDeducted = false;
  let userEmailForRefund: string | null = null;
  let ipForRefund = "guest";
  try {
    // Rate Limiting Check (Max 25 per minute per IP)
    const ip = getClientIp(request);
    const rateCheck = await checkRateLimit(`analyze_resume_${ip}`, 25, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. Please wait 1 minute before submitting another resume.",
        },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("resume") as File;
    const rawTargetRole = (formData.get("targetRole") as string) || "";
    if (rawTargetRole.length > 100) {
      return NextResponse.json(
        { error: "Target role is too long" },
        { status: 413 },
      );
    }
    const targetRole = sanitizePromptInput(rawTargetRole);

    if (!file) {
      return NextResponse.json(
        { error: "No resume file provided" },
        { status: 400 },
      );
    }

    // 1. Check size BEFORE buffering to prevent Memory Exhaustion (DoS)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit." },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 2. PDF Security & Magic Bytes Validation
    const pdfCheck = validatePdfBuffer(buffer);
    if (!pdfCheck.valid) {
      return NextResponse.json({ error: pdfCheck.error }, { status: 400 });
    }

    // 3. Deduct Credits AFTER successful validation (Bug #14 Fix)
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const creditCheck = await checkAndDeductCredit(userEmail, 1.0, ip);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error:
            creditCheck.error || "Insufficient AI Credits to analyze resume.",
          code: "OUT_OF_CREDITS",
        },
        { status: 402 },
      );
    }
    creditDeducted = true;
    userEmailForRefund = userEmail ?? null;
    ipForRefund = ip;

    const resumeText = await new Promise<string>((resolve) => {
      const pdfParser = new PDFParser(null, true as any);

      pdfParser.on("pdfParser_dataError", (errData: any) => {
        resolve(
          `Error parsing PDF: ${errData?.parserError || "Unknown error"}`,
        );
      });

      pdfParser.on("pdfParser_dataReady", () => {
        try {
          const raw = pdfParser.getRawTextContent();
          // Fix regex: include lowercase hex a-f (original missed these)
          const safeRaw = raw.replace(/%(?![0-9A-Fa-f]{2})/g, "%25");
          try {
            resolve(decodeURIComponent(safeRaw));
          } catch {
            // decodeURIComponent threw URIError on malformed UTF-8 sequences (e.g. %C3%28)
            // Fall back to the unmodified raw text to avoid crashing the handler
            resolve(raw);
          }
        } catch {
          resolve(pdfParser.getRawTextContent());
        }
      });

      try {
        pdfParser.parseBuffer(buffer);
      } catch {
        resolve(buffer.toString("utf-8", 0, 15000));
      }
    });

    if (
      resumeText.startsWith("Error parsing PDF:") ||
      resumeText.length > MAX_EXTRACTED_RESUME_CHARS
    ) {
      await refundCredit(userEmailForRefund, 1.0, ipForRefund);
      creditDeducted = false;
      return NextResponse.json(
        {
          error: resumeText.startsWith("Error parsing PDF:")
            ? "Unable to parse this PDF safely."
            : "Extracted resume text exceeds the 60,000-character limit.",
        },
        { status: resumeText.startsWith("Error parsing PDF:") ? 400 : 413 },
      );
    }

    const cleanText = sanitizePromptInput(
      resumeText
        .replace(/----------------Page \(\d+\) Break----------------/gi, "\n")
        .replace(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          "[EMAIL REDACTED]",
        )
        .replace(
          /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
          "[PHONE REDACTED]",
        )
        .replace(/\s+/g, " "),
    );

    if (!cleanText || cleanText.length < 30) {
      await refundCredit(userEmailForRefund, 1.0, ipForRefund);
      creditDeducted = false;
      return NextResponse.json(
        { error: "Could not extract sufficient text from PDF" },
        { status: 400 },
      );
    }

    const prompt = `You are an expert technical recruiter and AI interviewer.
Analyze the following candidate resume text to identify their primary SOFTWARE DEVELOPMENT skills, programming languages, and technical experience.

${targetRole ? `TARGET ROLE SPECIFIED BY CANDIDATE: "${targetRole}"` : ""}

CRITICAL ROLE RESOLUTION RULES:
1. Look for programming languages (Java, Python, C++, C#, JS/TS), frameworks (Spring Boot, Hibernate, React, Node, Express, Angular), databases (SQL, MongoDB), and software projects.
2. IF Java, Spring, J2EE, Hibernate, REST APIs, or SQL are found, the recommendedRole MUST BE "Java Developer" or "Software Engineer".
3. DO NOT output support, hardware, or university degree titles (such as "IT Support Associate", "Instrumentation Engineer", "Network Technician", "Helpdesk Tech", or "Trainee") if software development or coding skills/projects exist on the resume.
4. Default to "Java Developer" or "Software Engineer" whenever software development skills or projects are present.

Return ONLY a raw JSON object with no markdown formatting:
{
  "summary": "1-2 sentence summary of candidate's technical profile",
  "recommendedRole": "${targetRole || "Java Developer"}",
  "experienceLevel": "Entry-Level | Mid-Level | Senior | Staff/Principal",
  "detectedSkills": ["Java", "Spring Boot", "MySQL", "REST APIs"],
  "interviewContext": "2-3 sentences summarizing candidate's software technical background, key projects, and specific software topics to probe in the mock interview."
}

Resume Text:
${cleanText.substring(0, 10000)}
`;

    const textHash = crypto
      .createHash("sha256")
      .update(cleanText + targetRole)
      .digest("hex");
    const cacheKey = `resume_${textHash}`;

    const rawText = await generateUnifiedAIResponse(prompt, {
      cacheKey,
    });

    const cleanJson = rawText
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    let result;
    try {
      result = JSON.parse(cleanJson);
    } catch {
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Invalid JSON format returned by AI model");
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (creditDeducted) {
      await refundCredit(userEmailForRefund, 1.0, ipForRefund);
    }
    console.error("Error analyzing resume:", error);
    return NextResponse.json({ error: parseAiError(error) }, { status: 500 });
  }
}
