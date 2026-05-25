import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitation } from "./actions";
import { SubmitButton } from "@/components/submit-button";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

type InvitationLookup = {
  id: string;
  company_id: string;
  company_name: string;
  email: string;
  full_name: string | null;
  role: "admin" | "manager" | "employee";
  status: "pending" | "accepted" | "expired" | "cancelled";
  expires_at: string;
};

const ROLE_LABELS: Record<InvitationLookup["role"], string> = {
  admin: "مدير",
  manager: "مشرف",
  employee: "موظف",
};

export default async function AcceptInvitePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  // Use the public RPC function (no auth required, looks up by token)
  const { data: invitations } = await supabase.rpc("get_invitation_by_token", {
    p_token: token,
  });

  const invitation: InvitationLookup | null =
    invitations && invitations.length > 0 ? invitations[0] : null;

  const isExpired = invitation
    ? new Date(invitation.expires_at) < new Date()
    : false;
  const isInvalid = !invitation || invitation.status !== "pending" || isExpired;

  const acceptBound = acceptInvitation.bind(null, token);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30">
      <div className="max-w-md w-full">
        <Link href="/" className="flex flex-col items-center mb-8 group">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy shadow-lg shadow-cyan-500/20 mb-3">
            <span className="text-3xl font-black text-white font-display">ن</span>
          </div>
          <h1 className="text-3xl font-black font-display bg-gradient-to-r from-brand-cyan-dark via-brand-cyan to-brand-navy bg-clip-text text-transparent">
            نِظام
          </h1>
        </Link>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          {!invitation ? (
            <div className="text-center">
              <div className="text-5xl mb-3">⚠️</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2 font-cairo">
                دعوة مش موجودة
              </h2>
              <p className="text-sm text-slate-600 mb-6 font-cairo">
                اللينك ده مش صحيح. تأكد من الشخص اللي دعاك يبعتلك اللينك الصح.
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
              >
                الرجوع للرئيسية
              </Link>
            </div>
          ) : invitation.status === "accepted" ? (
            <div className="text-center">
              <div className="text-5xl mb-3">✓</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2 font-cairo">
                الدعوة مقبولة بالفعل
              </h2>
              <p className="text-sm text-slate-600 mb-6 font-cairo">
                أنت قبلت الدعوة دي قبل كده. سجّل دخولك عادي.
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
              >
                تسجيل الدخول
              </Link>
            </div>
          ) : invitation.status === "cancelled" || invitation.status === "expired" || isExpired ? (
            <div className="text-center">
              <div className="text-5xl mb-3">⏰</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2 font-cairo">
                الدعوة منتهية أو ملغية
              </h2>
              <p className="text-sm text-slate-600 mb-6 font-cairo">
                اطلب من المدير يبعتلك دعوة جديدة.
              </p>
            </div>
          ) : isInvalid ? (
            <div className="text-center">
              <div className="text-5xl mb-3">⚠</div>
              <p className="text-sm text-slate-600 font-cairo">الدعوة دي مش متاحة.</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-2xl font-bold text-slate-800 mb-1 font-cairo">
                  أهلًا بك في نِظام!
                </h2>
                <p className="text-sm text-slate-600 font-cairo">
                  تم دعوتك للانضمام لـ <strong>{invitation.company_name}</strong>
                </p>
                <p className="text-xs text-slate-500 mt-2 font-cairo">
                  الإيميل: <span className="font-mono">{invitation.email}</span>
                </p>
                <p className="text-xs text-slate-500 font-cairo">
                  الصلاحية: <strong className="text-brand-cyan-dark">{ROLE_LABELS[invitation.role]}</strong>
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
                  ⚠ {decodeURIComponent(error)}
                </div>
              )}

              <form action={acceptBound} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    اسمك الكامل
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    defaultValue={invitation.full_name ?? ""}
                    placeholder="اسمك الكامل"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    اختار كلمة سر{" "}
                    <span className="text-slate-400 text-xs">
                      (12 حرف على الأقل، حرف كبير + صغير + رقم + رمز)
                    </span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                  />
                </div>

                <SubmitButton
                  loadingText="جاري إنشاء الحساب..."
                  className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
                >
                  قبول الدعوة وإنشاء حسابي
                </SubmitButton>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
