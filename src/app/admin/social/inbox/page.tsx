// ============================================================================
// /admin/social/inbox — Comments + AI reply drafts
// ============================================================================
//
// Shows every comment pulled from connected posts. For each pending one,
// the user clicks "AI Draft Reply" → an AI suggestion appears → they edit
// + approve → it publishes to the platform.
//
// Auto-reply mode (no human review) is intentionally NOT implemented in
// the UI — that's a foot-gun for a marketing brand. Manual approval is
// the safest default.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  draftReplyForComment,
  approveAndPublishReply,
  markCommentReviewed,
  syncSocialCommentsNow,
} from "../actions";

// Bump function timeout past Vercel's 10s default — comment sync
// walks every published target and makes one Graph API call per
// target, which adds up quickly even with a small handful of posts.
export const maxDuration = 60;

type SearchParams = Promise<{
  drafted?: string;
  published?: string;
  marked?: string;
  error?: string;
  synced?: string;
  scanned?: string;
  seen?: string;
  new?: string;
  errors?: string;
  first_error?: string;
}>;

type CommentRow = {
  id: string;
  body: string;
  author_name: string | null;
  sentiment: string | null;
  urgency: string | null;
  review_state: string;
  ai_summary: string | null;
  observed_at: string;
};

type ReplyRow = {
  id: string;
  comment_id: string;
  draft_body: string;
  status: string;
  rejected_reason: string | null;
  created_at: string;
};

