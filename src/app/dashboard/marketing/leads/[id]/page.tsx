// ============================================================================
// /dashboard/marketing/leads/[id] — Single lead, full pipeline view
// ============================================================================
//
// Three things on this page:
//   1. Contact panel — name + every reachable channel (one-tap to WhatsApp /
//      call / email)
//   2. Status + pipeline actions — change status, mark won/lost, assign,
//      quick-log "I just called them"
//   3. Timeline — every lead_event + every interaction logged for this lead,
//      ordered newest first

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import {
  markLeadContacted,
  updateLeadStatus,
  assignLead,
  appendLeadNote,
} from "../actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    marked?: string;
    status_updated?: string;
    assigned?: string;
    noted?: string;
  }>;
};

type Customer = {
  id: string;
  full_name: string;
  type: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  source: string | null;
  estimated_value: number | null;
  notes: string | null;
  assigned_to: string | null;
  landing_page_id: string | null;
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_referrer: string | null;
  last_contacted_at: string | null;
  last_contacted_by: string | null;
  first_seen_at: string | null;
  converted_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
};

type LeadEvent = {
  id: string;
  event_type: string;
  occurred_at: string;
  utm_source: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  metadata: Record<string, unknown> | null;
};

type Interaction = {
  id: string;
  type: string;
  outcome: string;
  notes: string | null;
  date: string;
  created_at: string;
};

type EmployeeRow = { id: string; full_name: string };

const STATUS_LABEL: Record<string, { label: string; cls: string; icon: string }> =
  {
    lead: { label: "جديد", cls: "bg-cyan-100 text-cyan-800", icon: "🆕" },
    contacted: { label: "اتواصل", cls: "bg-amber-100 text-amber-800", icon: "📞" },
    qualified: { label: "مهتم", cls: "bg-violet-100 text-violet-800", icon: "🎯" },
    active: { label: "في النقاش", cls: "bg-violet-100 text-violet-800", icon: "💬" },
    won: { label: "عميل ✓", cls: "bg-emerald-100 text-emerald-800", icon: "🏆" },
    lost: { label: "ضايع", cls: "bg-rose-100 text-rose-800", icon: "❌" },
    dormant: { label: "خامد", cls: "bg-slate-100 text-slate-700", icon: "💤" },
  };

const EVENT_LABEL: Record<string, { icon: string; label: string }> = {
  page_view: { icon: "👁", label: "شاف الصفحة" },
  form_submit: { icon: "📝", label: "سيب بياناته" },
  whatsapp_click: { icon: "💬", label: "ضغط زرار واتساب" },
  phone_click: { icon: "📞", label: "ضغط زرار التليفون" },
  external_click: { icon: "🔗", label: "ضغط لينك خارجي" },
  custom: { icon: "✦", label: "حدث" },
};

const CHANNEL_LABEL: Record<string, string> = {
  call: "مكالمة",
  whatsapp: "واتساب",
  email: "إيميل",
  sms: "SMS",
  meeting: "اجتماع",
  other: "أخرى",
};

