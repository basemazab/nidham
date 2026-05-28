import { createHash } from "node:crypto";

export type EmbeddingProvider = "gemini" | "groq";

/**
 * Generate an embedding vector for the given text using the configured provider.
 * Currently uses Gemini's embedding model via the Google AI API directly.
 */
export async function generateEmbedding(
  text: string,
  provider: EmbeddingProvider = "gemini",
): Promise<number[]> {
  switch (provider) {
    case "gemini":
      return generateGeminiEmbedding(text);
    default:
      return generateGeminiEmbedding(text);
  }
}

async function generateGeminiEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for embeddings");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text }] },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.embedding?.values as number[];
}

/**
 * Chunk text into smaller pieces for embedding.
 * Uses sentence boundary detection where possible.
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 500,
  overlap: number = 50,
): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      // Keep last `overlap` characters for overlap
      current = current.slice(-overlap) + sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Create a deterministic conversation ID from user + company context.
 */
export function makeConversationTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\s+/g, " ").trim();
  return cleaned.length > 60 ? cleaned.slice(0, 60) + "..." : cleaned;
}
