// ============================================================================
// Social Media Image Generation — AI image gen + Supabase Storage upload
// ============================================================================
//
// Posts WITH images get 5-10x more engagement than text-only on FB / TG / IG.
// This module produces an on-brand visual for each post and stores it in
// the `social-media` Supabase bucket (mig 045).
//
// PROVIDER CHAIN — Gemini (primary) → Pollinations (fallback):
//   1) Google Gemini 2.5 Flash Image (free tier, requires GEMINI_API_KEY).
//      No IP-based queue throttling — works reliably from Vercel's
//      shared edges where Pollinations frequently returns 402 "Queue
//      full for IP: X" errors.
//   2) Pollinations.ai (free, FLUX) as fallback — used when GEMINI_API_KEY
//      isn't set OR Gemini errors out (e.g. quota exhausted, model
//      blocked the prompt, etc.). Keeps the system working even when
//      a single provider has a bad day.
//
//   Both produce comparable quality for social-media use. Gemini's main
//   advantage in this codebase is operational, not aesthetic.
//
// FLOW:
//   1) Caller passes a `prompt` (English visual brief, NOT the post body).
//   2) generateImageBytes() fetches from Pollinations.
//   3) uploadToBucket() stores it in supabase://social-media/<post-id>/<ts>.png
//   4) Returns the public URL — caller writes it to social_posts.media_urls.

import type { SupabaseClient } from "@supabase/supabase-js";
import { callWithFallback } from "./ai-models";
import { generateObject } from "ai";
import { z } from "zod";
import type { Platform } from "./social-ai";

const STORAGE_BUCKET = "social-media";

// Pollinations.ai endpoint (FALLBACK ONLY — Gemini is primary).
// Pollinations limits free users to 1 queued request per IP. On Vercel
// (shared IPs across many projects) this routinely returns:
//   402 {"error":"Queue full for IP: X.X.X.X: 1 requests already queued"}
// So we only reach for it if Gemini isn't configured / failed.
const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt/";

// Gemini image-generation endpoint. The 2.5-flash-image model is the
// current free-tier image generator (free as of Oct 2025; subject to
// Google's quota changes). It accepts a text prompt and returns
// base64-encoded PNG data inline with the response.
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";


// ----------------------------------------------------------------------------
// Visual brief schema — what the LLM returns to drive the image
// ----------------------------------------------------------------------------
//
// We DON'T feed the Arabic post body directly to the image model. Two reasons:
//   1) FLUX renders Arabic text poorly (often Arabic-looking but unreadable
//      glyphs). Better: visual-only image, real Arabic lives in the caption.
//   2) The image model wants concrete VISUAL nouns/adjectives, not marketing
//      prose. An LLM intermediary translates "وفر 8 ساعات شهرياً" into
//      "exhausted office worker buried in paperwork at a desk, clock
//      overhead, cinematic lighting".

const visualBriefSchema = z.object({
  prompt: z
    .string()
    .describe(
      "English visual description for an AI image model. Concrete nouns + adjectives + style. NO text in image. 30-60 words.",
    ),
  style_hint: z
    .enum([
      "photorealistic",
      "illustration",
      "isometric_3d",
      "minimal_flat",
      "infographic",
      "office_scene",
    ])
    .describe("Best visual treatment for this post's energy"),
  aspect_ratio: z
    .enum(["1:1", "4:5", "16:9"])
    .describe(
      "1:1 for FB/IG feed, 4:5 for IG portrait, 16:9 for FB share + LinkedIn",
    ),
});

export type VisualBrief = z.infer<typeof visualBriefSchema>;


