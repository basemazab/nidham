// ============================================================================
// /dashboard/marketing/landing-pages — Landing Pages list + creator
// ============================================================================
//
// Hub for all landing pages a tenant has published. Each row shows the
// public URL + funnel metrics (views vs conversions). The "+ صفحة جديدة"
// form lives below the list so you can spin up a new page without leaving
// the screen.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import { createLandingPage } from "./actions";
import { AiErrorBanner } from "@/components/ai-error-banner";

type SearchParams = Promise<{
  error?: string;
  created?: string;
  archived?: string;
}>;

type LPRow = {
  id: string;
  slug: string;
  name: string;
  template: string;
  headline: string;
  cta_action: string;
  is_active: boolean;
  views_count: number;
  conversions_count: number;
  updated_at: string;
};

type ProjectRow = {
  id: string;
  name: string;
};

const TEMPLATE_LABEL: Record<string, string> = {
  generic: "✦ عام",
  lead_magnet: "📥 Lead Magnet",
  product: "🛒 منتج",
  service: "🛠 خدمة",
  event: "📅 حدث",
};

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function LandingPagesHub({
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
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  // Scope to the caller's company — super-admin sessions can otherwise
  // read landing_pages + marketing_projects across every tenant.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [pagesRes, projectsRes] = await Promise.all([
    supabase
      .from("landing_pages")
      .select(
        "id, slug, name, template, headline, cta_action, is_active, views_count, conversions_count, updated_at",
      )
      .eq("company_id", callerCompanyId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .returns<LPRow[]>(),
    supabase
      .from("marketing_projects")
      .select("id, name")
      .eq("company_id", callerCompanyId)
      .eq("status", "active")
      .order("name")
      .returns<ProjectRow[]>(),
  ]);

  const pages = pagesRes.data ?? [];
  const projects = projectsRes.data ?? [];

  // Detect table-missing so we can show a Migration-039 banner
  const tableMissing =
    !!pagesRes.error &&
    /relation .* does not exist|42P01|schema cache|PGRST205/i.test(
      pagesRes.error.message ?? "",
    );

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/20 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/marketing"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← استوديو التسويق
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-cyan-100 to-blue-100 border border-cyan-300 text-cyan-800 text-xs font-bold mb-2 font-cairo">
            🏠 Landing Pages
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            صفحات الهبوط
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            كل lead يدخل من إعلاناتك أو منشوراتك هيمر من هنا. كل صفحة
            بتتعقّب: مين شاف، مين ضغط على واتساب، مين سيب بياناته. كل
            البيانات بتيجي لـ <strong>Leads Inbox</strong> تلقائياً.
          </p>
        </header>

        <AiErrorBanner message={errorMsg} />

        {sp.created && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
            ✅ الصفحة اتعملت. انسخ الرابط من تحت وحطه في إعلانك.
          </div>
        )}
        {sp.archived && (
          <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-cairo text-sm">
            تم الأرشفة. الصفحة بقت غير منشورة (الـ leads القديمين محفوظين).
          </div>
        )}

        {/* Migration 039 banner */}
        {tableMissing && (
          <div className="mb-5 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 font-cairo">
            <h3 className="font-black text-amber-900 mb-2 text-base">
              ⚠ Migration 039 لسه ما اتطبّقتش
            </h3>
            <p className="text-sm text-amber-800 leading-relaxed mb-3">
              جداول landing_pages و lead_events محتاجين Migration 039
              يتعمله apply الأول على Supabase. روح SQL Editor والصق
              محتوى:
            </p>
            <code
              className="block bg-slate-100 text-xs font-mono p-2 rounded text-slate-800"
              dir="ltr"
            >
              db/migrations/039_lead_capture_and_pipeline.sql
            </code>
          </div>
        )}

        {/* Pages list */}
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 font-cairo">
          صفحاتك المنشورة ({pages.length})
        </h2>

        {pages.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center mb-6">
            <div className="text-5xl mb-3">🏠</div>
            <p className="text-sm text-slate-500 font-cairo">
              مفيش صفحات لسه. عبّى الفورم اللي تحت وابدأ أول صفحة في
              دقايق.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {pages.map((p) => {
              const cvr =
                p.views_count > 0
                  ? Math.round((p.conversions_count / p.views_count) * 100)
                  : 0;
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/marketing/landing-pages/${p.id}`}
                  className="group bg-white border-2 border-slate-200 rounded-2xl p-5 hover:border-cyan-400 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 font-bold font-cairo">
                      {TEMPLATE_LABEL[p.template] ?? p.template}
                    </span>
                    {p.cta_action === "whatsapp" && (
                      <span className="text-[10px] text-emerald-700 font-bold">
                        💬 واتساب
                      </span>
                    )}
                    {p.cta_action === "phone" && (
                      <span className="text-[10px] text-blue-700 font-bold">
                        📞 تليفون
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black font-cairo text-slate-800 mb-1 group-hover:text-cyan-700 truncate">
                    {p.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-cairo line-clamp-2 mb-3">
                    {p.headline}
                  </p>
                  <div className="flex items-center justify-between text-xs font-cairo border-t border-slate-100 pt-3">
                    <span className="text-slate-500">
                      👁 {p.views_count.toLocaleString("ar-EG")}
                    </span>
                    <span className="text-emerald-700 font-bold">
                      🎯 {p.conversions_count.toLocaleString("ar-EG")}
                    </span>
                    <span
                      className={`font-bold ${cvr >= 5 ? "text-emerald-700" : cvr >= 2 ? "text-amber-700" : "text-slate-500"}`}
                    >
                      {cvr}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-2 truncate" dir="ltr">
                    /p/{p.slug}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Create form */}
        <section className="bg-white border-2 border-cyan-200 rounded-2xl p-5 mb-6">
          <h2 className="font-black font-cairo text-slate-800 mb-1">
            ✦ صفحة هبوط جديدة
          </h2>
          <p className="text-xs text-slate-500 font-cairo mb-4">
            هتاخد منك دقيقتين. الـ link هيبقى جاهز للنشر في إعلاناتك على
            FB / Google / TikTok / WhatsApp.
          </p>

          <form action={createLandingPage} className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>اسم الصفحة الداخلي (للإدارة بس) <Req /></Label>
              <input
                type="text"
                name="name"
                required
                minLength={2}
                placeholder="مثلاً: PVC Summer 2026"
                className={inputCls}
              />
            </div>

            <div>
              <Label>نوع الصفحة</Label>
              <select name="template" defaultValue="generic" className={inputCls}>
                <option value="generic">✦ عام</option>
                <option value="lead_magnet">📥 Lead Magnet (هدية مقابل بيانات)</option>
                <option value="product">🛒 منتج محدد</option>
                <option value="service">🛠 خدمة</option>
                <option value="event">📅 حدث / موعد</option>
              </select>
            </div>

            <div>
              <Label>المشروع المرتبط (اختياري)</Label>
              <select name="marketing_project_id" className={inputCls}>
                <option value="">— مفيش —</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <Label>العنوان الرئيسي (الكلام الكبير في أول الصفحة) <Req /></Label>
              <input
                type="text"
                name="headline"
                required
                minLength={5}
                placeholder="مثلاً: الواح PVC كوري — توصيل + تركيب مجاناً"
                className={inputCls}
              />
            </div>

            <div className="md:col-span-2">
              <Label>عنوان فرعي</Label>
              <input
                type="text"
                name="sub_headline"
                placeholder="مثلاً: ضمان 5 سنين · مقاوم للماء · بسعر المصنع"
                className={inputCls}
              />
            </div>

            <div className="md:col-span-2">
              <Label>وصف تفصيلي (اختياري)</Label>
              <textarea
                name="body"
                rows={4}
                placeholder="اكتب 2-3 فقرات عن المنتج، الفايدة، اللي يميزك. السطور بتفصل تلقائياً."
                className={`${inputCls} resize-y`}
              />
            </div>

            <hr className="md:col-span-2 my-2" />

            <div className="md:col-span-2">
              <h3 className="text-sm font-black text-slate-700 font-cairo mb-2">
                ⚡ زرار الـ CTA (الـ Action الأساسي)
              </h3>
            </div>

            <div>
              <Label>كلام الزرار</Label>
              <input
                type="text"
                name="cta_label"
                defaultValue="كلّمنا واتساب"
                className={inputCls}
              />
            </div>

            <div>
              <Label>نوع الـ Action</Label>
              <select name="cta_action" defaultValue="whatsapp" className={inputCls}>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="phone">📞 مكالمة</option>
                <option value="external_url">🔗 لينك خارجي</option>
                <option value="form">📝 فورم بس</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <Label>الـ Target (رقم واتساب / تليفون / URL)</Label>
              <input
                type="text"
                name="cta_target"
                placeholder="+201001234567 (للواتساب — مع كود الدولة) أو URL كامل"
                className={inputCls}
                dir="ltr"
              />
              <p className="text-[10px] text-slate-500 font-cairo mt-1">
                للواتساب: اكتب الرقم مع +20 في الأول. الزرار هيفتح
                wa.me/...
              </p>
            </div>

            <hr className="md:col-span-2 my-2" />

            <div className="md:col-span-2">
              <h3 className="text-sm font-black text-slate-700 font-cairo mb-2">
                📋 فورم البيانات (اختياري — مفيد للـ Lead Magnet)
              </h3>
              <label className="flex items-center gap-2 text-sm font-cairo cursor-pointer mb-3">
                <input type="checkbox" name="form_enabled" defaultChecked />
                <span>اعرض فورم لجمع بيانات الزوار</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <Label>الحقول المطلوبة (واحد في كل سطر)</Label>
              <textarea
                name="form_fields"
                rows={4}
                defaultValue={"name\nphone\nwhatsapp"}
                className={`${inputCls} resize-y font-mono text-xs`}
                dir="ltr"
              />
              <p className="text-[10px] text-slate-500 font-cairo mt-1">
                المتاح: name, phone, whatsapp, email, city, interest, budget, message
              </p>
            </div>

            <div>
              <Label>نص زرار الإرسال</Label>
              <input
                type="text"
                name="form_submit_label"
                defaultValue="سيب بياناتك"
                className={inputCls}
              />
            </div>

            <div>
              <Label>اللون الأساسي</Label>
              <input
                type="text"
                name="accent_color"
                defaultValue="#0891B2"
                className={inputCls}
                dir="ltr"
              />
            </div>

            <div className="md:col-span-2">
              <Label>رسالة الشكر بعد الإرسال</Label>
              <input
                type="text"
                name="form_success_msg"
                defaultValue="شكراً! هنتواصل معاك في أقرب وقت."
                className={inputCls}
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-black font-cairo shadow-lg hover:shadow-xl transition"
              >
                ✦ أنشئ الصفحة
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 outline-none text-sm font-cairo";

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
