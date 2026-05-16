// ============================================================================
// FormLetterhead — branded header at the top of every printable form
// ============================================================================
//
// Renders the company's letterhead with a dignified Egyptian-corporate
// feel: company name in serif Arabic display type, decorative gold
// accent bar, ref number + date on the right.
//
// Server component. Pure presentation, no client state.

import type { FormCompany } from "@/lib/forms";

type Props = {
  company: FormCompany;
  reference: string;
  date: string; // YYYY-MM-DD or formatted
  /** Optional sub-title under the company name */
  subtitle?: string;
};

export function FormLetterhead({ company, reference, date, subtitle }: Props) {
  return (
    <header className="px-12 pt-12 pb-6 border-b-4 border-double border-slate-800">
      <div className="flex items-start justify-between gap-6">
        {/* Right: company identity */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Logo placeholder — "ن" mark in a gold square */}
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-md shrink-0 print:shadow-none">
            <span className="text-3xl font-black text-white font-display leading-none">
              ن
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-3xl font-black font-cairo text-slate-900 leading-tight">
              {company.name}
            </div>
            {subtitle ? (
              <div className="text-sm text-slate-500 font-cairo mt-1">
                {subtitle}
              </div>
            ) : company.industry ? (
              <div className="text-sm text-slate-500 font-cairo mt-1">
                {company.industry}
              </div>
            ) : null}
          </div>
        </div>

        {/* Left: ref + date */}
        <div className="text-left text-xs font-cairo space-y-1 shrink-0">
          <div className="flex items-baseline gap-2 justify-end">
            <span className="text-slate-500">رقم المرجع:</span>
            <span className="font-mono font-bold text-slate-800" dir="ltr">
              {reference}
            </span>
          </div>
          <div className="flex items-baseline gap-2 justify-end">
            <span className="text-slate-500">التاريخ:</span>
            <span className="font-mono font-bold text-slate-800" dir="ltr">
              {date}
            </span>
          </div>
        </div>
      </div>

      {/* Decorative gold strip — adds gravitas without being ostentatious */}
      <div className="mt-6 flex items-center gap-2">
        <div className="h-0.5 flex-1 bg-gradient-to-l from-transparent via-amber-400 to-amber-500" />
        <span className="text-[10px] tracking-[0.4em] text-amber-700 font-bold uppercase">
          Human Resources · موارد بشرية
        </span>
        <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-amber-400 to-amber-500" />
      </div>
    </header>
  );
}
