export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const requiredEnvVars = ["MONGODB_URI", "NEXTAUTH_SECRET", "NEXTAUTH_URL"];

    const missing = requiredEnvVars.filter((v) => !process.env[v]);

    const hasAiProvider = [
      process.env.GEMINI_API_KEYS,
      process.env.GEMINI_API_KEY,
      process.env.OPENAI_API_KEYS,
      process.env.OPENAI_API_KEY,
      process.env.GROQ_API_KEYS,
      process.env.GROQ_API_KEY,
      process.env.GROK_API_KEYS,
      process.env.GROK_API_KEY,
      process.env.XAI_API_KEY,
    ].some((value) => value?.split(",").some((key) => key.trim().length > 0));

    if (!hasAiProvider) {
      missing.push(
        "at least one AI provider key (Gemini, OpenAI, Groq, or Grok)",
      );
    }

    if (missing.length > 0) {
      console.error(
        `\n[FATAL ERROR] The application cannot start. Missing critical environment variables:\n` +
          missing.map((v) => `- ${v}`).join("\n") +
          `\n\nPlease set these in your .env.local file or deployment environment.\n`,
      );
      process.exit(1);
    }
  }
}
