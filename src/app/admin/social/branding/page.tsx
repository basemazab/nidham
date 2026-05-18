// ============================================================================
// /admin/social/branding — Generate FB Page profile + cover images
// ============================================================================
//
// Why a separate page and not inline on /admin/social/accounts:
//   - Branding is a ONE-TIME setup the operator does after creating a
//     Page. It deserves its own focused workflow.
//   - We don't auto-upload to Facebook via API. The Pages API for setting
//     profile / cover requires `pages_manage_metadata` AND going through
//     App Review for any user that's not the developer. Manual download +
//     upload via Facebook's UI is friendlier + works today.
//   - The same images may later be used for IG, Twitter, LinkedIn — so
//     they live in their own bucket scope, not tied to one account row.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  generateBrandProfile,
  generateBrandCover,
  uploadBrandImage,
} from "../actions";
import { UploadButton } from "./upload-button";

// Vercel Hobby plan defaults serverless functions to 10s. Image
// generation through Gemini takes 8-30s for the cover (16:9 is heavier
// than 1:1), plus storage upload, so we bump to 60s — the Hobby plan's
// hard ceiling. This applies to both the GET render and the POST
// dispatched server actions on this route (generateBrandProfile /
// generateBrandCover).
export const maxDuration = 60;

type SearchParams = Promise<{
  profile?: string;
  cover?: string;
  uploaded?: string;
  error?: string;
}>;

type SettingRow = {
  key: string;
  value: unknown;
};

/**
 * social_settings.value is jsonb. Stored as JSON-encoded string (see
 * upsertAppSetting). Recover the raw string here for img src.
 */
function unwrapStringSetting(rows: SettingRow[], key: string): string | null {
  const row = rows.find((r) => r.key === key);
  if (!row) return null;
  const v = row.value;
  if (typeof v === "string") {
    // Some legacy rows stored as raw string (no JSON.stringify). Detect
    // by looking for stray quote chars.
    if (v.startsWith('"') && v.endsWith('"')) {
      try {
        return JSON.parse(v) as string;
      } catch {
        return v;
      }
    }
    return v;
  }
  return null;
}

