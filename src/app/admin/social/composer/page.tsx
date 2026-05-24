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
  generateImageForPost,
  removeImageFromPost,
} from "../actions";

// Extends Vercel's 10s default to the Hobby-plan ceiling (60s) so:
//   - generateAndDraftPosts can call the LLM (Groq 120B can take 15-25s
//     for the multi-variant schema).
//   - generateImageForPost can run the visual-brief LLM + Gemini image
//     model + Supabase upload sequentially without timing out.
//   - publishSocialPost can hit multiple platform APIs sequentially.
export const maxDuration = 60;

type SearchParams = Promise<{
  generated?: string;
  saved?: string;
  first?: string;
  error?: string;
  img?: string;
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
  media_urls: string[] | null;
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
        "id, title, body, status, scheduled_for, source, ai_intent, tags, media_urls, created_at",
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
      {/* Transient action toasts now handled by <UrlToasts> in root
          layout. */}

      <header className="mb-6">
        <h1 className="text-2xl font-black font-cairo text-slate-800 dark:text-slate-100 mb-1">
          ✦ الكاتب الذكي
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-cairo">
          اكتب الموضوع → AI يولّد بوست لكل منصة → راجع → اضغط نشر.
        </p>
      </header>

      {/* GENERATOR FORM */}
      <section className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/30 dark:to-pink-900/30 border-2 border-rose-200 dark:border-rose-800 rounded-2xl p-6 mb-8">
        <h2 className="text-base font-black font-cairo text-slate-800 dark:text-slate-100 mb-3">
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
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-cairo mt-1">
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
                placeholder="https://nidhamhr.com/p/..."
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
                  className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700 cursor-pointer text-sm font-cairo"
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
            <summary className="cursor-pointer text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 font-cairo">
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
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-cairo text-center">
            ⏱ 15-30 ثانية لكل variant · مستخدم Groq gpt-oss-120b
          </p>
        </form>
      </section>

      {/* DRAFTS LIST */}
      <h2 className="text-base font-black font-cairo text-slate-800 dark:text-slate-100 mb-3">
        📋 المسودات والبوستات المجدولة ({orderedDrafts.length})
      </h2>

      {accounts.length === 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300 font-cairo">
          ⚠ مفيش حساب مربوط — مش هتقدر تنشر. روح{" "}
          <Link href="/admin/social/accounts" className="underline">
            ربط الحسابات
          </Link>{" "}
          أول.
        </div>
      )}

      {orderedDrafts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-cairo">
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
      className={`bg-white dark:bg-slate-900 border-2 rounded-2xl p-5 ${focused ? "border-rose-400 dark:border-rose-600 ring-4 ring-rose-100 dark:ring-rose-900/40" : "border-slate-200 dark:border-slate-800"}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {post.title && (
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 font-cairo">
              {post.title}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-cairo ${
                post.status === "scheduled"
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              {post.status === "scheduled" ? "⏰ مجدول" : "📝 مسودة"}
            </span>
            {post.source === "ai_generated" && (
              <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold font-cairo">
                ✦ AI
              </span>
            )}
            {post.ai_intent && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-cairo truncate">
                {post.ai_intent}
              </span>
            )}
          </div>
        </div>
        <form action={archiveSocialPost}>
          <input type="hidden" name="id" value={post.id} />
          <button
            type="submit"
            className="text-xs text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-cairo"
            title="أرشفة"
          >
            🗑
          </button>
        </form>
      </div>

      {/* Image preview + AI generator */}
      <ImageBlock post={post} />

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
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white font-bold text-sm font-cairo"
          >
            💾 احفظ
          </button>
        </div>
      </form>

      {/* Publish form */}
      {accounts.length > 0 && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 font-cairo">
            🚀 نشر فوري لـ:
          </div>
          <form action={publishSocialPost} className="space-y-2">
            <input type="hidden" name="post_id" value={post.id} />
            <div className="grid sm:grid-cols-2 gap-2">
              {accounts.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/30 border border-slate-200 dark:border-slate-700 cursor-pointer text-sm font-cairo"
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

/**
 * Image preview + AI image generator strip inside each post editor.
 *
 * UX intent:
 *   - If the post has no image, show a single big "Generate" CTA so the
 *     user understands images aren't required but heavily recommended.
 *   - If the post HAS images, show the most-recent (which is also the
 *     one the publisher will use) prominently + the older ones as small
 *     thumbnails with delete buttons.
 *   - Regenerate keeps re-trying without manual cleanup. We cap history
 *     at 5 in the action layer.
 */
function ImageBlock({ post }: { post: PostRow }) {
  const images = post.media_urls ?? [];
  const active = images[0];
  const history = images.slice(1);

  return (
    <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-slate-50 to-rose-50/30 dark:from-slate-800 dark:to-rose-900/20 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 font-cairo">
          🖼 صورة البوست
          {images.length > 0 && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-2">
              ({images.length}/5)
            </span>
          )}
        </div>
        <form action={generateImageForPost}>
          <input type="hidden" name="post_id" value={post.id} />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold font-cairo shadow-sm hover:shadow-md transition"
          >
            {active ? "🔄 ولّد صورة جديدة" : "✨ ولّد صورة بالـ AI"}
          </button>
        </form>
      </div>

      {!active ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-cairo">
          💡 البوستات بصور بتاخد engagement أكتر 5-10x. اضغط الزرار فوق
          والـ AI هيصمم صورة تناسب نص البوست.
          <br />
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            ⏱ 15-30 ثانية · مجاناً عبر Pollinations/FLUX
          </span>
        </p>
      ) : (
        <div className="space-y-2">
          {/* Active image — the one the publisher will use */}
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active}
              alt="صورة البوست"
              className="max-w-full sm:max-w-md max-h-72 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 shadow"
            />
            <span className="absolute top-1 right-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold font-cairo">
              ✅ نشطة
            </span>
            <form
              action={removeImageFromPost}
              className="absolute top-1 left-1"
            >
              <input type="hidden" name="post_id" value={post.id} />
              <input type="hidden" name="url" value={active} />
              <button
                type="submit"
                title="حذف الصورة"
                className="w-7 h-7 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-bold shadow"
              >
                ✕
              </button>
            </form>
          </div>

          {/* History thumbnails */}
          {history.length > 0 && (
            <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-cairo w-full">
                📚 إصدارات سابقة:
              </div>
              {history.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="إصدار سابق"
                    className="w-16 h-16 object-cover rounded border border-slate-200 dark:border-slate-700 opacity-70"
                  />
                  <form
                    action={removeImageFromPost}
                    className="absolute -top-1 -left-1"
                  >
                    <input type="hidden" name="post_id" value={post.id} />
                    <input type="hidden" name="url" value={url} />
                    <button
                      type="submit"
                      title="حذف"
                      className="w-5 h-5 rounded-full bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 text-[10px] shadow"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:border-rose-400 dark:focus:border-rose-600 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900/40 outline-none text-sm";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 font-cairo">
      {children}
    </label>
  );
}

function Req() {
  return <span className="text-rose-500 dark:text-rose-400"> *</span>;
}

// Flash helper removed — transient action messages now flow through
// sonner toasts via the root-layout <UrlToasts> reader (see
// src/components/url-toasts.tsx). Inline persistent diagnostics
// (e.g. migration-missing banner) stay rendered.
