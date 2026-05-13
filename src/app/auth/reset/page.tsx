import Link from "next/link";
import { verifyResetToken } from "./actions";
import { SubmitButton } from "@/components/submit-button";

type SearchParams = Promise<{
  token_hash?: string;
  type?: string;
  next?: string;
}>;

export default async function ResetPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash;
  const next = params.next ?? "/update-password";

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30">
      <div className="max-w-md w-full">
        <Link href="/" className="flex flex-col items-center mb-8 group">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy shadow-lg shadow-cyan-500/20 mb-3 group-hover:scale-105 transition">
            <span className="text-3xl font-black text-white font-display">ن</span>
          </div>
          <h1 className="text-3xl font-black font-display bg-gradient-to-r from-brand-cyan-dark via-brand-cyan to-brand-navy bg-clip-text text-transparent">
            نِظام
          </h1>
        </Link>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3 font-cairo">
            إعادة تعيين كلمة السر
          </h2>

          {!tokenHash ? (
            <>
              <p className="text-sm text-red-600 mb-6 font-cairo">
                ⚠ اللينك مش صحيح. لازم تيجي من إيميل إعادة تعيين كلمة السر.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block px-6 py-3 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold font-cairo transition"
              >
                اطلب لينك جديد
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-2 font-cairo leading-relaxed">
                وصلت من إيميل إعادة التعيين بنجاح.
              </p>
              <p className="text-sm text-slate-600 mb-6 font-cairo leading-relaxed">
                اضغط الزرار تحت عشان نتأكد إنك إنت، وبعدها هتقدر تحط كلمة سر جديدة.
              </p>

              <form action={verifyResetToken}>
                <input type="hidden" name="token_hash" value={tokenHash} />
                <input type="hidden" name="next" value={next} />
                <SubmitButton
                  loadingText="جاري التحقق..."
                  className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
                >
                  متابعة لتغيير كلمة السر ←
                </SubmitButton>
              </form>

              <p className="text-xs text-slate-400 mt-4 font-cairo">
                الزرار ده بيشتغل مرة واحدة بس. لو سيبت الصفحة وحاولت تاني، اطلب لينك جديد.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
