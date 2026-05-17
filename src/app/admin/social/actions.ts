"use server";

// ============================================================================
// Social Media Suite — server actions (super-admin EXCLUSIVE)
// ============================================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  generateSocialPosts,
  draftCommentReply,
  type Platform,
} from "@/lib/social-ai";
import {
  publishToSocialPlatform,
  replyToSocialComment,
} from "@/lib/social-publishers";
import {
  generateAndStorePostImage,
  generateBrandProfileImage,
  generateBrandCoverImage,
} from "@/lib/social-images";
import { syncFacebookCommentsForAllTargets } from "@/lib/social-sync";

// ----------------------------------------------------------------------------
// Super-admin gate. Every action in this file runs through it. If the
// caller isn't on super_admins, the function throws — Next.js converts
// that to a 500 with no leaked details.
// ----------------------------------------------------------------------------
async function ensureSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) {
    redirect("/dashboard?error=" + encodeURIComponent("Access denied"));
  }
  return { supabase, userId: user.id };
}

function getEncryptionKey(): string {
  const key = process.env.META_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "META_ENCRYPTION_KEY not set — required to encrypt social account tokens",
    );
  }
  return key;
}

// ============================================================================
// ACCOUNTS — connect / disconnect / toggle
// ============================================================================

/**
 * Save (or update) a connected social account. The caller pastes the
 * platform's access token; we encrypt it via the save_social_account RPC
 * which uses pgp_sym_encrypt with META_ENCRYPTION_KEY.
 */
