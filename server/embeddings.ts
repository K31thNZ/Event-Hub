// server/embeddings.ts
// Generates vector embeddings using Google Gemini's text-embedding-004 model.
// Requires GOOGLE_API environment variable with a valid Gemini API key.

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_API;
if (!API_KEY) {
  console.warn("[embeddings] GOOGLE_API not set – embeddings will return empty arrays");
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Gemini's latest embedding model (768 dimensions, free tier available)
const EMBEDDING_MODEL = "text-embedding-004";

/**
 * Convert a piece of text into a vector embedding.
 * Returns an empty array if embedding fails or no API key is configured.
 */
export async function embedText(text: string): Promise<number[]> {
  if (!text?.trim() || !genAI) return [];

  try {
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text.slice(0, 2048)); // model’s max input tokens
    const values = result.embedding?.values ?? [];

    if (values.length === 0) {
      console.warn("[embeddings] Gemini returned empty embedding");
    }

    return values;
  } catch (err) {
    console.error("[embeddings] Gemini embedding failed:", err);
    return [];   // graceful degradation – event is created without vector
  }
}

/**
 * Generate embeddings for multiple texts in parallel.
 * Useful when backfilling existing events.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  // Gemini doesn't have a batch endpoint for free tier, so we process sequentially
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedText(text));
    // Small delay to avoid hitting rate limits (1500 requests per minute for free tier)
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
}
