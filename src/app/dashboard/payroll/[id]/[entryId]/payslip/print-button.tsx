"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Print is delegated to /print/payslip/[entryId]. Printing the
// /dashboard/* page directly used to leave the sidebar mounted and
// the Chromium / Edge / Electron print preview rendered blank
// (the off-canvas sidebar threw off the page-size calculation).
// The /print tree has its own bare layout AND auto-fires
// window.print() on mount, so the user gets one click to the dialog
// with a fully rendered preview.
export function PrintButton() {
  const pathname = usePathname() ?? "";
  // /dashboard/payroll/<periodId>/<entryId>/payslip
  const entryId = pathname.split("/")[4] ?? "";
  const target = `/print/payslip/${entryId}`;

  return (
    <Link
      href={target}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/40 transition font-cairo"
    >
      🖨 طباعة / حفظ PDF
    </Link>
  );
}
