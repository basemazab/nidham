"use client";

// Two-step submit button. First click opens an in-page confirm dialog;
// the dialog's "تأكيد" button is itself type="submit" inside the same
// form, so it triggers the parent server action when clicked. The
// modal renders inside the form on purpose so we don't have to deal
// with React portals or `form="..."` attributes.
//
// Usage:
//   <form action={deleteEmployee.bind(null, id)}>
//     <ConfirmSubmitButton
//       label="🗑 حذف الموظف نهائيًا"
//       message="هتمسح الموظف وكل بيانات الحضور والرواتب المرتبطة بيه."
//       className="px-4 py-2 rounded-lg bg-red-600 text-white"
//     />
//   </form>

import { useEffect, useState } from "react";

type Props = {
  label: string;
  message: string;
  className?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function ConfirmSubmitButton({
  label,
  message,
  className,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
}: Props) {
  const [open, setOpen] = useState(false);

  // Esc closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-right space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
                  />
                </svg>
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="font-bold font-cairo text-slate-900">
                  تأكيد العملية
                </h3>
                <p className="text-sm text-slate-600 font-cairo leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-sm transition"
              >
                {cancelLabel}
              </button>
              {/* type=submit + inside the parent form via React tree =
                  triggers the form's server action when clicked. */}
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-cairo font-bold text-sm transition"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
