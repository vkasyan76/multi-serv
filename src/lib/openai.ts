import "server-only";

import OpenAI from "openai";

let cachedOpenAI: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  cachedOpenAI ??= new OpenAI({
    apiKey,
    timeout: 20_000,
    maxRetries: 1,
  });

  return cachedOpenAI;
}