export default async function LeadDetailPage({
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

  // Scope every list-style query to the caller's company — the customer
  // row itself is fetched by an unguessable id so RLS is fine there.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle<Customer>();
  if (!customer) notFound();

  const [eventsRes, interactionsRes, employeesRes, landingPageRes] =
    await Promise.all([
      supabase
        .from("lead_events")
        .select(
          "id, event_type, occurred_at, utm_source, utm_campaign, referrer, metadata",
        )
        .eq("company_id", callerCompanyId)
        .eq("customer_id", id)
        .order("occurred_at", { ascending: false })
        .limit(50)
        .returns<LeadEvent[]>(),
      supabase
        .from("interactions")
        .select("id, type, outcome, notes, date, created_at")
        .eq("company_id", callerCompanyId)
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<Interaction[]>(),
      supabase
        .from("employees")
        .select("id, full_name")
        .eq("company_id", callerCompanyId)
        .order("full_name")
        .returns<EmployeeRow[]>(),
      customer.landing_page_id
        ? supabase
            .from("landing_pages")
            .select("id, name")
            .eq("id", customer.landing_page_id)
            .maybeSingle<{ id: string; name: string }>()
        : Promise.resolve({ data: null }),
    ]);

  const events = eventsRes.data ?? [];
  const interactions = interactionsRes.data ?? [];
  const employees = employeesRes.data ?? [];
  const landingPage = landingPageRes.data;

  const assignedEmployee = employees.find((e) => e.id === customer.assigned_to);
  const status = STATUS_LABEL[customer.status] ?? STATUS_LABEL.lead;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  // Snapshot "now" once per render so timeAgo() stays pure. Server
  // Component renders once per request; the purity rule is for Client
  // Components, so we suppress it locally.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  // Build unified timeline (events + interactions, sorted by date desc)
  type TimelineItem =
    | { kind: "event"; data: LeadEvent; ts: number }
    | { kind: "interaction"; data: Interaction; ts: number };
  const timeline: TimelineItem[] = [
    ...events.map(
      (e) =>
        ({
          kind: "event",
          data: e,
          ts: new Date(e.occurred_at).getTime(),
        }) as TimelineItem,
    ),
    ...interactions.map(
      (i) =>
        ({
          kind: "interaction",
          data: i,
          ts: new Date(i.created_at).getTime(),
        }) as TimelineItem,
    ),
  ].sort((a, b) => b.ts - a.ts);

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/marketing/leads"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← Leads Inbox
          </Link>
        </div>

        {/* Flash messages */}
        {sp.marked && (
          <Flash kind="ok">✅ سُجل التواصل + الحالة تحدّثت لـ &quot;اتواصل&quot;</Flash>
        )}
        {sp.status_updated && <Flash kind="ok">✅ تم تحديث الحالة</Flash>}
        {sp.assigned && <Flash kind="ok">✅ تم التعيين</Flash>}
        {sp.noted && <Flash kind="ok">✅ تم حفظ الملاحظة</Flash>}
        {errorMsg && <Flash kind="err">⚠ {errorMsg}</Flash>}

        {/* Header */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span
                className={`inline-block text-[10px] px-2.5 py-1 rounded-full border font-bold font-cairo mb-2 ${status.cls} border-current`}
              >
                {status.icon} {status.label}
              </span>
              <h1 className="text-2xl font-black font-cairo text-slate-800">
                {customer.full_name}
              </h1>
              <p className="text-xs text-slate-500 font-cairo mt-1">
                اتسجّل من {timeAgo(customer.created_at, nowMs)}
                {landingPage && (
                  <>
                    {" · "}
                    <Link
                      href={`/dashboard/marketing/landing-pages/${landingPage.id}`}
                      className="text-cyan-700 hover:underline"
                    >
                      🏠 {landingPage.name}
                    </Link>
                  </>
                )}
              </p>
            </div>

            {/* Contact quick actions */}
            <div className="flex flex-wrap gap-2">
              {(customer.whatsapp || customer.phone) && (
                <a
                  href={`https://wa.me/${(customer.whatsapp ?? customer.phone ?? "").replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold font-cairo"
                >
                  💬 واتساب
                </a>
              )}
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold font-cairo"
                >
                  📞 مكالمة
                </a>
              )}
              {customer.email && (
                <a
                  href={`mailto:${customer.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-500 hover:bg-slate-600 text-white text-sm font-bold font-cairo"
                >
                  ✉ إيميل
                </a>
              )}
            </div>
          </div>

          {/* Contact details */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
            <Field label="📞 تليفون" value={customer.phone} mono />
            <Field label="💬 واتساب" value={customer.whatsapp} mono />
            <Field label="✉ إيميل" value={customer.email} mono />
            <Field label="🎯 المصدر" value={customer.first_utm_source ?? customer.source} />
            <Field label="📢 الحملة" value={customer.first_utm_campaign} />
            <Field label="↗ Referrer" value={customer.first_referrer} mono />
            <Field
              label="🕐 آخر تواصل"
              value={
                customer.last_contacted_at
                  ? new Date(customer.last_contacted_at).toLocaleString("ar-EG", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : null
              }
            />
            <Field
              label="👤 المسؤول"
              value={assignedEmployee?.full_name ?? null}
            />
            <Field
              label="💰 قيمة الصفقة"
              value={
                customer.estimated_value
                  ? `${Number(customer.estimated_value).toLocaleString("ar-EG")} ج`
                  : null
              }
            />
          </div>
        </div>

        {/* Pipeline actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Mark contacted (one-tap) */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
              📞 سجّل تواصل
            </h2>
            <form action={markLeadContacted} className="space-y-2">
              <input type="hidden" name="customer_id" value={customer.id} />
              <select
                name="channel"
                defaultValue="call"
                className={inputCls}
              >
                <option value="call">مكالمة</option>
                <option value="whatsapp">رسالة واتساب</option>
                <option value="email">إيميل</option>
                <option value="sms">SMS</option>
                <option value="meeting">اجتماع</option>
              </select>
              <input
                type="text"
                name="notes"
                placeholder="ملاحظات سريعة (اختياري)"
                className={inputCls}
              />
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm font-cairo"
              >
                ✓ سجّل التواصل
              </button>
            </form>
          </section>

          {/* Update status */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
              🎯 تحديث الحالة
            </h2>
            <form action={updateLeadStatus} className="space-y-2">
              <input type="hidden" name="customer_id" value={customer.id} />
              <select
                name="status"
                defaultValue={customer.status}
                className={inputCls}
              >
                <option value="lead">🆕 جديد</option>
                <option value="contacted">📞 اتواصل</option>
                <option value="qualified">🎯 مهتم</option>
                <option value="won">🏆 عميل (اتحول)</option>
                <option value="lost">❌ ضايع</option>
                <option value="dormant">💤 خامد</option>
              </select>
              <input
                type="number"
                name="estimated_value"
                placeholder="قيمة الصفقة (لو 'عميل')"
                step="100"
                min="0"
                className={inputCls}
                defaultValue={customer.estimated_value ?? ""}
              />
              <input
                type="text"
                name="lost_reason"
                placeholder="سبب الضياع (لو 'ضايع')"
                className={inputCls}
                defaultValue={customer.lost_reason ?? ""}
              />
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-bold text-sm font-cairo"
              >
                💾 احفظ الحالة
              </button>
            </form>
          </section>

          {/* Assign */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
              👤 تعيين المسؤول
            </h2>
            <form action={assignLead} className="space-y-2">
              <input type="hidden" name="customer_id" value={customer.id} />
              <select
                name="employee_id"
                defaultValue={customer.assigned_to ?? ""}
                className={inputCls}
              >
                <option value="">— مفيش —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-sm font-cairo"
              >
                ✓ عيّن
              </button>
            </form>
          </section>

          {/* Add note */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
              📝 ضيف ملاحظة
            </h2>
            <form action={appendLeadNote} className="space-y-2">
              <input type="hidden" name="customer_id" value={customer.id} />
              <textarea
                name="note"
                required
                rows={2}
                placeholder="ملاحظة على الـ lead (هتتحفظ بتاريخ + اسمك)"
                className={`${inputCls} resize-y`}
              />
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm font-cairo"
              >
                + ضيف
              </button>
            </form>
          </section>
        </div>

        {/* Notes */}
        {customer.notes && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-black text-amber-900 mb-2 font-cairo">
              📒 ملاحظات
            </h2>
            <pre className="text-xs text-slate-700 font-cairo whitespace-pre-wrap leading-relaxed">
              {customer.notes}
            </pre>
          </section>
        )}

        {/* Timeline */}
        <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
          📜 السجل الزمني ({timeline.length})
        </h2>
        {timeline.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500 font-cairo">
            مفيش أحداث لسه
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {timeline.map((item) => {
              if (item.kind === "event") {
                const e = item.data;
                const lbl = EVENT_LABEL[e.event_type] ?? {
                  icon: "✦",
                  label: e.event_type,
                };
                return (
                  <div
                    key={`e-${e.id}`}
                    className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3"
                  >
                    <div className="text-xl shrink-0">{lbl.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 font-cairo">
                        {lbl.label}
                      </div>
                      <div className="text-[10px] text-slate-500 font-cairo">
                        {new Date(e.occurred_at).toLocaleString("ar-EG", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                        {e.utm_source && (
                          <>
                            {" · "}
                            <span className="font-mono">↗ {e.utm_source}</span>
                          </>
                        )}
                        {e.utm_campaign && (
                          <>
                            {" · "}
                            <span className="font-mono">{e.utm_campaign}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              const i = item.data;
              const channel = CHANNEL_LABEL[i.type] ?? i.type;
              const outcomeBadge: Record<string, string> = {
                positive: "bg-emerald-100 text-emerald-700",
                neutral: "bg-slate-100 text-slate-700",
                negative: "bg-rose-100 text-rose-700",
              };
              return (
                <div
                  key={`i-${i.id}`}
                  className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3"
                >
                  <div className="text-xl shrink-0">💬</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-sm font-bold text-slate-800 font-cairo">
                        {channel}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${outcomeBadge[i.outcome] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {i.outcome}
                      </span>
                    </div>
                    {i.notes && (
                      <p className="text-xs text-slate-600 font-cairo mt-1">
                        {i.notes}
                      </p>
                    )}
                    <div className="text-[10px] text-slate-500 font-cairo mt-1">
                      {new Date(i.created_at).toLocaleString("ar-EG", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function timeAgo(iso: string, nowMs: number): string {
  const ms = nowMs - new Date(iso).getTime();
  const hr = Math.floor(ms / 3600000);
  const day = Math.floor(ms / 86400000);
  if (hr < 1) return "أقل من ساعة";
  if (hr < 24) return `${hr} ساعة`;
  if (day === 1) return "إمبارح";
  if (day < 30) return `${day} يوم`;
  if (day < 365) return `${Math.floor(day / 30)} شهر`;
  return `${Math.floor(day / 365)} سنة`;
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-500 font-cairo mb-0.5">
        {label}
      </div>
      <div
        className={`text-sm ${mono ? "font-mono" : "font-cairo"} ${value ? "text-slate-800" : "text-slate-400"}`}
        dir={mono ? "ltr" : undefined}
      >
        {value ?? "—"}
      </div>
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
    <div
      className={`mb-4 p-3 rounded-xl border font-cairo text-sm ${cls}`}
    >
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-cyan-400 outline-none text-sm font-cairo";
