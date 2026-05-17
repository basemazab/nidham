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
  critical: { label: "🚨 حرج", cls: "bg-rose-600 text-white" },
  high: { label: "⚠ مرتفع", cls: "bg-orange-100 text-orange-900" },
  medium: { label: "متوسط", cls: "bg-amber-100 text-amber-900" },
  low: { label: "منخفض", cls: "bg-slate-100 text-slate-700" },
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
      {sp.drafted && <Flash kind="ok">✨ تم درافت رد AI — راجعه تحت</Flash>}
      {sp.published && <Flash kind="ok">✅ تم نشر الرد على المنصة</Flash>}
      {sp.marked && <Flash kind="ok">✓ تم التحديث</Flash>}
      {sp.synced && (
        <Flash kind="ok">
          🔄 تم الـ Sync · فحصنا {sp.scanned ?? 0} بوست منشور · شفنا{" "}
          {sp.seen ?? 0} تعليق · جديد {sp.new ?? 0}
          {Number(sp.errors ?? 0) > 0
            ? ` · ⚠ ${sp.errors} خطأ`
            : ""}
        </Flash>
      )}
      {sp.error && <Flash kind="err">⚠ {decodeURIComponent(sp.error)}</Flash>}

      {tableMissing && (
        <div className="mb-5 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 font-cairo">
          <h3 className="font-black text-amber-900 mb-2">
            ⚠ Migration 043 لسه ما اتطبّقتش
          </h3>
        </div>
      )}

      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black font-cairo text-slate-800 mb-1">
            💬 صندوق التعليقات
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
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

      <div className="mb-5 p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-800 font-cairo">
        ⚡ <strong>الـ Sync:</strong> الزرار فوق بيجلب التعليقات الجديدة من
        كل بوست منشور على Facebook. لو ضايف <code dir="ltr">vercel.json</code>
        فيه cron schedule على <code dir="ltr">/api/cron/sync-social-comments</code>{" "}
        كل 15 دقيقة، هيشتغل تلقائي.
      </div>

      {comments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-sm text-slate-500 font-cairo mb-2">
            مفيش تعليقات لسه. اضغط <strong>"🔄 اسحب التعليقات"</strong> فوق
            علشان نجلبها من Facebook.
          </p>
          <p className="text-xs text-slate-400 font-cairo">
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
          className="text-xs text-slate-500 hover:text-rose-700 font-cairo"
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
    pending: { text: "بانتظار اهتمام", cls: "bg-amber-100 text-amber-800" },
    replied: { text: "اترد عليه", cls: "bg-emerald-100 text-emerald-800" },
    ignored: { text: "تم تجاهله", cls: "bg-slate-100 text-slate-600" },
    escalated: { text: "محتاج انتباه شخصي", cls: "bg-rose-100 text-rose-800" },
  };
  const state = stateLabel[comment.review_state] ?? stateLabel.pending;

  return (
    <div
      className={`bg-white border-2 rounded-2xl p-5 ${comment.urgency === "critical" ? "border-rose-400" : comment.urgency === "high" ? "border-orange-300" : "border-slate-200"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-bold text-slate-800 font-cairo">
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
          <div className="text-[10px] text-slate-400 font-cairo">
            {new Date(comment.observed_at).toLocaleString("ar-EG", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </div>
        </div>
      </div>

      {/* Comment body */}
      <div className="bg-slate-50 border-r-4 border-slate-300 p-3 rounded mb-3">
        <p className="text-sm text-slate-700 font-cairo leading-relaxed whitespace-pre-line">
          {comment.body}
        </p>
      </div>

      {comment.ai_summary && (
        <div className="text-[11px] text-violet-700 font-cairo mb-3">
          🧠 AI Summary: {comment.ai_summary}
        </div>
      )}

      {/* Reply state */}
      {draft ? (
        draft.status === "pending_approval" ? (
          // AI draft pending approval
          <form action={approveAndPublishReply} className="space-y-2">
            <input type="hidden" name="reply_id" value={draft.id} />
            <div className="text-[11px] font-bold text-emerald-700 font-cairo mb-1">
              ✨ رد AI مقترح (عدّل لو حابب):
            </div>
            <textarea
              name="draft_body"
              defaultValue={draft.draft_body}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-emerald-200 focus:border-emerald-400 outline-none text-sm font-cairo"
            />
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm font-cairo"
            >
              ✅ وافق + انشر الرد
            </button>
          </form>
        ) : draft.status === "rejected" ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-cairo text-amber-800">
            🤖 AI اقترح: لا ترد. {draft.rejected_reason}
          </div>
        ) : draft.status === "published" ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-cairo text-emerald-800">
            ✅ الرد متنشر بنجاح
          </div>
        ) : draft.status === "failed" ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-cairo text-rose-800">
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
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold font-cairo"
            >
              ✦ اطلب AI يدرّج رد
            </button>
          </form>
          <form action={markCommentReviewed}>
            <input type="hidden" name="comment_id" value={comment.id} />
            <input type="hidden" name="review_state" value="escalated" />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold font-cairo"
            >
              🚩 ارفعها لانتباهي شخصياً
            </button>
          </form>
          <form action={markCommentReviewed}>
            <input type="hidden" name="comment_id" value={comment.id} />
            <input type="hidden" name="review_state" value="ignored" />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold font-cairo"
            >
              👋 تجاهل
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Flash({
  kind,
  children,
}: {
  kind: "ok" | "err";
  children: React.ReactNode;
}) {
  const cls =
    kind === "ok"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : "bg-rose-50 border-rose-200 text-rose-800";
  return (
    <div className={`mb-4 p-3 rounded-xl border font-cairo text-sm ${cls}`}>
      {children}
    </div>
  );
}