export default async function BrandingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("social_settings")
    .select("key, value")
    .in("key", ["brand_profile_image_url", "brand_cover_image_url"])
    .returns<SettingRow[]>();

  const profileUrl = unwrapStringSetting(
    settings ?? [],
    "brand_profile_image_url",
  );
  const coverUrl = unwrapStringSetting(
    settings ?? [],
    "brand_cover_image_url",
  );

  // Pull the connected Facebook Page id so the "open my page" link is
  // accurate for whichever tenant is logged in (no more hardcoded
  // 61589810406479). If there's no FB account yet, the link section
  // gets a graceful fallback to the Pages search.
  const { data: fbAccount } = await supabase
    .from("social_accounts")
    .select("external_id, display_label")
    .eq("platform", "facebook")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ external_id: string; display_label: string }>();

  const fbPageUrl = fbAccount?.external_id
    ? `https://www.facebook.com/${fbAccount.external_id}`
    : "https://www.facebook.com/pages/";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Transient action toasts now handled by <UrlToasts> in root
          layout. */}

      <header className="mb-6">
        <h1 className="text-2xl font-black font-cairo text-slate-800 dark:text-slate-100 mb-1">
          🎨 هوية بصرية للـ Facebook Page
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-cairo">
          عندك خياران: ولّد صورة بالـ AI أو ارفع صورتك الجاهزة (لو معاك من
          مصمم أو Canva). الاتنين بيتخزّنوا في نفس المكان وبتقدر تنزّلهم
          ترفعهم يدوياً على Facebook.
        </p>
      </header>

      {/* Quality note — set expectations honestly */}
      <div className="mb-5 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-cairo">
        💡 <strong>ملحوظة عن جودة الـ AI:</strong> النماذج المجانية
        (Gemini Flash Image + FLUX Schnell) جودتها متوسطة — مناسبة
        للبوستات اليومية بس مش لـ branding احترافي. **للهوية البصرية يفضّل ترفع
        صورة جاهزة من مصمم أو من Canva.**
      </div>

      {/* PROFILE PICTURE */}
      <section className="mb-8 p-5 bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-black font-cairo text-slate-800 dark:text-slate-100">
              👤 الصورة الشخصية (Profile Picture)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-cairo mt-0.5">
              1080×1080 مربعة · مناسبة لـ FB + IG + LinkedIn
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <UploadButton
              action={uploadBrandImage}
              slot="profile"
              label="📤 ارفع صورتك"
            />
            <form action={generateBrandProfile}>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-black font-cairo shadow hover:shadow-lg transition"
              >
                {profileUrl ? "🔄 ولّد بديل بالـ AI" : "✨ ولّد بالـ AI"}
              </button>
            </form>
          </div>
        </div>

        {profileUrl ? (
          <div className="flex items-start gap-4 flex-wrap">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profileUrl}
                alt="Nidham profile"
                className="w-48 h-48 rounded-full border-4 border-indigo-300 dark:border-indigo-700 shadow-lg"
              />
            </div>
            <div className="flex-1 min-w-[250px]">
              <h3 className="text-sm font-bold font-cairo text-slate-700 dark:text-slate-200 mb-2">
                📥 إزاي تنزّلها وترفعها على Facebook:
              </h3>
              <ol className="text-xs text-slate-600 dark:text-slate-300 font-cairo space-y-1.5 list-decimal pr-5">
                <li>
                  اضغط <strong>تحميل الصورة</strong> تحت
                </li>
                <li>
                  ادخل صفحتك على Facebook (
                  <a
                    href={fbPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-700 dark:text-indigo-400 underline"
                  >
                    {fbAccount?.display_label ?? "افتح Facebook Page"}
                  </a>
                  )
                </li>
                <li>
                  اضغط على الصورة الحالية (الـ N الأخضر) → <strong>Edit Profile Picture</strong>
                </li>
                <li>
                  اختار <strong>Upload Photo</strong> → ارفع الصورة اللي
                  حمّلتها
                </li>
              </ol>
              <a
                href={profileUrl}
                download="nidham-profile.png"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black font-cairo shadow"
              >
                📥 تحميل الصورة
              </a>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
            <div className="text-5xl mb-2">🖼</div>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-cairo">
              لسه ما تم توليد صورة شخصية. اضغط الزرار فوق علشان نبدأ.
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-cairo mt-1">
              ⏱ 20-40 ثانية
            </p>
          </div>
        )}
      </section>

      {/* COVER */}
      <section className="mb-8 p-5 bg-white dark:bg-slate-900 border-2 border-purple-200 dark:border-purple-800 rounded-2xl">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-black font-cairo text-slate-800 dark:text-slate-100">
              🌅 صورة الغلاف (Cover)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-cairo mt-0.5">
              1280×720 (16:9) · مناسبة لـ FB cover + LinkedIn banner
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <UploadButton
              action={uploadBrandImage}
              slot="cover"
              label="📤 ارفع غلافك"
            />
            <form action={generateBrandCover}>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white text-sm font-black font-cairo shadow hover:shadow-lg transition"
              >
                {coverUrl ? "🔄 ولّد بديل بالـ AI" : "✨ ولّد بالـ AI"}
              </button>
            </form>
          </div>
        </div>

        {coverUrl ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt="Nidham cover"
              className="w-full rounded-lg border-2 border-purple-300 dark:border-purple-700 shadow-lg"
            />
            <div className="flex items-start gap-4 flex-wrap">
              <a
                href={coverUrl}
                download="nidham-cover.png"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black font-cairo shadow"
              >
                📥 تحميل الغلاف
              </a>
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-600 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-400 font-cairo">
                  ⚙ خطوات رفعها على Facebook
                </summary>
                <ol className="mt-2 text-xs text-slate-600 dark:text-slate-300 font-cairo space-y-1.5 list-decimal pr-5">
                  <li>افتح صفحة Nidham Egypt على Facebook</li>
                  <li>
                    اضغط على منطقة الغلاف الفاضية → <strong>Add a cover photo</strong>
                  </li>
                  <li>
                    اختار <strong>Upload photo</strong> → ارفع الصورة
                  </li>
                  <li>ممكن تـ adjust الـ position قبل ما تحفظ</li>
                </ol>
              </details>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
            <div className="text-5xl mb-2">🌄</div>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-cairo">
              لسه ما تم توليد غلاف. اضغط الزرار فوق علشان نبدأ.
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-cairo mt-1">
              ⏱ 25-50 ثانية (الـ 16:9 بياخد وقت أطول من المربع)
            </p>
          </div>
        )}
      </section>

      {/* TIPS */}
      <section className="p-5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-2xl mb-6">
        <h3 className="text-sm font-black font-cairo text-amber-900 dark:text-amber-200 mb-2">
          💡 نصايح لو الصورة مش معجباك
        </h3>
        <ul className="text-xs text-amber-800 dark:text-amber-300 font-cairo space-y-1 list-disc pr-5">
          <li>
            اضغط <strong>"🔄 ولّد بديل"</strong> أكتر من مرة — كل مرة AI
            بيـ try ستايل تاني
          </li>
          <li>
            FLUX (الـ image model اللي بنستخدمه) بيـ avoid clichés
            المصرية (أهرام، جمل) — هتخرج صور office صرفة
          </li>
          <li>
            الصور كلها متخزّنة في Supabase Storage — تقدر تنزّل أي
            إصدار قديم من <code dir="ltr">/dashboard</code> → Storage →
            bucket <code dir="ltr">social-media</code>
          </li>
        </ul>
      </section>

      <div className="text-center">
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

// Flash helper removed — transient action messages now flow through
// sonner toasts via the root-layout <UrlToasts> reader (see
// src/components/url-toasts.tsx).
