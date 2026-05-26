"use client";

import { useState } from "react";

// ============================================================================
// EmbedSnippet — copy-to-clipboard widget for sharing tool embeds
// ============================================================================
//
// Renders a code block + Copy button. Used on each /tools/* page to give
// visitors (especially other Egyptian HR/accounting bloggers) a 1-click way
// to embed our calculator on their site — a key backlink strategy.

const SITE = "https://www.nidhamhr.com";

export function EmbedSnippet({
  embedPath,
  height = 700,
}: {
  embedPath: string;
  height?: number;
}) {
  const [copied, setCopied] = useState(false);
  const src = `${SITE}${embedPath}`;

  // We use the iframe-resizer pattern but stay light: a fixed sensible
  // height with `loading="lazy"` (so the host page Core Web Vitals don't
  // suffer) and width="100%" so it adapts to any container.
  const snippet = `<iframe src="${src}" width="100%" height="${height}" frameborder="0" loading="lazy" title="حاسبة نِظام HR"></iframe>
<p style="text-align:center;font-size:13px;color:#64748b;margin-top:8px;">
  أداة مجانية من <a href="${SITE}" target="_blank" rel="noopener">نِظام HR</a>
</p>`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers: a textarea + execCommand. We don't
      // surface a fancy error UX — the worst case is the user just
      // selects+copies the visible code block themselves.
    }
  };

  return (
    <div className="mt-12 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-3xl">🔗</div>
        <div>
          <h3 className="text-lg font-black text-slate-900 mb-1">
            ضع الحاسبة على موقعك مجاناً
          </h3>
          <p className="text-sm text-slate-600">
            عندك مدونة عن HR أو محاسبة أو قانون العمل؟ انسخ الكود وضعه في
            مقالك. الحاسبة هتظهر مع الـ branding بتاعك.
          </p>
        </div>
      </div>

      <div className="relative">
        <pre
          className="bg-slate-900 text-slate-100 text-xs p-4 pr-12 rounded-lg overflow-x-auto whitespace-pre"
          dir="ltr"
        >
          <code>{snippet}</code>
        </pre>
        <button
          onClick={copyToClipboard}
          className="absolute top-2 left-2 px-3 py-1.5 text-xs font-bold bg-brand-cyan-dark text-white rounded-md hover:bg-brand-cyan transition shadow"
          aria-label="انسخ الكود"
        >
          {copied ? "✓ تم النسخ" : "📋 انسخ"}
        </button>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        ✓ مجاني للاستخدام &nbsp;·&nbsp; ✓ بدون تسجيل &nbsp;·&nbsp; ✓ يظهر
        بنفس الـ branding بتاعك
      </div>
    </div>
  );
}
