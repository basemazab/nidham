import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";

// ============================================================================
// Celebrations — upcoming work anniversaries + birthdays in the next 90 days
// ============================================================================
//
// Pure SQL. Pulls all active employees with hire_date or date_of_birth set,
// computes the next occurrence of each in the next 90 days, sorts the
// combined list by date, and renders cards. Each card has a one-tap
// "ابعت تهنئة على واتساب" button that opens wa.me with a pre-filled
// Arabic greeting personalised to milestone (1 yr, 5 yr, etc).
//
// Cultural fit: in Egyptian SMBs, the founder personally messages every
// employee on their birthday + work anniversary. This page makes that
// 30 seconds instead of "did I miss anyone?" anxiety.

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  full_name: string;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  hire_date: string | null;
  date_of_birth: string | null;
};

type Celebration = {
  /** "anniv" | "bday" — drives icon + greeting copy. */
  kind: "anniv" | "bday";
  employee: Employee;
  /** ISO date of the upcoming celebration. */
  date: string;
  /** Days from today (0 = today, positive = future). */
  daysAhead: number;
  /** For anniversaries, years completed. For birthdays, 0. */
  years: number;
};

/** Format an Arabic-friendly month-day label. */
function formatMonthDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
}

/** Strip non-digit chars from an Egyptian phone number, prefix 20 if needed. */
function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  let p = raw.replace(/[^\d]/g, "");
  if (!p) return null;
  if (p.startsWith("0")) p = "2" + p; // 010... → 2010...
  if (!p.startsWith("20") && p.length === 10) p = "20" + p; // 10... → 2010...
  return p;
}

/** Build the next occurrence date (within 365 days) of a recurring MM-DD. */
function nextOccurrence(monthDay: string, fromDate: Date): Date {
  const [m, d] = monthDay.split("-").map(Number);
  if (!m || !d) return new Date(fromDate);
  let yr = fromDate.getFullYear();
  let next = new Date(yr, m - 1, d);
  if (next < fromDate) {
    yr += 1;
    next = new Date(yr, m - 1, d);
  }
  return next;
}

/** Days between two Date objects, rounded. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Build the wa.me URL with a personalised Arabic greeting. */
function whatsappLink(c: Celebration): string | null {
  const phone = normalizePhone(c.employee.phone);
  if (!phone) return null;
  const name = c.employee.full_name.split(" ")[0]; // first name feels warmer
  const text =
    c.kind === "anniv"
      ? c.years === 1
        ? `🎉 كل سنة وانت طيب يا ${name}!\nالنهاردة عدّت سنة كاملة على انضمامك ليّنا — شكراً على كل المجهود والأمانة.\nمستنيين منك أكتر بكتير 💪`
        : `🎊 ${c.years} سنين على بداية رحلتك معانا يا ${name}!\nمفيش كلام يوفّيك حقك. شكراً على كل يوم اشتغلت فيه معانا بإخلاص.\nاحتفال حلو يستحقك 🥳`
      : `🎂 كل سنة وانت طيب يا ${name}!\nسعداء جداً إنك في فريقنا — يومك يكون أحلى من اللي قبله، وكل أحلامك تتحقق.\nسنة سعيدة 🎉`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export default async function CelebrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getMyProfile();
  const companyId = profile?.company_id ?? "";

  const { data: rows } = await supabase
    .from("employees")
    .select(
      "id, full_name, phone, job_title, department, hire_date, date_of_birth",
    )
    .eq("company_id", companyId)
    .eq("status", "active")
    .returns<Employee[]>();

  const employees = rows ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Walk every employee, compute upcoming celebrations within 90 days.
  const celebrations: Celebration[] = [];
  for (const e of employees) {
    // Work anniversaries
    if (e.hire_date) {
      const next = nextOccurrence(e.hire_date.slice(5, 10), today);
      const days = daysBetween(today, next);
      if (days <= 90) {
        const years = next.getFullYear() - new Date(e.hire_date).getFullYear();
        if (years >= 1) {
          celebrations.push({
            kind: "anniv",
            employee: e,
            date: next.toISOString().split("T")[0],
            daysAhead: days,
            years,
          });
        }
      }
    }
    // Birthdays (if present)
    if (e.date_of_birth) {
      const next = nextOccurrence(e.date_of_birth.slice(5, 10), today);
      const days = daysBetween(today, next);
      if (days <= 90) {
        celebrations.push({
          kind: "bday",
          employee: e,
          date: next.toISOString().split("T")[0],
          daysAhead: days,
          years: 0,
        });
      }
    }
  }
  celebrations.sort((a, b) => a.daysAhead - b.daysAhead);

  // Bucket for the section grouping
  const thisWeek = celebrations.filter((c) => c.daysAhead <= 7);
  const thisMonth = celebrations.filter(
    (c) => c.daysAhead > 7 && c.daysAhead <= 30,
  );
  const later = celebrations.filter((c) => c.daysAhead > 30);

  const noBirthdays = employees.every((e) => !e.date_of_birth);

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-emerald-50 to-amber-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            🎉 احتفالات
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            ذكريات تعيين + أعياد ميلاد
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed">
            كل الذكريات السنوية لفريقك خلال الـ 90 يوم القادمة. اضغط زرار
            واتساب وابعت رسالة شخصية في 5 ثواني — تخليك دايماً متذكّرها قبل
            ميعادها.
          </p>
        </header>

        {/* Hint for birthdays — show until at least one employee has DOB set */}
        {noBirthdays && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 font-cairo text-sm text-amber-800 flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <strong>عايز تشوف أعياد الميلاد كمان؟</strong> ادخل ملف أي موظف
              من قائمة الموظفين وفي خانة "تاريخ الميلاد" حط التاريخ — هيظهر
              هنا تلقائياً.
            </div>
          </div>
        )}

        {/* Empty state */}
        {celebrations.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">🎂</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش احتفالات في الـ 90 يوم القادمة
            </h2>
            <p className="text-slate-500 font-cairo">
              لما يجي ميعاد، هتلاقيهم هنا. مفيش حاجة محتاجة منك دلوقتي.
            </p>
          </div>
        ) : (
          <>
            <Section
              title="🔥 الأسبوع ده"
              hint="استحقاق فوري — ابعت قبل ميعادهم"
              items={thisWeek}
            />
            <Section
              title="📅 خلال الشهر ده"
              hint="جهّز رسالة مسبقاً علشان متفوّتش"
              items={thisMonth}
            />
            <Section
              title="🗓 الـ 60 يوم اللي بعدها"
              hint="للتخطيط — مكافآت أو احتفالات أكبر"
              items={later}
            />
          </>
        )}
      </div>
    </main>
  );
}

