"use client";

// Three-state PDF importer:
//   - "idle"    : show the upload form
//   - "preview" : show the parsed records in an editable table with
//                 include/exclude checkboxes
//   - "saving"  : posting to confirmPdfImport server action
//
// The AI doesn't write to the DB on its own -- HR has to confirm
// every row. National IDs, dates, salaries can all be wrong, so the
// preview table lets the user fix them inline before save.

import { useState, useTransition } from "react";
import {
  confirmPdfImport,
  type EmployeeImportRow,
} from "@/app/dashboard/employees/import/actions";
import { FileDropZone } from "./file-drop-zone";

type ParseResponse = {
  ok: true;
  employees: EmployeeImportRow[];
  notes: string;
  truncated: boolean;
};
type ParseError = { error: string };

type Row = EmployeeImportRow & { included: boolean };

export function PDFImportFlow() {
  const [stage, setStage] = useState<"idle" | "preview">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, startTransition] = useTransition();

  const onParse = async () => {
    if (!file) return;
    setError(null);
    setNotes(null);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/parse-pdf", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json()) as ParseResponse | ParseError;
      if (!res.ok || "error" in body) {
        setError("error" in body ? body.error : `HTTP ${res.status}`);
        return;
      }
      if (body.employees.length === 0) {
        setError(
          `ما لقيتش موظفين في الـ PDF. ${body.notes ?? ""}`.trim(),
        );
        return;
      }
      setRows(body.employees.map((e) => ({ ...e, included: true })));
      setNotes(body.notes ?? null);
      setStage("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
    }
  };

  const onSave = () => {
    const selected = rows
      .filter((r) => r.included)
      .map(({ included, ...rest }) => {
        void included;
        return rest;
      });
    if (selected.length === 0) {
      setError("اختار على الأقل صف واحد");
      return;
    }
    startTransition(async () => {
      await confirmPdfImport(selected);
      // confirmPdfImport redirects -- nothing to do here
    });
  };

  const updateRow = <K extends keyof EmployeeImportRow>(
    idx: number,
    field: K,
    value: EmployeeImportRow[K],
  ) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const toggleRow = (idx: number) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], included: !next[idx].included };
      return next;
    });
  };

  const selectedCount = rows.filter((r) => r.included).length;

  // -------- stage: idle --------
  if (stage === "idle") {
    return (
      <div className="space-y-4">
        <div className="text-sm text-slate-600 font-cairo leading-relaxed">
          الـ AI هيقرا ملف الـ PDF (ورقة موظفين، قسائم رواتب قديمة، أي
          documents فيها بيانات موظفين) ويستخرج الصفوف. هتراجعها قبل ما تنحفظ.
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
            ⚠ {error}
          </div>
        )}

        <FileDropZone
          accept=".pdf,application/pdf"
          hint="ملف PDF · حد أقصى 5 ميجا · 30 صفحة"
          label="ارفع ملف PDF فيه بيانات الموظفين"
          maxBytes={5 * 1024 * 1024}
          onFileSelected={(f) => {
            setFile(f);
            setError(null);
          }}
        />
        <p className="text-xs text-slate-500 font-cairo">
          الـ AI بياخد 5-15 ثانية في القراءة بعد ما تدوس الزرار تحت.
        </p>

        <button
          type="button"
          onClick={onParse}
          disabled={!file || parsing}
          className="w-full px-5 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm font-cairo transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {parsing ? "✦ الـ AI بيقرا الملف..." : "✦ ابدأ القراءة الذكية"}
        </button>
      </div>
    );
  }

  // -------- stage: preview --------
  return (
    <div className="space-y-4">
      {notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 font-cairo text-sm">
          📝 ملاحظة الـ AI: {notes}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
          ⚠ {error}
        </div>
      )}

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 font-cairo text-sm flex items-center justify-between flex-wrap gap-2">
        <span>
          ✓ تم استخراج <b>{rows.length}</b> صف ·{" "}
          <b>{selectedCount}</b> محدد للحفظ
        </span>
        <button
          type="button"
          onClick={() => {
            setStage("idle");
            setRows([]);
            setFile(null);
          }}
          className="text-xs underline hover:text-emerald-900"
        >
          ارفع ملف تاني
        </button>
      </div>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table className="w-full text-sm font-cairo">
          <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-right w-10">حفظ؟</th>
              <th className="px-3 py-2 text-right">الاسم</th>
              <th className="px-3 py-2 text-right">الكود</th>
              <th className="px-3 py-2 text-right">الوظيفة</th>
              <th className="px-3 py-2 text-right">القسم</th>
              <th className="px-3 py-2 text-right">تليفون</th>
              <th className="px-3 py-2 text-right">إيميل</th>
              <th className="px-3 py-2 text-right">تاريخ التعيين</th>
              <th className="px-3 py-2 text-right">المرتب</th>
              <th className="px-3 py-2 text-right">حافز</th>
              <th className="px-3 py-2 text-right">رقم قومي</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className={`border-b border-slate-100 ${r.included ? "" : "opacity-40"}`}
              >
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={r.included}
                    onChange={() => toggleRow(i)}
                    className="w-4 h-4 accent-brand-cyan-dark cursor-pointer"
                  />
                </td>
                <PreviewCell
                  value={r.full_name}
                  onChange={(v) => updateRow(i, "full_name", v)}
                  bold
                />
                <PreviewCell
                  value={r.employee_code ?? ""}
                  onChange={(v) => updateRow(i, "employee_code", v || null)}
                />
                <PreviewCell
                  value={r.job_title ?? ""}
                  onChange={(v) => updateRow(i, "job_title", v || null)}
                />
                <PreviewCell
                  value={r.department ?? ""}
                  onChange={(v) => updateRow(i, "department", v || null)}
                />
                <PreviewCell
                  value={r.phone ?? ""}
                  onChange={(v) => updateRow(i, "phone", v || null)}
                />
                <PreviewCell
                  value={r.email ?? ""}
                  onChange={(v) => updateRow(i, "email", v || null)}
                />
                <PreviewCell
                  value={r.hire_date ?? ""}
                  onChange={(v) => updateRow(i, "hire_date", v || null)}
                  placeholder="2026-05-14"
                />
                <PreviewCell
                  value={r.basic_salary != null ? String(r.basic_salary) : ""}
                  onChange={(v) =>
                    updateRow(i, "basic_salary", v ? Number(v) : null)
                  }
                  align="left"
                />
                <PreviewCell
                  value={
                    r.incentive_allowance != null
                      ? String(r.incentive_allowance)
                      : ""
                  }
                  onChange={(v) =>
                    updateRow(i, "incentive_allowance", v ? Number(v) : null)
                  }
                  align="left"
                />
                <PreviewCell
                  value={r.national_id ?? ""}
                  onChange={(v) => updateRow(i, "national_id", v || null)}
                  align="left"
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || selectedCount === 0}
          className="flex-1 px-5 py-3 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition disabled:opacity-50"
        >
          {pending
            ? "بنحفظ..."
            : `✓ احفظ ${selectedCount} موظف`}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage("idle");
            setRows([]);
            setFile(null);
          }}
          className="px-5 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold text-sm font-cairo hover:bg-slate-50 transition"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}

// Editable cell -- displays as plain text until clicked, then turns into
// an input. Keeps the table readable while still letting HR fix any
// AI-mis-extraction inline.
function PreviewCell({
  value,
  onChange,
  placeholder,
  bold,
  align = "right",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  bold?: boolean;
  align?: "right" | "left";
}) {
  return (
    <td className="px-2 py-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "—"}
        dir={align === "left" ? "ltr" : "auto"}
        style={{ textAlign: align }}
        className={`w-full bg-transparent px-2 py-1.5 rounded border border-transparent hover:border-slate-200 focus:border-brand-cyan focus:bg-white outline-none text-sm transition ${bold ? "font-bold text-slate-800" : "text-slate-700"}`}
      />
    </td>
  );
}
