"use client";

// Big, friendly file picker. Replaces bare <input type="file"> in
// places where the user is uploading something important (employee
// import, PDF parse, ...).
//
// Pattern: a <label> wraps the visually-hidden <input type="file">.
// Browsers natively forward any click inside the label to the input,
// so we don't have to call .click() programmatically -- that path was
// blocked by iOS Safari when the synthetic click was overlapped by an
// absolute-positioned input. With the label pattern the tap always
// fires the native file dialog, on every device.

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

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

    // Drag-and-drop bypasses the input's accept filter, so re-check by
    // extension. (MIME types are unreliable on Windows for .xlsx etc.)
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

    // Sync the picked file into the underlying <input> so a parent
    // form-submit still sends it. Works in Chrome, Edge, Firefox, Safari.
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
      <label
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
        {/* The input is visually hidden but still focusable + clickable
            via the <label> wrap. Browser natively forwards label clicks
            to it -- no JS .click() needed (which iOS Safari blocked). */}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          required={required && !file}
          onChange={onChange}
          className="sr-only"
        />

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
            <div className="text-[11px] text-slate-400 mt-3 font-cairo inline-block px-3 py-1 rounded-full bg-white border border-slate-200">
              اضغط هنا لاختيار ملف
            </div>
          </div>
        )}
      </label>

      {error && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-cairo">
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
