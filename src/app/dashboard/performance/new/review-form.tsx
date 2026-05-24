"use client";

// ============================================================================
// ReviewForm — client form for creating a performance review
// ============================================================================
//
// Manages two pieces of interactive state the server form can't handle:
//   1. The rating row of clickable stars (manager + self) — sets a
//      hidden input under the hood so the server action just reads
//      formData.get("manager_rating").
//   2. The dynamic KPI list — each KPI is a row with name/target/achieved/
//      weight/score. We serialize the whole list to a JSON string in a
//      hidden input named "kpis_json" right before submit.

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

type EmployeeOption = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
};

type Kpi = {
  name: string;
  target: string;
  achieved: string;
  weight: string;
  score: string;
};

const EMPTY_KPI: Kpi = { name: "", target: "", achieved: "", weight: "", score: "" };

const OUTCOMES = [
  { value: "",                 label: "— غير محدد —" },
  { value: "continue",         label: "استمرار" },
  { value: "promote",          label: "ترقية" },
  { value: "extend_probation", label: "تمديد فترة الاختبار" },
  { value: "pip_30_day",       label: "خطة تحسين 30 يوم" },
  { value: "pip_60_day",       label: "خطة تحسين 60 يوم" },
  { value: "terminate",        label: "إنهاء خدمة" },
];

