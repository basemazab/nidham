"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Anomaly = {
  employeeId: string;
  employeeName: string;
  type: string;
  severity: "critical" | "warning" | "info";
  description: string;
  details: Record<string, unknown>;
  date: string;
  recommendation: string;
};

type DeptRank = {
  departmentName: string;
  attendanceRate: number;
  tardinessRate: number;
  overtimeAvg: number;
  anomalyCount: number;
};

type Insights = {
  anomalies: Anomaly[];
  summary: {
    totalAnomalies: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    topIssues: string[];
  };
  departmentRanks: DeptRank[];
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-red-100", text: "text-red-700", label: "حرج" },
  warning: { bg: "bg-amber-100", text: "text-amber-700", label: "تنبيه" },
  info: { bg: "bg-blue-100", text: "text-blue-700", label: "ملاحظة" },
};

const TYPE_LABELS: Record<string, string> = {
  fake_gps: "GPS مشبوه",
  unusual_overtime: "أوفرتايم غير معتاد",
  repeated_pattern: "نمط متكرر",
  suspicious_attendance: "حضور مشبوه",
  missing_checkout: "خروج غير مسجل",
  abnormal_behavior: "سلوك غير معتاد",
};

const TYPE_ICONS: Record<string, string> = {
  fake_gps: "📍",
  unusual_overtime: "⏰",
  repeated_pattern: "🔄",
  suspicious_attendance: "👀",
  missing_checkout: "🚪",
  abnormal_behavior: "⚠️",
};

export default function AttendanceIntelligencePage() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/ai/attendance-insights?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setInsights(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  const filteredAnomalies = insights?.anomalies.filter(
    (a) => filterSeverity === "all" || a.severity === filterSeverity,
  ) ?? [];

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-orange-50/20 min-h-screen" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/attendance"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للحضور والانصراف
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 text-orange-700 text-xs font-bold mb-2 font-cairo">
            🧠 ذكاء الحضور
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
                تحليلات الحضور الذكية
              </h1>
              <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
                AI بتحليل أنماط الحضور والانصراف — يكشف GPS مزيف، أوفرتايم غير معتاد،
                أنماط متكررة، وتسجيل دخول بدون خروج.
              </p>
            </div>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-cairo bg-white"
            >
              <option value={7}>آخر 7 أيام</option>
              <option value={14}>آخر 14 يوم</option>
              <option value={30}>آخر 30 يوم</option>
              <option value={90}>آخر 90 يوم</option>
            </select>
          </div>
        </header>

        {loading && (
          <div className="text-center py-12 text-slate-400 font-cairo">جاري التحليل...</div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            {error}
          </div>
        )}

        {insights && !loading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                label="إجمالي الحالات"
                value={insights.summary.totalAnomalies}
                icon="🔍"
                color="text-slate-700"
              />
              <SummaryCard
                label="حالات حرجة"
                value={insights.summary.criticalCount}
                icon="🚨"
                color="text-red-600"
              />
              <SummaryCard
                label="تنبيهات"
                value={insights.summary.warningCount}
                icon="⚠️"
                color="text-amber-600"
              />
              <SummaryCard
                label="ملاحظات"
                value={insights.summary.infoCount}
                icon="💡"
                color="text-blue-600"
              />
            </div>

            {/* Top Issues */}
            {insights.summary.topIssues.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6">
                <h3 className="text-sm font-bold text-slate-700 font-cairo mb-2">
                  أهم المشكلات المكتشفة
                </h3>
                <div className="flex flex-wrap gap-2">
                  {insights.summary.topIssues.map((issue, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold font-cairo border border-red-200"
                    >
                      {issue}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Filter + Anomaly List */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-slate-500 font-cairo">تصفية:</span>
              {["all", "critical", "warning", "info"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSeverity(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-cairo transition ${
                    filterSeverity === s
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {s === "all" ? "الكل" : SEVERITY_COLORS[s]?.label}
                </button>
              ))}
            </div>

            <div className="space-y-3 mb-8">
              {filteredAnomalies.length === 0 && (
                <div className="text-center py-8 text-slate-400 font-cairo">
                  {insights.summary.totalAnomalies === 0
                    ? "🎉 لا توجد أي حالة شاذة — أداء مثالي!"
                    : "لا توجد نتائج للتصفية الحالية"}
                </div>
              )}
              {filteredAnomalies.map((a, i) => {
                const sev = SEVERITY_COLORS[a.severity];
                return (
                  <div
                    key={i}
                    className={`bg-white border-r-4 rounded-2xl p-4 ${
                      a.severity === "critical"
                        ? "border-r-red-500 shadow-sm"
                        : a.severity === "warning"
                          ? "border-r-amber-500"
                          : "border-r-blue-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl shrink-0">
                          {TYPE_ICONS[a.type] || "🔍"}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-bold text-slate-800 font-cairo">
                              {a.employeeName}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-cairo ${sev.bg} ${sev.text}`}>
                              {sev.label}
                            </span>
                            <span className="text-[10px] text-slate-400 font-cairo">
                              {TYPE_LABELS[a.type] || a.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-cairo mb-1">
                            {a.description}
                          </p>
                          <p className="text-[11px] text-slate-400 font-cairo">
                            التاريخ: {a.date}
                          </p>
                          <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600 font-cairo">
                            💡 {a.recommendation}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Department Rankings */}
            {insights.departmentRanks && insights.departmentRanks.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="text-lg font-black font-cairo text-slate-800 mb-4">
                  ترتيب الأقسام
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-cairo">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-xs">
                        <th className="text-right py-2 px-2">القسم</th>
                        <th className="text-center py-2 px-2">نسبة الحضور</th>
                        <th className="text-center py-2 px-2">التأخير</th>
                        <th className="text-center py-2 px-2">معدل الأوفرتايم</th>
                        <th className="text-center py-2 px-2">الحالات الشاذة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.departmentRanks.map((d, i) => (
                        <tr
                          key={i}
                          className={`border-b border-slate-100 ${
                            d.anomalyCount > 0 ? "text-slate-800" : "text-slate-600"
                          }`}
                        >
                          <td className="py-3 px-2 font-bold">{d.departmentName}</td>
                          <td className="text-center py-3 px-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                d.attendanceRate >= 90
                                  ? "bg-emerald-100 text-emerald-700"
                                  : d.attendanceRate >= 70
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {d.attendanceRate}%
                            </span>
                          </td>
                          <td className="text-center py-3 px-2">{d.tardinessRate}%</td>
                          <td className="text-center py-3 px-2">{d.overtimeAvg} د</td>
                          <td className="text-center py-3 px-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                d.anomalyCount > 0
                                  ? "bg-red-100 text-red-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {d.anomalyCount}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-[11px] text-slate-500 font-cairo">{label}</span>
      </div>
      <div className={`text-2xl font-black font-cairo ${color}`}>{value}</div>
    </div>
  );
}
