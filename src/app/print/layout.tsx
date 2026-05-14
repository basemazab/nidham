// Minimal layout for print-only routes. Lives at /print/* and is
// deliberately OUTSIDE the /dashboard tree so the sidebar / chrome
// don't render at all -- the previous "print payslip" path was
// /dashboard/payroll/.../payslip and the dashboard sidebar took up
// the print preview width, leaving a blank panel in Chromium /
// Edge / Electron previews.
//
// Every page under /print/* auto-fires window.print() on mount via
// the auto-print client component, so the user just clicks the
// "طباعة" link in the dashboard and the print dialog opens
// immediately with the content rendered.

import "../globals.css";
import { Tajawal, Cairo } from "next/font/google";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "900"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  weight: ["400", "600", "700", "900"],
});

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${tajawal.variable} ${cairo.variable} min-h-screen bg-white text-slate-900 font-sans`}
    >
      {children}
    </div>
  );
}
