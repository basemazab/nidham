// ============================================================================
// /dashboard/marketing/integrations — Marketing platform integrations
// ============================================================================
//
// V1 = Meta Lead Ads (Facebook + Instagram). Future: Google Ads, TikTok
// Ads, ZapMail, etc.
//
// The page has THREE jobs:
//   1) Onboard a NEW tenant through the (admittedly painful) Meta App
//      setup process, with screen-by-screen instructions in Arabic.
//   2) Let a tenant paste in their Page Access Token to connect a page.
//   3) Show health for each connected integration: last webhook
//      received, webhooks count, leads imported, last error.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import {
  connectMetaPage,
  disconnectMetaPage,
  toggleMetaPageActive,
} from "./actions";

type SearchParams = Promise<{
  error?: string;
  connected?: string;
  disconnected?: string;
  toggled?: string;
}>;

type Integration = {
  id: string;
  page_id: string;
  page_name: string;
  app_id: string | null;
  display_label: string | null;
  default_landing_page_id: string | null;
  is_active: boolean;
  last_webhook_at: string | null;
  last_error: string | null;
  webhooks_received: number;
  leads_imported: number;
  created_at: string;
};

type ImportRow = {
  id: string;
  leadgen_id: string;
  outcome: string;
  error_message: string | null;
  occurred_at: string;
  customer_id: string | null;
};