const URGENCY_LABEL: Record<string, { label: string; cls: string }> = {
  critical: { label: "🚨 حرج", cls: "bg-rose-600 dark:bg-rose-700 text-white" },
  high: { label: "⚠ مرتفع", cls: "bg-orange-100 dark:bg-orange-900/40 text-orange-900 dark:text-orange-300" },
  medium: { label: "متوسط", cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300" },
  low: { label: "منخفض", cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" },
};

const SENTIMENT_ICON: Record<string, string> = {
  positive: "😊",
  neutral: "😐",
  negative: "😡",
  question: "❓",
  spam: "🗑",
};

export default async function SocialInbox({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [commentsRes, repliesRes] = await Promise.all([
    supabase
      .from("social_comments")
      .select(
        "id, body, author_name, sentiment, urgency, review_state, ai_summary, observed_at",
      )
      .order("urgency", { ascending: false })
      .order("observed_at", { ascending: false })
      .limit(50)
      .returns<CommentRow[]>(),
    supabase
      .from("social_replies")
      .select("id, comment_id, draft_body, status, rejected_reason, created_at")
      .in("status", ["pending_approval", "approved", "publishing", "failed"])
      .order("created_at", { ascending: false })
      .returns<ReplyRow[]>(),
  ]);

  const comments = commentsRes.data ?? [];
  const replies = repliesRes.data ?? [];
  const replyByCommentId = new Map<string, ReplyRow>();
  for (const r of replies) {
    if (!replyByCommentId.has(r.comment_id)) {
      replyByCommentId.set(r.comment_id, r);
    }
  }

  const tableMissing =
    !!commentsRes.error &&
    /relation .* does not exist|42P01|PGRST/i.test(
      commentsRes.error.message ?? "",
    );

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Transient action toasts now handled by <UrlToasts> in root
          layout. The sync-result detail panel below (first_error)
          stays inline because it is persistent diagnostics tied to
          the most-recent sync, not a transient confirmation. */}
      {sp.synced && sp.first_error && (
        <div className="mb-4 p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 font-cairo text-xs">
          <div className="font-bold mb-1">
            ⚠ سبب الفشل (أول error من Facebook):
          </div>
          <code className="block bg-white/60 dark:bg-slate-900/60 p-2 rounded text-[11px] break-all" dir="ltr">
            {decodeURIComponent(sp.first_error)}
          </code>
          {/Session has expired|access token/i.test(
            decodeURIComponent(sp.first_error),
          ) && (
            <div className="mt-2 text-[11px] leading-snug">
              💡 الـ Token انتهت صلاحيته — جدّده من Graph API Explorer
              وحدّثه في صفحة الحسابات، أو اضغط زرار{" "}
              <strong>🔐 60 يوم</strong> لو ضفت META_APP_ID/SECRET.
            </div>
          )}
          {/pages_read_user_content|permission/i.test(
            decodeURIComponent(sp.first_error),
          ) && (
            <div className="mt-2 text-[11px] leading-snug">
              💡 محتاج تضيف permission{" "}
              <code dir="ltr">pages_read_user_content</code> للـ Token
              من App Dashboard → Use Cases → Customize → Permissions.
            </div>
          )}
        </div>
      )}

      {tableMissing && (
        <div className="mb-5 bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-5 font-cairo">
          <h3 className="font-black text-amber-900 dark:text-amber-200 mb-2">
            ⚠ Migration 043 لسه ما اتطبّقتش
          </h3>
        </div>
      )}

      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black font-cairo text-slate-800 dark:text-slate-100 mb-1">
            💬 صندوق التعليقات
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-cairo">
            {comments.length} تعليق · AI بيدرّج الردود · انت توافق أو تعدّل
          </p>
        </div>
        <form action={syncSocialCommentsNow}>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-black font-cairo shadow hover:shadow-lg transition"
            title="اسحب التعليقات الجديدة من Facebook دلوقتي"
          >
            🔄 اسحب التعليقات
          </button>
        </form>
      </header>

      <div className="mb-5 p-3 bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-800 rounded-xl text-xs text-cyan-800 dark:text-cyan-300 font-cairo">
        ⚡ <strong>الـ Sync:</strong> الزرار فوق بيجلب التعليقات الجديدة من
        كل بوست منشور على Facebook. لو ضايف <code dir="ltr">vercel.json</code>
        فيه cron schedule على <code dir="ltr">/api/cron/sync-social-comments</code>{" "}
        كل 15 دقيقة، هيشتغل تلقائي.
      </div>

      {comments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-cairo mb-2">
            مفيش تعليقات لسه. اضغط <strong>"🔄 اسحب التعليقات"</strong> فوق
            علشان نجلبها من Facebook.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-cairo">
            💡 لو مفيش حد كومنت على بوستاتك لسه، الـ sync هيرجع 0 تعليق.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              draft={replyByCommentId.get(c.id) ?? null}
            />
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/admin/social"
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 font-cairo"
        >
          ← الرجوع للوحة Social
        </Link>
      </div>
    </div>
  );
}

function CommentCard({
  comment,
  draft,
}: {
  comment: CommentRow;
  draft: ReplyRow | null;
}) {
  const urgency = comment.urgency
    ? URGENCY_LABEL[comment.urgency]
    : URGENCY_LABEL.medium;
  const sentimentIcon = comment.sentiment
    ? SENTIMENT_ICON[comment.sentiment]
    : null;

  const stateLabel: Record<string, { text: string; cls: string }> = {
    pending: { text: "بانتظار اهتمام", cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300" },
    replied: { text: "اترد عليه", cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300" },
    ignored: { text: "تم تجاهله", cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" },
    escalated: { text: "محتاج انتباه شخصي", cls: "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300" },
  };
  const state = stateLabel[comment.review_state] ?? stateLabel.pending;

  return (
    <div
      className={`bg-white dark:bg-slate-900 border-2 rounded-2xl p-5 ${comment.urgency === "critical" ? "border-rose-400 dark:border-rose-600" : comment.urgency === "high" ? "border-orange-300 dark:border-orange-700" : "border-slate-200 dark:border-slate-800"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-cairo">
              {sentimentIcon} {comment.author_name ?? "user"}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-cairo ${urgency.cls}`}
            >
              {urgency.label}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-cairo ${state.cls}`}
            >
              {state.text}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-cairo">
            {new Date(comment.observed_at).toLocaleString("ar-EG", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </div>
        </div>
      </div>

      {/* Comment body */}
      <div className="bg-slate-50 dark:bg-slate-800 border-r-4 border-slate-300 dark:border-slate-600 p-3 rounded mb-3">
        <p className="text-sm text-slate-700 dark:text-slate-200 font-cairo leading-relaxed whitespace-pre-line">
          {comment.body}
        </p>
      </div>

      {comment.ai_summary && (
        <div className="text-[11px] text-violet-700 dark:text-violet-400 font-cairo mb-3">
          🧠 AI Summary: {comment.ai_summary}
        </div>
      )}

      {/* Reply state */}
      {draft ? (
        draft.status === "pending_approval" ? (
          // AI draft pending approval
          <form action={approveAndPublishReply} className="space-y-2">
            <input type="hidden" name="reply_id" value={draft.id} />
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 font-cairo mb-1">
              ✨ رد AI مقترح (عدّل لو حابب):
            </div>
            <textarea
              name="draft_body"
              defaultValue={draft.draft_body}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:border-emerald-400 dark:focus:border-emerald-600 outline-none text-sm font-cairo"
            />
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold text-sm font-cairo"
            >
              ✅ وافق + انشر الرد
            </button>
          </form>
        ) : draft.status === "rejected" ? (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-cairo text-amber-800 dark:text-amber-300">
            🤖 AI اقترح: لا ترد. {draft.rejected_reason}
          </div>
        ) : draft.status === "published" ? (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-cairo text-emerald-800 dark:text-emerald-300">
            ✅ الرد متنشر بنجاح
          </div>
        ) : draft.status === "failed" ? (
          <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-cairo text-rose-800 dark:text-rose-300">
            ❌ الرد فشل. حاول تاني من Composer.
          </div>
        ) : null
      ) : comment.review_state === "pending" ? (
        // No draft yet — show action buttons
        <div className="flex gap-2 flex-wrap">
          <form action={draftReplyForComment}>
            <input type="hidden" name="comment_id" value={comment.id} />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 text-white text-xs font-bold font-cairo"
            >
              ✦ اطلب AI يدرّج رد
            </button>
          </form>
          <form action={markCommentReviewed}>
            <input type="hidden" name="comment_id" value={comment.id} />
            <input type="hidden" name="review_state" value="escalated" />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-200 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold font-cairo"
            >
              🚩 ارفعها لانتباهي شخصياً
            </button>
          </form>
          <form action={markCommentReviewed}>
            <input type="hidden" name="comment_id" value={comment.id} />
            <input type="hidden" name="review_state" value="ignored" />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold font-cairo"
            >
              👋 تجاهل
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

// Flash helper removed — transient action messages now flow through
// sonner toasts via the root-layout <UrlToasts> reader (see
// src/components/url-toasts.tsx). Inline persistent diagnostics
// (migration-missing banner, sync first_error detail) stay rendered.