export async function saveSocialAccount(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();

  const platform = String(formData.get("platform") ?? "").trim() as Platform;
  const externalId = String(formData.get("external_id") ?? "").trim();
  const displayLabel = String(formData.get("display_label") ?? "").trim();
  const accessToken = String(formData.get("access_token") ?? "").trim();
  const refreshToken = String(formData.get("refresh_token") ?? "").trim() || "";
  const expiresAtRaw = String(formData.get("expires_at") ?? "").trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

  // Platform-specific metadata pasted as JSON (advanced users) or built
  // from individual fields (common). For MVP: take the few fields we
  // know each platform needs as separate inputs.
  const metaIgUserId = String(formData.get("meta_ig_user_id") ?? "").trim();
  const metaFbPageId = String(formData.get("meta_fb_page_id") ?? "").trim();
  const metaUrn = String(formData.get("meta_urn") ?? "").trim();
  const metaChatId = String(formData.get("meta_chat_id") ?? "").trim();

  const platformMetadata: Record<string, string> = {};
  if (metaIgUserId) platformMetadata.ig_user_id = metaIgUserId;
  if (metaFbPageId) platformMetadata.fb_page_id = metaFbPageId;
  if (metaUrn) platformMetadata.urn = metaUrn;
  if (metaChatId) platformMetadata.chat_id = metaChatId;

  // Validation
  const allowed: Platform[] = [
    "facebook",
    "instagram",
    "twitter",
    "linkedin",
    "tiktok",
    "youtube",
    "threads",
    "telegram",
  ];
  if (!allowed.includes(platform)) {
    redirect(
      "/admin/social/accounts?error=" +
        encodeURIComponent("منصة غير معروفة"),
    );
  }
  if (!externalId || !displayLabel || !accessToken) {
    redirect(
      "/admin/social/accounts?error=" +
        encodeURIComponent("اسم الحساب + ID المنصة + Access Token مطلوبين"),
    );
  }

  const { error } = await supabase.rpc("save_social_account", {
    p_platform: platform,
    p_external_id: externalId,
    p_display_label: displayLabel,
    p_access_token: accessToken,
    p_refresh_token: refreshToken,
    p_expires_at: expiresAt,
    p_platform_metadata: platformMetadata,
    p_encryption_key: getEncryptionKey(),
  });

  if (error) {
    redirect(
      "/admin/social/accounts?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/admin/social/accounts");
  revalidatePath("/admin/social");
  redirect("/admin/social/accounts?saved=1");
}

/**
 * Exchange a short-lived Facebook token for a long-lived one (60 days).
 *
 * The token Graph API Explorer hands you is short-lived (1-2 hours).
 * The actual long-lived flow is two steps:
 *
 *   1) Exchange short USER token → long USER token (60 days)
 *      GET /oauth/access_token?grant_type=fb_exchange_token
 *          &client_id=APP_ID
 *          &client_secret=APP_SECRET
 *          &fb_exchange_token=SHORT_TOKEN
 *
 *   2) Use long User token to GET /me/accounts — the Page tokens
 *      returned at this step inherit "never expire" status as long
 *      as the user keeps the app authorized and stays admin.
 *
 * Importantly: for a Page token, the exchange endpoint ALSO accepts
 * the page token directly and just returns a longer-lived version of
 * the same page token. We use that single-step path because:
 *   - Operator pasted a Page token, not a User token.
 *   - We don't have the User context to call /me/accounts cleanly.
 *
 * Required env vars: META_APP_ID, META_APP_SECRET (operator must add
 * these once when they create the FB App).
 */
export async function refreshFacebookTokenToLongLived(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const accountId = String(formData.get("account_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) {
    redirect("/admin/social/accounts");
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    redirect(
      "/admin/social/accounts?error=" +
        encodeURIComponent(
          "محتاج META_APP_ID + META_APP_SECRET في Vercel Env Variables. خد القيم من App Dashboard → Settings → Basic.",
        ),
    );
  }

  // Decrypt current token
  const { data: tokenRows } = await supabase.rpc("decrypt_social_token", {
    p_account_id: accountId,
    p_encryption_key: getEncryptionKey(),
  });
  type Row = {
    access_token: string;
    platform: string;
    external_id: string;
    platform_metadata: Record<string, unknown>;
  };
  const row = (Array.isArray(tokenRows) ? tokenRows[0] : tokenRows) as
    | Row
    | null
    | undefined;
  if (!row?.access_token || row.platform !== "facebook") {
    redirect(
      "/admin/social/accounts?error=" +
        encodeURIComponent(
          "Token غير صالح أو الحساب مش Facebook. جدّد بـ Graph Explorer.",
        ),
    );
  }

  // Call FB to exchange. Wrap in try/catch because fetch() can throw
  // (DNS / TCP / TLS errors) BEFORE we get an HTTP response — without
  // this guard Vercel surfaces a generic 500 instead of a friendly
  // redirect-with-error to the operator. Keep redirect() calls OUTSIDE
  // the try block (NEXT_REDIRECT-bubble rule).
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: row.access_token,
  });
  let json: {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  let fbHttpError: string | null = null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`,
    );
    if (!res.ok) {
      fbHttpError = (await res.text()).slice(0, 300);
      json = {};
    } else {
      json = (await res.json()) as typeof json;
    }
  } catch (err) {
    redirect(
      "/admin/social/accounts?error=" +
        encodeURIComponent(
          err instanceof Error
            ? `FB request failed: ${err.message.slice(0, 200)}`
            : "FB request failed",
        ),
    );
  }
  if (fbHttpError) {
    redirect(
      "/admin/social/accounts?error=" +
        encodeURIComponent(`FB رفض التبديل: ${fbHttpError}`),
    );
  }
  if (!json.access_token) {
    redirect(
      "/admin/social/accounts?error=" +
        encodeURIComponent("FB رد بدون token جديد"),
    );
  }

  // Compute expiry. FB returns expires_in in seconds (typically 5184000
  // = 60 days for the user-token exchange path). Page tokens that
  // inherit "never expire" return 0 / no expires_in — store null in
  // that case so the UI shows "never expires".
  const expiresAt =
    json.expires_in && json.expires_in > 0
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null;

  // Re-save via the same RPC — it handles re-encryption + upsert.
  // We keep external_id + display_label intact by reading the existing
  // row first (the RPC needs them as inputs).
  const { data: account } = await supabase
    .from("social_accounts")
    .select("display_label, platform_metadata")
    .eq("id", accountId)
    .single<{
      display_label: string;
      platform_metadata: Record<string, unknown>;
    }>();

  await supabase.rpc("save_social_account", {
    p_platform: "facebook",
    p_external_id: row.external_id,
    p_display_label: account?.display_label ?? "Facebook Page",
    p_access_token: json.access_token,
    p_refresh_token: "",
    p_expires_at: expiresAt,
    p_platform_metadata: account?.platform_metadata ?? {},
    p_encryption_key: getEncryptionKey(),
  });

  revalidatePath("/admin/social/accounts");
  redirect(
    `/admin/social/accounts?saved=1&long_lived=${encodeURIComponent(
      expiresAt ?? "permanent",
    )}`,
  );
}

export async function deleteSocialAccount(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/admin/social/accounts");
  }
  await supabase.from("social_accounts").delete().eq("id", id);
  revalidatePath("/admin/social/accounts");
  redirect("/admin/social/accounts?deleted=1");
}

export async function toggleSocialAccountActive(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const targetState = formData.get("target_state") === "on";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/admin/social/accounts");
  }
  await supabase
    .from("social_accounts")
    .update({ is_active: targetState, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/social/accounts");
  redirect("/admin/social/accounts?toggled=1");
}

// ============================================================================
// POSTS — AI generate / save draft / publish
// ============================================================================

/**
 * Generate AI post variants and save them ALL as drafts.
 * Returns to the composer with the post IDs surfaced so the user can pick
 * which to publish/edit.
 */
export async function generateAndDraftPosts(formData: FormData) {
  const { supabase, userId } = await ensureSuperAdmin();

  const topic = String(formData.get("topic") ?? "").trim();
  const goal = String(formData.get("goal") ?? "lead_generation").trim();
  const platforms = formData
    .getAll("platforms")
    .map((p) => String(p))
    .filter((p): p is Platform =>
      ["facebook", "instagram", "twitter", "linkedin", "tiktok", "telegram"].includes(p),
    );
  const referenceUrl =
    String(formData.get("reference_url") ?? "").trim() || undefined;
  const brandVoice =
    String(formData.get("brand_voice_override") ?? "").trim() || undefined;

  if (topic.length < 5 || platforms.length === 0) {
    redirect(
      "/admin/social/composer?error=" +
        encodeURIComponent("لازم تكتب موضوع + تختار منصة واحدة على الأقل"),
    );
  }

  let result;
  try {
    result = await generateSocialPosts({
      topic,
      platforms,
      goal: goal as
        | "awareness"
        | "lead_generation"
        | "engagement"
        | "thought_leadership"
        | "feature_launch",
      variant_count: platforms.length,
      reference_url: referenceUrl,
      brand_voice_override: brandVoice,
    });
  } catch (err) {
    redirect(
      "/admin/social/composer?error=" +
        encodeURIComponent(
          err instanceof Error
            ? err.message.slice(0, 200)
            : "AI generation failed",
        ),
    );
  }

  // Save each variant as a draft post. We DON'T fan out to accounts
  // yet — that happens when the user clicks "publish" from the composer.
  // We do compose a clean body that includes hashtags + CTA.
  const insertRows = result.posts.map((v) => ({
    title: result.campaign_theme,
    body: composeFullBody(v),
    source: "ai_generated",
    ai_intent: `${goal} · ${topic.slice(0, 80)}`,
    ai_model: "groq:openai/gpt-oss-120b",
    status: "draft",
    tags: [goal, ...(referenceUrl ? ["has_link"] : [])],
    created_by: userId,
  }));

  const { data: inserted, error } = await supabase
    .from("social_posts")
    .insert(insertRows)
    .select("id");

  if (error) {
    redirect(
      "/admin/social/composer?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/admin/social");
  revalidatePath("/admin/social/composer");
  const firstId = inserted?.[0]?.id;
  if (firstId) {
    redirect(`/admin/social/composer?generated=${inserted?.length ?? 0}&first=${firstId}`);
  }
  redirect(`/admin/social/composer?generated=${inserted?.length ?? 0}`);
}

function composeFullBody(v: {
  hook: string;
  body: string;
  hashtags: string[];
  cta_label: string;
}): string {
  const hashtagLine =
    v.hashtags.length > 0
      ? "\n\n" + v.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")
      : "";
  const cta = v.cta_label ? `\n\n👉 ${v.cta_label}` : "";
  return `${v.hook}\n\n${v.body}${cta}${hashtagLine}`;
}

/**
 * Update a draft post (body, scheduled_for, title, tags).
 */
export async function updateSocialPost(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/admin/social");
  }
  const body = String(formData.get("body") ?? "").trim();
  const scheduledForRaw = String(formData.get("scheduled_for") ?? "").trim();

  if (body.length < 5) {
    redirect(
      `/admin/social/composer?error=` +
        encodeURIComponent("نص البوست لازم 5 حروف على الأقل"),
    );
  }

  await supabase
    .from("social_posts")
    .update({
      body,
      scheduled_for: scheduledForRaw
        ? new Date(scheduledForRaw).toISOString()
        : null,
      status: scheduledForRaw ? "scheduled" : "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/admin/social");
  revalidatePath(`/admin/social/composer?first=${id}`);
  redirect(`/admin/social/composer?first=${id}&saved=1`);
}

/**
 * Generate an AI image for a post and attach it to social_posts.media_urls.
 *
 * We APPEND to media_urls rather than replacing so the operator can stack
 * multiple variants (regenerate without losing the previous one). The
 * publisher today picks media_urls[0], so the most-recently-generated
 * image becomes the active one — that's why we unshift, not push.
 */
export async function generateImageForPost(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const postId = String(formData.get("post_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(postId)) {
    redirect("/admin/social/composer");
  }

  // Pull the post so we can use its body + intent to brief the visual.
  const { data: post } = await supabase
    .from("social_posts")
    .select("id, body, media_urls, ai_intent")
    .eq("id", postId)
    .single<{
      id: string;
      body: string;
      media_urls: string[] | null;
      ai_intent: string | null;
    }>();

  if (!post) {
    redirect(
      "/admin/social/composer?error=" +
        encodeURIComponent("البوست مش موجود"),
    );
  }

  try {
    const { url } = await generateAndStorePostImage({
      supabase,
      postId: post.id,
      postBody: post.body,
      platform: "facebook", // default — image works across FB/IG/TG
      goal: post.ai_intent ?? undefined,
    });

    // Prepend so the latest generation becomes the "active" image for
    // the publisher. Keep the previous URLs as a history trail.
    const existing = Array.isArray(post.media_urls) ? post.media_urls : [];
    const next = [url, ...existing.filter((u) => u !== url)].slice(0, 5);

    await supabase
      .from("social_posts")
      .update({ media_urls: next, updated_at: new Date().toISOString() })
      .eq("id", post.id);
  } catch (err) {
    redirect(
      `/admin/social/composer?first=${postId}&error=` +
        encodeURIComponent(
          err instanceof Error
            ? `توليد الصورة فشل: ${err.message.slice(0, 200)}`
            : "توليد الصورة فشل",
        ),
    );
  }

  revalidatePath("/admin/social");
  revalidatePath("/admin/social/composer");
  redirect(`/admin/social/composer?first=${postId}&img=1`);
}

/**
 * Remove a specific image URL from a post's media_urls. Used by the "X"
 * button next to each image preview in the composer.
 */
export async function removeImageFromPost(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const postId = String(formData.get("post_id") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(postId) || !url) {
    redirect("/admin/social/composer");
  }

  const { data: post } = await supabase
    .from("social_posts")
    .select("media_urls")
    .eq("id", postId)
    .single<{ media_urls: string[] | null }>();

  if (post) {
    const next = (post.media_urls ?? []).filter((u) => u !== url);
    await supabase
      .from("social_posts")
      .update({ media_urls: next, updated_at: new Date().toISOString() })
      .eq("id", postId);
  }

  revalidatePath("/admin/social/composer");
  redirect(`/admin/social/composer?first=${postId}&img=removed`);
}

// ============================================================================
// BRANDING — generate FB Page profile + cover images
// ============================================================================

/**
 * Generate a fresh profile picture for the brand. The URL is stored in
 * a tiny app_settings row so the branding page can render the latest
 * across reloads without re-listing the bucket.
 */
export async function generateBrandProfile() {
  const { supabase } = await ensureSuperAdmin();

  // CAREFUL: redirect() throws a NEXT_REDIRECT internal error. If the
  // success redirect lives inside the try{} it gets caught by the
  // catch and re-thrown as a generic "Sync failed: NEXT_REDIRECT".
  // Keep all redirect() calls OUTSIDE the try/catch so they bubble up
  // to Next.js' framework handler instead.
  try {
    const url = await generateBrandProfileImage({ supabase });
    await upsertAppSetting(supabase, "brand_profile_image_url", url);
  } catch (err) {
    redirect(
      "/admin/social/branding?error=" +
        encodeURIComponent(
          err instanceof Error
            ? `توليد الصورة الشخصية فشل: ${err.message.slice(0, 200)}`
            : "توليد الصورة الشخصية فشل",
        ),
    );
  }
  revalidatePath("/admin/social/branding");
  redirect("/admin/social/branding?profile=1");
}

export async function generateBrandCover() {
  const { supabase } = await ensureSuperAdmin();
  // Same NEXT_REDIRECT consideration as generateBrandProfile above.
  try {
    const url = await generateBrandCoverImage({ supabase });
    await upsertAppSetting(supabase, "brand_cover_image_url", url);
  } catch (err) {
    redirect(
      "/admin/social/branding?error=" +
        encodeURIComponent(
          err instanceof Error
            ? `توليد الغلاف فشل: ${err.message.slice(0, 200)}`
            : "توليد الغلاف فشل",
        ),
    );
  }
  revalidatePath("/admin/social/branding");
  redirect("/admin/social/branding?cover=1");
}

/**
 * Upload a brand image (profile picture or cover) from the operator's
 * computer. Stored in the same Supabase bucket as AI-generated images,
 * keyed by which slot (`profile` / `cover`) it belongs to.
 *
 * Why this exists alongside the AI generators:
 *   - Free AI image gen quality is mediocre. Operators with a real
 *     designer-made logo / cover get a much better Page look by
 *     uploading their own asset rather than relying on FLUX Schnell
 *     or Gemini Flash Image.
 *   - The downstream consumer (Facebook upload) doesn't care whether
 *     the URL was AI-generated or hand-curated — same code path.
 */
export async function uploadBrandImage(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const slot = String(formData.get("slot") ?? "").trim();
  const file = formData.get("file");

  if (slot !== "profile" && slot !== "cover") {
    redirect(
      "/admin/social/branding?error=" +
        encodeURIComponent("slot لازم يكون profile أو cover"),
    );
  }
  if (!file || !(file instanceof File) || file.size === 0) {
    redirect(
      "/admin/social/branding?error=" +
        encodeURIComponent("اختار ملف صورة الأول"),
    );
  }

  // Validate type — must match the bucket's allowed_mime_types (mig 045)
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    redirect(
      "/admin/social/branding?error=" +
        encodeURIComponent(
          `نوع الصورة مش مدعوم (${file.type}). استخدم PNG / JPEG / WebP / GIF`,
        ),
    );
  }
  // Validate size (10 MB bucket cap from mig 045)
  if (file.size > 10 * 1024 * 1024) {
    redirect(
      "/admin/social/branding?error=" +
        encodeURIComponent(
          `حجم الصورة كبير (${(file.size / 1024 / 1024).toFixed(1)} MB). الحد الأقصى 10 MB`,
        ),
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "png";
    const path = `branding/${slot}/${Date.now()}-upload.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("social-media")
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
        cacheControl: "31536000",
      });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: pub } = supabase.storage
      .from("social-media")
      .getPublicUrl(path);

    await upsertAppSetting(
      supabase,
      slot === "profile" ? "brand_profile_image_url" : "brand_cover_image_url",
      pub.publicUrl,
    );
  } catch (err) {
    redirect(
      "/admin/social/branding?error=" +
        encodeURIComponent(
          err instanceof Error
            ? `الرفع فشل: ${err.message.slice(0, 200)}`
            : "الرفع فشل",
        ),
    );
  }

  revalidatePath("/admin/social/branding");
  redirect(
    `/admin/social/branding?${slot === "profile" ? "profile" : "cover"}=1&uploaded=1`,
  );
}

