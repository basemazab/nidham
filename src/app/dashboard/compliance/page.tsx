// ============================================================================
// /dashboard/compliance — Inspection Authority Compliance Hub
// ============================================================================
//
// The hub for the "dليل امتثال" feature. Lists every Egyptian inspection
// authority that can show up at the company's door — Labor Office, Social
// Insurance, Tax, Health & Safety, Civil Defense, Industrial Security,
// Environment — with a card per authority that links to its full guide.
//
// Designed so a non-legal HR person can navigate by problem ("inspector
// from labor office is coming tomorrow") rather than by law text.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COMPLIANCE_AUTHORITIES, countItems, totalItems } from "@/lib/compliance-data";

export default async function ComplianceHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const grandTotal = totalItems();

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-amber-50/20 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-rose-50 via-amber-50 to-emerald-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            ✦ دليل الامتثال
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            دليل الامتثال لجهات التفتيش
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            ٧ جهات تفتيش رسمية ممكن تيجي لشركتك في أي وقت — كل جهة عندها
            مستندات بتطلبها وإجراءات لازم تكون مستوفية. الدليل ده بيوريك
            <strong className="text-slate-700"> كل ورقة لازم تكون عندك </strong>
            وإزاي تجهزها مطابقة للقانون المصري.
          </p>
        </header>

        {/* Top summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard
            label="جهات التفتيش"
            value={String(COMPLIANCE_AUTHORITIES.length)}
            icon="🏛"
            color="cyan"
          />
          <SummaryCard
            label="إجمالي البنود"
            value={String(grandTotal)}
            icon="📋"
            color="amber"
          />
          <SummaryCard
            label="قوانين مرجعية"
            value="٨+"
            icon="⚖"
            color="violet"
          />
          <SummaryCard
            label="نماذج جاهزة"
            value="٩"
            icon="📄"
            color="emerald"
            link="/dashboard/forms"
          />
        </div>

        {/* Why this matters */}
        <div className="mb-6 p-5 rounded-2xl bg-gradient-to-l from-amber-50 to-rose-50 border-2 border-amber-200">
          <div className="flex items-start gap-3">
            <span className="text-3xl">💡</span>
            <div>
              <h3 className="font-black font-cairo text-slate-800 mb-1">
                ليه دليل الامتثال ده مهم؟
              </h3>
              <p className="text-sm text-slate-700 font-cairo leading-relaxed mb-2">
                مفتش مكتب العمل، التأمينات، الضرائب أو الدفاع المدني ممكن يدخل
                شركتك بدون موعد. لو ما لقاش أي مستند مطلوب، الغرامات بتبدأ من
                <strong className="text-rose-700"> 1,000 جنيه </strong>
                وممكن توصل لـ
                <strong className="text-rose-700"> إغلاق النشاط</strong>.
                الدليل ده بيخليك جاهز لأي تفتيش.
              </p>
              <p className="text-xs text-slate-600 font-cairo">
                ⚠️ المعلومات دي إرشادية بشكل عام. للحالات الخاصة، استشر محامي
                متخصص في قانون العمل.
              </p>
            </div>
          </div>
        </div>

        {/* Authority cards */}
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 font-cairo">
          جهات التفتيش
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMPLIANCE_AUTHORITIES.map((a) => {
            const itemsCount = countItems(a);
            const tone = TONE_BY_COLOR[a.color];
            return (
              <Link
                key={a.slug}
                href={`/dashboard/compliance/${a.slug}`}
                className={`group bg-white border-2 ${tone.border} rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`w-12 h-12 rounded-xl ${tone.bg} ${tone.border} border flex items-center justify-center text-2xl shrink-0`}
                  >
                    {a.icon}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-bold font-cairo ${tone.chip}`}
                  >
                    {itemsCount} بند
                  </span>
                </div>
                <h3
                  className={`text-base font-black font-cairo text-slate-800 mb-1 group-hover:${tone.titleHover} transition`}
                >
                  {a.name}
                </h3>
                <p className="text-[11px] text-slate-500 font-cairo leading-relaxed line-clamp-2 mb-3">
                  {a.tagline}
                </p>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-cairo">
                    {a.ministry}
                  </span>
                  <span className={`font-bold ${tone.text}`}>
                    اعرف التفاصيل →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Tip section */}
        <div className="mt-8 grid md:grid-cols-3 gap-3">
          <Tip
            icon="📝"
            title="تجهيز قبل التفتيش"
            text="افتح الدليل لكل جهة + تأكد إن كل المستندات عندك جاهزة قبل أي تفتيش"
          />
          <Tip
            icon="🤝"
            title="استعن بمتخصصين"
            text="محاسب قانوني + مستشار سلامة + مسؤول بيئي — مش رفاهية، استثمار"
          />
          <Tip
            icon="📅"
            title="تحديث دوري"
            text="القوانين بتتغير. راجع الدليل كل 6 شهور + تابع أخبار وزارة العمل"
          />
        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Color palette per authority — derived from compliance-data.ts color field
// ----------------------------------------------------------------------------
type Tone = {
  border: string;
  bg: string;
  chip: string;
  text: string;
  titleHover: string;
};

const TONE_BY_COLOR: Record<string, Tone> = {
  cyan: {
    border: "border-cyan-200 hover:border-cyan-400",
    bg: "bg-cyan-50",
    chip: "bg-cyan-50 text-cyan-700 border-cyan-200",
    text: "text-cyan-700",
    titleHover: "text-cyan-700",
  },
  emerald: {
    border: "border-emerald-200 hover:border-emerald-400",
    bg: "bg-emerald-50",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    text: "text-emerald-700",
    titleHover: "text-emerald-700",
  },
  amber: {
    border: "border-amber-200 hover:border-amber-400",
    bg: "bg-amber-50",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    text: "text-amber-700",
    titleHover: "text-amber-700",
  },
  rose: {
    border: "border-rose-200 hover:border-rose-400",
    bg: "bg-rose-50",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    text: "text-rose-700",
    titleHover: "text-rose-700",
  },
  violet: {
    border: "border-violet-200 hover:border-violet-400",
    bg: "bg-violet-50",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    text: "text-violet-700",
    titleHover: "text-violet-700",
  },
  slate: {
    border: "border-slate-200 hover:border-slate-400",
    bg: "bg-slate-50",
    chip: "bg-slate-50 text-slate-700 border-slate-200",
    text: "text-slate-700",
    titleHover: "text-slate-700",
  },
  sky: {
    border: "border-sky-200 hover:border-sky-400",
    bg: "bg-sky-50",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
    text: "text-sky-700",
    titleHover: "text-sky-700",
  },
};

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function SummaryCard({
  label,
  value,
  icon,
  color,
  link,
}: {
  label: string;
  value: string;
  icon: string;
  color: "cyan" | "amber" | "violet" | "emerald";
  link?: string;
}) {
  const bg = {
    cyan: "from-cyan-50 to-white border-cyan-200",
    amber: "from-amber-50 to-white border-amber-200",
    violet: "from-violet-50 to-white border-violet-200",
    emerald: "from-emerald-50 to-white border-emerald-200",
  }[color];
  const txt = {
    cyan: "text-cyan-700",
    amber: "text-amber-700",
    violet: "text-violet-700",
    emerald: "text-emerald-700",
  }[color];

  const content = (
    <div
      className={`p-4 rounded-2xl bg-gradient-to-br ${bg} border shadow-sm h-full`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        <span
          className={`text-[10px] font-bold uppercase font-cairo ${txt} tracking-wider`}
        >
          {label}
        </span>
      </div>
      <div className="text-2xl md:text-3xl font-black text-slate-800 font-cairo">
        {value}
      </div>
    </div>
  );

  if (link) {
    return (
      <Link href={link} className="block hover:-translate-y-0.5 transition">
        {content}
      </Link>
    );
  }
  return content;
}

function Tip({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-start gap-2.5">
        <span className="text-xl shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800 font-cairo">
            {title}
          </div>
          <div className="text-[11px] text-slate-500 font-cairo leading-relaxed mt-0.5">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}
