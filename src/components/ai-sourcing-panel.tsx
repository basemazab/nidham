"use client";

// "AI Sourcing" panel on the job detail page. Three modes the recruiter
// can run in any order:
//
//   1. Match candidates: scores everyone in the company's `candidates`
//      table against this job. Top 10 returned with strengths/gaps.
//   2. Boolean search: gives the recruiter ready-made LinkedIn /
//      Google X-ray / Wuzzuf strings to paste into external sites.
//   3. Outreach (per-candidate): generates WhatsApp + email drafts
//      tailored to the (job × candidate) pair.

import { useEffect, useState } from "react";

type MatchedCandidate = {
  candidate_id: string;
  score: number;
  reasoning: string;
  key_strengths: string[];
  gaps: string[];
  candidate: {
    id: string;
    full_name: string;
    current_title: string | null;
    current_company: string | null;
    years_experience: number | null;
    location: string | null;
    expected_salary: number | null;
  };
};

type BooleanResult = {
  linkedin: string;
  google_xray: string;
  wuzzuf_keywords: string;
  notes: string;
};

type OutreachResult = {
  whatsapp_message: string;
  email_subject: string;
  email_body: string;
};

type Props = {
  jobId: string;
};

type Tab = "match" | "boolean" | null;

export function AISourcingPanel({ jobId }: Props) {
  const [tab, setTab] = useState<Tab>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [boolLoading, setBoolLoading] = useState(false);
  const [matches, setMatches] = useState<MatchedCandidate[] | null>(null);
  const [matchNotes, setMatchNotes] = useState<string | null>(null);
  const [bool, setBool] = useState<BooleanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runMatch = async () => {
    setError(null);
    setMatchLoading(true);
    try {
      const res = await fetch("/api/ai/recruit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "match-candidates", job_id: jobId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMatches(data.matches ?? []);
      setMatchNotes(data.notes ?? null);
      setTab("match");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMatchLoading(false);
    }
  };

  const runBoolean = async () => {
    setError(null);
    setBoolLoading(true);
    try {
      const res = await fetch("/api/ai/recruit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "boolean-search", job_id: jobId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setBool({
        linkedin: data.linkedin,
        google_xray: data.google_xray,
        wuzzuf_keywords: data.wuzzuf_keywords,
        notes: data.notes,
      });
      setTab("boolean");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBoolLoading(false);
    }
  };

  return (
    <section className="bg-gradient-to-br from-amber-50/40 via-white to-cyan-50/30 border-2 border-amber-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-black font-cairo text-slate-800">
          ✦ AI Sourcing
        </h2>
        <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
          جديد
        </span>
      </div>
      <p className="text-sm text-slate-600 mb-5 font-cairo leading-relaxed">
        خلّي الـ AI يساعدك تلاقي المرشحين المناسبين — يبدأ من قاعدة بياناتك
        الداخلية، ولو محتاج توسّع برّه عندك سلاسل بحث جاهزة للنسخ.
      </p>

      <div className="grid md:grid-cols-2 gap-3 mb-5">
        <button
          type="button"
          onClick={runMatch}
          disabled={matchLoading}
          className="text-right px-4 py-3 rounded-xl border-2 border-cyan-200 bg-white hover:border-cyan-400 hover:shadow-md transition font-cairo disabled:opacity-60"
        >
          <div className="text-2xl mb-1">👥</div>
          <div className="font-bold text-slate-800 text-sm">
            {matchLoading ? "بيقيّم المرشحين..." : "اقترح مرشحين من قاعدة بياناتي"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            الـ AI بيقيّم كل المرشحين الموجودين عندك ويرتّبهم لهذه الوظيفة
          </div>
        </button>

        <button
          type="button"
          onClick={runBoolean}
          disabled={boolLoading}
          className="text-right px-4 py-3 rounded-xl border-2 border-amber-200 bg-white hover:border-amber-400 hover:shadow-md transition font-cairo disabled:opacity-60"
        >
          <div className="text-2xl mb-1">🔍</div>
          <div className="font-bold text-slate-800 text-sm">
            {boolLoading ? "بيولّد..." : "Boolean Search للبحث الخارجي"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            ولّد سلاسل بحث جاهزة لـ LinkedIn و Wuzzuf و Google
          </div>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 font-cairo">
          ⚠ {error}
        </div>
      )}

      {tab === "match" && matches && (
        <MatchResults
          matches={matches}
          notes={matchNotes}
          jobId={jobId}
        />
      )}
      {tab === "boolean" && bool && <BooleanResults bool={bool} />}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Match results
// ----------------------------------------------------------------------------

function MatchResults({
  matches,
  notes,
  jobId,
}: {
  matches: MatchedCandidate[];
  notes: string | null;
  jobId: string;
}) {
  if (matches.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
        <div className="text-3xl mb-2">📭</div>
        <div className="font-bold text-slate-800 font-cairo mb-1">
          مفيش مرشحين مناسبين دلوقتي
        </div>
        <p className="text-sm text-slate-500 font-cairo">
          {notes ?? "ضيف مرشحين أكتر في قاعدة بياناتك أو استخدم Boolean Search."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500 font-cairo">
        ✓ أحسن {matches.length} مرشح مرتبين تنازليًا حسب درجة المطابقة
      </div>
      {matches.map((m) => (
        <CandidateMatchCard key={m.candidate_id} match={m} jobId={jobId} />
      ))}
    </div>
  );
}

function CandidateMatchCard({
  match,
  jobId,
}: {
  match: MatchedCandidate;
  jobId: string;
}) {
  const [outreachOpen, setOutreachOpen] = useState(false);

  const scoreColor =
    match.score >= 80
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : match.score >= 60
      ? "bg-cyan-100 text-cyan-800 border-cyan-300"
      : match.score >= 40
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-slate-100 text-slate-600 border-slate-300";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-cyan-300 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <div
          className={`w-14 h-14 rounded-xl border-2 ${scoreColor} flex items-center justify-center shrink-0`}
        >
          <div className="text-center">
            <div className="text-lg font-black font-display leading-none">
              {match.score}
            </div>
            <div className="text-[8px] leading-none mt-0.5">من 100</div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 font-cairo">
            {match.candidate.full_name}
          </div>
          <div className="text-xs text-slate-500 font-cairo mt-0.5">
            {match.candidate.current_title ?? "—"}{" "}
            {match.candidate.current_company && (
              <>· {match.candidate.current_company}</>
            )}
            {match.candidate.years_experience != null && (
              <> · {match.candidate.years_experience} سنين</>
            )}
            {match.candidate.location && <> · {match.candidate.location}</>}
          </div>
          <p className="text-sm text-slate-700 mt-2 font-cairo leading-relaxed">
            {match.reasoning}
          </p>

          {match.key_strengths.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {match.key_strengths.map((s, i) => (
                <span
                  key={i}
                  className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-cairo"
                >
                  ✓ {s}
                </span>
              ))}
            </div>
          )}

          {match.gaps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {match.gaps.map((g, i) => (
                <span
                  key={i}
                  className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-cairo"
                >
                  ⚠ {g}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setOutreachOpen(true)}
            className="mt-3 text-xs text-brand-cyan-dark hover:text-brand-cyan font-bold font-cairo"
          >
            ✦ اكتب رسالة تواصل بالـ AI ←
          </button>
        </div>
      </div>

      {outreachOpen && (
        <OutreachModal
          jobId={jobId}
          candidateId={match.candidate_id}
          candidateName={match.candidate.full_name}
          onClose={() => setOutreachOpen(false)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Boolean results
// ----------------------------------------------------------------------------

function BooleanResults({ bool }: { bool: BooleanResult }) {
  return (
    <div className="space-y-3">
      <CopyableBlock
        label="LinkedIn Boolean (Recruiter / Sales Navigator)"
        value={bool.linkedin}
      />
      <CopyableBlock label="Google X-Ray (LinkedIn العام)" value={bool.google_xray} />
      <CopyableBlock
        label="Wuzzuf / Bayt كلمات مفتاحية"
        value={bool.wuzzuf_keywords}
      />
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-cairo">
        💡 {bool.notes}
      </div>
    </div>
  );
}

function CopyableBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-slate-700 font-cairo">{label}</div>
        <button
          type="button"
          onClick={onCopy}
          className={`text-xs px-2 py-0.5 rounded font-bold font-cairo transition ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {copied ? "تم النسخ ✓" : "نسخ"}
        </button>
      </div>
      <pre
        className="bg-slate-900 text-emerald-300 text-xs p-3 rounded-lg overflow-x-auto font-mono whitespace-pre-wrap break-all"
        dir="ltr"
      >
        {value}
      </pre>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Outreach modal
// ----------------------------------------------------------------------------

function OutreachModal({
  jobId,
  candidateId,
  candidateName,
  onClose,
}: {
  jobId: string;
  candidateId: string;
  candidateName: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fire the AI request once on mount. The component is rendered only
  // when the user clicks "اكتب رسالة تواصل" so we don't burn Gemini
  // quota on every job-detail visit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/recruit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "outreach",
            job_id: jobId,
            candidate_id: candidateId,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setResult({
          whatsapp_message: data.whatsapp_message,
          email_subject: data.email_subject,
          email_body: data.email_body,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, candidateId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-slate-800 font-cairo">
              ✦ رسائل تواصل لـ {candidateName}
            </h3>
            <p className="text-xs text-slate-500 font-cairo mt-0.5">
              الـ AI كتبها بناءً على بياناتك. عدّل قبل ما تبعت.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="py-10 text-center text-slate-500 font-cairo">
            ✦ بيكتب الرسائل...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-cairo">
            ⚠ {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <OutreachBlock
              label="💬 رسالة واتساب"
              value={result.whatsapp_message}
            />
            <OutreachBlock
              label="✉ عنوان الإيميل"
              value={result.email_subject}
            />
            <OutreachBlock label="📝 نص الإيميل" value={result.email_body} />
          </div>
        )}
      </div>
    </div>
  );
}

function OutreachBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200">
        <div className="text-xs font-bold text-slate-700 font-cairo">{label}</div>
        <button
          type="button"
          onClick={onCopy}
          className={`text-xs px-2 py-0.5 rounded font-bold font-cairo transition ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
          }`}
        >
          {copied ? "تم النسخ ✓" : "نسخ"}
        </button>
      </div>
      <div className="p-3 text-sm text-slate-800 font-cairo whitespace-pre-wrap leading-relaxed bg-white">
        {value}
      </div>
    </div>
  );
}
