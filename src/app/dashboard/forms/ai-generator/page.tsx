"use client";

import { useState } from "react";
import Link from "next/link";

const DOCUMENT_TYPES = [
  { id: "employment_contract", label: "عقد عمل", icon: "📜" },
  { id: "warning_letter", label: "إنذار موظف", icon: "⚠️" },
  { id: "penalty_letter", label: "جزاء تأديبي", icon: "🔨" },
  { id: "offer_letter", label: "عرض وظيفي", icon: "🎯" },
  { id: "experience_certificate", label: "شهادة خبرة", icon: "🎓" },
  { id: "salary_certificate", label: "شهادة راتب", icon: "💰" },
  { id: "settlement_agreement", label: "مخالصة مالية", icon: "✅" },
  { id: "termination_letter", label: "إنهاء خدمة", icon: "🚪" },
];

export default function AIGeneratorPage() {
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0].id);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeTitle, setEmployeeTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          employeeName: employeeName || undefined,
          employeeTitle: employeeTitle || undefined,
          companyName: companyName || undefined,
          additionalContext: context || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التوليد");
      setResult(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (result) navigator.clipboard.writeText(result);
  }

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/20 min-h-screen" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/forms"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للنماذج
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-200 text-violet-700 text-xs font-bold mb-2 font-cairo">
            🤖 الذكاء الاصطناعي
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            المولّد الذكي للمستندات
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            AI بيكتب المستندات الرسمية بالعربية الفصحى القانونية — عقود، إنذارات،
            مخالصات، شهادات. اختار النوع، اكتب البيانات، وهات المستند جاهز.
          </p>
        </header>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Sidebar — document type selector */}
          <div className="lg:col-span-2 space-y-2">
            <label className="block text-sm font-bold text-slate-700 font-cairo mb-2">
              نوع المستند
            </label>
            {DOCUMENT_TYPES.map((dt) => (
              <button
                key={dt.id}
                onClick={() => { setDocType(dt.id); setResult(null); }}
                className={`w-full text-right px-4 py-3 rounded-xl border-2 font-cairo text-sm transition-all ${
                  docType === dt.id
                    ? "border-violet-400 bg-violet-50 text-violet-800 font-bold shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="ml-2">{dt.icon}</span>
                {dt.label}
              </button>
            ))}
          </div>

          {/* Main — form + result */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-black font-cairo text-slate-800">
                بيانات المستند
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 font-cairo mb-1">
                    اسم الموظف
                  </label>
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                    placeholder="مثال: أحمد محمد علي"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 font-cairo mb-1">
                    المسمى الوظيفي
                  </label>
                  <input
                    type="text"
                    value={employeeTitle}
                    onChange={(e) => setEmployeeTitle(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                    placeholder="مثال: مهندس برمجيات"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 font-cairo mb-1">
                  اسم الشركة
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                  placeholder="مثال: شركة نظام للموارد البشرية"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 font-cairo mb-1">
                  سياق إضافي (اختياري)
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-y"
                  placeholder="مثال: العقد لمدة سنة مع تجديد تلقائي، الراتب الأساسي 5000 جنيه + بدل مواصلات 500 جنيه"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-l from-violet-600 to-cyan-600 text-white font-bold font-cairo text-sm hover:from-violet-700 hover:to-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {loading ? "جارٍ التوليد..." : "🤖 توليد المستند بالذكاء الاصطناعي"}
              </button>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
                  {error}
                </div>
              )}
            </div>

            {/* Result */}
            {result && (
              <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-black font-cairo text-emerald-800">
                    ✅ المستند جاهز
                  </h2>
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold font-cairo hover:bg-slate-200 transition"
                  >
                    📋 نسخ
                  </button>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm leading-relaxed whitespace-pre-wrap font-cairo text-slate-800">
                  {result}
                </div>
                <p className="mt-3 text-xs text-slate-400 font-cairo">
                  ⚡ تم التوليد بواسطة الذكاء الاصطناعي — يُرجى مراجعة المستند قبل الاستخدام
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
