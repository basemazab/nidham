"use client";

// Global error boundary. Next.js routes unhandled exceptions through
// here. We:
//   1) ship the error to Sentry (if the SDK is configured) so the team
//      gets paged in production,
//   2) log to console for local dev,
//   3) show a friendly Arabic UI with a Retry button + the Sentry digest
//      so support can match the user's report to a specific event.
//
// Previously this just console.error()'d the issue — Sentry capture
// was P0 #5 in PRODUCTION_READINESS_AUDIT.md.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Capture to Sentry. If the SDK isn't initialised (missing DSN), this
    // is a silent no-op — no exception bubbles up.
    Sentry.captureException(error);

     
    console.error("Unhandled error in route:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 flex items-center justify-center">
          <svg
            className="w-9 h-9 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-black font-cairo text-slate-900">
            حصلت مشكلة غير متوقعة
          </h1>
          <p className="text-sm text-slate-600 font-cairo leading-relaxed">
            رجاءً جرّب تعمل refresh، ولو المشكلة استمرت ابعتلنا الرقم اللي تحت
            عشان نقدر نتابع.
          </p>
        </div>

        {error.digest && (
          <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-500 break-all">
            ref: {error.digest}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={reset}
            className="flex-1 px-4 py-3 rounded-xl bg-brand-cyan-dark hover:bg-brand-cyan text-white font-cairo font-bold text-sm transition"
          >
            🔄 حاول تاني
          </button>
          <a
            href="/dashboard"
            className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-sm transition flex items-center justify-center"
          >
            للرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}
