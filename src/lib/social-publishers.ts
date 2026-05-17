// ============================================================================
// Social Media Publishers — platform-specific posting + reply APIs
// ============================================================================
//
// Each function takes the decrypted account token + post body and returns
// either { ok: true, external_id, external_url } or { ok: false, error }.
// Server actions call these AFTER decrypting the token via the
// decrypt_social_token RPC.
//
// We do not store tokens here. Caller is responsible for fetching the
// token from Supabase (via the SECURITY DEFINER RPC) and passing it in.

import type { Platform } from "./social-ai";

export type PublishResult =
  | { ok: true; external_id: string; external_url: string | null }
  | { ok: false; error: string };

type PlatformMetadata = Record<string, unknown>;

function getMeta<T>(meta: PlatformMetadata, key: string): T | undefined {
  return meta?.[key] as T | undefined;
}

// ----------------------------------------------------------------------------
// Facebook Page — POST /{page_id}/feed
// ----------------------------------------------------------------------------
async function publishToFacebook(args: {
  accessToken: string;
  externalId: string; // page_id
  body: string;
  mediaUrls?: string[];
}): Promise<PublishResult> {
  try {
    // Multi-image posts need a different flow (create unpublished photos,
    // then post with attached_media). For MVP we handle text + single
    // image only — multi-image is a future enhancement.
    const hasMedia = (args.mediaUrls?.length ?? 0) > 0;

    const url = hasMedia
      ? `https://graph.facebook.com/v19.0/${args.externalId}/photos`
      : `https://graph.facebook.com/v19.0/${args.externalId}/feed`;

    const body = new URLSearchParams({
      access_token: args.accessToken,
      [hasMedia ? "caption" : "message"]: args.body,
      ...(hasMedia && args.mediaUrls?.[0]
        ? { url: args.mediaUrls[0] }
        : {}),
    });

    const res = await fetch(url, { method: "POST", body });
    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Facebook ${res.status}: ${errText.slice(0, 300)}`,
      };
    }
    const json = (await res.json()) as { id?: string; post_id?: string };
    const id = json.post_id ?? json.id ?? "";
    const externalUrl = id
      ? `https://facebook.com/${id}`
      : null;
    return { ok: true, external_id: id, external_url: externalUrl };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Reply to a Facebook comment — POST /{comment_id}/comments
async function replyToFacebookComment(args: {
  accessToken: string;
  commentExternalId: string;
  body: string;
}): Promise<PublishResult> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${args.commentExternalId}/comments`,
      {
        method: "POST",
        body: new URLSearchParams({
          access_token: args.accessToken,
          message: args.body,
        }),
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        error: `FB reply ${res.status}: ${(await res.text()).slice(0, 300)}`,
      };
    }
    const json = (await res.json()) as { id?: string };
    return {
      ok: true,
      external_id: json.id ?? "",
      external_url: null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ----------------------------------------------------------------------------
// Instagram Business — two-step (media container → publish)
// ----------------------------------------------------------------------------
async function publishToInstagram(args: {
  accessToken: string;
  externalId: string; // ig_user_id (NOT fb page_id)
  body: string;
  mediaUrls?: string[];
}): Promise<PublishResult> {
  // Instagram REQUIRES an image or video URL — text-only isn't allowed.
  // For MVP we error out if no media; Composer UI should enforce this.
  if (!args.mediaUrls?.[0]) {
    return {
      ok: false,
      error:
        "Instagram requires an image or video URL. Upload media before publishing.",
    };
  }

  try {
    // Step 1: create media container
    const createRes = await fetch(
      `https://graph.facebook.com/v19.0/${args.externalId}/media`,
      {
        method: "POST",
        body: new URLSearchParams({
          access_token: args.accessToken,
          image_url: args.mediaUrls[0],
          caption: args.body,
        }),
      },
    );
    if (!createRes.ok) {
      return {
        ok: false,
        error: `IG container ${createRes.status}: ${(await createRes.text()).slice(0, 300)}`,
      };
    }
    const { id: creationId } = (await createRes.json()) as { id: string };

    // Step 2: publish the container
    const pubRes = await fetch(
      `https://graph.facebook.com/v19.0/${args.externalId}/media_publish`,
      {
        method: "POST",
        body: new URLSearchParams({
          access_token: args.accessToken,
          creation_id: creationId,
        }),
      },
    );
    if (!pubRes.ok) {
      return {
        ok: false,
        error: `IG publish ${pubRes.status}: ${(await pubRes.text()).slice(0, 300)}`,
      };
    }
    const { id: mediaId } = (await pubRes.json()) as { id: string };
    return {
      ok: true,
      external_id: mediaId,
      external_url: null, // IG doesn't return a canonical URL synchronously
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ----------------------------------------------------------------------------
// X (Twitter) — POST /2/tweets — requires Bearer token + paid tier
// ----------------------------------------------------------------------------
async function publishToTwitter(args: {
  accessToken: string;
  body: string;
}): Promise<PublishResult> {
  try {
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: args.body }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Twitter ${res.status}: ${(await res.text()).slice(0, 300)}`,
      };
    }
    const json = (await res.json()) as { data?: { id?: string; text?: string } };
    const id = json.data?.id ?? "";
    return {
      ok: true,
      external_id: id,
      external_url: id ? `https://x.com/i/status/${id}` : null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ----------------------------------------------------------------------------
// LinkedIn — POST /v2/ugcPosts — requires URN + r_basicprofile/w_member_social
// ----------------------------------------------------------------------------
async function publishToLinkedIn(args: {
  accessToken: string;
  body: string;
  platformMetadata: PlatformMetadata;
}): Promise<PublishResult> {
  const urn = getMeta<string>(args.platformMetadata, "urn");
  if (!urn) {
    return {
      ok: false,
      error:
        "LinkedIn account is missing urn metadata (urn:li:person:... or urn:li:organization:...). Reconnect the account.",
    };
  }
  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: urn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: args.body },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `LinkedIn ${res.status}: ${(await res.text()).slice(0, 300)}`,
      };
    }
    const id = res.headers.get("x-restli-id") ?? "";
    return {
      ok: true,
      external_id: id,
      external_url: id ? `https://www.linkedin.com/feed/update/${id}` : null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ----------------------------------------------------------------------------
// Telegram — POST sendMessage with bot token + channel chat_id
// (easiest "real" channel to publish to without business verification)
// ----------------------------------------------------------------------------
async function publishToTelegram(args: {
  accessToken: string; // this is actually the bot token (1234:ABC...)
  externalId: string;  // channel @username or numeric ID — same thing
  platformMetadata: PlatformMetadata;
  body: string;
}): Promise<PublishResult> {
  // For Telegram channels, the platform-level "external_id" and the
  // "chat_id" metadata field are conceptually identical (both = the
  // channel's @username or numeric ID). The Accounts form has both
  // because some platforms genuinely need separate values, but for
  // Telegram users routinely fill only one of them. Accept either:
  // metadata.chat_id wins (operator-intent override), then externalId.
  const chatId =
    getMeta<string>(args.platformMetadata, "chat_id") || args.externalId;
  if (!chatId) {
    return {
      ok: false,
      error:
        "Telegram channel ID missing. Set Platform ID OR Metadata.chat_id on the account.",
    };
  }
  // Telegram's sendMessage caps text at 4096 chars. Truncate gracefully
  // rather than letting the API reject the whole post.
  const safeBody = args.body.length > 4096 ? args.body.slice(0, 4093) + "…" : args.body;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${args.accessToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No parse_mode — send as plain text. We were previously passing
        // parse_mode: "HTML" which makes Telegram strict about <, >, &
        // characters in the body. AI-generated posts occasionally include
        // a stray < or & that breaks publish without any visible HTML
        // intent. Plain text is more forgiving and the posts don't need
        // formatting anyway (line breaks render natively).
        body: JSON.stringify({
          chat_id: chatId,
          text: safeBody,
          disable_web_page_preview: false,
        }),
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        error: `Telegram ${res.status}: ${(await res.text()).slice(0, 300)}`,
      };
    }
    const json = (await res.json()) as {
      ok?: boolean;
      result?: { message_id?: number };
    };
    const msgId = String(json.result?.message_id ?? "");
    return {
      ok: true,
      external_id: msgId,
      external_url: null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ----------------------------------------------------------------------------
// TikTok / YouTube / Threads — scaffolded but require manual setup.
// Returning a clear error so the UI guides the user.
// ----------------------------------------------------------------------------
function notYetImplemented(platform: string): PublishResult {
  return {
    ok: false,
    error: `النشر التلقائي على ${platform} لسه مش جاهز. حالياً عدّى المحتوى يدوي من الـ Composer.`,
  };
}

// ----------------------------------------------------------------------------
// Main dispatcher
// ----------------------------------------------------------------------------
export async function publishToSocialPlatform(args: {
  platform: Platform;
  accessToken: string;
  externalId: string;
  platformMetadata: PlatformMetadata;
  body: string;
  mediaUrls?: string[];
}): Promise<PublishResult> {
  const { platform, accessToken, externalId, platformMetadata, body, mediaUrls } =
    args;

  switch (platform) {
    case "facebook":
      return publishToFacebook({ accessToken, externalId, body, mediaUrls });
    case "instagram":
      return publishToInstagram({ accessToken, externalId, body, mediaUrls });
    case "twitter":
      return publishToTwitter({ accessToken, body });
    case "linkedin":
      return publishToLinkedIn({ accessToken, body, platformMetadata });
    case "telegram":
      return publishToTelegram({
        accessToken,
        externalId,
        platformMetadata,
        body,
      });
    case "tiktok":
      return notYetImplemented("TikTok");
    case "youtube":
      return notYetImplemented("YouTube");
    case "threads":
      return notYetImplemented("Threads");
  }
}

// Comment reply dispatcher (only Facebook implemented; others later)
export async function replyToSocialComment(args: {
  platform: Platform;
  accessToken: string;
  commentExternalId: string;
  body: string;
}): Promise<PublishResult> {
  if (args.platform === "facebook" || args.platform === "instagram") {
    // IG comments use the same FB Graph API endpoint
    return replyToFacebookComment({
      accessToken: args.accessToken,
      commentExternalId: args.commentExternalId,
      body: args.body,
    });
  }
  return {
    ok: false,
    error: `الرد التلقائي على تعليقات ${args.platform} لسه مش جاهز.`,
  };
}
