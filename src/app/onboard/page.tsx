import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardClient } from "./onboard-client";

// ============================================================================
// /onboard — Employee self-onboarding wizard
// ============================================================================
//
// Replaces "HR types every detail manually" with "employee fills their
// own record". HR creates a skeleton employees row + sends invitation,
// employee accepts the invite (mig 015), then lands here to complete:
//
//   1. Welcome screen
//   2. Personal info (full_name, date_of_birth, national_id)
//   3. Contact (phone, email, address)
//   4. Banking (bank_name, bank_account_number)
//   5. Profile photo
//   6. Done — record marked complete, HR notified
//
// All PII (national_id, bank info) flows through the same encryption
// trigger as /dashboard/employees — Vault key + AES per migration 050.

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ done?: string; error?: string }>;

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/onboard");
  }

  // Pull the employee record linked to this auth user. The employee
  // could be either (a) freshly-invited with most fields NULL, or (b)
  // already partially-onboarded and resuming.
  //
  // We read from employees_with_pii (mig 067 grant) so the wizard can
  // pre-fill values the user already saved if they navigated away mid-flow.
  const { data: employee } = await supabase
    .from("employees_with_pii")
    .select(
      "id, full_name, date_of_birth, national_id_dec, phone, email, bank_name_dec, bank_account_number_dec, avatar_url, hire_date, job_title, department",
    )
    .eq("user_id", user.id)
    .maybeSingle<{
      id: string;
      full_name: string;
      date_of_birth: string | null;
      national_id_dec: string | null;
      phone: string | null;
      email: string | null;
      bank_name_dec: string | null;
      bank_account_number_dec: string | null;
      avatar_url: string | null;
      hire_date: string | null;
      job_title: string | null;
      department: string | null;
    }>();

  if (!employee) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center font-cairo">
          <div className="text-5xl mb-3">⚠</div>
          <h1 className="text-lg font-bold text-slate-800 mb-2">
            حسابك مش متربط بأي موظف
          </h1>
          <p className="text-sm text-slate-600 mb-5">
            تواصل مع HR الشركة بتاعتك علشان يبعتلك كود دعوة.
          </p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold font-cairo"
          >
            تسجيل خروج
          </Link>
        </div>
      </main>
    );
  }

  // Done state — show a celebration screen after the user completes
  // the final step. The actions.ts redirect lands here with ?done=1.
  if (params.done === "1") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-cyan-50 to-amber-50 p-6 font-cairo">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="text-7xl mb-4">🎉</div>
          <h1 className="text-2xl font-black text-emerald-700 mb-2">
            تمام كده! بياناتك كاملة.
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            HR شركتك بقى يقدر يطلع لك قسائم المرتب وشهادات العمل بدون أي
            تأخير. تقدر دلوقتي تستخدم باقي النظام:
          </p>

          <div className="grid grid-cols-1 gap-2 mb-6 text-right">
            <Link
              href="/clock-in"
              className="block p-4 rounded-xl bg-emerald-50 border-2 border-emerald-200 hover:border-emerald-400 transition"
            >
              <div className="font-bold text-emerald-900 mb-0.5">
                📍 سجّل حضورك دلوقتي
              </div>
              <div className="text-xs text-emerald-700">
                GPS + سيلفي · بياخد ١٠ ثواني
              </div>
            </Link>

            <Link
              href="/dashboard"
              className="block p-4 rounded-xl bg-cyan-50 border-2 border-cyan-200 hover:border-cyan-400 transition"
            >
              <div className="font-bold text-cyan-900 mb-0.5">
                🏠 شوف الـ Dashboard
              </div>
              <div className="text-xs text-cyan-700">
                طلبات الإجازة، رصيدك، مرتبك
              </div>
            </Link>
          </div>

          <p className="text-[10px] text-slate-400">
            🔐 كل بياناتك مشفّرة بـ AES-256 وفقاً لقانون حماية البيانات 151/2020
          </p>
        </div>
      </main>
    );
  }

  return (
    <OnboardClient
      initial={{
        employee_id: employee.id,
        full_name: employee.full_name ?? "",
        date_of_birth: employee.date_of_birth ?? "",
        national_id: employee.national_id_dec ?? "",
        phone: employee.phone ?? "",
        email: employee.email ?? "",
        bank_name: employee.bank_name_dec ?? "",
        bank_account_number: employee.bank_account_number_dec ?? "",
        avatar_url: employee.avatar_url ?? "",
        job_title: employee.job_title ?? "",
        department: employee.department ?? "",
        hire_date: employee.hire_date ?? "",
      }}
    />
  );
}
