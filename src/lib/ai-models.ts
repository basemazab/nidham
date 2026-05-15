// ============================================================================
// AI Model selector — multi-provider fallback for "effectively unlimited" free
// ============================================================================
//
// The chat agent and other LLM endpoints used to be hard-coded to Gemini
// Flash. That's great for quality but the free tier (20 RPM, 1500 RPD)
// hits its ceiling in real use within minutes — especially when each
// tool-using turn costs 3-4 API calls.
//
// This module exposes a single function `pickAgentModel()` that returns
// the best LANGUAGE model available given the configured API keys, using
// this priority order:
//
//   1) Groq Llama 3.3 70B Versatile        — 30 RPM, 14k RPD (free)
//      Excellent tool calling, fast, Arabic decent.
//   2) Groq Llama 3.1 8B Instant           — 30 RPM, 14k RPD (free)
//      Different rate-limit bucket from 70B → effective 60 RPM together.
//   3) Gemini 2.5 Flash Lite               — 60 RPM, 1.5k RPD (free)
//      Falls back here when Groq keys aren't set.
//
// Tenants can override the default order via env var:
//   AI_AGENT_MODEL = "groq:llama-3.3-70b-versatile"
//   AI_AGENT_MODEL = "gemini:gemini-2.5-flash"
//   AI_AGENT_MODEL = "gemini:gemini-2.5-flash-lite"
//
// PDF parsing still pins to Gemini Flash via `pickPdfModel()` because
// multimodal + OCR isn't available on Groq's Llama lineup.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------
export type AgentModelInfo = {
  model: LanguageModel;
  /** "groq" or "gemini" — for telemetry / debugging logs */
  provider: "groq" | "gemini";
  /** Underlying model name, e.g. "llama-3.3-70b-versatile" */
  modelName: string;
};

// ----------------------------------------------------------------------------
// Lazy-initialised provider singletons. Each call returns the same
// underlying SDK instance so requests share connection pools.
// ----------------------------------------------------------------------------
function getGroqProvider() {
  if (!process.env.GROQ_API_KEY) return null;
  return createGroq({ apiKey: process.env.GROQ_API_KEY });
}

function getGoogleProvider() {
  if (!process.env.GEMINI_API_KEY) return null;
  return createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
}

// ----------------------------------------------------------------------------
// pickAgentModel — choose the best available LLM for the chat agent
// ----------------------------------------------------------------------------
// Priority:
//   1) Honor AI_AGENT_MODEL env var if set ("groq:..." or "gemini:...")
//   2) Otherwise prefer Groq Llama 3.3 70B (highest free RPD)
//   3) Fall back to Gemini Flash Lite
// Throws if NO provider is configured — every tenant must have at least
// one API key in env. The error message is bilingual so the surfaced
// 500 in the UI tells HR what to do.
export function pickAgentModel(): AgentModelInfo {
  const groq = getGroqProvider();
  const google = getGoogleProvider();

  // 1) Explicit override via env var
  const override = process.env.AI_AGENT_MODEL;
  if (override) {
    const [providerName, ...rest] = override.split(":");
    const modelName = rest.join(":");
    if (providerName === "groq" && groq && modelName) {
      return { provider: "groq", modelName, model: groq(modelName) };
    }
    if (providerName === "gemini" && google && modelName) {
      return { provider: "gemini", modelName, model: google(modelName) };
    }
    // fall through to defaults if the override is malformed
  }

  // 2) Default: Groq Llama 3.3 70B — best free quota + tool calling
  if (groq) {
    return {
      provider: "groq",
      modelName: "llama-3.3-70b-versatile",
      model: groq("llama-3.3-70b-versatile"),
    };
  }

  // 3) Fallback: Gemini Flash Lite — works with just GEMINI_API_KEY
  if (google) {
    return {
      provider: "gemini",
      modelName: "gemini-2.5-flash-lite",
      model: google("gemini-2.5-flash-lite"),
    };
  }

  throw new Error(
    "AI configuration missing — set GROQ_API_KEY (recommended) or GEMINI_API_KEY in env",
  );
}

// ----------------------------------------------------------------------------
// pickFallbackAgentModel — used when the primary returns a quota error
// ----------------------------------------------------------------------------
// Returns the OTHER configured provider, so an exhausted Groq quota falls
// through to Gemini and vice-versa. Returns null if no fallback is
// available, meaning the caller should surface the original error.
export function pickFallbackAgentModel(
  primary: AgentModelInfo,
): AgentModelInfo | null {
  const groq = getGroqProvider();
  const google = getGoogleProvider();

  if (primary.provider === "groq") {
    // Try the other Groq model first (different rate-limit bucket),
    // then fall through to Gemini.
    if (groq && primary.modelName === "llama-3.3-70b-versatile") {
      return {
        provider: "groq",
        modelName: "llama-3.1-8b-instant",
        model: groq("llama-3.1-8b-instant"),
      };
    }
    if (google) {
      return {
        provider: "gemini",
        modelName: "gemini-2.5-flash-lite",
        model: google("gemini-2.5-flash-lite"),
      };
    }
  }

  if (primary.provider === "gemini") {
    if (groq) {
      return {
        provider: "groq",
        modelName: "llama-3.3-70b-versatile",
        model: groq("llama-3.3-70b-versatile"),
      };
    }
  }

  return null;
}

// ----------------------------------------------------------------------------
// isQuotaError — heuristic to detect "free tier exhausted" errors so the
// caller can swap to a fallback model gracefully.
// ----------------------------------------------------------------------------
export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : JSON.stringify(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("rate-limit") ||
    lower.includes("429") ||
    lower.includes("exceeded") ||
    lower.includes("resource_exhausted")
  );
}

// ----------------------------------------------------------------------------
// pickPdfModel — multimodal model for PDF OCR/extraction.
// Groq's Llama lineup doesn't support image/PDF input, so we always use
// Gemini here. The chat agent's higher-RPM path doesn't apply because
// PDF uploads are much lower volume than chat turns anyway.
// ----------------------------------------------------------------------------
export function pickPdfModel() {
  const google = getGoogleProvider();
  if (!google) {
    throw new Error(
      "PDF parsing requires GEMINI_API_KEY (multimodal/OCR not available on Groq)",
    );
  }
  return google("gemini-2.5-flash");
}

// ----------------------------------------------------------------------------
// Provider availability summary — surfaced in /admin so the operator can
// see which keys are configured without exposing them.
// ----------------------------------------------------------------------------
export function getProviderStatus() {
  return {
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    primary: process.env.GROQ_API_KEY
      ? "groq:llama-3.3-70b-versatile"
      : process.env.GEMINI_API_KEY
        ? "gemini:gemini-2.5-flash-lite"
        : "none",
  };
}