export function ReviewForm({
  action,
  employees,
  defaultEmployeeId,
  defaultPeriodLabel,
  defaultPeriodStart,
  defaultPeriodEnd,
}: {
  action: (formData: FormData) => Promise<void>;
  employees: EmployeeOption[];
  defaultEmployeeId: string | null;
  defaultPeriodLabel: string;
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
}) {
  const [managerRating, setManagerRating] = useState<number>(0);
  const [selfRating, setSelfRating] = useState<number>(0);
  const [kpis, setKpis] = useState<Kpi[]>([{ ...EMPTY_KPI }]);

  function updateKpi(index: number, patch: Partial<Kpi>) {
    setKpis((prev) =>
      prev.map((k, i) => (i === index ? { ...k, ...patch } : k)),
    );
  }

  function addKpi() {
    setKpis((prev) => [...prev, { ...EMPTY_KPI }]);
  }

  function removeKpi(index: number) {
    setKpis((prev) => prev.filter((_, i) => i !== index));
  }

  // Serialize KPIs as JSON for the server action right before submit.
  // We use an onSubmit handler on the wrapper so the hidden input is
  // updated AFTER React's render cycle — otherwise the form might send
  // stale data.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const kpisInput = form.elements.namedItem("kpis_json") as HTMLInputElement | null;
    if (kpisInput) {
      // Drop empty rows (name + no scores)
      const cleaned = kpis
        .filter((k) => k.name.trim() !== "")
        .map((k) => ({
          name:     k.name.trim(),
          target:   k.target ? Number(k.target) : null,
          achieved: k.achieved ? Number(k.achieved) : null,
          weight:   k.weight ? Number(k.weight) : null,
          score:    k.score ? Number(k.score) : null,
        }));
      kpisInput.value = JSON.stringify(cleaned);
    }
  }

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6 font-cairo"
    >
      {/* Employee + period */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-slate-700 mb-1">
            الموظف <span className="text-rose-500">*</span>
          </label>
          <select
            name="employee_id"
            required
            defaultValue={defaultEmployeeId ?? ""}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
          >
            <option value="">— اختار موظف —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
                {e.job_title ? ` · ${e.job_title}` : ""}
                {e.department ? ` (${e.department})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            تسمية الفترة <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="period_label"
            required
            defaultValue={defaultPeriodLabel}
            placeholder="مثلاً: يناير 2026 / Q1 2026"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              من تاريخ
            </label>
            <input
              type="date"
              name="period_start"
              defaultValue={defaultPeriodStart}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              إلى تاريخ
            </label>
            <input
              type="date"
              name="period_end"
              defaultValue={defaultPeriodEnd}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Ratings */}
      <div className="grid md:grid-cols-2 gap-6 pt-3 border-t border-slate-100">
        <RatingPicker
          label="تقييم المدير"
          name="manager_rating"
          value={managerRating}
          onChange={setManagerRating}
          required
        />
        <RatingPicker
          label="التقييم الذاتي (اختياري)"
          name="self_rating"
          value={selfRating}
          onChange={setSelfRating}
        />
      </div>

      {/* KPIs */}
      <div className="pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800">
            🎯 الـ KPIs
          </h3>
          <button
            type="button"
            onClick={addKpi}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-bold"
          >
            + ضيف KPI
          </button>
        </div>

        {/* The kpis_json hidden input gets populated by handleSubmit
            right before the form is submitted. */}
        <input type="hidden" name="kpis_json" value="[]" />

        <div className="space-y-2">
          {kpis.map((k, i) => (
            <div
              key={i}
              className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 rounded-lg"
            >
              <input
                type="text"
                value={k.name}
                onChange={(e) => updateKpi(i, { name: e.target.value })}
                placeholder="اسم الـ KPI"
                className="col-span-4 px-2 py-1.5 text-sm rounded border border-slate-200 focus:border-amber-500 outline-none"
              />
              <input
                type="number"
                value={k.target}
                onChange={(e) => updateKpi(i, { target: e.target.value })}
                placeholder="الهدف"
                className="col-span-2 px-2 py-1.5 text-sm rounded border border-slate-200 focus:border-amber-500 outline-none text-center"
              />
              <input
                type="number"
                value={k.achieved}
                onChange={(e) => updateKpi(i, { achieved: e.target.value })}
                placeholder="المتحقق"
                className="col-span-2 px-2 py-1.5 text-sm rounded border border-slate-200 focus:border-amber-500 outline-none text-center"
              />
              <input
                type="number"
                value={k.weight}
                onChange={(e) => updateKpi(i, { weight: e.target.value })}
                placeholder="الوزن %"
                className="col-span-1 px-2 py-1.5 text-sm rounded border border-slate-200 focus:border-amber-500 outline-none text-center"
              />
              <select
                value={k.score}
                onChange={(e) => updateKpi(i, { score: e.target.value })}
                className="col-span-2 px-2 py-1.5 text-sm rounded border border-slate-200 focus:border-amber-500 outline-none"
              >
                <option value="">— التقييم —</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} نجوم
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeKpi(i)}
                className="col-span-1 text-rose-500 hover:bg-rose-50 rounded px-2 py-1.5 text-sm font-bold"
                title="حذف"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          الصفوف الفاضية بتتشال أوتوماتيك قبل الحفظ.
        </p>
      </div>

      {/* Text sections */}
      <div className="grid md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            💪 نقاط القوة
          </label>
          <textarea
            name="strengths"
            rows={3}
            placeholder="إنجازات الموظف، الـ skills اللي اتطورت..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            🎯 نقاط التحسين
          </label>
          <textarea
            name="areas_to_improve"
            rows={3}
            placeholder="حاجات محتاج يشتغل عليها في الفترة الجاية..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">
          📝 ملاحظات المدير
        </label>
        <textarea
          name="manager_notes"
          rows={3}
          placeholder="أي ملاحظات إضافية..."
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">
          🏁 النتيجة
        </label>
        <select
          name="outcome"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
        >
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <SubmitButton
        loadingText="جاري الحفظ..."
        className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-lg shadow-amber-500/30"
      >
        ✓ احفظ كمسودة
      </SubmitButton>
    </form>
  );
}

// ----------------------------------------------------------------------------
// RatingPicker — 5 clickable stars that update a hidden input
// ----------------------------------------------------------------------------
function RatingPicker({
  label,
  name,
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (n: number) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 mb-2">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === value ? 0 : n)}
            className={`text-3xl transition ${
              n <= value ? "text-amber-500" : "text-slate-300 hover:text-amber-300"
            }`}
            aria-label={`${n} stars`}
          >
            ★
          </button>
        ))}
        <span className="ms-3 text-xs text-slate-500">
          {value === 0 ? "—" : `${value} / 5`}
        </span>
      </div>
      <input type="hidden" name={name} value={value || ""} />
    </div>
  );
}
