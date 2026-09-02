import { NextResponse } from "next/server";
import { generateUnifiedAIResponse } from "@/lib/multiAiProvider";
import pdfParse from "pdf-parse";
import { connectToDatabase } from "@/lib/mongodb";
import QuestionBank from "@/models/QuestionBank";
import {
  validatePdfBuffer,
  sanitizePromptInput,
} from "@/lib/securitySanitizer";
  validateExtractedText,
import crypto from "crypto";
import { requireAdmin } from "@/lib/authorization";

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const rawCategory = (formData.get("category") as string) || "General";

    // M-04 Fix: Sanitize category before embedding in AI prompt to prevent prompt injection
    const category = sanitizePromptInput(rawCategory.substring(0, 100));

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // File size limit: 5MB to prevent DoS (OOM)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit." },
        { status: 413 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    let extractedText = "";

    // If it's a PDF, parse it with pdf-parse
    if (file.type === "application/pdf") {
      const validation = validatePdfBuffer(buffer);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if (file.type === "text/plain") {
      extractedText = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Only PDF and TXT are supported." },
        { status: 400 },
      );
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "Document appears to be empty or unreadable." },
        { status: 400 },
      );
    }

    const extractedTextCheck = validateExtractedText(extractedText, 500_000);
    if (!extractedTextCheck.valid) {
      return NextResponse.json({ error: extractedTextCheck.error }, { status: 413 });
    }

    const CHUNK_SIZE = 12000; // About 2,000 to 2,500 words per chunk
    const chunks: string[] = [];
    let currentIdx = 0;

    // Split text into chunks
    while (currentIdx < extractedText.length) {
      chunks.push(extractedText.substring(currentIdx, currentIdx + CHUNK_SIZE));
      currentIdx += CHUNK_SIZE;
    }

    let allParsedQuestions: any[] = [];
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
      const chunkText = chunks[i];

      const prompt = `You are an expert technical interviewer and document parser. 
I am going to provide you with text extracted from a section of a document. 
Your task is to extract all interview questions from the text. 
If an answer is provided for a question in the text, improve the answer to make it a perfect, comprehensive interview answer.
If no answer is provided for a question in the text, you must generate the best possible answer yourself.

The category for these questions is: ${category}

Respond strictly with a JSON array of objects, where each object has four keys:
- "question": The interview question.
- "answer": The improved or generated comprehensive answer.
- "category": The category string provided above.
- "difficulty": Estimate the difficulty level of this question. Must be one of exactly: "Entry", "Mid", or "Senior".

Do not wrap the JSON in markdown code blocks. Just output the raw JSON array.

DOCUMENT TEXT:
=================
${chunkText}
=================
`;

      try {
        const aiResponse = await generateUnifiedAIResponse(prompt, {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        });

        if (!aiResponse) {
          console.warn(`AI failed to generate content for chunk ${i + 1}`);
          continue;
        }

        let parsedQuestions = [];
        let cleanJson = aiResponse
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        try {
          parsedQuestions = JSON.parse(cleanJson);
        } catch (parseError) {
          console.warn(
            `Failed to parse AI JSON natively for chunk ${i + 1}. Attempting to repair...`,
          );
          const lastBraceIndex = cleanJson.lastIndexOf("}");
          if (lastBraceIndex !== -1) {
            const repairedJson =
              cleanJson.substring(0, lastBraceIndex + 1) + "]";
            try {
              parsedQuestions = JSON.parse(repairedJson);
              console.log(
                `Successfully recovered ${parsedQuestions.length} questions from truncated JSON.`,
              );
            } catch (repairError) {
              console.error(`Failed to repair JSON for chunk ${i + 1}`);
            }
          }
        }

        if (Array.isArray(parsedQuestions)) {
          allParsedQuestions.push(...parsedQuestions);
        }

        // Rate limit protection: Wait 5 seconds between chunks (except the last one)
        if (i < chunks.length - 1) {
          await delay(5000);
        }
      } catch (chunkError) {
        console.error(`Error processing chunk ${i + 1}:`, chunkError);
        // Continue to next chunk even if one fails
      }
    }

    if (allParsedQuestions.length === 0) {
      return NextResponse.json(
        { error: "Failed to extract any questions from the document." },
        { status: 500 },
      );
    }

    // Deduplicate against existing questions in the database
    await connectToDatabase();
    const existingQuestions = await QuestionBank.find({}, { question: 1 });
    const existingTexts = new Set(
      existingQuestions.map((q) => q.question.toLowerCase().trim()),
    );

    const uniqueQuestions = allParsedQuestions.filter((q: any) => {
      const qText = (q.question || "").toLowerCase().trim();
      return !existingTexts.has(qText);
    });

    return NextResponse.json({ questions: uniqueQuestions });
  } catch (error: any) {
    const errorId = `ERR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    console.error(`[${errorId}] Error processing document upload:`, error);
    return NextResponse.json(
      { error: `Internal Server Error. Reference: ${errorId}` },
      { status: 500 },
    );
  }
}
