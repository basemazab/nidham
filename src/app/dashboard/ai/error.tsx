"use client";

export default function AIError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-lg mx-auto text-center pt-16">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold font-cairo mb-2 text-slate-700">حدث خطأ في المساعد الذكي</h1>
        <p className="text-slate-500 text-sm font-cairo mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-brand-cyan-dark text-white font-bold text-sm font-cairo hover:bg-brand-cyan transition"
        >
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