const VISUAL_BRIEF_SYSTEM = `You are an art director who briefs an AI image model
(FLUX) for social media posts. The post is in Egyptian Arabic; YOU output
English visual descriptions only.

CRITICAL RULES:
1. NO text in the image — the image model can't render Arabic text properly.
   Describe the scene only, not the message.
2. Concrete nouns + adjectives + lighting + composition. Avoid abstract
   marketing words ("innovation", "synergy" → garbage images).
3. The brand is Nidham — a modern Egyptian HR/CRM SaaS. Visual identity:
   clean, professional, slightly warm. Egyptian setting subtle (no pyramids,
   no clichés). Office workers, laptops, dashboards.
4. Pick the style that matches the POST'S ENERGY:
   - pain point / problem        → photorealistic stressed worker
   - feature / solution          → isometric_3d clean dashboard
   - case study / numbers        → infographic with charts
   - hype / launch               → cinematic photorealistic
   - tip / how-to                → minimal_flat illustration
5. Aspect ratio: 1:1 unless the post is specifically a banner (16:9).`;


export async function buildVisualBrief(args: {
  post_body: string;
  platform: Platform;
  goal?: string;
}): Promise<VisualBrief> {
  const prompt = `Post (Egyptian Arabic):
${args.post_body.slice(0, 800)}

Target platform: ${args.platform}
Campaign goal: ${args.goal ?? "engagement"}

Brief the image model. Output a 30-60 word English visual description with
no text-in-image, plus the best style and aspect ratio.`;

  return callWithFallback(async (picked) => {
    const { object } = await generateObject({
      maxRetries: 0,
      model: picked.model,
      schema: visualBriefSchema,
      system: VISUAL_BRIEF_SYSTEM,
      prompt,
      temperature: 0.7,
    });
    return object;
  });
}


// ----------------------------------------------------------------------------
// generateImageBytes — call Pollinations.ai and return PNG bytes
// ----------------------------------------------------------------------------
//
// Pollinations is HTTP-only with the prompt encoded into the URL path.
// We add quality controls via query params and let their server stream
// back a PNG. Failures (5xx, malformed, slow) are surfaced as Errors so
// the caller can fall back to no-image gracefully.

/**
 * Public entry — generate image bytes via the provider chain.
 *
 * Tries Gemini first (free, no IP throttle) and falls back to
 * Pollinations only if Gemini isn't configured OR errored out. We
 * surface the Gemini error in a console.warn so an operator chasing
 * a flaky image gen can tell WHICH provider failed and why.
 */
export async function generateImageBytes(args: {
  prompt: string;
  aspect_ratio?: "1:1" | "4:5" | "16:9";
  seed?: number;
}): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateImageBytesViaGemini(args);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[social-images] Gemini image gen failed, falling back to Pollinations:",
        err instanceof Error ? err.message.slice(0, 200) : String(err),
      );
      // fall through
    }
  }
  return generateImageBytesViaPollinations(args);
}


// ----------------------------------------------------------------------------
// Gemini image generation (primary)
// ----------------------------------------------------------------------------
//
// Direct REST call to /v1beta/models/{model}:generateContent with
// responseModalities=["IMAGE"]. The @ai-sdk/google package doesn't yet
// expose this surface as a typed `.image()` model, so we hand-roll the
// HTTP. Cost: free tier today (10 req/min, generous daily cap).

