// ============================================================================
// Social Media Sync — pull comments from connected platforms
// ============================================================================
//
// The Social Growth Suite (mig 043) has end-to-end REPLY plumbing:
//   inbox UI → draftReplyForComment → social_replies → publish.
//
// What was missing until now: a way to GET comments off the platform
// into social_comments in the first place. This module fills that gap
// for Facebook (the only platform that exposes per-post comments via a
// stable Graph API endpoint today).
//
// Telegram channels don't have comments on broadcast messages (replies
// are a separate Bot API surface that requires the bot to be added to
// the linked discussion group — not the model we set up). IG comments
// use the same Graph API root but require pages_read_user_content, which
// the operator hasn't enabled yet. Both are deliberate gaps.
//
// HOW IT WORKS:
//   1) Pull every published social_post_targets row that points at a
//      Facebook account (= a published FB post with external_post_id).
//   2) For each, decrypt the page token via the existing
//      decrypt_social_token RPC.
//   3) GET /{external_post_id}/comments?fields=id,message,from,parent,created_time
//      with limit=100.
//   4) Skip comments authored BY us (page's own replies show up here too).
//   5) Upsert into social_comments on (target_id, external_id) so
//      re-runs are idempotent.
//
// Designed to be called from two places:
//   - server action `syncSocialCommentsNow()` for the "🔄 Sync" button
//   - cron route `/api/cron/sync-social-comments` (every 15 min)

import type { SupabaseClient } from "@supabase/supabase-js";

type FacebookComment = {
  id: string;
  message?: string;
  from?: { id: string; name: string };
  parent?: { id: string };
  created_time: string;
};

type FacebookCommentResponse = {
  data?: FacebookComment[];
  error?: { message: string; code: number };
};

type DecryptedToken = {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  platform_metadata: Record<string, unknown>;
  platform: string;
  external_id: string;
};

type TargetRow = {
  id: string;
  post_id: string;
  account_id: string;
  external_post_id: string;
};

export type SyncResult = {
  /** How many published-FB targets we tried to sync */
  targets_scanned: number;
  /** How many distinct comments we observed across all of them */
  comments_seen: number;
  /** How many of those were brand-new inserts (not already in DB) */
  new_comments: number;
  /** Per-target error messages, keyed by external_post_id */
  errors: Array<{ target_id: string; external_post_id: string; error: string }>;
};

/**
 * Main entry. Returns a SyncResult summary; UI / cron caller can decide
 * how prominently to surface the numbers.
 *
 * IMPORTANT: this function expects to run with a supabase client that
 * has SELECT/INSERT access on social_post_targets, social_accounts,
 * social_comments. The super-admin server-action path satisfies that
 * naturally (RLS allows super_admins). The cron path must use the
 * service-role key (bypasses RLS).
 */
