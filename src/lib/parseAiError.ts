export function parseAiError(error: any): string {
  if (!error) return 'Unable to generate AI response right now. Please try again in a few moments.';

  let msg = typeof error === 'string' ? error : error?.message || String(error);

  // If the error string is a raw JSON blob from Google GenAI SDK
  if (typeof msg === 'string' && msg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
    } catch {}
  }

  const lower = msg.toLowerCase();

  if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
    return 'The AI Mentor is currently experiencing high demand. Please try again in a few moments.';
  }

  if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('econnrefused')) {
    return 'Network connection issue. Please check your internet connection and try again.';
  }

  return 'Unable to generate AI response right now. Please try again shortly.';
}
