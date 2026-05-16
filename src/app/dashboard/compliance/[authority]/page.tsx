// ============================================================================
// /dashboard/compliance/[authority] — Per-authority compliance guide
// ============================================================================
//
// Renders a complete guide for one inspection authority: overview, legal
// basis, required document checklist (grouped into sections), common
// violations + penalties, and prep tips. Static content sourced from
// /lib/compliance-data.ts.
//
// Designed for an HR person who needs to prep for an inspection in the
// next 24 hours — every section is skimmable, every item has a 2-line
// description, and items that map to a Nidham form link directly to it.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthorityBySlug, type ComplianceItem } from "@/lib/compliance-data";

type PageProps = { params: Promise<{ authority: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { authority } = await params;
  const a = getAuthorityBySlug(authority);
  return {
    title: a ? `${a.name} · دليل الامتثال` : "دليل الامتثال",
  };
}

export default async function ComplianceAuthorityPage({ params }: PageProps) {
  const { authority: slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const authority = getAuthorityBySlug(slug);
  if (!authority) notFound();

  const tone = TONE_BY_COLOR[authority.color];

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/compliance"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للدليل
          </Link>
        </div>

        {/* Hero */}
        <header
          className={`rounded-2xl p-6 mb-6 bg-gradient-to-l ${tone.heroBg} border-2 ${tone.border}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-16 h-16 rounded-2xl ${tone.iconBg} border-2 ${tone.border} flex items-center justify-center text-3xl shrink-0`}
            >
              {authority.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-2 font-cairo ${tone.chip}`}
              >
                {authority.ministry}
              </div>
              <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1">
                {authority.name}
              </h1>
              <p className="text-sm text-slate-600 font-cairo leading-relaxed">
                {authority.tagline}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-700 font-cairo leading-relaxed mt-4">
            {authority.overview}
          </p>
        </header>

        {/* Meta strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <MetaCard
            label="🕒 تكرار التفتيش"
            value={authority.inspectionFrequency}
          />
          <MetaCard
            label="📜 القوانين المرجعية"
            value={`${authority.legalBasis.length} قانون`}
          />
          <MetaCard
            label="📋 إجمالي البنود"
            value={String(
              authority.sections.reduce((s, sec) => s + sec.items.length, 0),
            )}
          />
        </div>

        {/* Legal basis */}
        <Section title="🏛 الأساس القانوني" tone={tone}>
          <ul className="space-y-2">
            {authority.legalBasis.map((law, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-slate-700 font-cairo"
              >
                <span className={`shrink-0 ${tone.text}`}>▪</span>
                <span>{law}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Document sections */}
        {authority.sections.map((section, i) => (
          <Section
            key={i}
            title={`📋 ${section.title}`}
            tone={tone}
            count={section.items.length}
          >
            <div className="space-y-3">
              {section.items.map((item, idx) => (
                <ItemRow key={idx} item={item} idx={idx + 1} tone={tone} />
              ))}
            </div>
          </Section>
        ))}

        {/* Violations */}
        <Section title="⚠ المخالفات الشائعة + الغرامات" tone={tone} dangerous>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm font-cairo min-w-[500px]">
              <thead className="bg-rose-50 border-b-2 border-rose-200">
                <tr>
                  <th className="px-3 py-2 text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                    المخالفة
                  </th>
                  <th className="px-3 py-2 text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                    العقوبة
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {authority.violations.map((v, i) => (
                  <tr key={i} className="hover:bg-rose-50/30">
                    <td className="px-3 py-3 text-slate-700">{v.violation}</td>
                    <td className="px-3 py-3 text-rose-700 font-bold whitespace-nowrap">
                      {v.penalty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Tips */}
        <Section title="💡 نصائح للتجهيز" tone={tone}>
          <ul className="space-y-3">
            {authority.tips.map((tip, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-slate-700 font-cairo leading-relaxed"
              >
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-black shrink-0">
                  {i + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Footer disclaimer */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-xs text-slate-500 font-cairo leading-relaxed">
            <strong className="text-slate-700">⚠️ تنويه قانوني:</strong> الدليل
            ده إرشادي بشكل عام ومبني على القوانين السارية حتى تاريخ كتابته.
            القوانين بتتغير، والحالات الخاصة بتحتاج استشارة قانونية متخصصة. الـ
            HR في شركتك مسؤول عن متابعة آخر التعديلات والاستعانة بمتخصصين عند
            الحاجة (محامي، محاسب قانوني، مستشار سلامة).
          </div>
        </div>

        {/* Navigation chips */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          <Link
            href="/dashboard/compliance"
            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-sm font-cairo transition"
          >
            ← باقي الجهات
          </Link>
          <Link
            href="/dashboard/forms"
            className="px-4 py-2 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 font-bold text-sm font-cairo transition"
          >
            📄 النماذج الجاهزة
          </Link>
        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Section wrapper
// ----------------------------------------------------------------------------
function Section({
  title,
  tone,
  count,
  dangerous,
  children,
}: {
  title: string;
  tone: Tone;
  count?: number;
  dangerous?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2
          className={`text-base font-black font-cairo ${
            dangerous ? "text-rose-800" : "text-slate-800"
          }`}
        >
          {title}
        </h2>
        {count !== undefined && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-cairo ${tone.chip}`}
          >
            {count} بند
          </span>
        )}
      </div>
      <div
        className={`bg-white border rounded-2xl p-5 ${
          dangerous ? "border-rose-200" : "border-slate-200"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// ItemRow — one checklist item
// ----------------------------------------------------------------------------
function ItemRow({
  item,
  idx,
  tone,
}: {
  item: ComplianceItem;
  idx: number;
  tone: Tone;
}) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
      <div
        className={`shrink-0 w-8 h-8 rounded-lg ${tone.iconBg} border ${tone.border} flex items-center justify-center text-xs font-black ${tone.text} font-cairo`}
      >
        {idx}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <h3 className="font-bold text-slate-800 font-cairo text-sm">
            {item.title}
          </h3>
          {item.cadence && (
            <CadenceBadge cadence={item.cadence} />
          )}
          {item.threshold && (
            <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full font-cairo">
              {item.threshold}
            </span>
          )}
          {item.legalRef && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
              {item.legalRef}
            </span>
          )}
        </div>
        <p className="text-[12px] text-slate-600 font-cairo leading-relaxed">
          {item.description}
        </p>
        {item.formLink && (
          <Link
            href={item.formLink}
            className={`inline-flex items-center gap-1 mt-2 text-[11px] font-bold font-cairo ${tone.text} hover:underline`}
          >
            <span>↗</span>
            <span>افتح المتعلق في النظام</span>
          </Link>
        )}
      </div>
    </div>
  );
}

function CadenceBadge({ cadence }: { cadence: NonNullable<ComplianceItem["cadence"]> }) {
  const map: Record<string, { label: string; cls: string }> = {
    always: {
      label: "دائم",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    "on-hire": {
      label: "عند التعيين",
      cls: "bg-cyan-50 text-cyan-700 border-cyan-200",
    },
    "on-termination": {
      label: "عند الإنهاء",
      cls: "bg-slate-50 text-slate-600 border-slate-200",
    },
    monthly: {
      label: "شهري",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    annual: {
      label: "سنوي",
      cls: "bg-rose-50 text-rose-700 border-rose-200",
    },
    "on-incident": {
      label: "عند حادث",
      cls: "bg-rose-50 text-rose-700 border-rose-200",
    },
    "on-event": {
      label: "حسب الحاجة",
      cls: "bg-slate-50 text-slate-600 border-slate-200",
    },
  };
  const m = map[cadence] ?? map.always;
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold font-cairo ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

// ----------------------------------------------------------------------------
// MetaCard — top strip card
// ----------------------------------------------------------------------------
function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-cairo mb-1">
        {label}
      </div>
      <div className="text-sm font-bold text-slate-800 font-cairo">
        {value}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Tone palette (mirror of hub page)
// ----------------------------------------------------------------------------
type Tone = {
  border: string;
  heroBg: string;
  iconBg: string;
  chip: string;
  text: string;
};

const TONE_BY_COLOR: Record<string, Tone> = {
  cyan: {
    border: "border-cyan-300",
    heroBg: "from-cyan-50 to-white",
    iconBg: "bg-cyan-50",
    chip: "bg-cyan-100 text-cyan-800 border border-cyan-200",
    text: "text-cyan-700",
  },
  emerald: {
    border: "border-emerald-300",
    heroBg: "from-emerald-50 to-white",
    iconBg: "bg-emerald-50",
    chip: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    text: "text-emerald-700",
  },
  amber: {
    border: "border-amber-300",
    heroBg: "from-amber-50 to-white",
    iconBg: "bg-amber-50",
    chip: "bg-amber-100 text-amber-800 border border-amber-200",
    text: "text-amber-700",
  },
  rose: {
    border: "border-rose-300",
    heroBg: "from-rose-50 to-white",
    iconBg: "bg-rose-50",
    chip: "bg-rose-100 text-rose-800 border border-rose-200",
    text: "text-rose-700",
  },
  violet: {
    border: "border-violet-300",
    heroBg: "from-violet-50 to-white",
    iconBg: "bg-violet-50",
    chip: "bg-violet-100 text-violet-800 border border-violet-200",
    text: "text-violet-700",
  },
  slate: {
    border: "border-slate-300",
    heroBg: "from-slate-50 to-white",
    iconBg: "bg-slate-50",
    chip: "bg-slate-100 text-slate-800 border border-slate-200",
    text: "text-slate-700",
  },
  sky: {
    border: "border-sky-300",
    heroBg: "from-sky-50 to-white",
    iconBg: "bg-sky-50",
    chip: "bg-sky-100 text-sky-800 border border-sky-200",
    text: "text-sky-700",
  },
};
