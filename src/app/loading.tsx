// ============================================================================
// Root loading fallback — shown only on cold-load + nav from outside the
// app (landing → dashboard, login → dashboard, etc.). Per-route loading.tsx
// takes precedence once you're navigating WITHIN a segment.
// ============================================================================

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow-lg shadow-cyan-500/20 animate-pulse">
          <span className="text-2xl font-black text-white font-display">ن</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-cairo text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-brand-cyan animate-bounce [animation-delay:-0.3s]" />
          <span className="inline-block w-2 h-2 rounded-full bg-brand-cyan animate-bounce [animation-delay:-0.15s]" />
          <span className="inline-block w-2 h-2 rounded-full bg-brand-cyan animate-bounce" />
          <span className="mr-2">جاري التحميل...</span>
        </div>
      </div>
    </div>
  );
}
