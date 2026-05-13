import Link from "next/link";

// Custom 404 -- the default Next.js page is English-only and feels out of
// place in an Arabic product. This one matches the brand and offers a
// useful next step instead of dropping the user at a dead end.
export const metadata = {
  title: "الصفحة مش موجودة | نِظام",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow-lg">
          <span className="text-3xl font-black text-white font-display">٤٠٤</span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-black font-cairo text-slate-900">
            الصفحة دي مش موجودة
          </h1>
          <p className="text-sm text-slate-600 font-cairo leading-relaxed">
            يمكن الـ link قديم، أو الصفحة اتنقلت، أو فيه typo في العنوان.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/dashboard"
            className="flex-1 px-4 py-3 rounded-xl bg-brand-cyan-dark hover:bg-brand-cyan text-white font-cairo font-bold text-sm transition flex items-center justify-center"
          >
            للرئيسية
          </Link>
          <Link
            href="/"
            className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-sm transition flex items-center justify-center"
          >
            صفحة البداية
          </Link>
        </div>
      </div>
    </div>
  );
}
