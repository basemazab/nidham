"use client";

// "Write this job description for me" button. Sits next to the job-
// title field on /dashboard/jobs/new. When the user has typed a title
// (e.g. "Senior Backend Developer") + optionally a department / years,
// they hit the button and Gemini fills in description, requirements,
// responsibilities, and suggests a salary range.

import { useState } from "react";

type Generated = {
  description: string;
  requirements: string;
  responsibilities: string;
  suggested_salary_min: number | null;
  suggested_salary_max: number | null;
};

type Props = {
  // Form field IDs to write the generated content into. Lets us
  // collaborate with the existing native HTML form on /dashboard/
  // jobs/new without React refs.
  descriptionFieldId: string;
  requirementsFieldId: string;
  responsibilitiesFieldId: string;
  salaryMinFieldId: string;
  salaryMaxFieldId: string;
  titleFieldId: string;
  departmentFieldId: string;
  experienceYearsFieldId: string;
  jobTypeFieldId: string;
  locationFieldId: string;
};

export function AIJobDescriptionGenerator(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onGenerate = async () => {
    setError(null);
    setSuccess(false);

    const title = (document.getElementById(props.titleFieldId) as HTMLInputElement | null)?.value?.trim() ?? "";
    if (title.length < 2) {
      setError("اكتب اسم الوظيفة الأول (مثلاً: مهندس برمجيات)");
      return;
    }

    const department = (document.getElementById(props.departmentFieldId) as HTMLInputElement | null)?.value ?? "";
    const experienceYearsStr = (document.getElementById(props.experienceYearsFieldId) as HTMLInputElement | null)?.value ?? "0";
    const jobType = (document.getElementById(props.jobTypeFieldId) as HTMLSelectElement | null)?.value ?? "full_time";
    const location = (document.getElementById(props.locationFieldId) as HTMLInputElement | null)?.value ?? "";

    setLoading(true);
    try {
      const res = await fetch("/api/ai/recruit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate-jd",
          title,
          department: department || undefined,
          experience_years_min: parseInt(experienceYearsStr, 10) || 0,
          job_type: jobType,
          location: location || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }

      const data = (await res.json()) as Generated & { ok: true };

      // Write into the form fields. We use textareas for the three
      // long-form ones; the salary inputs are numeric.
      setField(props.descriptionFieldId, data.description);
      setField(props.requirementsFieldId, data.requirements);
      setField(props.responsibilitiesFieldId, data.responsibilities);
      if (data.suggested_salary_min != null) {
        setField(props.salaryMinFieldId, String(data.suggested_salary_min));
      }
      if (data.suggested_salary_max != null) {
        setField(props.salaryMaxFieldId, String(data.suggested_salary_max));
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 via-white to-cyan-50 border-2 border-amber-200 rounded-2xl p-4 mb-5">
      <div className="flex items-start gap-3">
        <div className="text-2xl">✦</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-slate-800 mb-1 font-cairo">
            خلّي الـ AI يكتبهالك
          </h3>
          <p className="text-xs text-slate-600 mb-3 font-cairo leading-relaxed">
            اكتب المسمى الوظيفي تحت + الخبرة المطلوبة، ودوس الزرار -- الـ AI
            هيكتب الوصف والمتطلبات والمسؤوليات وحتى اقتراح للراتب. تقدر تعدّل أي حاجة بعد كده.
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2 text-xs text-red-700 font-cairo">
              ⚠ {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mb-2 text-xs text-emerald-800 font-cairo">
              ✓ تم! راجع الحقول تحت وعدّل اللي تحبه.
            </div>
          )}
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm font-cairo transition disabled:opacity-60"
          >
            {loading ? "✦ بيكتب الوصف..." : "✦ ولّد الوصف بالـ AI"}
          </button>
        </div>
      </div>
    </div>
  );
}

function setField(id: string, value: string) {
  const el = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;
  if (!el) return;
  el.value = value;
  // Dispatch input event so React listeners that might watch the field
  // pick up the change.
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
