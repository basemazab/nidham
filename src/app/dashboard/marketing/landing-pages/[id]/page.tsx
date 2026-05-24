// ============================================================================
// /dashboard/marketing/landing-pages/[id] — single page editor + funnel stats
// ============================================================================

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import { AiErrorBanner } from "@/components/ai-error-banner";
import { updateLandingPage, archiveLandingPage } from "../actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    created?: string;
  }>;
};

type LP = {
  id: string;
  slug: string;
  name: string;
  template: string;
  headline: string;
  sub_headline: string | null;
  body: string | null;
  hero_image_url: string | null;
  accent_color: string;
  cta_label: string;
  cta_action: string;
  cta_target: string | null;
  form_enabled: boolean;
  form_fields: string[];
  form_submit_label: string;
  form_success_msg: string;
  is_active: boolean;
  views_count: number;
  conversions_count: number;
  created_at: string;
  updated_at: string;
};

export default async function LandingPageEditPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await canUseFeature("marketing_studio"))) {
    return <UpgradeRequired feature="marketing_studio" />;
  }

  // Scope analytics queries to caller's company.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: page } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("id", id)
    .maybeSingle<LP>();

  if (!page) notFound();

  const [eventsRes, leadsRes] = await Promise.all([
    supabase
      .from("lead_events")
      .select("event_type", { count: "exact", head: false })
      .eq("company_id", callerCompanyId)
      .eq("landing_page_id", id),
    supabase
      .from("customers")
      .select("id, full_name, phone, status, created_at", { count: "exact" })
      .eq("company_id", callerCompanyId)
      .eq("landing_page_id", id)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<
        {
          id: string;
          full_name: string;
          phone: string | null;
          status: string;
          created_at: string;
        }[]
      >(),
  ]);

  // Funnel breakdown from event types
  const eventCounts = (eventsRes.data ?? []).reduce(
    (acc: Record<string, number>, e) => {
      acc[e.event_type] = (acc[e.event_type] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const views = eventCounts.page_view ?? page.views_count ?? 0;
  const whatsappClicks = eventCounts.whatsapp_click ?? 0;
  const phoneClicks = eventCounts.phone_click ?? 0;
  const submits = eventCounts.form_submit ?? page.conversions_count ?? 0;

  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  const publicUrl = `/p/${page.slug}`;

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/marketing/landing-pages"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← كل الصفحات
          </Link>
        </div>

        <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1">
              {page.name}
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {page.headline}
            </p>
          </div>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-800 font-bold text-sm font-cairo transition"
          >
            <span>👁</span>
            <span>افتح الصفحة العامة</span>
          </a>
        </header>

        {sp.created && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
            ✅ الصفحة جاهزة. شارك الرابط في إعلاناتك:
            <div className="mt-2 bg-white border border-emerald-300 rounded-lg p-2 font-mono text-xs" dir="ltr">
              https://nidhamhr.com{publicUrl}
            </div>
          </div>
        )}
        {sp.saved && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
            ✅ تم حفظ التعديلات
          </div>
        )}
        <AiErrorBanner message={errorMsg} />

        {/* Funnel KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi icon="👁" label="مشاهدات" value={views} color="slate" />
          <Kpi
            icon="💬"
            label="ضغطوا واتساب"
            value={whatsappClicks}
            color="emerald"
          />
          <Kpi
            icon="📞"
            label="ضغطوا التليفون"
            value={phoneClicks}
            color="blue"
          />
          <Kpi
            icon="🎯"
            label="سابوا بياناتهم"
            value={submits}
            color="amber"
            subtext={
              views > 0
                ? `${Math.round((submits / views) * 100)}% conversion`
                : undefined
            }
          />
        </section>

        {/* Recent leads from this page */}
        {leadsRes.data && leadsRes.data.length > 0 && (
          <section className="mb-6 bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
              📥 أحدث Leads من الصفحة دي
            </h2>
            <div className="space-y-2">
              {leadsRes.data.map((l) => (
                <Link
                  key={l.id}
                  href={`/dashboard/marketing/leads/${l.id}`}
                  className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition border border-transparent hover:border-slate-200"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-800 font-cairo">
                      {l.full_name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                      {l.phone ?? "—"}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-cairo">
                    {new Date(l.created_at).toLocaleDateString("ar-EG")}
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href={`/dashboard/marketing/leads?source_page=${page.id}`}
              className="block text-center text-xs text-cyan-700 hover:text-cyan-900 font-bold font-cairo mt-3"
            >
              شوف كل الـ leads ←
            </Link>
          </section>
        )}

        {/* Edit form */}
        <section className="bg-white border-2 border-slate-200 rounded-2xl p-5 mb-6">
          <h2 className="font-black font-cairo text-slate-800 mb-3">
            ✏ تعديل الصفحة
          </h2>
          <form
            action={updateLandingPage}
            className="grid md:grid-cols-2 gap-3"
          >
            <input type="hidden" name="id" value={page.id} />

            <div className="md:col-span-2">
              <Label>اسم الصفحة</Label>
              <input
                type="text"
                name="name"
                required
                defaultValue={page.name}
                className={inputCls}
              />
            </div>

            <div>
              <Label>النوع</Label>
              <select
                name="template"
                defaultValue={page.template}
                className={inputCls}
              >
                <option value="generic">✦ عام</option>
                <option value="lead_magnet">📥 Lead Magnet</option>
                <option value="product">🛒 منتج</option>
                <option value="service">🛠 خدمة</option>
                <option value="event">📅 حدث</option>
              </select>
            </div>

            <div>
              <Label>اللون الأساسي</Label>
              <input
                type="text"
                name="accent_color"
                defaultValue={page.accent_color}
                className={inputCls}
                dir="ltr"
              />
            </div>

            <div className="md:col-span-2">
              <Label>العنوان الرئيسي</Label>
              <input
                type="text"
                name="headline"
                required
                defaultValue={page.headline}
                className={inputCls}
              />
            </div>

            <div className="md:col-span-2">
              <Label>العنوان الفرعي</Label>
              <input
                type="text"
                name="sub_headline"
                defaultValue={page.sub_headline ?? ""}
                className={inputCls}
              />
            </div>

            <div className="md:col-span-2">
              <Label>الوصف التفصيلي</Label>
              <textarea
                name="body"
                rows={5}
                defaultValue={page.body ?? ""}
                className={`${inputCls} resize-y`}
              />
            </div>

            <hr className="md:col-span-2 my-2" />

            <div>
              <Label>كلام زرار CTA</Label>
              <input
                type="text"
                name="cta_label"
                defaultValue={page.cta_label}
                className={inputCls}
              />
            </div>

            <div>
              <Label>نوع Action</Label>
              <select
                name="cta_action"
                defaultValue={page.cta_action}
                className={inputCls}
              >
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="phone">📞 مكالمة</option>
                <option value="external_url">🔗 لينك</option>
                <option value="form">📝 فورم بس</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <Label>الـ Target</Label>
              <input
                type="text"
                name="cta_target"
                defaultValue={page.cta_target ?? ""}
                className={inputCls}
                dir="ltr"
              />
            </div>

            <hr className="md:col-span-2 my-2" />

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-cairo cursor-pointer">
                <input
                  type="checkbox"
                  name="form_enabled"
                  defaultChecked={page.form_enabled}
                />
                <span>اعرض فورم البيانات</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <Label>حقول الفورم</Label>
              <textarea
                name="form_fields"
                rows={4}
                defaultValue={(page.form_fields ?? []).join("\n")}
                className={`${inputCls} resize-y font-mono text-xs`}
                dir="ltr"
              />
            </div>

            <div>
              <Label>نص زرار الإرسال</Label>
              <input
                type="text"
                name="form_submit_label"
                defaultValue={page.form_submit_label}
                className={inputCls}
              />
            </div>

            <div>
              <Label>رسالة النجاح</Label>
              <input
                type="text"
                name="form_success_msg"
                defaultValue={page.form_success_msg}
                className={inputCls}
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-cairo cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={page.is_active}
                />
                <span>الصفحة منشورة (شغّالة على /p/{page.slug})</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-black font-cairo shadow-md hover:shadow-lg transition"
              >
                💾 احفظ التعديلات
              </button>
            </div>
          </form>
        </section>

        {/* Danger zone */}
        <details className="mb-6">
          <summary className="cursor-pointer text-xs text-rose-600 hover:text-rose-800 font-cairo">
            🗑 أرشفة الصفحة (هتقفل الرابط للزوار، الـ leads بيفضلوا محفوظين)
          </summary>
          <form action={archiveLandingPage} className="mt-3 p-4 bg-rose-50 border border-rose-200 rounded-lg">
            <input type="hidden" name="id" value={page.id} />
            <p className="text-xs text-rose-700 font-cairo mb-3">
              الصفحة هتتحول لـ inactive. لو حد فتح الـ link هيلاقي 404. تقدر
              ترجعها لاحقاً من قاعدة البيانات.
            </p>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm font-cairo"
            >
              تأكيد الأرشفة
            </button>
          </form>
        </details>
      </div>
    </main>
  );
}

function Kpi({
  icon,
  label,
  value,
  color,
  subtext,
}: {
  icon: string;
  label: string;
  value: number;
  color: "slate" | "emerald" | "blue" | "amber";
  subtext?: string;
}) {
  const bg: Record<typeof color, string> = {
    slate: "from-slate-50 to-white border-slate-200",
    emerald: "from-emerald-50 to-white border-emerald-200",
    blue: "from-blue-50 to-white border-blue-200",
    amber: "from-amber-50 to-white border-amber-200",
  };
  return (
    <div
      className={`p-4 rounded-xl bg-gradient-to-br ${bg[color]} border shadow-sm`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-black text-slate-800 font-display">
        {value.toLocaleString("ar-EG")}
      </div>
      <div className="text-[10px] text-slate-500 font-cairo mt-1">{label}</div>
      {subtext && (
        <div className="text-[10px] text-emerald-700 font-bold font-cairo mt-1">
          {subtext}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-cyan-400 outline-none text-sm font-cairo";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
      {children}
    </label>
  );
}
