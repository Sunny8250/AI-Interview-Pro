import {
  generateContentStreamWithRetry,
  generateContentWithRetry,
} from "./gemini";

interface AIOptions {
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: string;
  maxOutputTokens?: number;
  cacheKey?: string;
}

// Key pool helper for multi-key rotation
function parseKeys(envStr: string | undefined): string[] {
  if (!envStr) return [];
  return envStr
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

// Key rotation uses a random start index per request to avoid non-atomic shared state
// across concurrent serverless invocations (module-level variables are NOT thread-safe here).

// 1. OpenAI Chat Completion Fallback (supports key pool rotation)
async function callOpenAI(
  messages: any[],
  options: AIOptions = {},
): Promise<string | null> {
  const keys = parseKeys(
    process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY,
  );
  if (keys.length === 0) return null;

  const formattedMessages: any[] = [];
  if (options.systemInstruction) {
    formattedMessages.push({
      role: "system",
      content: options.systemInstruction,
    });
  }

  messages.forEach((m: any) => {
    if (typeof m === "string") {
      formattedMessages.push({ role: "user", content: m });
    } else if (m.parts && m.parts[0]?.text) {
      formattedMessages.push({
        role:
          m.role === "model"
            ? "assistant"
            : m.role === "system"
              ? "system"
              : "user",
        content: m.parts[0].text,
      });
    } else if (m.content) {
      formattedMessages.push({
        role:
          m.role === "ai" || m.role === "assistant" || m.role === "model"
            ? "assistant"
            : "user",
        content: m.content,
      });
    }
  });

  const bodyObj: any = {
    model: "gpt-4o-mini",
    messages: formattedMessages,
    temperature: options.temperature ?? 0.2,
  };
  if (options.maxOutputTokens) bodyObj.max_tokens = options.maxOutputTokens;

  if (options.responseMimeType === "application/json") {
    bodyObj.response_format = { type: "json_object" };
  }

  // Random starting key per request — avoids non-atomic shared counter across concurrent calls
  const startIndex = Math.floor(Math.random() * keys.length);
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const apiKey = keys[(startIndex + attempt) % keys.length];

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyObj),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn(`OpenAI key attempt ${attempt + 1} failed:`, errJson);
      }
    } catch (err) {
      console.warn(`OpenAI fetch error (key ${attempt + 1}):`, err);
    }
  }

  return null;
}

// 2. Groq / xAI Grok Chat Completion Fallback (supports key pool rotation & Groq / xAI endpoints)
async function callGrokOrGroq(
  messages: any[],
  options: AIOptions = {},
): Promise<string | null> {
  const groqKeys = parseKeys(
    process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY,
  );
  const grokKeys = parseKeys(
    process.env.GROK_API_KEYS ||
      process.env.GROK_API_KEY ||
      process.env.XAI_API_KEY,
  );

  const isGroq = groqKeys.length > 0;
  const keys = isGroq ? groqKeys : grokKeys;

  if (keys.length === 0) return null;

  const endpoint = isGroq
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.x.ai/v1/chat/completions";

  const model = isGroq ? "llama-3.3-70b-versatile" : "grok-2-latest";

  const formattedMessages: any[] = [];
  if (options.systemInstruction) {
    formattedMessages.push({
      role: "system",
      content: options.systemInstruction,
    });
  }

  messages.forEach((m: any) => {
    if (typeof m === "string") {
      formattedMessages.push({ role: "user", content: m });
    } else if (m.parts && m.parts[0]?.text) {
      formattedMessages.push({
        role:
          m.role === "model"
            ? "assistant"
            : m.role === "system"
              ? "system"
              : "user",
        content: m.parts[0].text,
      });
    } else if (m.content) {
      formattedMessages.push({
        role:
          m.role === "ai" || m.role === "assistant" || m.role === "model"
            ? "assistant"
            : "user",
        content: m.content,
      });
    }
  });

  // Random starting key per request — avoids non-atomic shared counter across concurrent calls
  const grokStartIndex = Math.floor(Math.random() * keys.length);
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const apiKey = keys[(grokStartIndex + attempt) % keys.length];

    try {
      const grokBodyObj: any = {
        model,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.2,
      };
      if (options.maxOutputTokens)
        grokBodyObj.max_tokens = options.maxOutputTokens;
      if (options.responseMimeType === "application/json") {
        grokBodyObj.response_format = { type: "json_object" };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(grokBodyObj),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn(`Groq/Grok key attempt ${attempt + 1} failed:`, errJson);
      }
    } catch (err) {
      console.warn(`Groq/Grok fetch error (key ${attempt + 1}):`, err);
    }
  }

  return null;
}

// 3. Unified Multi-Provider Orchestrator (Gemini ➔ OpenAI ➔ Groq / Grok)
export async function generateUnifiedAIResponse(
  promptOrMessages: any,
  options: AIOptions = {},
): Promise<string> {
  const messages =
    typeof promptOrMessages === "string"
      ? [{ role: "user", parts: [{ text: promptOrMessages }] }]
      : promptOrMessages;

  // STEP 1: Primary - Google Gemini (Multi-Key Rotation + Caching + Backoff)
  try {
    const result = await generateContentWithRetry(messages, options);
    if (result) return result;
  } catch (geminiErr: any) {
    console.warn(
      "Gemini Provider exhausted/failed, trying OpenAI fallback...",
      geminiErr?.message || geminiErr,
    );
  }

  // STEP 2: Secondary - OpenAI (Multi-Key Rotation)
  const openAiResult = await callOpenAI(messages, options);
  if (openAiResult) return openAiResult;

  // STEP 3: Tertiary - Groq / xAI Grok (Multi-Key Rotation)
  const grokResult = await callGrokOrGroq(messages, options);
  if (grokResult) return grokResult;

  throw new Error(
    "All AI providers (Gemini, OpenAI, Groq/Grok) failed to return a response.",
  );
}

export async function generateUnifiedAIResponseStream(
  promptOrMessages: any,
  options: AIOptions = {},
  onChunk: (chunk: string) => void,
): Promise<string> {
  const messages =
    typeof promptOrMessages === "string"
      ? [{ role: "user", parts: [{ text: promptOrMessages }] }]
      : promptOrMessages;

  try {
    const result = await generateContentStreamWithRetry(
      messages,
      options,
      onChunk,
    );
    if (result) return result;
  } catch (geminiErr: any) {
    console.warn(
      "Gemini streaming exhausted/failed, trying fallback provider...",
      geminiErr?.message || geminiErr,
    );
  }

  const fallbackResult = await generateUnifiedAIResponse(messages, options);
  for (let index = 0; index < fallbackResult.length; index += 32) {
    onChunk(fallbackResult.slice(index, index + 32));
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
  return fallbackResult;
}
