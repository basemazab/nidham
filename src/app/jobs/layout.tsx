import Link from "next/link";

export const metadata = {
  title: "وظائف — نِظام",
  description:
    "اكتشف فرص عمل من شركات مصرية، وقدم بسهولة من خلال منصة نِظام للتوظيف الذكي.",
};

export default function PublicJobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/jobs" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow-md shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition">
              <span className="text-xl font-black text-white font-display">
                ن
              </span>
            </div>
            <div>
              <div className="text-lg font-black font-display bg-gradient-to-r from-brand-cyan-dark to-brand-navy bg-clip-text text-transparent leading-none">
                نِظام · الوظائف
              </div>
              <div className="text-[10px] tracking-widest text-brand-gold font-semibold mt-0.5">
                NIDHAM JOBS
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 text-sm font-cairo">
            <Link
              href="/login"
              className="hidden sm:inline px-3 py-1.5 text-slate-600 hover:text-brand-cyan-dark transition"
            >
              تسجيل دخول الشركات
            </Link>
            <Link
              href="/signup"
              className="px-3 sm:px-4 py-1.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-sm hover:shadow-md hover:shadow-cyan-500/30 transition"
            >
              نشر وظيفة
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-cairo">
          <div>
            © {new Date().getFullYear()} نِظام · Nidham. كل الحقوق محفوظة.
          </div>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-brand-cyan-dark transition">
              عن نِظام
            </Link>
            <Link href="/jobs" className="hover:text-brand-cyan-dark transition">
              تصفح الوظائف
            </Link>
            <Link href="/signup" className="hover:text-brand-cyan-dark transition">
              للشركات
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
