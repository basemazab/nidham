"use client";

// "Wipe every employee in this company" button. Surfaced as a danger
// zone at the bottom of /dashboard/employees. Hidden behind a typed
// confirmation phrase ("حذف الكل") so a stray click can't trigger it
// and a stolen session can't bulk-wipe via direct POST without
// knowing the phrase.
//
// Pattern:
//   1. Closed: a red outlined button "حذف كل الموظفين".
//   2. Click -> modal dialog inside the form. The submit button is
//      disabled until the typed phrase matches.
//   3. Submit -> server action deleteAllEmployees(formData), which
//      re-checks the phrase server-side and refuses if it doesn't
//      match. Returns to the page with deleted_all=N or error=...

import { useEffect, useState } from "react";
import { deleteAllEmployees } from "@/app/dashboard/employees/actions";

type Props = {
  employeeCount: number;
};

export function DeleteAllEmployeesButton({ employeeCount }: Props) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");

  // Esc closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const matched = phrase.trim() === "حذف الكل";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={employeeCount === 0}
        className="px-5 py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm font-cairo transition shadow-md hover:shadow-lg"
      >
        🗑 حذف كل الموظفين ({employeeCount.toLocaleString("ar-EG")})
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={deleteAllEmployees}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-right"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg
                  className="w-7 h-7 text-red-600"
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
              <div>
                <h3 className="text-lg font-black text-slate-900 font-cairo">
                  هتمسح كل الموظفين؟
                </h3>
                <p className="text-sm text-slate-600 font-cairo mt-1 leading-relaxed">
                  العملية دي **مفيهاش رجوع**. هتمسح{" "}
                  <b>{employeeCount.toLocaleString("ar-EG")}</b> موظف
                  مع كل بياناتهم:
                </p>
              </div>
            </div>

            <ul className="space-y-1.5 text-sm text-slate-700 font-cairo bg-red-50 border border-red-200 rounded-xl p-4">
              <li>• كل سجلات الحضور والانصراف</li>
              <li>• كل قسائم الرواتب القديمة</li>
              <li>• كل طلبات الإجازات / السلف / الاستئذان</li>
              <li>• كل أرصدة الإجازات السنوية</li>
              <li>• ربطهم بحسابات الموبايل بيتفك</li>
            </ul>

            <div>
              <label
                htmlFor="confirm_phrase"
                className="block text-sm font-bold text-slate-700 mb-2 font-cairo"
              >
                اكتب{" "}
                <span className="bg-slate-900 text-red-300 px-2 py-0.5 rounded font-mono">
                  حذف الكل
                </span>{" "}
                عشان تأكد:
              </label>
              <input
                id="confirm_phrase"
                name="confirm_phrase"
                type="text"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition text-slate-900 text-center font-bold"
                placeholder="حذف الكل"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPhrase("");
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm font-cairo transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!matched}
                className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-bold text-sm font-cairo transition"
              >
                {matched ? "نعم احذف الكل" : "اكتب العبارة"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
