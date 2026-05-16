// ============================================================================
// FormPieces — bundle of small reusable building blocks for HR templates
// ============================================================================
//
// FieldBox       — labelled value display with optional placeholder line
// FieldRow       — horizontal label + value (for inline grids)
// FieldLine      — blank labelled line for handwritten input
// SectionTitle   — section divider with gold accent
// SignatureBlock — multi-line signature placeholder
// StampPlaceholder — square outlined "ختم الشركة" placeholder
// FormFooter     — printed page footer
// RatingScale    — 1-5 rating circles for performance forms

import type { FormCompany } from "@/lib/forms";

// ----------------------------------------------------------------------------
// SectionTitle
// ----------------------------------------------------------------------------
export function SectionTitle({
  number,
  title,
  className = "",
}: {
  number?: string | number;
  title: string;
  className?: string;
}) {
  return (
    <h2
      className={`text-base font-black font-cairo text-slate-800 mb-4 mt-6 flex items-center gap-3 ${className}`}
    >
      {number !== undefined && (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-sm font-black shrink-0">
          {number}
        </span>
      )}
      <span className="border-b-2 border-amber-400 pb-1">{title}</span>
    </h2>
  );
}

// ----------------------------------------------------------------------------
// FieldBox — labelled cell with a value (or placeholder line if blank)
// ----------------------------------------------------------------------------
export function FieldBox({
  label,
  value,
  dir = "rtl",
  width,
}: {
  label: string;
  value?: string | number | null;
  dir?: "rtl" | "ltr";
  width?: "full" | "half" | "third" | "quarter";
}) {
  const colSpan = {
    full: "col-span-12",
    half: "col-span-6",
    third: "col-span-4",
    quarter: "col-span-3",
  }[width ?? "half"];

  const display =
    value === null || value === undefined || value === "" ? null : String(value);

  return (
    <div className={colSpan}>
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-cairo mb-1">
        {label}
      </div>
      <div
        className={`min-h-[2rem] px-3 py-1.5 bg-slate-50/60 border-b-2 border-slate-300 font-cairo text-sm text-slate-800 ${
          dir === "ltr" ? "font-mono" : ""
        }`}
        dir={dir}
      >
        {display ?? <span className="text-slate-300">..........</span>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// FieldLine — blank line under a label (always blank, for handwriting)
// ----------------------------------------------------------------------------
export function FieldLine({
  label,
  value,
  rows = 1,
}: {
  label: string;
  value?: string | null;
  rows?: number;
}) {
  return (
    <div>
      <div className="text-xs font-bold text-slate-600 font-cairo mb-2">
        {label}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b-2 border-slate-300 h-7 font-cairo text-sm text-slate-800 px-2"
        >
          {i === 0 && value ? value : null}
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// FieldRow — label + value on a single horizontal line
// ----------------------------------------------------------------------------
export function FieldRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value?: string | number | null;
  className?: string;
}) {
  return (
    <div
      className={`flex items-baseline gap-2 py-1 border-b border-dotted border-slate-300 ${className}`}
    >
      <span className="text-xs text-slate-500 font-cairo shrink-0">
        {label}:
      </span>
      <span className="flex-1 font-bold text-sm text-slate-800 font-cairo">
        {value !== null && value !== undefined && value !== ""
          ? value
          : <span className="text-slate-300">..............................</span>}
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// SignatureBlock — name + title + signature line + date
// ----------------------------------------------------------------------------
export function SignatureBlock({
  role,
  name,
  showStamp = false,
}: {
  role: string;
  name?: string | null;
  showStamp?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-slate-700 font-cairo">{role}</div>

      {/* Signature line */}
      <div className="border-b-2 border-slate-400 h-12 flex items-end justify-center pb-1">
        <span className="text-[10px] text-slate-400 font-cairo">
          (التوقيع)
        </span>
      </div>

      {/* Printed name (if provided) */}
      <div className="text-center text-sm font-cairo text-slate-700">
        <div className="font-bold">{name ?? "...................................."}</div>
        <div className="text-[10px] text-slate-500 mt-1">الاسم</div>
      </div>

      {/* Date line */}
      <div className="border-b border-dotted border-slate-300 h-7 flex items-end justify-center pb-1">
        <span className="text-[10px] text-slate-400 font-cairo">
          (التاريخ)
        </span>
      </div>

      {showStamp && (
        <div className="mt-4 flex justify-center">
          <StampPlaceholder size="sm" />
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// StampPlaceholder — square "ختم الشركة" area
// ----------------------------------------------------------------------------
export function StampPlaceholder({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = { sm: "w-20 h-20", md: "w-28 h-28", lg: "w-36 h-36" }[size];
  return (
    <div
      className={`${dim} border-2 border-dashed border-slate-400 rounded-md flex items-center justify-center text-[10px] text-slate-500 font-cairo`}
    >
      <div className="text-center leading-tight">
        ختم
        <br />
        الشركة
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// PhotoPlaceholder — passport-photo area for job applications
// ----------------------------------------------------------------------------
export function PhotoPlaceholder() {
  return (
    <div className="w-24 h-32 border-2 border-dashed border-slate-400 rounded-md flex items-center justify-center text-[10px] text-slate-500 font-cairo">
      <div className="text-center leading-tight">
        صورة
        <br />
        شخصية
        <br />
        4×6
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// RatingScale — 1-5 circle ratings for performance evaluation
// ----------------------------------------------------------------------------
export function RatingScale({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center py-2 border-b border-slate-100">
      <div className="col-span-7">
        <div className="font-bold text-sm font-cairo text-slate-800">
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-slate-500 font-cairo mt-0.5">
            {description}
          </div>
        )}
      </div>
      <div className="col-span-5 flex items-center justify-around">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="w-7 h-7 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs font-bold text-slate-500 font-cairo"
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// FormFooter — last line on the printed page
// ----------------------------------------------------------------------------
export function FormFooter({ company }: { company: FormCompany }) {
  return (
    <footer className="mt-12 pt-4 border-t border-slate-200 text-[10px] font-cairo text-slate-400 flex items-center justify-between px-12 pb-8">
      <div>
        <span className="font-bold text-slate-500">{company.name}</span>
        {company.industry && <span> · {company.industry}</span>}
      </div>
      <div className="text-left">
        صفحة 1 · تم إصدار النموذج من نظام نِظام HR
      </div>
    </footer>
  );
}

// ----------------------------------------------------------------------------
// CheckBox — small printed checkbox (for forms that need yes/no toggles)
// ----------------------------------------------------------------------------
export function CheckBox({
  label,
  checked = false,
}: {
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-cairo cursor-default">
      <span
        className={`inline-flex items-center justify-center w-4 h-4 border-2 border-slate-400 rounded-sm text-xs font-bold ${
          checked ? "bg-slate-800 text-white" : "bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      <span>{label}</span>
    </label>
  );
}
