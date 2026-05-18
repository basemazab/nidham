// ============================================================================
// /admin/social/accounts — connect / disconnect social platforms
// ============================================================================

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  saveSocialAccount,
  deleteSocialAccount,
  toggleSocialAccountActive,
  refreshFacebookTokenToLongLived,
} from "../actions";

// Bump Vercel's 10s default — refreshFacebookTokenToLongLived hits
// graph.facebook.com which can be slow on a cold connection, and
// saveSocialAccount runs the encryption RPC which adds ~500ms.
export const maxDuration = 60;

type SearchParams = Promise<{
  saved?: string;
  deleted?: string;
  toggled?: string;
  error?: string;
  long_lived?: string;
}>;

type AccountRow = {
  id: string;
  platform: string;
  external_id: string;
  display_label: string;
  is_active: boolean;
  last_used_at: string | null;
  last_error: string | null;
  token_expires_at: string | null;
  created_at: string;
};

const PLATFORM_GUIDE: Record<
  string,
  { icon: string; label: string; tokenSource: string; idLabel: string }
> = {
  facebook: {
    icon: "📘",
    label: "Facebook Page",
    tokenSource: "Graph API Explorer → اختر صفحتك → اطلب pages_manage_posts + pages_read_engagement + pages_manage_engagement",
    idLabel: "Page ID (15-25 رقم)",
  },
  instagram: {
    icon: "📸",
    label: "Instagram Business",
    tokenSource: "نفس الـ token بتاع Facebook Page المربوط (يتطلب تحويل IG لـ Business + Linked إلى FB Page)",
    idLabel: "IG User ID (رقم — مش الـ @handle)",
  },
  twitter: {
    icon: "🐦",
    label: "X (Twitter)",
    tokenSource: "developer.x.com → Basic plan ($100/month) → Bearer token",
    idLabel: "User ID (e.g. 1234567890)",
  },
  linkedin: {
    icon: "💼",
    label: "LinkedIn",
    tokenSource: "developer.linkedin.com → r_basicprofile + w_member_social → OAuth flow",
    idLabel: "Person/Org ID (للـ URN كامل ضعه في الـ metadata)",
  },
  telegram: {
    icon: "📨",
    label: "Telegram Channel (via Bot)",
    tokenSource: "كلّم @BotFather في Telegram → /newbot → خد الـ bot token (يبدأ بـ 1234:ABC...)",
    idLabel: "Channel chat_id (e.g. @nidhamsaas أو -1001234567890)",
  },
  tiktok: {
    icon: "🎵",
    label: "TikTok Business",
    tokenSource: "TikTok for Business Marketing API (يحتاج موافقة)",
    idLabel: "Advertiser ID",
  },
  youtube: {
    icon: "📺",
    label: "YouTube Channel",
    tokenSource: "Google Cloud Console → YouTube Data API v3 → OAuth",
    idLabel: "Channel ID (يبدأ بـ UC...)",
  },
  threads: {
    icon: "🧵",
    label: "Meta Threads",
    tokenSource: "Meta Threads API (مازال beta)",
    idLabel: "Threads User ID",
  },
};