function Section({
  title,
  hint,
  items,
}: {
  title: string;
  hint: string;
  items: Celebration[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-bold font-cairo text-slate-800">{title}</h2>
        <span className="text-xs text-slate-500 font-cairo">{hint}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((c) => (
          <CelebrationCard key={`${c.kind}-${c.employee.id}`} c={c} />
        ))}
      </div>
    </section>
  );
}

function CelebrationCard({ c }: { c: Celebration }) {
  const wa = whatsappLink(c);
  const isAnniv = c.kind === "anniv";

  const subtitle = isAnniv
    ? c.years === 1
      ? "سنة كاملة معانا 🎉"
      : `${c.years} سنين معانا 🎊`
    : "عيد ميلاده 🎂";

  const dateLabel =
    c.daysAhead === 0
      ? "النهارده"
      : c.daysAhead === 1
        ? "بكره"
        : `بعد ${c.daysAhead} يوم · ${formatMonthDay(c.date)}`;

  return (
    <div
      className={`p-4 rounded-2xl border-2 ${
        isAnniv
          ? "bg-gradient-to-br from-emerald-50 to-white border-emerald-200"
          : "bg-gradient-to-br from-amber-50 to-white border-amber-200"
      } flex items-center gap-4`}
    >
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
          isAnniv
            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
            : "bg-gradient-to-br from-amber-500 to-amber-600 text-white"
        }`}
      >
        {isAnniv ? "🎊" : "🎂"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-slate-900 font-cairo truncate">
          {c.employee.full_name}
        </div>
        <div className="text-xs text-slate-600 font-cairo">{subtitle}</div>
        <div className="text-xs text-slate-500 mt-0.5 font-cairo">
          {dateLabel}
          {c.employee.department && (
            <span className="mr-1.5"> · {c.employee.department}</span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm font-cairo whitespace-nowrap transition"
          >
            <span>💬</span>
            <span>تهنّي</span>
          </a>
        ) : (
          <span
            className="inline-block px-3 py-2 rounded-xl bg-slate-100 text-slate-400 text-xs font-cairo"
            title="مفيش رقم تليفون مسجّل"
          >
            مفيش رقم
          </span>
        )}
      </div>
    </div>
  );
}
