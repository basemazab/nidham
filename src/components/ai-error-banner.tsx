// ============================================================================
// AiErrorBanner — Arabic AI error display with actionable CTAs
// ============================================================================
//
// Used by every Marketing Studio page (and any future AI-powered page) to
// render error messages with the right call-to-action attached. The banner
// inspects the error text and:
//   - Adds a clickable "Open Groq" button when GROQ_API_KEY is mentioned
//   - Adds a clickable "Open Gemini" button when GEMINI_API_KEY is mentioned
//   - Auto-linkifies any console.groq.com / aistudio.google.com URLs
//   - Falls through to a plain banner when neither pattern matches
//
// Centralizing this in one component keeps every AI tool's failure UX
// consistent — the user doesn't have to copy URLs out of error text.

type Props = {
  message: string | null | undefined;
};

export function AiErrorBanner({ message }: Props) {
  if (!message) return null;

  const mentionsGroq = /GROQ_API_KEY|groq\.com/i.test(message);
  const mentionsGemini = /GEMINI_API_KEY|aistudio\.google/i.test(message);

  return (
    <div className="mb-5 p-4 rounded-xl bg-red-50 border-2 border-red-200 text-red-800 font-cairo text-sm">
      <div className="flex items-start gap-2">
        <span className="text-lg shrink-0">⚠</span>
        <div className="flex-1 leading-relaxed whitespace-pre-wrap">
          {message}
        </div>
      </div>

      {(mentionsGroq || mentionsGemini) && (
        <div className="mt-3 pt-3 border-t border-red-200 flex flex-wrap gap-2 items-center">
          <span className="text-[11px] text-red-700 font-bold">
            👇 الحل بضغطة واحدة:
          </span>
          {mentionsGroq && (
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition"
            >
              <span>افتح Groq</span>
              <span>↗</span>
            </a>
          )}
          {mentionsGemini && (
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition"
            >
              <span>افتح Gemini</span>
              <span>↗</span>
            </a>
          )}
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition"
          >
            <span>Vercel Env Vars</span>
            <span>↗</span>
          </a>
        </div>
      )}
    </div>
  );
}