export default async function SocialAccountsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: accountsData } = await supabase
    .from("social_accounts")
    .select(
      "id, platform, external_id, display_label, is_active, last_used_at, last_error, token_expires_at, created_at",
    )
    .order("created_at", { ascending: false })
    .returns<AccountRow[]>();

  const accounts = accountsData ?? [];

  const envReady = !!process.env.META_ENCRYPTION_KEY;

  // Compute which accounts are expiring soon so we can show a banner
  // at the top — operators routinely miss the per-row chip and don't
  // notice until publishes start failing. We treat <7 days as
  // "critical", <30 days as "warning". Null expiries (long-lived /
  // permanent / unspecified) are healthy.
  const expiringAccounts = accounts
    .filter((a) => a.is_active && a.token_expires_at)
    .map((a) => {
      const ms = new Date(a.token_expires_at as string).getTime() - Date.now();
      const days = Math.floor(ms / 86_400_000);
      return { account: a, days };
    })
    .filter((x) => x.days < 30)
    .sort((a, b) => a.days - b.days);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Transient action toasts now handled by <UrlToasts> in root
          layout. Persistent diagnostics (env-var missing, expiring tokens)
          remain inline below. */}

      {!envReady && (
        <div className="mb-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/30 border-2 border-rose-300 dark:border-rose-700 font-cairo">
          <h3 className="font-black text-rose-900 dark:text-rose-200 mb-1">
            ⚠ META_ENCRYPTION_KEY مش متعيّن
          </h3>
          <p className="text-sm text-rose-800 dark:text-rose-300">
            مش هتقدر تحفظ tokens بدون الـ env var ده. روح Vercel → Settings →
            Environment Variables، ضيف <code dir="ltr">META_ENCRYPTION_KEY</code>{" "}
            بـ string عشوائي 32+ char، Redeploy.
          </p>
        </div>
      )}

      {/* Token-expiry warning — only renders if at least one account
          is < 30 days from expiry. Critical (<7 days) gets a red
          banner; warning (<30 days) gets an amber one. */}
      {expiringAccounts.length > 0 && (
        <div
          className={`mb-5 p-4 rounded-2xl border-2 font-cairo ${
            expiringAccounts[0].days < 7
              ? "bg-rose-50 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200"
              : "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200"
          }`}
        >
          <h3 className="font-black mb-2">
            {expiringAccounts[0].days < 7 ? "🚨" : "⚠"} في{" "}
            {expiringAccounts.length} حساب tokens قربت تنتهي
          </h3>
          <ul className="text-sm space-y-1 list-disc pr-5">
            {expiringAccounts.map((x) => (
              <li key={x.account.id}>
                <strong>{x.account.display_label}</strong> —{" "}
                {x.days < 0
                  ? `انتهى من ${-x.days} يوم!`
                  : `هينتهي خلال ${x.days} يوم`}
                {x.account.platform === "facebook" && (
                  <span>
                    {" "}· اضغط <strong>🔐 60 يوم</strong> جنبه عشان تجدّده
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <header className="mb-6">
        <h1 className="text-2xl font-black font-cairo text-slate-800 dark:text-slate-100 mb-1">
          🔌 الحسابات المربوطة
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-cairo">
          {accounts.length} حساب · الـ tokens كلها متشفّرة بـ pgcrypto في قاعدة البيانات
        </p>
      </header>

      {/* Connected accounts */}
      {accounts.length > 0 && (
        <section className="mb-8 space-y-3">
          {accounts.map((a) => {
            const guide = PLATFORM_GUIDE[a.platform];
            return (
              <div
                key={a.id}
                className={`bg-white dark:bg-slate-900 border-2 rounded-2xl p-4 ${a.is_active ? "border-emerald-200 dark:border-emerald-800" : "border-slate-300 dark:border-slate-700 opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-3xl">{guide?.icon ?? "🔌"}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black font-cairo text-slate-800 dark:text-slate-100">
                          {a.display_label}
                        </h3>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${a.is_active ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                        >
                          {a.is_active ? "🟢 نشط" : "⏸ متوقف"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-cairo">
                        {guide?.label ?? a.platform} · ID:{" "}
                        <span className="font-mono" dir="ltr">{a.external_id}</span>
                      </div>
                      {a.last_error && (
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 font-cairo mt-1">
                          ⚠ {a.last_error}
                        </div>
                      )}
                      <TokenExpiryChip expiresAt={a.token_expires_at} />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {a.platform === "facebook" && (
                      <form action={refreshFacebookTokenToLongLived}>
                        <input type="hidden" name="account_id" value={a.id} />
                        <button
                          type="submit"
                          title="حوّل الـ Token لـ long-lived (60 يوم أو دائم)"
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-cairo border border-indigo-200 dark:border-indigo-800"
                        >
                          🔐 60 يوم
                        </button>
                      </form>
                    )}
                    <form action={toggleSocialAccountActive}>
                      <input type="hidden" name="id" value={a.id} />
                      <input
                        type="hidden"
                        name="target_state"
                        value={a.is_active ? "off" : "on"}
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold font-cairo"
                      >
                        {a.is_active ? "⏸" : "▶"}
                      </button>
                    </form>
                    <form action={deleteSocialAccount}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-bold font-cairo"
                      >
                        🗑
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Connect new */}
      <section className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30 border-2 border-cyan-200 dark:border-cyan-800 rounded-2xl p-6">
        <h2 className="text-base font-black font-cairo text-slate-800 dark:text-slate-100 mb-3">
          ➕ ربط حساب جديد
        </h2>

        <form action={saveSocialAccount} className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>المنصة <Req /></Label>
              <select name="platform" required className={inputCls} defaultValue="facebook">
                {Object.entries(PLATFORM_GUIDE).map(([key, g]) => (
                  <option key={key} value={key}>
                    {g.icon} {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>اسم وصفي (داخلي) <Req /></Label>
              <input
                type="text"
                name="display_label"
                required
                placeholder="مثلاً: Nidham Egypt - الصفحة الرسمية"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <Label>Platform ID <Req /></Label>
            <input
              type="text"
              name="external_id"
              required
              placeholder="Page ID / User ID / Channel ID..."
              className={`${inputCls} font-mono`}
              dir="ltr"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-cairo mt-1">
              📘 FB Page ID · 📸 IG User ID · 🐦 X User ID · 📨 Telegram chat_id
            </p>
          </div>

          <div>
            <Label>Access Token <Req /></Label>
            <textarea
              name="access_token"
              required
              rows={3}
              placeholder="EAAxxx... / Bearer token / Bot token..."
              className={`${inputCls} font-mono text-[10px]`}
              dir="ltr"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-cairo mt-1">
              🔒 بيتشفر بـ pgp_sym_encrypt قبل ما يتخزن. مش بيظهر تاني.
            </p>
          </div>

          <details>
            <summary className="cursor-pointer text-xs text-slate-600 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-400 font-cairo">
              🔧 Metadata إضافية حسب المنصة (Instagram URN / Telegram chat_id / LinkedIn URN)
            </summary>
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div>
                <Label>IG User ID (للـ Instagram)</Label>
                <input
                  type="text"
                  name="meta_ig_user_id"
                  className={`${inputCls} font-mono text-xs`}
                  dir="ltr"
                />
              </div>
              <div>
                <Label>FB Page ID المرتبط (للـ Instagram)</Label>
                <input
                  type="text"
                  name="meta_fb_page_id"
                  className={`${inputCls} font-mono text-xs`}
                  dir="ltr"
                />
              </div>
              <div>
                <Label>LinkedIn URN (urn:li:organization:123)</Label>
                <input
                  type="text"
                  name="meta_urn"
                  className={`${inputCls} font-mono text-xs`}
                  dir="ltr"
                />
              </div>
              <div>
                <Label>Telegram chat_id (@channel أو -100123)</Label>
                <input
                  type="text"
                  name="meta_chat_id"
                  className={`${inputCls} font-mono text-xs`}
                  dir="ltr"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Token Expiry (اختياري — للـ tokens اللي تنتهي)</Label>
                <input
                  type="datetime-local"
                  name="expires_at"
                  className={inputCls}
                />
              </div>
            </div>
          </details>

          <button
            type="submit"
            disabled={!envReady}
            className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-black font-cairo shadow-md hover:shadow-lg transition disabled:opacity-50"
          >
            🔗 احفظ + شفّر الـ Token
          </button>
        </form>
      </section>

      {/* Platform guide cheat-sheet */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-cyan-700 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300 font-bold font-cairo">
          📚 إزاي تجيب tokens لكل منصة؟ (دليل سريع)
        </summary>
        <div className="mt-3 space-y-3">
          {Object.entries(PLATFORM_GUIDE).map(([key, g]) => (
            <div
              key={key}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-cairo"
            >
              <div className="font-black text-slate-800 dark:text-slate-100 mb-1">
                {g.icon} {g.label}
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                <strong>الـ Token:</strong> {g.tokenSource}
              </div>
              <div className="text-slate-500 dark:text-slate-400 mt-1">
                <strong>الـ ID:</strong> {g.idLabel}
              </div>
            </div>
          ))}
        </div>
      </details>

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

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:border-cyan-400 dark:focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 dark:focus:ring-cyan-900/40 outline-none text-sm font-cairo";

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

/**
 * Visual indicator for token freshness. Three states:
 *   - null/missing      → "غير محدد"      (most non-FB platforms; harmless)
 *   - expires < 7 days  → red banner      (action needed soon)
 *   - expires < 30 days → amber           (heads up)
 *   - expires later     → green           (healthy)
 * Page tokens that "never expire" come back with null expires_at after
 * the long-lived exchange — we treat that same as "غير محدد" but with a
 * positive label.
 */
function TokenExpiryChip({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) {
    return (
      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-cairo mt-1">
        ⏱ صلاحية الـ Token: غير محددة (ممكن يكون دائم بعد long-lived)
      </div>
    );
  }
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const cls =
    days < 0
      ? "text-rose-600 dark:text-rose-400"
      : days < 7
        ? "text-rose-600 dark:text-rose-400"
        : days < 30
          ? "text-amber-700 dark:text-amber-400"
          : "text-emerald-700 dark:text-emerald-400";
  const icon = days < 7 ? "🚨" : days < 30 ? "⚠" : "🟢";
  const label =
    days < 0
      ? "انتهى — جدّده!"
      : days < 7
        ? `هينتهي خلال ${days} يوم — جدّده!`
        : `هينتهي بعد ${days} يوم`;
  return (
    <div className={`text-[10px] font-cairo mt-1 font-bold ${cls}`}>
      {icon} الـ Token {label}
    </div>
  );
}

// Flash helper removed — transient action messages now flow through
// sonner toasts via the root-layout <UrlToasts> reader (see
// src/components/url-toasts.tsx). Inline persistent diagnostics
// (env-var missing, expiring-tokens list) stay rendered.
