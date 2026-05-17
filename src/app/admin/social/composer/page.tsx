// ============================================================================
// /admin/social/composer — AI generate posts + review + publish
// ============================================================================

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  generateAndDraftPosts,
  updateSocialPost,
  publishSocialPost,
  archiveSocialPost,
} from "../actions";

type SearchParams = Promise<{
  generated?: string;
  saved?: string;
  first?: string;
  error?: string;
}>;

type PostRow = {
  id: string;
  title: string | null;
  body: string;
  status: string;
  scheduled_for: string | null;
  source: string;
  ai_intent: string | null;
  tags: string[] | null;
  created_at: string;
};

type AccountRow = {
  id: string;
  platform: string;
  display_label: string;
  is_active: boolean;
};

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  threads: "Threads",
  telegram: "Telegram",
};

export default async function SocialComposer({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [draftsRes, accountsRes] = await Promise.all([
    supabase
      .from("social_posts")
      .select(
        "id, title, body, status, scheduled_for, source, ai_intent, tags, created_at",
      )
      .in("status", ["draft", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(15)
      .returns<PostRow[]>(),
    supabase
      .from("social_accounts")
      .select("id, platform, display_label, is_active")
      .eq("is_active", true)
      .order("platform")
      .returns<AccountRow[]>(),
  ]);

  const drafts = draftsRes.data ?? [];
  const accounts = accountsRes.data ?? [];

  // If a "first" param is set, surface that draft at top — used after
  // generate/save flows to land the user directly on the post they just
  // touched.
  const focusedId = sp.first ?? null;
  const orderedDrafts = focusedId
    ? [
        ...drafts.filter((d) => d.id === focusedId),
        ...drafts.filter((d) => d.id !== focusedId),
      ]
    : drafts;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {sp.generated && (
        <Flash kind="ok">
          ✨ تم توليد {sp.generated} variant — مرّحبة بمراجعتك وتعديلك تحت
        </Flash>
      )}
      {sp.saved && <Flash kind="ok">💾 تم حفظ التعديلات</Flash>}
      {sp.error && (
        <Flash kind="err">⚠ {decodeURIComponent(sp.error)}</Flash>
      )}

      <header className="mb-6">
        <h1 className="text-2xl font-black font-cairo text-slate-800 mb-1">
          ✦ الكاتب الذكي
        </h1>
        <p className="text-sm text-slate-500 font-cairo">
          اكتب الموضوع → AI يولّد بوست لكل منصة → راجع → اضغط نشر.
        </p>
      </header>

      {/* GENERATOR FORM */}
      <section className="bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-200 rounded-2xl p-6 mb-8">
        <h2 className="text-base font-black font-cairo text-slate-800 mb-3">
          📝 موضوع البوست الجديد
        </h2>
        <form action={generateAndDraftPosts} className="space-y-3">
          <div>
            <Label>الموضوع <Req /></Label>
            <textarea
              name="topic"
              required
              minLength={5}
              rows={3}
              placeholder="مثلاً: ميزة جديدة في الـ payroll بتحسب التأمينات تلقائياً + قصة عميل وفّر 8 ساعات شهرياً + لينك للـ landing page"
              className={inputCls}
            />
            <p className="text-[10px] text-slate-500 font-cairo mt-1">
              💡 كل ما الموضوع محدد وفيه أرقام / case study، كل ما الـ AI يولّد بوست أحسن.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>الهدف</Label>
              <select name="goal" defaultValue="lead_generation" className={inputCls}>
                <option value="lead_generation">🎯 جذب leads</option>
                <option value="awareness">📢 زيادة وعي بـ Nidham</option>
                <option value="engagement">💬 تفاعل + reshares</option>
                <option value="thought_leadership">🧠 صوت موثوق في المجال</option>
                <option value="feature_launch">🚀 إطلاق ميزة جديدة</option>
              </select>
            </div>
            <div>
              <Label>رابط مرجعي (اختياري)</Label>
              <input
                type="url"
                name="reference_url"
                placeholder="https://nidham-seven.vercel.app/p/..."
                className={inputCls}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <Label>المنصات (اختر واحدة على الأقل) <Req /></Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
              {(
                [
                  "facebook",
                  "instagram",
                  "twitter",
                  "linkedin",
                  "tiktok",
                  "telegram",
                ] as const
              ).map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:border-rose-300 cursor-pointer text-sm font-cairo"
                >
                  <input
                    type="checkbox"
                    name="platforms"
                    value={p}
                    defaultChecked={p === "facebook" || p === "instagram"}
                  />
                  <span>{PLATFORM_LABEL[p]}</span>
                </label>
              ))}
            </div>
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-slate-500 hover:text-rose-700 font-cairo">
              ✏ تعديل الـ tone (اختياري)
            </summary>
            <div className="mt-2">
              <textarea
                name="brand_voice_override"
                rows={2}
                placeholder="مثلاً: 'يكون أكتر هزلي', 'استخدم أسلوب case-study بسرد قصصي'..."
                className={inputCls}
              />
            </div>
          </details>

          <button
            type="submit"
            className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 text-white font-black font-cairo shadow-md hover:shadow-lg transition"
          >
            ✦ ولّد البوستات بالـ AI
          </button>
          <p className="text-[10px] text-slate-500 font-cairo text-center">
            ⏱ 15-30 ثانية لكل variant · مستخدم Groq gpt-oss-120b
          </p>
        </form>
      </section>

      {/* DRAFTS LIST */}
      <h2 className="text-base font-black font-cairo text-slate-800 mb-3">
        📋 المسودات والبوستات المجدولة ({orderedDrafts.length})
      </h2>

      {accounts.length === 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 font-cairo">
          ⚠ مفيش حساب مربوط — مش هتقدر تنشر. روح{" "}
          <Link href="/admin/social/accounts" className="underline">
            ربط الحسابات
          </Link>{" "}
          أول.
        </div>
      )}

      {orderedDrafts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-sm text-slate-500 font-cairo">
            مفيش مسودات. عبّى الفورم فوق وولّد أول بوست.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orderedDrafts.map((post) => (
            <PostEditor
              key={post.id}
              post={post}
              accounts={accounts}
              focused={post.id === focusedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PostEditor({
  post,
  accounts,
  focused,
}: {
  post: PostRow;
  accounts: AccountRow[];
  focused: boolean;
}) {
  return (
    <div
      className={`bg-white border-2 rounded-2xl p-5 ${focused ? "border-rose-400 ring-4 ring-rose-100" : "border-slate-200"}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {post.title && (
            <div className="text-sm font-bold text-slate-700 font-cairo">
              {post.title}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-cairo ${
                post.status === "scheduled"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {post.status === "scheduled" ? "⏰ مجدول" : "📝 مسودة"}
            </span>
            {post.source === "ai_generated" && (
              <span className="text-[10px] text-rose-700 font-bold font-cairo">
                ✦ AI
              </span>
            )}
            {post.ai_intent && (
              <span className="text-[10px] text-slate-500 font-cairo truncate">
                {post.ai_intent}
              </span>
            )}
          </div>
        </div>
        <form action={archiveSocialPost}>
          <input type="hidden" name="id" value={post.id} />
          <button
            type="submit"
            className="text-xs text-slate-400 hover:text-rose-600 font-cairo"
            title="أرشفة"
          >
            🗑
          </button>
        </form>
      </div>

      {/* Edit form */}
      <form action={updateSocialPost} className="space-y-3 mb-3">
        <input type="hidden" name="id" value={post.id} />
        <textarea
          name="body"
          rows={8}
          defaultValue={post.body}
          className={`${inputCls} font-cairo`}
        />
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label>جدولة (اختياري)</Label>
            <input
              type="datetime-local"
              name="scheduled_for"
              defaultValue={
                post.scheduled_for
                  ? new Date(post.scheduled_for).toISOString().slice(0, 16)
                  : ""
              }
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm font-cairo"
          >
            💾 احفظ
          </button>
        </div>
      </form>

      {/* Publish form */}
      {accounts.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-600 mb-2 font-cairo">
            🚀 نشر فوري لـ:
          </div>
          <form action={publishSocialPost} className="space-y-2">
            <input type="hidden" name="post_id" value={post.id} />
            <div className="grid sm:grid-cols-2 gap-2">
              {accounts.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-rose-50 border border-slate-200 cursor-pointer text-sm font-cairo"
                >
                  <input type="checkbox" name="account_ids" value={a.id} />
                  <span>
                    {PLATFORM_LABEL[a.platform] ?? a.platform} — {a.display_label}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm font-cairo shadow-md hover:shadow-lg transition"
            >
              🚀 انشر دلوقتي
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-200 outline-none text-sm";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
      {children}
    </label>
  );
}

function Req() {
  return <span className="text-rose-500"> *</span>;
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
