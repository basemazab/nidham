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

// Gemini image-generation endpoint. The 2.5-flash-image-preview model
// is the current free-tier image generator (free as of Q1 2026; subject
// to Google's quota changes). The `-preview` suffix matters — without
// it the endpoint returns 404 in the free tier.
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image-preview";
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


const VISUAL_BRIEF_SYSTEM = `You are a senior art director briefing an AI
image model (FLUX / Imagen) for a B2B SaaS company's social media. The
underlying post is in Egyptian Arabic; YOU output English visual
descriptions only.

# PROMPT QUALITY RULES (these drive the final image quality)

1. **No text in image** — Arabic text from FLUX/Imagen renders as
   gibberish. Describe the SCENE, not the marketing message.

2. **Concrete > abstract.** Bad: "innovation, synergy, productivity".
   Good: "young woman in cream sweater at standing desk, two monitors
   show colorful charts, one hand holds coffee".

3. **Lock in style explicitly.** Every brief must include:
   - Lighting (e.g. "soft natural daylight from large window")
   - Lens / framing (e.g. "shot on 50mm, shallow depth of field, eye-level")
   - Color palette (e.g. "warm cream + deep indigo accents")
   - Composition cue (e.g. "rule of thirds, subject right of center")
   - Quality anchors ("editorial photography, high detail, sharp focus")

4. **Brand: Nidham** — modern Egyptian HR / CRM SaaS. Visual identity:
   - Clean, professional, warm (not cold corporate).
   - Egyptian subtly — Cairo office workers, modern fashion, no
     pyramid/camel clichés EVER.
   - Color accents: deep indigo (#4338ca) and warm cream (#fef7e0).
   - People in scenes are 22-45, business-casual, look like real
     Cairo professionals (not stock-photo models).

5. **Style matches post energy:**
   - pain point / problem        → photorealistic stressed worker, dim
                                    overhead light, cluttered desk
   - feature / solution          → isometric 3d dashboard, clean white
                                    background, vibrant accent colors
   - case study / numbers        → infographic style, charts/numbers
                                    composition, modern flat design
   - hype / feature launch       → cinematic photo, dramatic lighting,
                                    confident subject
   - tip / how-to                → minimal flat illustration, two-tone,
                                    icon-driven

6. **Aspect ratio: 1:1 default.** 16:9 only for explicit banner posts.

7. **End every prompt with quality boosters:**
   "8k resolution, professional photography, award-winning composition,
   shot on Hasselblad, ultra-realistic detail, no text, no logos"
   (or the illustration equivalent for non-photo styles)`;


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
  let geminiError: string | null = null;

  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateImageBytesViaGemini(args);
    } catch (err) {
      geminiError =
        err instanceof Error ? err.message.slice(0, 200) : String(err);
       
      console.warn(
        "[social-images] Gemini failed, trying Pollinations:",
        geminiError,
      );
      // fall through
    }
  }

  try {
    return await generateImageBytesViaPollinations(args);
  } catch (err) {
    const pollErr =
      err instanceof Error ? err.message.slice(0, 200) : String(err);
    // Compound message — if both providers failed the caller needs to
    // know about both. The bare "This operation was aborted" we used
    // to surface gave no clue WHICH provider the user could try
    // working around (e.g. add a different API key).
    if (geminiError) {
      throw new Error(
        `Both providers failed. Gemini: ${geminiError}. Pollinations: ${pollErr}`,
      );
    }
    throw new Error(`Pollinations: ${pollErr}`);
  }
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
      // Both TEXT and IMAGE — even though we only want the image,
      // omitting TEXT causes "responseModalities must include TEXT"
      // errors from some model variants.
      responseModalities: ["IMAGE", "TEXT"],
      // Skipping temperature etc — the image model has its own defaults
      // and overriding them with text-model values tends to error out.
    },
  };

  // 25s timeout — gives the fallback (Pollinations, another 25s) room
  // to run inside Vercel's 60s function cap. If Gemini hasn't returned
  // in 25s it's probably stuck; better to fail fast and try the other
  // provider than wait the full 50s and starve the fallback.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
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

  // 25s — matches the Gemini timeout above. If both providers fail
  // we want to surface the error well before Vercel's 60s cap so the
  // user sees a real error message and not a generic 504.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
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

  // Append heavy style + quality anchors to push the image model into
  // its strongest mode. These follow the proven "boost the prompt with
  // technical photography / illustration vocab" pattern that takes
  // FLUX / Imagen output from mediocre to professional. Re-rolled per
  // style_hint so a photorealistic scene gets camera vocab, an
  // illustration gets vector vocab, etc.
  const styleSuffix: Record<VisualBrief["style_hint"], string> = {
    photorealistic:
      ", professional editorial photography, shot on Hasselblad H6D 100c, " +
      "85mm prime lens, golden hour natural lighting, shallow depth of field f/2.8, " +
      "high dynamic range, ultra-detailed skin texture, magazine cover quality, " +
      "8k resolution, sharp focus, no text, no logos",
    illustration:
      ", modern minimalist vector illustration, clean geometric shapes, " +
      "bold flat colors with subtle gradients, harmonious palette, " +
      "behance trending, dribbble featured, smooth bezier curves, " +
      "ultra crisp lines, no text, no typography",
    isometric_3d:
      ", premium isometric 3D render in Blender, soft global illumination, " +
      "subtle ambient occlusion, pastel material palette, octane render quality, " +
      "subsurface scattering, professional product visualization, " +
      "trending on artstation, 4k resolution, no text",
    minimal_flat:
      ", swiss minimalist flat design, generous negative space, " +
      "two-tone palette (deep indigo + warm cream), grid composition, " +
      "modernist typography placeholder areas, magazine layout aesthetic, " +
      "vector crisp, no actual text",
    infographic:
      ", premium business infographic, clean data visualization style, " +
      "modern flat design, deep indigo and warm cream accents, " +
      "geometric charts and bars (no text), Behance featured quality, " +
      "high contrast, professional, 4k resolution",
    office_scene:
      ", candid editorial photography of a modern Cairo office, " +
      "soft window light, natural skin tones, shot on 50mm prime, " +
      "documentary style, warm professional atmosphere, " +
      "sharp focus on subject, blurred background, 8k, no text, no logos",
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
