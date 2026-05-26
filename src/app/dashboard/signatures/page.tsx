import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";

// ============================================================================
// /dashboard/signatures — list of e-signature requests
// ============================================================================

export const dynamic = "force-dynamic";

type SignatureRequest = {
  id: string;
  title: string;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  token: string;
  status: string;
  expires_at: string | null;
  signed_at: string | null;
  created_at: string;
  employees: { full_name: string } | null;
};

type SearchParams = Promise<{ status?: string; saved?: string; error?: string }>;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: {
    label: "منتظر التوقيع",
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  signed: {
    label: "✓ تم التوقيع",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  expired: {
    label: "منتهي الصلاحية",
    color: "bg-slate-100 text-slate-600 border-slate-200",
  },
  cancelled: {
    label: "ملغي",
    color: "bg-rose-100 text-rose-700 border-rose-200",
  },
};

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nidhamhr.com"
  ).replace(/\/$/, "");
}

export default async function SignaturesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getMyProfile();
  const companyId = profile?.company_id ?? "";

  const params = await searchParams;
  const filter = params.status ?? "pending";

  let query = supabase
    .from("signature_requests")
    .select(
      "id, title, recipient_name, recipient_phone, recipient_email, token, status, expires_at, signed_at, created_at, employees(full_name)",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data: requests } = await query.returns<SignatureRequest[]>();
  const rows = requests ?? [];

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

        <header className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-200 text-violet-700 text-xs font-bold mb-2 font-cairo">
              ✍ توقيع إلكتروني
            </div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              التوقيعات الإلكترونية
            </h1>
            <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
              ارسل عقد أو مستند للموظف على واتساب، يفتح اللينك ويوقّع
              بإصبعه على الموبايل في ثواني. التوقيع بيتسجّل معاه الوقت
              والـ IP لو محتاج تأكيد قانوني.
            </p>
          </div>
          <Link
            href="/dashboard/signatures/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white font-bold text-sm shadow-md font-cairo transition"
          >
            <span>+</span>
            <span>طلب توقيع جديد</span>
          </Link>
        </header>

        {/* Status chips */}
        <nav className="flex flex-wrap gap-2 mb-4">
          {[
            { key: "pending", label: "منتظر التوقيع" },
            { key: "signed", label: "اتوقّع" },
            { key: "expired", label: "منتهي" },
            { key: "cancelled", label: "ملغي" },
            { key: "all", label: "الكل" },
          ].map((chip) => (
            <Link
              key={chip.key}
              href={`/dashboard/signatures?status=${chip.key}`}
              className={`px-4 py-1.5 rounded-full text-xs font-bold font-cairo border-2 transition ${
                filter === chip.key
                  ? "bg-brand-cyan-dark text-white border-brand-cyan-dark"
                  : "bg-white text-slate-700 border-slate-200 hover:border-brand-cyan"
              }`}
            >
              {chip.label}
            </Link>
          ))}
        </nav>

        {params.saved && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ طلب التوقيع اتسجّل — ابعت اللينك للمستلم
          </div>
        )}
        {params.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(params.error)}
          </div>
        )}

        {/* Empty state */}
        {rows.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="text-5xl mb-3">✍</div>
            <h2 className="text-lg font-bold font-cairo text-slate-700 mb-1">
              مفيش طلبات توقيع
              {filter !== "all" && filter !== "pending" && " بالحالة دي"}
            </h2>
            <p className="text-sm text-slate-500 font-cairo mb-5">
              ابدأ بإرسال أول مستند للتوقيع.
            </p>
            <Link
              href="/dashboard/signatures/new"
              className="inline-block px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-bold font-cairo transition"
            >
              + طلب جديد
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((req) => {
              const status = STATUS_LABEL[req.status] ?? {
                label: req.status,
                color: "bg-slate-100",
              };
              const baseUrl = getBaseUrl();
              const signUrl = `${baseUrl}/sign/${req.token}`;
              const isPending = req.status === "pending";
              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-wrap items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-slate-800 font-cairo truncate">
                        {req.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.color} font-cairo`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-cairo">
                      المستلم: <strong>{req.recipient_name}</strong>
                      {req.recipient_phone && ` · ${req.recipient_phone}`}
                      {req.employees?.full_name &&
                        ` · للموظف ${req.employees.full_name}`}
                    </div>
                    {isPending && (
                      <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-2 flex-wrap font-mono">
                        <span dir="ltr" className="bg-slate-50 px-2 py-1 rounded">
                          {signUrl}
                        </span>
                      </div>
                    )}
                    {req.signed_at && (
                      <div className="text-[10px] text-emerald-700 mt-1 font-cairo">
                        اتوقّع في{" "}
                        {new Date(req.signed_at).toLocaleString("ar-EG")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPending && req.recipient_phone && (
                      <a
                        href={`https://wa.me/${req.recipient_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                          `أهلاً ${req.recipient_name}، عندي مستند محتاج توقيعك:\n${req.title}\n\nاضغط هنا واوقّع: ${signUrl}`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold font-cairo transition"
                      >
                        💬 ابعت على واتساب
                      </a>
                    )}
                    <Link
                      href={signUrl}
                      target="_blank"
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-cairo transition"
                    >
                      👁 معاينة
                    </Link>
                    <Link
                      href={`/dashboard/signatures/${req.id}`}
                      className="px-3 py-1.5 rounded-lg bg-brand-cyan-dark text-white text-xs font-bold font-cairo transition"
                    >
                      التفاصيل ←
                    </Link>
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
