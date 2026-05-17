// ============================================================================
// /admin/social — Social Growth Suite Home (super-admin only)
// ============================================================================
//
// At-a-glance view: connected accounts, recent posts, pending comments,
// quick stats. Each card deep-links to the relevant management page.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  archived?: string;
  published?: string;
  error?: string;
}>;

type AccountRow = {
  id: string;
  platform: string;
  display_label: string;
  is_active: boolean;
  last_used_at: string | null;
  last_error: string | null;
};

type PostRow = {
  id: string;
  title: string | null;
  body: string;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  source: string;
  ai_intent: string | null;
  created_at: string;
};

type TargetRow = {
  id: string;
  post_id: string;
  status: string;
  last_error: string | null;
  external_post_id: string | null;
  external_url: string | null;
  social_accounts: {
    platform: string;
    display_label: string;
  } | null;
};

type CommentRow = {
  id: string;
  body: string;
  author_name: string | null;
  sentiment: string | null;
  urgency: string | null;
  review_state: string;
  observed_at: string;
};

const PLATFORM_ICON: Record<string, string> = {
  facebook: "📘",
  instagram: "📸",
  twitter: "🐦",
  linkedin: "💼",
  tiktok: "🎵",
  youtube: "📺",
  threads: "🧵",
  telegram: "📨",
};

