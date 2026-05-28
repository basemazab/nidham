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
//   1) Groq gpt-oss-120b                   — 30 RPM, ~30k RPD (free)
//      Supports json_schema AND tool calling. The 120B size matters for
//      complex Marketing Studio schemas (SEO returns 10-25 keyword
//      objects with enums; gpt-oss-20b reliably fails to produce valid
//      JSON for those). Slightly slower than 20B but bullet-proof on
//      structured output, which is what users hit first.
//   2) Groq gpt-oss-20b                    — 30 RPM, ~100k RPD (free)
//      Fast secondary for simpler schemas + chat. Different rate-limit
//      bucket from 120B so an exhausted primary gracefully degrades.
//   3) Groq Llama 4 Scout 17B              — 30 RPM, 14k RPD (free)
//      Third option in the Groq family if both gpt-oss variants are
//      hammered. Also supports json_schema.
//   4) Gemini 2.5 Flash Lite               — 60 RPM, 1.5k RPD (free)
//      Final fallback when all Groq is exhausted, or the only provider
//      when GROQ_API_KEY isn't set.
//
// Why not Llama 3.3 70B Versatile or Llama 3.1 8B Instant: Groq's
// docs (https://console.groq.com/docs/structured-outputs#supported-models)
// list them as supporting json_object only — NOT json_schema. The Vercel
// AI SDK 6.x sends json_schema by default for generateObject, so those
// models error with "This model does not support response format `json_schema`".
//
// Tenants can override the default order via env var:
//   AI_AGENT_MODEL = "groq:openai/gpt-oss-120b"
//   AI_AGENT_MODEL = "groq:openai/gpt-oss-20b"
//   AI_AGENT_MODEL = "groq:meta-llama/llama-4-scout-17b-16e-instruct"
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
//   2) Otherwise prefer Groq gpt-oss-120b (best at structured output)
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

  // 2) Default: Groq gpt-oss-120b — bullet-proof for complex schemas.
  // The 20B variant intermittently returns "Failed to generate JSON"
  // for the SEO / Personas / Ad-copy schemas which have 10-25 items
  // each with nested enums. 120B handles them reliably; same json_schema
  // + tool-calling support, same 30 RPM, just lower RPD (30k vs 100k).
  // RPD isn't the bottleneck for a Marketing Studio that runs a few
  // dozen requests per active tenant per day.
  if (groq) {
    return {
      provider: "groq",
      modelName: "openai/gpt-oss-120b",
      model: groq("openai/gpt-oss-120b"),
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
// pickAgentModelLargeContext — preferred picker for the /api/ai/agent route
// ----------------------------------------------------------------------------
// The agent route differs from Marketing Studio / single-shot generations:
//   - File uploads (Excel/PDF) inject 5-12k tokens of JSON into the messages
//   - Tool calls + multi-turn confirmations stack up history fast
//   - System prompt is large (~3k tokens of Arabic instructions + column maps)
// Groq's free tier caps gpt-oss-120b at 8k TPM and gpt-oss-20b at 12k TPM
// per request, which 80-employee imports routinely blow through ("Request
// too large for model openai/gpt-oss-120b ... Limit 8000, Requested 12672").
//
// Gemini Flash Lite's free tier has a much higher per-request budget
// (1M+ tokens). So for the agent specifically, we prefer Gemini first
// and fall back to Groq only when Gemini isn't configured.
//
// This is OPPOSITE of pickAgentModel()'s normal Groq-first ordering.
// We keep the normal helper for everything else (chat assistant, marketing
// studio tools) where requests are tiny and Groq's latency wins.
export function pickAgentModelLargeContext(): AgentModelInfo {
  const groq = getGroqProvider();
  const google = getGoogleProvider();

  // Honor explicit operator override first.
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
  }

  // 1) Gemini first — TPM headroom for file uploads.
  if (google) {
    return {
      provider: "gemini",
      modelName: "gemini-2.5-flash",
      model: google("gemini-2.5-flash"),
    };
  }

  // 2) Groq as fallback. gpt-oss-20b has 12k TPM (vs 120b's 8k), giving
  //    SLIGHTLY more room for file context. Still tight; if even this
  //    fails the agent will surface the TPM error.
  if (groq) {
    return {
      provider: "groq",
      modelName: "openai/gpt-oss-20b",
      model: groq("openai/gpt-oss-20b"),
    };
  }

  throw new Error(
    "AI configuration missing — set GEMINI_API_KEY (recommended for agent) or GROQ_API_KEY",
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
    // Chain: 120B (primary) -> 20B -> llama-4-scout -> Gemini
    if (groq && primary.modelName === "openai/gpt-oss-120b") {
      return {
        provider: "groq",
        modelName: "openai/gpt-oss-20b",
        model: groq("openai/gpt-oss-20b"),
      };
    }
    if (groq && primary.modelName === "openai/gpt-oss-20b") {
      return {
        provider: "groq",
        modelName: "meta-llama/llama-4-scout-17b-16e-instruct",
        model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
      };
    }
    // If we're already on Llama 4 Scout, fall through to Gemini.
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
        modelName: "openai/gpt-oss-120b",
        model: groq("openai/gpt-oss-120b"),
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
// isRetryableError — broader detector covering quota AND transient
// provider-side outages (model overload, 5xx, "high demand", timeouts).
// We retry these via the fallback chain instead of bubbling them up.
// ----------------------------------------------------------------------------
export function isRetryableError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : JSON.stringify(err);
  const lower = msg.toLowerCase();
  return (
    isQuotaError(err) ||
    lower.includes("overloaded") ||
    lower.includes("high demand") ||
    lower.includes("currently experiencing") ||
    lower.includes("temporarily") ||
    lower.includes("service unavailable") ||
    lower.includes("internal server error") ||
    lower.includes("bad gateway") ||
    lower.includes("gateway timeout") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("504") ||
    lower.includes("500") ||
    lower.includes("etimedout") ||
    lower.includes("econnreset") ||
    lower.includes("aborted") ||
    // Treat "model capability mismatch" as retryable so the fallback
    // chain can swap to a compatible model. Most commonly hit when an
    // older Groq model is asked for json_schema (only json_object support).
    lower.includes("does not support response format") ||
    lower.includes("response_format") ||
    lower.includes("does not support") ||
    lower.includes("not supported") ||
    // Treat schema-validation failures as retryable so a smaller model
    // that produced syntactically-bad JSON falls through to a bigger
    // one. Groq surfaces this as "Failed to generate JSON. Please
    // adjust your prompt. See 'failed_generation'". Happens most on
    // complex schemas (SEO with 10-25 keyword objects).
    lower.includes("failed to generate json") ||
    lower.includes("failed_generation") ||
    lower.includes("adjust your prompt") ||
    // Vercel AI SDK wraps schema-validation issues as AI_NoObject /
    // AI_TypeValidation / no-object-generated errors. Same fallback
    // logic applies — let a bigger / different-family model try.
    lower.includes("no-object-generated") ||
    lower.includes("no object generated") ||
    lower.includes("ai_noobject") ||
    lower.includes("typevalidation")
  );
}

// ----------------------------------------------------------------------------
// callWithFallback — run an AI request through the model chain. If the
// primary returns a retryable error (overload, quota, 5xx), automatically
// retry with the next model in the fallback chain. Surfaces the LAST
// error if every provider in the chain fails.
//
// Use this from any feature that wants resilient AI calls without
// hand-rolling the retry logic per call site.
// ----------------------------------------------------------------------------
export async function callWithFallback<T>(
  fn: (model: AgentModelInfo) => Promise<T>,
): Promise<T> {
  const tried: string[] = [];
  let lastError: unknown = null;

  // Build the chain dynamically — primary, then each fallback in turn.
  // Four tiers cover the realistic Groq case:
  //   gpt-oss-120b -> gpt-oss-20b -> llama-4-scout -> Gemini Flash Lite
  // (or Gemini -> gpt-oss-120b if Gemini was primary)
  let cursor: AgentModelInfo | null = pickAgentModel();
  for (let i = 0; i < 4 && cursor; i++) {
    const label = `${cursor.provider}:${cursor.modelName}`;
    tried.push(label);
    try {
      return await fn(cursor);
    } catch (err) {
      lastError = err;
       
      console.warn(`[ai-models] ${label} failed:`, errorSummary(err));
      if (!isRetryableError(err)) {
        // Non-retryable: bail immediately (e.g. bad schema, auth issue).
        throw err;
      }
      cursor = pickFallbackAgentModel(cursor);
    }
  }

  // Build a SPECIFIC error message that tells the operator exactly
  // what's wrong + what to do about it. Three branches:
  //   1) Only one provider was configured AND it hit quota — biggest
  //      fix is adding a second free API key (Groq is the easy one).
  //   2) Both providers were tried + quota — wait or upgrade plan.
  //   3) Pure transient overload — just retry in a minute.
  const msg =
    lastError instanceof Error ? lastError.message : String(lastError);
  const isQuota = isQuotaError(lastError);
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const onlyOneProvider = !hasGroq || !hasGemini;

  if (isQuota && onlyOneProvider) {
    const missing = !hasGroq ? "GROQ_API_KEY" : "GEMINI_API_KEY";
    const signupUrl = !hasGroq
      ? "https://console.groq.com/keys"
      : "https://aistudio.google.com/app/apikey";
    const dailyLimit = !hasGroq
      ? "14,000 request/يوم مجاناً"
      : "1,500 request/يوم";
    throw new Error(
      `وصلنا للحد اليومي للـ AI ولسه ما عندكش provider ثاني. ` +
        `الحل: ضيف مفتاح ${missing} (مجاني — ${dailyLimit}) من ${signupUrl} ` +
        `وحطه في Vercel Environment Variables. اللي اتجرّب: ${tried.join(" → ")}.`,
    );
  }

  if (isQuota) {
    throw new Error(
      `وصلنا للحد اليومي لكل الـ AI providers. استنى لبكرة (الـ quota بتتجدد كل 24 ساعة) أو ارفع الـ Gemini لخطة مدفوعة. اللي اتجرّب: ${tried.join(" → ")}.`,
    );
  }

  throw new Error(
    `كل الـ AI providers مزدحمين دلوقتي. جرّب بعد دقيقة. (${tried.join(" → ")}) — ${msg.slice(0, 100)}`,
  );
}

function errorSummary(err: unknown): string {
  if (err instanceof Error) {
    return err.message.slice(0, 200);
  }
  return String(err).slice(0, 200);
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
      ? "groq:openai/gpt-oss-120b"
      : process.env.GEMINI_API_KEY
        ? "gemini:gemini-2.5-flash-lite"
        : "none",
  };
}
