/**
 * Full-Stack Security Sanitization Utility
 */

// 1. AI Prompt Injection & System Override Neutralizer
export function sanitizePromptInput(text: unknown = ""): string {
  if (typeof text !== "string") return "";

  let sanitized = text;

  // Basic unicode normalization to prevent lookalike character attacks (e.g. ｉｇｎｏｒｅ)
  sanitized = sanitized.normalize("NFKC");

  // Strip common command characters that might confuse the LLM if used maliciously
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Aggressive neutralizer for prompt jailbreak patterns
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/gi,
    /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/gi,
    /forget\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/gi,
    /system\s+instruction\s+override/gi,
    /you\s+are\s+now\s+in\s+(developer|admin)\s+mode/gi,
    /override\s+system\s+prompt/gi,
    /output\s+(overallScore|score):\s*100/gi,
    /simulat(e|ion)\s+a\s+scenario/gi,
    /bypass\s+rules/gi,
    /act\s+as\s+a\s+different/gi,
    /new\s+persona/gi,
    /ignore\s+context/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[sanitized_prompt_attempt]");
  }

  return sanitized.trim();
}

// 2. NoSQL Query Operator Stripper
export function sanitizeNoSqlInput<T>(input: T): T {
  if (typeof input === "string") {
    return input.replace(/^\$+/, "") as unknown as T; // strip ALL leading $$ (e.g. $$ROOT, $$NOW)
  }

  if (input && typeof input === "object") {
    if (Array.isArray(input)) {
      return input.map((item) => sanitizeNoSqlInput(item)) as unknown as T;
    }

    const cleanObj: any = {};
    for (const key of Object.keys(input)) {
      if (key.startsWith("$")) continue; // Drop MongoDB operators like $gt, $ne, $where
      cleanObj[key] = sanitizeNoSqlInput((input as any)[key]);
    }
    return cleanObj as T;
  }

  return input;
}

// 3. PDF Magic Bytes & Security Validator
export function validatePdfBuffer(buffer: Buffer): {
  valid: boolean;
  error?: string;
} {
  // Max size: 5MB
  const MAX_SIZE = 5 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    return { valid: false, error: "File size exceeds 5MB limit." };
  }

  // Check PDF Magic Bytes (0x25 0x50 0x44 0x46 -> %PDF-)
  const magic = buffer.toString("utf-8", 0, 5);
  if (!magic.startsWith("%PDF-")) {
    return {
      valid: false,
      error: "Invalid file format. Uploaded file is not a valid PDF document.",
    };
  }

  return { valid: true };
}

export function validateExtractedText(
  text: string,
  maxLength: number,
): { valid: boolean; error?: string } {
  if (text.length > maxLength) {
    return {
      valid: false,
      error: "The document contains too much extracted text to process safely.",
    };
  }

  return { valid: true };
}