export default async function SocialHomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [accountsRes, postsRes, commentsRes] = await Promise.all([
    supabase
      .from("social_accounts")
      .select(
        "id, platform, display_label, is_active, last_used_at, last_error",
      )
      .order("platform")
      .returns<AccountRow[]>(),
    supabase
      .from("social_posts")
      .select(
        "id, title, body, status, scheduled_for, published_at, source, ai_intent, created_at",
      )
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<PostRow[]>(),
    supabase
      .from("social_comments")
      .select(
        "id, body, author_name, sentiment, urgency, review_state, observed_at",
      )
      .in("review_state", ["pending"])
      .order("observed_at", { ascending: false })
      .limit(10)
      .returns<CommentRow[]>(),
  ]);

  const accounts = accountsRes.data ?? [];
  const posts = postsRes.data ?? [];
  const pendingComments = commentsRes.data ?? [];

  // Fetch per-platform publish results for the visible posts so we can
  // surface error messages inline (otherwise the user has no way to see
  // WHY a post failed — Supabase only returns aggregate post.status).
  const postIds = posts.map((p) => p.id);
  let targetsByPost: Record<string, TargetRow[]> = {};
  if (postIds.length > 0) {
    const { data: targets } = await supabase
      .from("social_post_targets")
      .select(
        "id, post_id, status, last_error, external_post_id, external_url, social_accounts(platform, display_label)",
      )
      .in("post_id", postIds)
      .returns<TargetRow[]>();
    targetsByPost = (targets ?? []).reduce<Record<string, TargetRow[]>>(
      (acc, t) => {
        (acc[t.post_id] ??= []).push(t);
        return acc;
      },
      {},
    );
  }

  const tableMissing =
    !!postsRes.error &&
    /relation .* does not exist|42P01|PGRST/i.test(
      postsRes.error.message ?? "",
    );

  const stats = {
    accounts: accounts.length,
    accountsActive: accounts.filter((a) => a.is_active).length,
    draftPosts: posts.filter((p) => p.status === "draft").length,
    scheduledPosts: posts.filter((p) => p.status === "scheduled").length,
    publishedPosts: posts.filter((p) => p.status === "published").length,
    failedPosts: posts.filter(
      (p) => p.status === "failed" || p.status === "partially_failed",
    ).length,
    pendingComments: pendingComments.length,
    criticalComments: pendingComments.filter(
      (c) => c.urgency === "critical" || c.urgency === "high",
    ).length,
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {sp.archived && <Flash kind="ok">✓ تم الأرشفة</Flash>}
      {sp.published && (
        <Flash kind="ok">✅ تم النشر · شوف التفاصيل في كارت البوست</Flash>
      )}
      {sp.error && <Flash kind="err">⚠ {decodeURIComponent(sp.error)}</Flash>}

      {tableMissing && (
        <div className="mb-5 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 font-cairo">
          <h3 className="font-black text-amber-900 mb-2">
            ⚠ Migration 043 لسه ما اتطبّقتش
          </h3>
          <p className="text-sm text-amber-800">
            طبّق على Supabase الكود في:{" "}
            <code dir="ltr">db/migrations/043_social_media_growth_suite.sql</code>
          </p>
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
          مرحباً يا basem — هنا بتكتب وبتنشر وبتبيع
        </h1>
        <p className="text-sm text-slate-500 font-cairo">
          AI بيصمم البوستات · انت بتراجعها · النظام بينشرها على كل
          حساباتك · بيرد على التعليقات (بموافقتك).
        </p>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Kpi
          icon="🔌"
          label="حسابات مربوطة"
          value={`${stats.accountsActive}/${stats.accounts}`}
          color="cyan"
        />
        <Kpi
          icon="✏"
          label="مسودات + جدولة"
          value={stats.draftPosts + stats.scheduledPosts}
          color="amber"
        />
        <Kpi
          icon="✅"
          label="منشورة"
          value={stats.publishedPosts}
          color="emerald"
        />
        <Kpi
          icon="🚨"
          label="تعليقات تحتاج اهتمام"
          value={stats.pendingComments}
          color={stats.criticalComments > 0 ? "rose" : "slate"}
        />
      </section>

      {/* Quick links */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <ActionCard
          href="/admin/social/composer"
          icon="✦"
          gradient="from-rose-500 to-pink-500"
          title="اكتب بوست جديد"
          desc="AI يولّد بوستات للمنصات اللي اخترتها — انت بس تراجع وتنشر."
        />
        <ActionCard
          href="/admin/social/accounts"
          icon="🔌"
          gradient="from-cyan-500 to-blue-500"
          title="ربط حساب جديد"
          desc="Facebook · Instagram · X · LinkedIn · Telegram + غيرهم."
        />
        <ActionCard
          href="/admin/social/inbox"
          icon="💬"
          gradient="from-violet-500 to-purple-500"
          title="رد على التعليقات"
          desc="AI بيدرّج رد لكل تعليق — انت توافق أو تعدّل قبل النشر."
        />
      </section>

      {/* Recent posts */}
      <section className="mb-8">
        <h2 className="text-sm font-black font-cairo text-slate-700 mb-3 flex items-center gap-2">
          📋 آخر البوستات ({posts.length})
        </h2>
        {posts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm text-slate-500 font-cairo mb-3">
              مفيش بوستات لسه. ابدأ بـ AI generator.
            </p>
            <Link
              href="/admin/social/composer"
              className="inline-block px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm font-cairo"
            >
              ✦ اكتب أول بوست
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {posts.slice(0, 9).map((p) => (
              <PostCard
                key={p.id}
                post={p}
                targets={targetsByPost[p.id] ?? []}
              />
            ))}
          </div>
        )}
      </section>

      {/* Connected accounts */}
      <section className="mb-8">
        <h2 className="text-sm font-black font-cairo text-slate-700 mb-3 flex items-center gap-2">
          🔌 الحسابات المربوطة ({accounts.length})
        </h2>
        {accounts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-slate-500 font-cairo mb-2">
              لسه مفيش حسابات مربوطة
            </p>
            <Link
              href="/admin/social/accounts"
              className="text-xs text-cyan-700 hover:text-cyan-900 font-bold font-cairo"
            >
              ابدأ ربط حساب ←
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {accounts.map((a) => (
              <AccountChip key={a.id} account={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: "cyan" | "amber" | "emerald" | "rose" | "slate";
}) {
  const cls: Record<typeof color, string> = {
    cyan: "from-cyan-50 to-white border-cyan-200 text-cyan-800",
    amber: "from-amber-50 to-white border-amber-200 text-amber-800",
    emerald: "from-emerald-50 to-white border-emerald-200 text-emerald-800",
    rose: "from-rose-50 to-white border-rose-200 text-rose-800",
    slate: "from-slate-50 to-white border-slate-200 text-slate-800",
  };
  return (
    <div className={`p-4 rounded-2xl bg-gradient-to-br ${cls[color]} border shadow-sm`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-2xl font-black font-display">{value}</div>
      <div className="text-[10px] opacity-80 font-cairo mt-1">{label}</div>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  desc,
  gradient,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className={`group block p-5 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg hover:shadow-xl transition hover:-translate-y-0.5`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="text-base font-black font-cairo mb-1">{title}</h3>
      <p className="text-xs opacity-90 font-cairo leading-snug">{desc}</p>
    </Link>
  );
}

function PostCard({
  post,
  targets,
}: {
  post: PostRow;
  targets: TargetRow[];
}) {
  const statusLabel: Record<string, { cls: string; text: string }> = {
    draft: { cls: "bg-slate-100 text-slate-700", text: "مسودة" },
    scheduled: { cls: "bg-amber-100 text-amber-800", text: "مجدول" },
    publishing: { cls: "bg-cyan-100 text-cyan-800", text: "بينشر…" },
    published: { cls: "bg-emerald-100 text-emerald-800", text: "منشور" },
    partially_failed: { cls: "bg-orange-100 text-orange-800", text: "نشر جزئي" },
    failed: { cls: "bg-rose-100 text-rose-800", text: "فشل" },
    archived: { cls: "bg-slate-100 text-slate-500", text: "مؤرشف" },
  };
  const status = statusLabel[post.status] ?? statusLabel.draft;

  return (
    <Link
      href={`/admin/social/composer?first=${post.id}`}
      className="bg-white border border-slate-200 hover:border-rose-300 rounded-2xl p-4 transition hover:shadow block"
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-cairo ${status.cls}`}
        >
          {status.text}
        </span>
        {post.source === "ai_generated" && (
          <span className="text-[10px] text-rose-700 font-bold">✦ AI</span>
        )}
      </div>
      {post.title && (
        <div className="text-xs font-bold text-slate-700 font-cairo mb-1 truncate">
          {post.title}
        </div>
      )}
      <p className="text-xs text-slate-600 font-cairo line-clamp-4 leading-relaxed whitespace-pre-line">
        {post.body}
      </p>
      <div className="text-[10px] text-slate-400 font-cairo mt-2">
        {new Date(post.created_at).toLocaleString("ar-EG", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </div>

      {/* Per-platform publish results — the most important debug info. */}
      {targets.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
          {targets.map((t) => {
            const platform = t.social_accounts?.platform ?? "?";
            const icon = PLATFORM_ICON[platform] ?? "🔌";
            const ok = t.status === "published";
            const failed = t.status === "failed";
            const pending =
              t.status === "queued" || t.status === "publishing";
            return (
              <div
                key={t.id}
                className={`text-[10px] font-cairo p-1.5 rounded ${
                  failed
                    ? "bg-rose-50"
                    : ok
                      ? "bg-emerald-50"
                      : "bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{icon}</span>
                  <span className="flex-1 truncate text-slate-700">
                    {t.social_accounts?.display_label ?? platform}
                  </span>
                  <span>
                    {ok ? "✅" : failed ? "❌" : pending ? "⏳" : "·"}
                  </span>
                </div>
                {failed && t.last_error && (
                  <div
                    className="text-rose-700 mt-1 text-[10px] leading-tight break-words"
                    dir="ltr"
                  >
                    ⚠ {t.last_error}
                  </div>
                )}
                {ok && t.external_url && (
                  <div className="mt-0.5">
                    <span className="text-emerald-700 underline" dir="ltr">
                      {t.external_url.slice(0, 50)}…
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}

function AccountChip({ account }: { account: AccountRow }) {
  return (
    <div
      className={`p-3 rounded-xl border ${account.is_active ? "bg-white border-slate-200" : "bg-slate-50 border-slate-300 opacity-60"}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">
          {PLATFORM_ICON[account.platform] ?? "🔌"}
        </span>
        <span className="text-xs font-bold font-cairo text-slate-800 truncate">
          {account.display_label}
        </span>
      </div>
      <div className="text-[10px] text-slate-500 font-cairo">
        {account.is_active ? "🟢 نشط" : "⏸ متوقف"}
      </div>
      {account.last_error && (
        <div className="text-[10px] text-rose-600 font-cairo mt-1 truncate" title={account.last_error}>
          ⚠ {account.last_error}
        </div>
      )}
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