export async function syncFacebookCommentsForAllTargets(args: {
  supabase: SupabaseClient;
  encryptionKey: string;
  /** Optional cap so a cold-start sync doesn't blow the function budget */
  maxTargets?: number;
}): Promise<SyncResult> {
  const result: SyncResult = {
    targets_scanned: 0,
    comments_seen: 0,
    new_comments: 0,
    errors: [],
  };

  // 1) Pull every published FB target. We join through social_accounts
  // to filter platform=facebook in one trip — cheaper than two queries
  // for the typical handful-of-targets case Basem has today, and still
  // fine if it grows to hundreds.
  type RawTarget = TargetRow & {
    social_accounts: { id: string; platform: string } | null;
  };
  const { data: rawTargets, error: targetsErr } = await args.supabase
    .from("social_post_targets")
    .select(
      "id, post_id, account_id, external_post_id, social_accounts!inner(id, platform)",
    )
    .eq("status", "published")
    .not("external_post_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(args.maxTargets ?? 50)
    .returns<RawTarget[]>();

  if (targetsErr) {
    throw new Error(`Failed to list published targets: ${targetsErr.message}`);
  }

  const targets =
    (rawTargets ?? []).filter(
      (t) => t.social_accounts?.platform === "facebook",
    );

  // 2) Group targets by account so we decrypt each token ONCE — there
  // are usually fewer accounts than targets, and each decrypt is a
  // round-trip through pgcrypto.
  const tokenCache = new Map<string, DecryptedToken | null>();

  async function getToken(accountId: string): Promise<DecryptedToken | null> {
    if (tokenCache.has(accountId)) return tokenCache.get(accountId) ?? null;
    const { data: rows } = await args.supabase.rpc("decrypt_social_token", {
      p_account_id: accountId,
      p_encryption_key: args.encryptionKey,
    });
    const tok = (Array.isArray(rows) ? rows[0] : rows) as
      | DecryptedToken
      | null
      | undefined;
    tokenCache.set(accountId, tok ?? null);
    return tok ?? null;
  }

  // 3) For each target, fetch comments + upsert. Sequential (not
  // parallel) on purpose: Graph API throttles per-page-token and we'd
  // rather get clean results than fan out and hit rate limits.
  for (const target of targets) {
    result.targets_scanned += 1;
    try {
      const token = await getToken(target.account_id);
      if (!token?.access_token) {
        result.errors.push({
          target_id: target.id,
          external_post_id: target.external_post_id,
          error: "Token decryption failed",
        });
        continue;
      }

      const fbComments = await fetchFacebookComments({
        postId: target.external_post_id,
        accessToken: token.access_token,
      });

      result.comments_seen += fbComments.length;

      // Filter out comments authored by the page itself — those are OUR
      // replies surfacing in the feed. We compare from.id against the
      // account's external_id (page id).
      const ownerPageId = token.external_id;
      const externalComments = fbComments.filter(
        (c) => c.from?.id !== ownerPageId,
      );

      if (externalComments.length === 0) continue;

      // Upsert in one shot. Postgres handles conflict on (target_id,
      // external_id); see mig 043 line 251.
      const rows = externalComments.map((c) => ({
        target_id: target.id,
        external_id: c.id,
        parent_external_id: c.parent?.id ?? null,
        author_name: c.from?.name ?? null,
        author_external_id: c.from?.id ?? null,
        body: c.message ?? "",
        observed_at: c.created_time
          ? new Date(c.created_time).toISOString()
          : new Date().toISOString(),
        review_state: "pending",
      }));

      const { data: inserted, error: upsertErr } = await args.supabase
        .from("social_comments")
        .upsert(rows, {
          onConflict: "target_id,external_id",
          ignoreDuplicates: false,
        })
        .select("id, created_at, observed_at");

      if (upsertErr) {
        result.errors.push({
          target_id: target.id,
          external_post_id: target.external_post_id,
          error: `Upsert failed: ${upsertErr.message}`,
        });
        continue;
      }

      // Heuristic for "new": created_at within last 60s. This isn't
      // perfect (the row may have been touched-updated rather than
      // freshly inserted) but it gives Basem a "you got 3 new comments"
      // surface that's good enough. Pure "new vs updated" tracking
      // would need a SELECT-before-UPSERT round trip per target which
      // doesn't pay off.
      const cutoff = Date.now() - 60_000;
      const newCount = (inserted ?? []).filter(
        (r) => new Date(r.created_at as string).getTime() > cutoff,
      ).length;
      result.new_comments += newCount;
    } catch (err) {
      result.errors.push({
        target_id: target.id,
        external_post_id: target.external_post_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}


// ----------------------------------------------------------------------------
// fetchFacebookComments — raw Graph API call
// ----------------------------------------------------------------------------
//
// Returns the data array (or empty on FB error — caller already wrapped
// the call in try/catch and surfaced the error message). Hard-cap at 100
// comments per post; Basem isn't running viral threads (yet) and 100 is
// enough to spot anything urgent. Pagination is left as a future change.

async function fetchFacebookComments(args: {
  postId: string;
  accessToken: string;
}): Promise<FacebookComment[]> {
  const url =
    `https://graph.facebook.com/v19.0/${args.postId}/comments?` +
    new URLSearchParams({
      access_token: args.accessToken,
      fields: "id,message,from,parent,created_time",
      limit: "100",
      // Most-recent first; FB defaults to chronological which buries new
      // urgent comments under stale ones for popular posts.
      order: "reverse_chronological",
    }).toString();

  const res = await fetch(url);
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300);
    throw new Error(`FB ${res.status}: ${errText}`);
  }
  const json = (await res.json()) as FacebookCommentResponse;
  if (json.error) {
    throw new Error(`FB error #${json.error.code}: ${json.error.message}`);
  }
  return json.data ?? [];
}
