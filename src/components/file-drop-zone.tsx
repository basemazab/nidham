"use client";

// Big, friendly file picker. Two interaction paths so iOS Safari, in-
// app browsers, and stripped-down WebViews all reach the OS dialog:
//
//   1. The whole drop zone is a <label htmlFor={inputId}>. Browsers
//      natively forward any click inside the label to the matching
//      <input id={inputId}>. No JS .click() needed.
//   2. Inside the drop zone there's an explicit "اختار ملف" link
//      with the same htmlFor. Some embedded browsers refuse to forward
//      clicks on non-text label children -- this gives them a plain
//      label-text fallback that always works.
//
// The <input type="file"> itself is positioned far off-screen rather
// than display:none, because iOS Safari has been known to refuse
// .change events on display:none inputs in older builds. Off-screen
// keeps it focusable + change-eventable everywhere.

import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";

type Props = {
  /** Comma-separated list of accepted file extensions / MIME types. */
  accept: string;
  /** Form field name; only needed when used inside a <form action={...}>. */
  name?: string;
  /** Required-flag forwarded to the underlying input. */
  required?: boolean;
  /** Human-readable hint shown under the headline. */
  hint?: string;
  /** Override the default "ارفع ملف أو اسحبه هنا" label. */
  label?: string;
  /** Optional callback when a file is selected (used by PDF-AI flow). */
  onFileSelected?: (file: File | null) => void;
  /** Max bytes -- we surface a friendly error instead of failing later. */
  maxBytes?: number;
};

export function FileDropZone({
  accept,
  name,
  required,
  hint,
  label = "ارفع ملف أو اسحبه هنا",
  onFileSelected,
  maxBytes,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setFromFile = (f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      onFileSelected?.(null);
      return;
    }
    if (maxBytes && f.size > maxBytes) {
      setError(
        `الملف كبير (${(f.size / 1024 / 1024).toFixed(1)} MB). الحد الأقصى ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`,
      );
      return;
    }
    setFile(f);
    onFileSelected?.(f);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFromFile(f);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (!f) return;

    const acceptList = accept
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const ext = "." + (f.name.split(".").pop()?.toLowerCase() ?? "");
    const allowed =
      acceptList.length === 0 ||
      acceptList.some((a) => a === ext || a === f.type.toLowerCase());

    if (!allowed) {
      setError(
        `نوع الملف مش مدعوم (${ext}). المسموح: ${accept.replace(/\./g, "")}`,
      );
      return;
    }

    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
    setFromFile(f);
  };

  const onClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) inputRef.current.value = "";
    setFromFile(null);
  };

  return (
    <div>
      {/* Off-screen but functional input. Positioning (not display:none)
          keeps iOS Safari + WebViews happy with the change event. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={name}
        accept={accept}
        required={required && !file}
        onChange={onChange}
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          opacity: 0,
        }}
      />

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`block cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
          dragOver
            ? "border-brand-cyan bg-brand-cyan/5"
            : file
            ? "border-emerald-300 bg-emerald-50/40"
            : "border-slate-300 bg-slate-50 hover:border-brand-cyan/50 hover:bg-slate-100/50 active:bg-slate-100"
        }`}
      >
        {file ? (
          <div className="flex items-center justify-between gap-3 text-right">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl shrink-0">
                ✓
              </div>
              <div className="min-w-0">
                <div
                  className="font-bold text-slate-800 truncate font-cairo"
                  dir="ltr"
                >
                  {file.name}
                </div>
                <div className="text-xs text-slate-500 font-cairo">
                  {(file.size / 1024).toFixed(1)} KB · جاهز للرفع
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition font-cairo shrink-0"
            >
              تغيير
            </button>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-2">⬆</div>
            <div className="font-bold text-slate-700 font-cairo mb-1">
              {label}
            </div>
            {hint && (
              <div className="text-xs text-slate-500 font-cairo">{hint}</div>
            )}
            <div className="mt-4 inline-block px-4 py-2 rounded-full bg-brand-cyan-dark text-white text-sm font-bold font-cairo">
              اختار ملف
            </div>
            <div className="text-[11px] text-slate-400 mt-2 font-cairo">
              أو اسحب الملف لهنا
            </div>
          </div>
        )}
      </label>

      {/* Fallback: a fully redundant plain-label button. Identical
          htmlFor, separate visual element so the user has two ways to
          open the picker. */}
      {!file && (
        <label
          htmlFor={inputId}
          className="block text-center mt-3 text-xs text-brand-cyan-dark hover:underline cursor-pointer font-cairo"
        >
          مش شغّال؟ اضغط هنا
        </label>
      )}

      {error && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-cairo">
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