type LandingPageMini = { id: string; name: string };

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await canUseFeature("marketing_studio"))) {
    return <UpgradeRequired feature="marketing_studio" />;
  }

  const sp = await searchParams;

  // Scope every tenant-scoped query to the caller's company.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [integrationsRes, importsRes, pagesRes] = await Promise.all([
    supabase
      .from("meta_integrations")
      .select(
        "id, page_id, page_name, app_id, display_label, default_landing_page_id, is_active, last_webhook_at, last_error, webhooks_received, leads_imported, created_at",
      )
      .eq("company_id", callerCompanyId)
      .order("created_at", { ascending: false })
      .returns<Integration[]>(),
    supabase
      .from("meta_lead_imports")
      .select("id, leadgen_id, outcome, error_message, occurred_at, customer_id")
      .eq("company_id", callerCompanyId)
      .order("occurred_at", { ascending: false })
      .limit(15)
      .returns<ImportRow[]>(),
    supabase
      .from("landing_pages")
      .select("id, name")
      .eq("company_id", callerCompanyId)
      .eq("is_active", true)
      .order("name")
      .returns<LandingPageMini[]>(),
  ]);

  const integrations = integrationsRes.data ?? [];
  const recentImports = importsRes.data ?? [];
  const landingPages = pagesRes.data ?? [];
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  const tableMissing =
    !!integrationsRes.error &&
    /relation .* does not exist|42P01|PGRST/i.test(
      integrationsRes.error.message ?? "",
    );

  // Construct the public webhook URL the tenant needs to paste into
  // Facebook App settings. Use the actual request host so the URL
  // reflects whatever domain the user is currently on (works for
  // preview deployments, custom domains, and the production URL alike).
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ??
    "nidhamhr.com";
  const webhookUrl = `${proto}://${host}/api/webhooks/meta-leads`;

  // Check env-var readiness server-side so we can warn upfront instead
  // of after the user fills the entire form. We can only see these
  // three from server components — they're not exposed to the client.
  const envReady = {
    encryption: !!process.env.META_ENCRYPTION_KEY,
    appSecret: !!process.env.META_APP_SECRET,
    verifyToken: !!process.env.META_WEBHOOK_VERIFY_TOKEN,
  };
  const missingEnvVars = [
    !envReady.encryption && "META_ENCRYPTION_KEY",
    !envReady.appSecret && "META_APP_SECRET",
    !envReady.verifyToken && "META_WEBHOOK_VERIFY_TOKEN",
  ].filter(Boolean) as string[];

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/marketing"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← استوديو التسويق
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-300 text-blue-800 text-xs font-bold mb-2 font-cairo">
            🔌 Integrations
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            الربط مع منصات الإعلان
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            خلي الـ leads من Facebook Lead Ads تيجي للـ CRM تلقائياً بدون CSV.
          </p>
        </header>

        {/* Flash */}
        {sp.connected && (
          <Flash kind="ok">
            ✅ تم ربط الصفحة. لو الـ webhook subscription متضبط على Facebook،
            أي lead جديد هييجي هنا تلقائياً.
          </Flash>
        )}
        {sp.disconnected && <Flash kind="ok">✅ تم فك الربط</Flash>}
        {sp.toggled && <Flash kind="ok">✅ تم التحديث</Flash>}
        {errorMsg && <Flash kind="err">⚠ {errorMsg}</Flash>}

        {tableMissing && (
          <div className="mb-5 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 font-cairo">
            <h3 className="font-black text-amber-900 mb-2">
              ⚠ Migration 040 لسه ما اتطبّقتش
            </h3>
            <p className="text-sm text-amber-800">
              جداول الـ Meta Integration محتاجة Migration 040 يتعمله apply
              الأول على Supabase. الكود في الملف{" "}
              <code dir="ltr">
                db/migrations/040_meta_lead_ads_integrations.sql
              </code>
            </p>
          </div>
        )}

        {missingEnvVars.length > 0 && (
          <div className="mb-5 bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 font-cairo">
            <h3 className="font-black text-rose-900 mb-2 text-base">
              ⚠ السيرفر مش جاهز للـ Meta Integration
            </h3>
            <p className="text-sm text-rose-800 leading-relaxed mb-3">
              في{" "}
              <strong className="text-rose-900">
                {missingEnvVars.length} env var
              </strong>{" "}
              لازم يتعيّن في Vercel قبل ما الـ integration يشتغل:
            </p>
            <ul className="space-y-1.5 mb-3">
              {missingEnvVars.map((v) => (
                <li
                  key={v}
                  className="flex items-center gap-2 text-xs font-mono bg-white border border-rose-200 rounded p-2"
                  dir="ltr"
                >
                  <span className="text-rose-600">❌</span>
                  <span className="font-bold">{v}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-rose-700">
              💡 روح Vercel → Settings → Environment Variables، ضيفهم،
              وبعدين اعمل Redeploy. لـ <code>META_ENCRYPTION_KEY</code>{" "}
              استخدم string عشوائي 32+ حرف (مثلاً من PowerShell:{" "}
              <code className="bg-rose-100 px-1 rounded text-[10px]">
                [System.Convert]::ToBase64String([byte[]](1..32 | %&#123;Get-Random -Maximum 256&#125;))
              </code>
              ).
            </p>
          </div>
        )}

        {/* Existing integrations */}
        {integrations.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
              🔗 الصفحات المربوطة ({integrations.length})
            </h2>
            <div className="space-y-3">
              {integrations.map((i) => (
                <IntegrationCard key={i.id} integration={i} />
              ))}
            </div>
          </section>
        )}

        {/* Recent imports log */}
        {recentImports.length > 0 && (
          <section className="mb-6 bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
              📥 آخر 15 webhook
            </h2>
            <table className="w-full text-right text-xs font-cairo">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-2 py-1 text-slate-500">الوقت</th>
                  <th className="px-2 py-1 text-slate-500">Leadgen ID</th>
                  <th className="px-2 py-1 text-slate-500">النتيجة</th>
                  <th className="px-2 py-1 text-slate-500">العميل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentImports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2 text-slate-600">
                      {new Date(r.occurred_at).toLocaleString("ar-EG", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-2 py-2 font-mono text-[10px]" dir="ltr">
                      {r.leadgen_id.slice(0, 16)}…
                    </td>
                    <td className="px-2 py-2">
                      <OutcomeBadge outcome={r.outcome} />
                      {r.error_message && (
                        <div
                          className="text-[10px] text-rose-600 mt-1 max-w-xs truncate"
                          title={r.error_message}
                        >
                          {r.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {r.customer_id ? (
                        <Link
                          href={`/dashboard/marketing/leads/${r.customer_id}`}
                          className="text-cyan-700 hover:underline"
                        >
                          فتح ←
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Setup walkthrough */}
        <section className="bg-white border-2 border-blue-200 rounded-2xl p-5 mb-6">
          <h2 className="text-base font-black text-slate-800 mb-3 font-cairo">
            ✦ ربط صفحة Facebook جديدة
          </h2>
          <details className="mb-4 group">
            <summary className="cursor-pointer text-sm text-blue-700 font-bold font-cairo hover:text-blue-900">
              📋 خطوات الإعداد التفصيلية (افتح لو أول مرة)
            </summary>
            <SetupGuide webhookUrl={webhookUrl} />
          </details>

          <form action={connectMetaPage} className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>اسم وصفي (داخلي) <Req /></Label>
              <input
                type="text"
                name="display_label"
                placeholder="مثلاً: صفحة الواح PVC الرسمية"
                required
                className={inputCls}
              />
            </div>
            <div>
              <Label>اسم الصفحة على Facebook <Req /></Label>
              <input
                type="text"
                name="page_name"
                required
                placeholder="Korean Factory Official"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Page ID (رقم) <Req /></Label>
              <input
                type="text"
                name="page_id"
                required
                pattern="[0-9]{8,25}"
                placeholder="123456789012345"
                className={`${inputCls} font-mono`}
                dir="ltr"
              />
            </div>
            <div>
              <Label>App ID (اختياري)</Label>
              <input
                type="text"
                name="app_id"
                placeholder="987654321098765"
                className={`${inputCls} font-mono`}
                dir="ltr"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Page Access Token (طويل، يبدأ بـ EAA) <Req /></Label>
              <textarea
                name="page_access_token"
                required
                rows={3}
                placeholder="EAAxxx..."
                className={`${inputCls} font-mono text-[10px] resize-y`}
                dir="ltr"
              />
              <p className="text-[10px] text-slate-500 font-cairo mt-1">
                🔒 الـ token بيتشفّر قبل ما يتخزن في قاعدة البيانات. مش بيظهر تاني بعد ما تحفظه.
              </p>
            </div>
            <div className="md:col-span-2">
              <Label>Landing Page الافتراضية (اختياري — للـ attribution)</Label>
              <select
                name="default_landing_page_id"
                className={inputCls}
                defaultValue=""
              >
                <option value="">— ولا واحدة —</option>
                {landingPages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black font-cairo shadow-md hover:shadow-lg transition"
              >
                🔗 اربط الصفحة
              </button>
            </div>
          </form>
        </section>

        {/* Webhook URL for ops */}
        <section className="bg-slate-900 text-slate-100 rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-black mb-2 font-cairo">
            📡 Webhook URL (للنسخ في Facebook App)
          </h2>
          <code
            className="block bg-black/40 text-emerald-300 p-3 rounded-lg text-xs font-mono break-all"
            dir="ltr"
          >
            {webhookUrl}
          </code>
          <p className="text-[10px] text-slate-400 font-cairo mt-2">
            ✅ HTTPS · Subscribe to <code className="font-mono">leadgen</code>{" "}
            field · ضع Verify Token من{" "}
            <code className="font-mono">META_WEBHOOK_VERIFY_TOKEN</code> env var.
          </p>
        </section>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// SetupGuide — step-by-step instructions in Arabic
// ----------------------------------------------------------------------------
function SetupGuide({ webhookUrl }: { webhookUrl: string }) {
  return (
    <div className="mt-4 space-y-4 p-4 bg-blue-50 rounded-lg text-sm font-cairo leading-relaxed">
      <p className="text-blue-900 font-bold">
        محتاج 15-30 دقيقة المرة الأولى. بعد كده كل صفحة جديدة بتاخد 5 دقايق.
      </p>

      <Step n={1} title="اعمل Facebook App">
        <p>
          روح <Lnk href="https://developers.facebook.com/apps/">
            developers.facebook.com/apps
          </Lnk>{" "}
          → اضغط <strong>Create App</strong> → اختار{" "}
          <strong>Business</strong> → سمّيه &quot;Nidham Marketing&quot; مثلاً.
        </p>
      </Step>

      <Step n={2} title="ضيف Webhooks Product">
        <p>
          من القائمة الجنبية → <strong>+ Add Product</strong> →{" "}
          <strong>Webhooks</strong> → اضغط <strong>Set up</strong>.
        </p>
      </Step>

      <Step n={3} title="عيّن Page Webhook Subscription">
        <p>
          من القايمة → <strong>Page</strong> → ضع البيانات:
        </p>
        <ul className="list-disc pr-6 mt-2 space-y-1">
          <li>
            <strong>Callback URL:</strong>{" "}
            <code className="bg-white px-1 rounded font-mono text-[11px]" dir="ltr">
              {webhookUrl}
            </code>
          </li>
          <li>
            <strong>Verify Token:</strong> أي نص عشوائي طويل (مثلاً
            uuid). احفظه — لازم يتعيّن في Vercel كـ{" "}
            <code className="font-mono">META_WEBHOOK_VERIFY_TOKEN</code>
          </li>
          <li>اضغط <strong>Verify and Save</strong></li>
        </ul>
      </Step>

      <Step n={4} title="اشترك في leadgen field">
        <p>
          بعد ما الـ verify ينجح → في الـ Page webhook subscriptions →
          فعّل <strong>leadgen</strong>.
        </p>
      </Step>

      <Step n={5} title="اطلب App Permission: leads_retrieval">
        <p>
          من القايمة → <strong>App Review</strong> →{" "}
          <strong>Permissions and Features</strong> → اطلب{" "}
          <strong>leads_retrieval</strong>. Meta هتراجع الطلب (1-2 أسبوع).
        </p>
        <p className="text-amber-700 mt-2">
          💡 في وقت المراجعة، Meta بتسمحلك تختبر بـ Test Users. تقدر تكمل
          الباقي وتجرّب بحساب Test User.
        </p>
      </Step>

      <Step n={6} title="جيب Page Access Token">
        <p>
          روح <Lnk href="https://developers.facebook.com/tools/explorer/">
            Graph API Explorer
          </Lnk>{" "}
          → اختار App بتاعك → اختار{" "}
          <strong>Get Page Access Token</strong> → اختار الصفحة → امنح
          صلاحية <strong>leads_retrieval</strong> + <strong>pages_show_list</strong>.
        </p>
        <p className="mt-2">
          انسخ الـ token (طويل، بيبدأ بـ EAA). ده اللي هتلصقه تحت.
        </p>
      </Step>

      <Step n={7} title="اشترك التطبيق في صفحتك">
        <p>
          نفس Graph API Explorer → غيّر الـ method لـ <strong>POST</strong>{" "}
          → URL يبقى{" "}
          <code className="bg-white px-1 rounded font-mono text-[11px]" dir="ltr">
            /{`{PAGE_ID}`}/subscribed_apps
          </code>{" "}
          → ضيف parameter <code className="font-mono">subscribed_fields=leadgen</code> →{" "}
          <strong>Submit</strong>.
        </p>
      </Step>

      <Step n={8} title="عيّن env vars في Vercel">
        <p>تأكد إن دول متعيّنين في Vercel → Settings → Environment Variables:</p>
        <ul className="list-disc pr-6 mt-2 space-y-1 font-mono text-[11px]">
          <li>META_APP_SECRET (من App Dashboard → Settings → Basic)</li>
          <li>META_WEBHOOK_VERIFY_TOKEN (الـ token من خطوة 3)</li>
          <li>META_ENCRYPTION_KEY (نص عشوائي طويل لتشفير الـ tokens)</li>
        </ul>
      </Step>

      <Step n={9} title="اربط الصفحة هنا">
        <p>عبّى الفورم تحت بالـ Page ID + Token. خلاص ✅</p>
      </Step>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-black text-blue-900 mb-1">{title}</div>
        <div className="text-blue-900">{children}</div>
      </div>
    </div>
  );
}

function Lnk({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-700 underline hover:text-blue-900"
    >
      {children}
    </a>
  );
}

// ----------------------------------------------------------------------------
// IntegrationCard
// ----------------------------------------------------------------------------
function IntegrationCard({ integration }: { integration: Integration }) {
  const lastWebhook = integration.last_webhook_at
    ? new Date(integration.last_webhook_at)
    : null;

  return (
    <div
      className={`bg-white border-2 rounded-2xl p-5 ${integration.is_active ? "border-emerald-200" : "border-slate-300 opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📘</span>
            <h3 className="text-base font-black text-slate-800 font-cairo">
              {integration.display_label || integration.page_name}
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${integration.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
            >
              {integration.is_active ? "🟢 نشط" : "⏸ متوقف"}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-cairo">
            {integration.page_name} ·{" "}
            <span className="font-mono" dir="ltr">
              ID: {integration.page_id}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <form action={toggleMetaPageActive}>
            <input
              type="hidden"
              name="integration_id"
              value={integration.id}
            />
            <input
              type="hidden"
              name="target_state"
              value={integration.is_active ? "off" : "on"}
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold font-cairo"
            >
              {integration.is_active ? "⏸ أوقف" : "▶ شغّل"}
            </button>
          </form>
          <form action={disconnectMetaPage}>
            <input
              type="hidden"
              name="integration_id"
              value={integration.id}
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold font-cairo"
            >
              🗑 افصل
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Webhooks" value={integration.webhooks_received} icon="📥" />
        <Stat label="Leads مستوردة" value={integration.leads_imported} icon="🎯" />
        <Stat
          label="آخر webhook"
          value={lastWebhook ? timeAgo(lastWebhook) : "—"}
          icon="🕐"
          isText
        />
      </div>

      {integration.last_error && (
        <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-cairo">
          ⚠ آخر error: {integration.last_error}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  isText,
}: {
  label: string;
  value: number | string;
  icon: string;
  isText?: boolean;
}) {
  return (
    <div className="p-2 bg-slate-50 rounded-lg">
      <div className="text-xs">{icon}</div>
      <div
        className={`${isText ? "text-xs" : "text-lg"} font-black text-slate-800 font-display`}
      >
        {value}
      </div>
      <div className="text-[10px] text-slate-500 font-cairo">{label}</div>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const label: Record<string, { text: string; cls: string }> = {
    success: { text: "✅ نجح", cls: "bg-emerald-100 text-emerald-800" },
    duplicate: { text: "✓ مكرر (تحديث)", cls: "bg-cyan-100 text-cyan-800" },
    token_missing: { text: "⚠ Token مفقود", cls: "bg-amber-100 text-amber-800" },
    fetch_failed: { text: "❌ Fetch فشل", cls: "bg-rose-100 text-rose-800" },
    parse_failed: { text: "❌ Parse فشل", cls: "bg-rose-100 text-rose-800" },
    insert_failed: { text: "❌ Insert فشل", cls: "bg-rose-100 text-rose-800" },
  };
  const o = label[outcome] ?? { text: outcome, cls: "bg-slate-100 text-slate-700" };
  return (
    <span
      className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold font-cairo ${o.cls}`}
    >
      {o.text}
    </span>
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

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const hr = Math.floor(ms / 3600000);
  const day = Math.floor(ms / 86400000);
  if (hr < 1) return "دلوقتي";
  if (hr < 24) return `${hr} ساعة`;
  if (day === 1) return "إمبارح";
  return `${day} يوم`;
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none text-sm font-cairo";

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