async function generateImageBytesViaGemini(args: {
  prompt: string;
  aspect_ratio?: "1:1" | "4:5" | "16:9";
}): Promise<{ bytes: Uint8Array; contentType: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  // The image-gen model variants don't expose aspectRatio as a typed
  // generationConfig field yet — they read it from the prompt text. So
  // we embed a clear aspect hint at the END of the prompt where the
  // model gives it more weight.
  const aspectHint =
    args.aspect_ratio === "16:9"
      ? "Wide landscape format 16:9 cinematic aspect ratio."
      : args.aspect_ratio === "4:5"
        ? "Portrait format 4:5 vertical aspect ratio."
        : "Square format 1:1 aspect ratio.";

  const promptText = `${args.prompt.slice(0, 1500)}\n\n${aspectHint}`;

  const url =
    `${GEMINI_API_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=` +
    encodeURIComponent(apiKey);

  const body = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      // Skipping temperature etc — the image model has its own defaults
      // and overriding them with text-model values tends to error out.
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(
        `Gemini image ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType: string; data: string };
          }>;
        };
      }>;
      promptFeedback?: { blockReason?: string };
    };

    if (json.promptFeedback?.blockReason) {
      throw new Error(
        `Gemini blocked the prompt: ${json.promptFeedback.blockReason}`,
      );
    }

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.data);
    if (!imgPart?.inlineData) {
      throw new Error("Gemini returned no image data");
    }

    // Decode base64 → bytes. Buffer is available in Node runtime on
    // Vercel (this code path is always server-side).
    const bytes = new Uint8Array(
      Buffer.from(imgPart.inlineData.data, "base64"),
    );
    if (bytes.length < 1000) {
      throw new Error(
        `Gemini returned a suspiciously small image (${bytes.length} bytes)`,
      );
    }
    return {
      bytes,
      contentType: imgPart.inlineData.mimeType || "image/png",
    };
  } finally {
    clearTimeout(timer);
  }
}


// ----------------------------------------------------------------------------
// Pollinations image generation (fallback)
// ----------------------------------------------------------------------------
//
// Only used when Gemini isn't available. Hits the same hard 1-per-IP
// queue limit that prompted the move to Gemini in the first place, so
// failures here are expected and the caller (generateImageBytes) doesn't
// retry — it just surfaces the error.

async function generateImageBytesViaPollinations(args: {
  prompt: string;
  aspect_ratio?: "1:1" | "4:5" | "16:9";
  seed?: number;
}): Promise<{ bytes: Uint8Array; contentType: string }> {
  const dims =
    args.aspect_ratio === "16:9"
      ? { width: 1280, height: 720 }
      : args.aspect_ratio === "4:5"
        ? { width: 1080, height: 1350 }
        : { width: 1080, height: 1080 };

  const encoded = encodeURIComponent(args.prompt.slice(0, 800));
  const seed = args.seed ?? Math.floor(Math.random() * 1_000_000);
  const url =
    `${POLLINATIONS_BASE}${encoded}?` +
    new URLSearchParams({
      width: String(dims.width),
      height: String(dims.height),
      model: "flux",
      nologo: "true",
      enhance: "false",
      safe: "true",
      seed: String(seed),
    }).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(
        `Pollinations ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 1000) {
      throw new Error(
        `Pollinations returned a suspiciously small image (${buf.length} bytes)`,
      );
    }
    return { bytes: buf, contentType };
  } finally {
    clearTimeout(timer);
  }
}


// ----------------------------------------------------------------------------
// uploadToBucket — push bytes into supabase://social-media/<path>
// ----------------------------------------------------------------------------
//
// Returns the PUBLIC URL the social platforms can fetch. We path-scope by
// post or "branding" so listing the bucket from the dashboard stays
// browsable instead of one giant flat blob graveyard.

export async function uploadToBucket(args: {
  supabase: SupabaseClient;
  scopePath: string; // e.g. "posts/<post-id>" or "branding/profile"
  bytes: Uint8Array;
  contentType: string;
  filenameHint?: string;
}): Promise<string> {
  const ext =
    args.contentType.includes("jpeg") || args.contentType.includes("jpg")
      ? "jpg"
      : args.contentType.includes("webp")
        ? "webp"
        : "png";
  const ts = Date.now();
  const safeName = (args.filenameHint ?? "image")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .slice(0, 40);
  const path = `${args.scopePath}/${ts}-${safeName}.${ext}`;

  const { error } = await args.supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, args.bytes, {
      contentType: args.contentType,
      upsert: false,
      cacheControl: "31536000", // 1 year — generated images are immutable
    });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // getPublicUrl is synchronous; it just builds the URL string.
  const { data } = args.supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}