/**
 * Tiny key-value helper backed by social_settings (mig 043). value is
 * jsonb so we wrap strings in JSON.stringify — the read side does
 * JSON.parse to recover the original.
 */
async function upsertAppSetting(
  supabase: Awaited<ReturnType<typeof createClient>>,
  key: string,
  value: string,
) {
  await supabase.from("social_settings").upsert(
    {
      key,
      value: JSON.stringify(value),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}

/**
 * Reset social_posts rows stuck in `publishing` state for more than 5
 * minutes back to `draft`. This unblocks the operator when a deploy
 * (or function timeout) interrupts publishSocialPost mid-loop — those
 * posts would otherwise sit indefinitely with no way to retry from the
 * UI (the publish form only shows for `draft` status).
 *
 * Conservative cutoff: 5 minutes. A real publish run touches every
 * target sequentially so even a slow 5-platform run finishes well
 * inside that window.
 */
export async function recoverStuckPublishingPosts() {
  const { supabase } = await ensureSuperAdmin();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();

  const { data: stuck, error: selErr } = await supabase
    .from("social_posts")
    .select("id")
    .eq("status", "publishing")
    .lt("updated_at", fiveMinutesAgo)
    .returns<{ id: string }[]>();
  if (selErr) {
    redirect(
      "/admin/social?error=" +
        encodeURIComponent(`Failed to scan stuck posts: ${selErr.message}`),
    );
  }
  const count = stuck?.length ?? 0;

  if (count > 0) {
    await supabase
      .from("social_posts")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("status", "publishing")
      .lt("updated_at", fiveMinutesAgo);
  }

  revalidatePath("/admin/social");
  redirect(`/admin/social?recovered=${count}`);
}

export async function archiveSocialPost(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/admin/social");
  }
  await supabase
    .from("social_posts")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/social");
  redirect("/admin/social?archived=1");
}

/**
 * Publish a post NOW to all selected accounts. Caller passes account_ids
 * as repeated form fields. We:
 *   1) Insert social_post_targets rows for each account
 *   2) For each target, decrypt the account token, call the publisher
 *   3) Record the result via record_target_publish_result RPC
 *
 * Partial failures are OK — each target reports its own status.
 */
export async function publishSocialPost(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const postId = String(formData.get("post_id") ?? "").trim();
  const accountIds = formData
    .getAll("account_ids")
    .map((a) => String(a))
    .filter((a) => /^[0-9a-f-]{36}$/i.test(a));

  if (!/^[0-9a-f-]{36}$/i.test(postId) || accountIds.length === 0) {
    redirect(
      "/admin/social?error=" +
        encodeURIComponent("لازم تختار البوست + حساب واحد على الأقل"),
    );
  }

  // Mark the post as publishing + fan out target rows
  await supabase
    .from("social_posts")
    .update({ status: "publishing", updated_at: new Date().toISOString() })
    .eq("id", postId);

  const { data: post } = await supabase
    .from("social_posts")
    .select("body, media_urls")
    .eq("id", postId)
    .single<{ body: string; media_urls: string[] | null }>();

  if (!post) {
    redirect(
      "/admin/social?error=" + encodeURIComponent("البوست مش موجود"),
    );
  }

  await supabase.from("social_post_targets").upsert(
    accountIds.map((account_id) => ({
      post_id: postId,
      account_id,
      status: "queued",
    })),
    { onConflict: "post_id,account_id" },
  );

  // Decrypt + publish per target. This is sequential rather than parallel
  // because (a) we hit a small number of platforms typically, (b) some
  // APIs rate-limit at the connection level, and (c) sequential is easier
  // to debug from logs.
  const key = getEncryptionKey();
  for (const accountId of accountIds) {
    const { data: tokenRows } = await supabase.rpc("decrypt_social_token", {
      p_account_id: accountId,
      p_encryption_key: key,
    });
    type TokenRow = {
      access_token: string;
      refresh_token: string | null;
      token_expires_at: string | null;
      platform_metadata: Record<string, unknown>;
      platform: Platform;
      external_id: string;
    };
    const token = (Array.isArray(tokenRows) ? tokenRows[0] : tokenRows) as
      | TokenRow
      | null
      | undefined;

    const { data: targetRow } = await supabase
      .from("social_post_targets")
      .select("id")
      .eq("post_id", postId)
      .eq("account_id", accountId)
      .single<{ id: string }>();

    if (!targetRow) continue;

    if (!token || !token.access_token) {
      await supabase.rpc("record_target_publish_result", {
        p_target_id: targetRow.id,
        p_status: "failed",
        p_external_post_id: null,
        p_external_url: null,
        p_error: "Token decryption failed — re-connect the account",
      });
      continue;
    }

    const result = await publishToSocialPlatform({
      platform: token.platform,
      accessToken: token.access_token,
      externalId: token.external_id,
      platformMetadata: token.platform_metadata,
      body: post.body,
      mediaUrls: post.media_urls ?? [],
    });

    await supabase.rpc("record_target_publish_result", {
      p_target_id: targetRow.id,
      p_status: result.ok ? "published" : "failed",
      p_external_post_id: result.ok ? result.external_id : null,
      p_external_url: result.ok ? result.external_url : null,
      p_error: result.ok ? null : result.error,
    });
  }

  revalidatePath("/admin/social");
  redirect(`/admin/social?published=${postId}`);
}

// ============================================================================
// COMMENTS — draft AI reply / approve+publish reply
// ============================================================================

/**
 * Draft an AI reply for a comment. Saves the draft into social_replies
 * with status='pending_approval'. The operator reviews + approves +
 * publishes via approveAndPublishReply().
 */
export async function draftReplyForComment(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const commentId = String(formData.get("comment_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(commentId)) {
    redirect("/admin/social/inbox");
  }

  // Pull the comment + parent post + platform context
  const { data: comment } = await supabase
    .from("social_comments")
    .select(
      "id, body, author_name, target_id, social_post_targets!inner(post_id, account_id, social_accounts!inner(platform), social_posts!inner(body))",
    )
    .eq("id", commentId)
    .single();

  if (!comment) {
    redirect(
      "/admin/social/inbox?error=" + encodeURIComponent("التعليق مش موجود"),
    );
  }

  // Fan out the JSON structure
  const target = (
    comment as unknown as {
      body: string;
      author_name: string | null;
      social_post_targets: {
        social_accounts: { platform: Platform };
        social_posts: { body: string };
      };
    }
  ).social_post_targets;

  try {
    const draft = await draftCommentReply({
      post_body: target.social_posts.body,
      comment_body: (comment as { body: string }).body,
      comment_author: (comment as { author_name: string | null }).author_name,
      platform: target.social_accounts.platform,
    });

    // Save draft + classify the comment too
    await Promise.all([
      supabase.from("social_replies").insert({
        comment_id: commentId,
        draft_body: draft.reply_body,
        ai_intent: draft.summary,
        ai_model: "groq:openai/gpt-oss-120b",
        status:
          draft.suggested_action === "post_reply"
            ? "pending_approval"
            : "rejected",
        rejected_reason:
          draft.suggested_action !== "post_reply"
            ? `AI suggested: ${draft.suggested_action} — ${draft.reasoning}`
            : null,
      }),
      supabase
        .from("social_comments")
        .update({
          sentiment: draft.sentiment,
          urgency: draft.urgency,
          ai_summary: draft.summary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", commentId),
    ]);
  } catch (err) {
    redirect(
      `/admin/social/inbox?error=` +
        encodeURIComponent(
          err instanceof Error ? err.message.slice(0, 200) : "AI drafting failed",
        ),
    );
  }

  revalidatePath("/admin/social/inbox");
  redirect(`/admin/social/inbox?drafted=${commentId}`);
}

/**
 * Approve a pending reply and publish it to the platform.
 */
export async function approveAndPublishReply(formData: FormData) {
  const { supabase, userId } = await ensureSuperAdmin();
  const replyId = String(formData.get("reply_id") ?? "").trim();
  const editedBody = String(formData.get("draft_body") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(replyId) || editedBody.length < 2) {
    redirect(
      "/admin/social/inbox?error=" +
        encodeURIComponent("نص الرد مطلوب"),
    );
  }

  // Pull the reply + comment + account context
  const { data } = await supabase
    .from("social_replies")
    .select(
      "id, comment_id, social_comments!inner(external_id, target_id, social_post_targets!inner(account_id, social_accounts!inner(id, platform)))",
    )
    .eq("id", replyId)
    .single();

  if (!data) {
    redirect(
      "/admin/social/inbox?error=" + encodeURIComponent("الرد مش موجود"),
    );
  }

  type Wired = {
    id: string;
    comment_id: string;
    social_comments: {
      external_id: string;
      social_post_targets: {
        social_accounts: { id: string; platform: Platform };
      };
    };
  };
  const wired = data as unknown as Wired;
  const commentExternalId = wired.social_comments.external_id;
  const accountId = wired.social_comments.social_post_targets.social_accounts.id;
  const platform = wired.social_comments.social_post_targets.social_accounts.platform;

  // Decrypt token
  const { data: tokenRows } = await supabase.rpc("decrypt_social_token", {
    p_account_id: accountId,
    p_encryption_key: getEncryptionKey(),
  });
  const token = (Array.isArray(tokenRows) ? tokenRows[0] : tokenRows) as
    | { access_token: string }
    | null
    | undefined;

  if (!token?.access_token) {
    await supabase
      .from("social_replies")
      .update({
        status: "failed",
        last_error: "Token decryption failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", replyId);
    redirect(
      "/admin/social/inbox?error=" +
        encodeURIComponent("Token مش موجود — اعيد ربط الحساب"),
    );
  }

  // Mark reply as approved + publishing
  await supabase
    .from("social_replies")
    .update({
      draft_body: editedBody,
      approved_by: userId,
      approved_at: new Date().toISOString(),
      status: "publishing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", replyId);

  const result = await replyToSocialComment({
    platform,
    accessToken: token.access_token,
    commentExternalId,
    body: editedBody,
  });

  await Promise.all([
    supabase
      .from("social_replies")
      .update({
        status: result.ok ? "published" : "failed",
        published_at: result.ok ? new Date().toISOString() : null,
        external_reply_id: result.ok ? result.external_id : null,
        last_error: result.ok ? null : result.error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", replyId),
    result.ok
      ? supabase
          .from("social_comments")
          .update({
            review_state: "replied",
            updated_at: new Date().toISOString(),
          })
          .eq("id", wired.comment_id)
      : Promise.resolve(),
  ]);

  revalidatePath("/admin/social/inbox");
  redirect(
    result.ok
      ? "/admin/social/inbox?published=1"
      : "/admin/social/inbox?error=" + encodeURIComponent(result.error),
  );
}

/**
 * Manual trigger for the comment sync worker. Bound to the "🔄 Sync now"
 * button on /admin/social/inbox so the operator can pull fresh comments
 * on demand without waiting for the cron tick (every 15 min).
 *
 * Returns redirect with a summary in querystring so the inbox page can
 * surface "أنت لقطّت X تعليق جديد" without an extra round-trip.
 */
export async function syncSocialCommentsNow() {
  const { supabase } = await ensureSuperAdmin();

  // CAREFUL: redirect() throws NEXT_REDIRECT internally. Catching it
  // turns the success path into a fake "Sync failed: NEXT_REDIRECT"
  // error. Always declare the result outside try{}, do the work
  // inside, and redirect AFTER the try/catch so the throw bubbles up
  // to the framework cleanly.
  let result;
  try {
    result = await syncFacebookCommentsForAllTargets({
      supabase,
      encryptionKey: getEncryptionKey(),
      maxTargets: 50,
    });
  } catch (err) {
    redirect(
      "/admin/social/inbox?error=" +
        encodeURIComponent(
          err instanceof Error
            ? `Sync failed: ${err.message.slice(0, 200)}`
            : "Sync failed",
        ),
    );
  }

  revalidatePath("/admin/social/inbox");
  revalidatePath("/admin/social");
  const summary = new URLSearchParams({
    synced: "1",
    scanned: String(result.targets_scanned),
    seen: String(result.comments_seen),
    new: String(result.new_comments),
    errors: String(result.errors.length),
  });
  // Expose the first error message so the operator can act on it.
  // Previously the UI just said "3 errors" with no hint of what went
  // wrong (token expired? permission missing? FB outage?), so the
  // operator was blind. We surface ONE representative message — the
  // rest will be the same root cause 99% of the time.
  if (result.errors.length > 0) {
    summary.set("first_error", result.errors[0].error.slice(0, 200));
  }
  redirect(`/admin/social/inbox?${summary.toString()}`);
}

export async function markCommentReviewed(formData: FormData) {
  const { supabase } = await ensureSuperAdmin();
  const commentId = String(formData.get("comment_id") ?? "").trim();
  const newState = String(formData.get("review_state") ?? "").trim();
  if (
    !/^[0-9a-f-]{36}$/i.test(commentId) ||
    !["ignored", "escalated"].includes(newState)
  ) {
    redirect("/admin/social/inbox");
  }
  await supabase
    .from("social_comments")
    .update({
      review_state: newState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId);
  revalidatePath("/admin/social/inbox");
  redirect("/admin/social/inbox?marked=1");
}
