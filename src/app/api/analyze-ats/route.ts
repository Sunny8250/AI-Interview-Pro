import { getClientIp } from "@/lib/ipHelper";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PDFParser from "pdf2json";
import { generateUnifiedAIResponse } from "@/lib/multiAiProvider";
import { parseAiError } from "@/lib/parseAiError";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  sanitizePromptInput,
  validatePdfBuffer,
} from "@/lib/securitySanitizer";
import { checkAndDeductCredit, refundCredit } from "@/lib/creditGuard";
import crypto from "crypto";

const MAX_EXTRACTED_RESUME_CHARS = 60_000;

export async function POST(request: Request) {
  let creditDeducted = false;
  let userEmailForRefund: string | null = null;
  let ipForRefund = "guest";
  try {
    // 1. Rate Limiting Check
    const ip = getClientIp(request);
    const rateCheck = await checkRateLimit(`analyze_ats_${ip}`, 25, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. Please wait 1 minute before submitting another ATS audit.",
        },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("resume") as File;
    const rawJdText = (formData.get("jd") as string) || "";
    if (rawJdText.length > 10_000) {
      return NextResponse.json({ error: "Job description exceeds the 10,000-character limit" }, { status: 413 });
    }
    const jdText = sanitizePromptInput(rawJdText);

    if (!file || !jdText) {
      return NextResponse.json(
        { error: "Both resume PDF and Job Description are required" },
        { status: 400 },
      );
    }

    // HIGH-02 Fix: Check size BEFORE buffering to prevent Memory Exhaustion (DoS)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit." },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 3. PDF Security & Magic Bytes Validation
    const pdfCheck = validatePdfBuffer(buffer);
    if (!pdfCheck.valid) {
      return NextResponse.json({ error: pdfCheck.error }, { status: 400 });
    }

    // 4. Credit Guard Check AFTER file validation (Bug #14 Fix)
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    const creditCheck = await checkAndDeductCredit(userEmail, 2.0, ip);

    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error:
            creditCheck.error ||
            "Insufficient AI credits (2.0 Credits required for ATS Resume Audit). Upgrade to Pro for unlimited audits!",
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
      pdfParser.on("pdfParser_dataError", (errData: any) =>
        resolve(
          `Error parsing PDF: ${errData?.parserError || "Unknown error"}`,
        ),
      );
      pdfParser.on("pdfParser_dataReady", () => {
        try {
          const raw = pdfParser.getRawTextContent();
          // Fix regex: include lowercase hex a-f
          const safeRaw = raw.replace(/%(?![0-9A-Fa-f]{2})/g, "%25");
          try {
            resolve(decodeURIComponent(safeRaw));
          } catch {
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

    if (resumeText.startsWith("Error parsing PDF:") || resumeText.length > MAX_EXTRACTED_RESUME_CHARS) {
      await refundCredit(userEmailForRefund, 2.0, ipForRefund);
      creditDeducted = false;
      return NextResponse.json(
        { error: resumeText.startsWith("Error parsing PDF:") ? "Unable to parse this PDF safely." : "Extracted resume text exceeds the 60,000-character limit." },
        { status: resumeText.startsWith("Error parsing PDF:") ? 400 : 413 },
      );
    }

    const cleanResumeText = sanitizePromptInput(
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

    if (cleanResumeText.length < 30) {
      await refundCredit(userEmailForRefund, 2.0, ipForRefund);
      creditDeducted = false;
      return NextResponse.json({ error: "Could not extract sufficient text from PDF" }, { status: 400 });
    }

    const prompt = `You are an expert ATS (Applicant Tracking System) resume auditor.
Compare the candidate's resume text against the Job Description (JD) below and calculate a detailed ATS Match Score.

JOB DESCRIPTION:
"""
${jdText.substring(0, 5000)}
"""

RESUME TEXT:
"""
${cleanResumeText.substring(0, 8000)}
"""

Return ONLY a raw JSON object with no markdown formatting:
{
  "atsScore": 85,
  "matchRating": "Strong Match | Moderate Match | Low Match",
  "matchingKeywords": ["Python", "SQL", "REST APIs", "AWS"],
  "missingKeywords": ["Docker", "Kubernetes", "Redis"],
  "recommendations": [
    "Highlight experience with container orchestration tools like Docker and Kubernetes.",
    "Mention specific performance optimization metrics for SQL queries.",
    "Add explicit achievements detailing microservices scaling."
  ]
}`;

    const atsHash = crypto
      .createHash("sha256")
      .update(jdText + cleanResumeText)
      .digest("hex");
    const cacheKey = `ats_${atsHash}`;

    try {
      const rawText = await generateUnifiedAIResponse(prompt, {
        temperature: 0.2,
        cacheKey,
      });

      const cleanJson = rawText
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();
      const result = JSON.parse(cleanJson);

      if (result && typeof result.atsScore === "number") {
        return NextResponse.json({
          ...result,
          remainingCredits: creditCheck.remainingCredits,
        });
      }
    } catch (aiErr) {
      // A successful algorithmic fallback is still a completed paid analysis.
      // Do not refund here, otherwise malformed model output bypasses credits.
      console.warn(
        "AI ATS analysis failed, executing algorithmic keyword audit:",
        aiErr,
      );
    }

    // Algorithmic ATS Match Fallback
    const cleanJd = jdText.toLowerCase();
    const cleanResume = cleanResumeText.toLowerCase();

    // Extract alphabetic words from JD dynamically, prioritizing capitalized or typical tech terms
    const rawJdWords = cleanJd.match(/[a-z0-9#\+\-\.]{2,}/g) || [];
    // Basic stop words to filter out
    const stopWords = new Set([
      "and",
      "the",
      "for",
      "with",
      "experience",
      "years",
      "team",
      "work",
      "development",
      "strong",
      "ability",
      "skills",
      "software",
      "knowledge",
      "understanding",
      "working",
      "using",
      "including",
      "such",
      "other",
      "related",
    ]);

    const uniqueJdKeywords = Array.from(new Set(rawJdWords)).filter(
      (kw) => !stopWords.has(kw),
    );

    // Fallback to techCatalog if extraction yields too little
    let jdKeywords = uniqueJdKeywords;
    if (jdKeywords.length < 5) {
      const techCatalog = [
        "python",
        "java",
        "javascript",
        "typescript",
        "c#",
        "c++",
        "sql",
        "nosql",
        "react",
        "node",
        "express",
        "next.js",
        "angular",
        "vue",
        "spring boot",
        "django",
        "flask",
        "aws",
        "azure",
        "gcp",
        "docker",
        "kubernetes",
        "rest api",
        "graphql",
        "mongodb",
        "postgresql",
        "mysql",
        "oracle",
        "pyspark",
        "databricks",
        "kafka",
        "redis",
        "microservices",
        "ci/cd",
        "git",
      ];
      jdKeywords = techCatalog.filter((kw) => cleanJd.includes(kw));
    }

    const matchingKeywords = jdKeywords.filter((kw) =>
      cleanResume.includes(kw),
    );
    const missingKeywords = jdKeywords.filter(
      (kw) => !cleanResume.includes(kw),
    );

    const totalJdKws = Math.max(1, jdKeywords.length);
    const scorePct = Math.min(
      95,
      Math.max(50, Math.round((matchingKeywords.length / totalJdKws) * 100)),
    );

    const fallbackResult = {
      atsScore: scorePct,
      matchRating:
        scorePct >= 75
          ? "Strong Match"
          : scorePct >= 50
            ? "Moderate Match"
            : "Low Match",
      matchingKeywords: matchingKeywords.map((k) => k.toUpperCase()),
      missingKeywords: missingKeywords.map((k) => k.toUpperCase()),
      recommendations: [
        `Incorporate missing JD keywords like ${missingKeywords
          .slice(0, 3)
          .map((k) => k.toUpperCase())
          .join(", ")} into your resume skills section.`,
        "Ensure key framework titles and project responsibilities match the JD terminology.",
        "Add quantifiable production metrics (e.g. % performance increase, latency reduced).",
      ],
      remainingCredits: creditCheck.remainingCredits,
    };

    return NextResponse.json(fallbackResult);
  } catch (error: any) {
    if (creditDeducted) {
      await refundCredit(userEmailForRefund, 2.0, ipForRefund);
    }
    console.error("Error analyzing ATS match:", error);
    return NextResponse.json({ error: parseAiError(error) }, { status: 500 });
  }
}