// ----------------------------------------------------------------------------
// generateAndStorePostImage — full orchestration for one post
// ----------------------------------------------------------------------------
//
// Caller-facing convenience: given a post body + post id, produce a public
// URL pointing at a freshly-generated image. The caller is responsible for
// writing the URL back to social_posts.media_urls.

export async function generateAndStorePostImage(args: {
  supabase: SupabaseClient;
  postId: string;
  postBody: string;
  platform?: Platform;
  goal?: string;
}): Promise<{ url: string; brief: VisualBrief }> {
  const brief = await buildVisualBrief({
    post_body: args.postBody,
    platform: args.platform ?? "facebook",
    goal: args.goal,
  });

  // Append style cue to keep Pollinations on-brand without re-rolling
  // the brief each time. These are well-known FLUX modifiers.
  const styleSuffix: Record<VisualBrief["style_hint"], string> = {
    photorealistic:
      ", professional photography, soft natural lighting, shallow depth of field, high detail",
    illustration:
      ", modern vector illustration style, clean lines, vibrant flat colors",
    isometric_3d:
      ", isometric 3d render, soft shadows, pastel palette, blender style",
    minimal_flat:
      ", minimal flat design, two-tone accent palette, generous white space",
    infographic:
      ", clean modern infographic style, data visualization, blue and teal accent colors",
    office_scene:
      ", modern office workspace, natural light, candid composition",
  };

  const finalPrompt = `${brief.prompt}${styleSuffix[brief.style_hint]}`;

  const { bytes, contentType } = await generateImageBytes({
    prompt: finalPrompt,
    aspect_ratio: brief.aspect_ratio,
  });

  const url = await uploadToBucket({
    supabase: args.supabase,
    scopePath: `posts/${args.postId}`,
    bytes,
    contentType,
    filenameHint: brief.style_hint,
  });

  return { url, brief };
}


// ----------------------------------------------------------------------------
// Brand image generation — profile picture + cover for the FB Page
// ----------------------------------------------------------------------------
//
// One-shot helpers for the /admin/social/branding page. Different prompts +
// aspect ratios from regular posts; we hand-curate the brief because brand
// assets need to be more consistent than per-post visuals.

const BRAND_PROFILE_PROMPT =
  "Modern minimalist logo design for 'Nidham', an Egyptian HR and CRM SaaS company. " +
  "Bold geometric letter 'N' centered, deep indigo color (#4338ca) on warm cream background (#fef7e0). " +
  "Subtle gradient, very clean, professional tech company branding, vector style, sharp edges, " +
  "no text, no Arabic letters, square format, high resolution";

const BRAND_COVER_PROMPT =
  "Wide cinematic banner for an Egyptian HR/CRM software company called Nidham. " +
  "Modern open-plan office with diverse Egyptian professionals collaborating around laptops " +
  "and dashboards on large screens, warm soft daylight from large windows, deep indigo and " +
  "warm cream color accents, shallow depth of field, professional photography, " +
  "ultra wide composition, clean modern aesthetic, high production value, no text overlay";


export async function generateBrandProfileImage(args: {
  supabase: SupabaseClient;
}): Promise<string> {
  const { bytes, contentType } = await generateImageBytes({
    prompt: BRAND_PROFILE_PROMPT,
    aspect_ratio: "1:1",
  });
  return uploadToBucket({
    supabase: args.supabase,
    scopePath: "branding/profile",
    bytes,
    contentType,
    filenameHint: "nidham-profile",
  });
}


export async function generateBrandCoverImage(args: {
  supabase: SupabaseClient;
}): Promise<string> {
  const { bytes, contentType } = await generateImageBytes({
    prompt: BRAND_COVER_PROMPT,
    aspect_ratio: "16:9",
  });
  return uploadToBucket({
    supabase: args.supabase,
    scopePath: "branding/cover",
    bytes,
    contentType,
    filenameHint: "nidham-cover",
  });
}
