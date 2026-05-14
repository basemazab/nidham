"use client";

// Re-trigger the print dialog. Used on the /print/* pages where
// AutoPrint fires window.print() once on mount; if the user dismissed
// that first dialog and wants another shot at it, this button is
// the obvious place to click.
//
// Lives in a client component on purpose: server components in
// Next.js 15 / React 19 cannot attach inline onClick handlers --
// the server can't serialise the function across the RSC boundary
// and the page errors at request time with the global error.tsx
// boundary swallowing the trace.

export function PrintAgainButton({
  label = "🖨 طباعة تاني",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "px-4 py-2 rounded-lg bg-brand-cyan-dark text-white font-bold font-cairo hover:bg-brand-cyan transition"
      }
    >
      {label}
    </button>
  );
}
