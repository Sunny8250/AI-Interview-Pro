import { GoogleGenAI } from "@google/genai";

// Strategy 1: Multi-API Key Rotation Pool
function getApiKeyPool(): string[] {
  const keysStr =
    process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const keys = keysStr
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return keys.length > 0 ? keys : [];
}

// Initialize with a random offset to prevent serverless cold starts from hammering the first key
let currentKeyIndex = Math.floor(Math.random() * 1000);

export function getRotatedGenAIClient(): {
  ai: GoogleGenAI;
  apiKey: string;
} | null {
  const keys = getApiKeyPool();
  if (keys.length === 0) return null;

  const selectedKey = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;

  return {
    ai: new GoogleGenAI({ apiKey: selectedKey }),
    apiKey: selectedKey,
  };
}

import { connectToDatabase } from "./mongodb";
import mongoose from "mongoose";

// Strategy 3: Persistent MongoDB Response Caching (24h TTL)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getCachedAiResponse(key: string): Promise<any | null> {
  if (!process.env.MONGODB_URI) return null;
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return null;

    const cached = await db.collection("aicache").findOne({ key });
    if (!cached) return null;

    if (Date.now() - new Date(cached.timestamp).getTime() > CACHE_TTL_MS) {
      await db.collection("aicache").deleteOne({ key });
      return null;
    }
    return cached.result;
  } catch (err) {
    console.warn("AI Cache read error:", err);
    return null;
  }
}

export async function setCachedAiResponse(
  key: string,
  result: any,
): Promise<void> {
  if (!process.env.MONGODB_URI) return;

  // MED-05 Fix: Enforce a per-entry size limit to prevent large AI responses
  // from bloating the aicache collection and causing storage issues.
  const MAX_CACHE_ENTRY_BYTES = 50 * 1024; // 50KB per cached response
  if (
    typeof result === "string" &&
    Buffer.byteLength(result, "utf8") > MAX_CACHE_ENTRY_BYTES
  ) {
    console.warn(
      `[AI Cache] Skipping cache write: response too large (>${MAX_CACHE_ENTRY_BYTES} bytes) for key: ${key.substring(0, 40)}`,
    );
    return;
  }

  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return;

    await db.collection("aicache").updateOne(
      { key },
      // TTL indexes only expire BSON Date values, not numeric epoch timestamps.
      { $set: { result, timestamp: new Date() } },
      { upsert: true },
    );
  } catch (err) {
    console.warn("AI Cache write error:", err);
  }
}

// Strategy 4: Exponential Backoff & Smart Retries across Keys & Models
export async function generateContentWithRetry(
  promptOrContents: any,
  options: {
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    maxOutputTokens?: number;
    cacheKey?: string;
  } = {},
): Promise<string> {
  // Check cache first
  if (options.cacheKey) {
    const cached = await getCachedAiResponse(options.cacheKey);
    if (cached) return cached;
  }

  const keys = getApiKeyPool();
  if (keys.length === 0) {
    throw new Error("🔑 GEMINI_API_KEY is missing in .env.local");
  }

  // Gemini 1.5 models were retired in 2025. Keep the stable current model
  // first, then use lower-cost and newer fallbacks for availability.
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
  ];
  let lastError: any = null;

  // Multi-key + Multi-model retry loop
  for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt++) {
    const clientObj = getRotatedGenAIClient();
    if (!clientObj) break;

    for (const modelName of modelsToTry) {
      try {
        const reqConfig: any = {};
        if (options.temperature !== undefined)
          reqConfig.temperature = options.temperature;
        if (options.responseMimeType)
          reqConfig.responseMimeType = options.responseMimeType;
        if (options.maxOutputTokens)
          reqConfig.maxOutputTokens = options.maxOutputTokens;
        if (options.systemInstruction)
          reqConfig.systemInstruction = options.systemInstruction;

        const response = await clientObj.ai.models.generateContent({
          model: modelName,
          contents: promptOrContents,
          config: Object.keys(reqConfig).length > 0 ? reqConfig : undefined,
        });

        const resultText = response.text?.trim();
        if (resultText) {
          if (options.cacheKey) {
            await setCachedAiResponse(options.cacheKey, resultText);
          }
          return resultText;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(
          `Model ${modelName} failed on key attempt ${keyAttempt + 1}:`,
          err?.message || err,
        );
        const errStr = String(err?.message || err).toLowerCase();

        // Exponential backoff delay on rate limits (1s -> 2s)
        if (
          errStr.includes("429") ||
          errStr.includes("quota") ||
          errStr.includes("resource_exhausted")
        ) {
          const backoffMs = (keyAttempt + 1) * 1000;
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }
  }

  throw lastError || new Error("All AI model attempts failed.");
}

export async function generateContentStreamWithRetry(
  promptOrContents: any,
  options: {
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    maxOutputTokens?: number;
    cacheKey?: string;
  } = {},
  onChunk: (chunk: string) => void,
): Promise<string> {
  if (options.cacheKey) {
    const cached = await getCachedAiResponse(options.cacheKey);
    if (cached) {
      onChunk(cached);
      return cached;
    }
  }

  const keys = getApiKeyPool();
  if (keys.length === 0) throw new Error("No Gemini API key configured");

  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
  ];
  let lastError: any = null;

  for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt++) {
    const clientObj = getRotatedGenAIClient();
    if (!clientObj) break;

    for (const modelName of modelsToTry) {
      try {
        const reqConfig: any = {};
        if (options.temperature !== undefined)
          reqConfig.temperature = options.temperature;
        if (options.responseMimeType)
          reqConfig.responseMimeType = options.responseMimeType;
        if (options.maxOutputTokens)
          reqConfig.maxOutputTokens = options.maxOutputTokens;
        if (options.systemInstruction)
          reqConfig.systemInstruction = options.systemInstruction;

        const responseStream = await clientObj.ai.models.generateContentStream({
          model: modelName,
          contents: promptOrContents,
          config: Object.keys(reqConfig).length > 0 ? reqConfig : undefined,
        });
        let result = "";
        for await (const chunk of responseStream as any) {
          const text = chunk.text || "";
          if (text) {
            result += text;
            onChunk(text);
          }
        }
        if (result) {
          if (options.cacheKey)
            await setCachedAiResponse(options.cacheKey, result);
          return result;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(
          `Streaming model ${modelName} failed on key attempt ${keyAttempt + 1}:`,
          err?.message || err,
        );
      }
    }
  }

  throw lastError || new Error("All streaming AI model attempts failed.");
}
