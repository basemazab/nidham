// ============================================================================
// Payroll export — bank transfer files, CSV, Excel
// ============================================================================
//
// Three formats are produced from the same per-employee record:
//
//   1) Generic CSV   — universal "Name | Account | Net Salary" with a
//                      few extra columns. Accepted by every bank in
//                      Egypt that takes batch imports.
//   2) CIB / NBE SIF — Standard Information File. The two largest banks
//                      have a near-identical layout (the small details
//                      vary), so we produce a single layout that both
//                      accept after the HR user uploads it.
//   3) XLSX (Excel)  — full payroll register for the company accountant
//                      with every line item: attendance, allowances,
//                      deductions, net. Uses the `xlsx` library that's
//                      already in the project for the Excel importer.
//
// All builders are pure: they take a strongly-typed array of records,
// return a string (CSV/SIF) or ArrayBuffer (XLSX). The route handler
// streams the result with a sensible Content-Disposition.

import * as XLSX from "xlsx";

// ----------------------------------------------------------------------------
// Shared record shape — what the period page passes to every builder
// ----------------------------------------------------------------------------
export type PayrollExportRow = {
  employee_code: string | null;
  full_name: string;
  national_id: string | null;
  job_title: string | null;
  department: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  payment_method: "cash" | "bank" | "instapay" | null;

  // Attendance snapshot
  attended_days: number;
  half_day_days: number;
  leave_days: number;
  absent_days: number;

  // Earnings
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  incentive_allowance: number;
  bonuses: number;
  overtime: number;
  gross_salary: number;

  // Deductions
  absence_deduction: number;
  tardiness_deduction: number;
  social_insurance: number;
  income_tax: number;
  loan_deduction: number;
  other_deductions: number;
  total_deductions: number;

  // EOS (when termination falls in the cycle)
  eos_gratuity: number;

  // Result
  net_salary: number;
  notes: string | null;
};

export type PeriodMeta = {
  company_name: string;
  start_date: string | null;
  end_date: string | null;
  year: number;
  month: number;
  frequency: "monthly" | "weekly" | null;
  working_days: number;
};

// ----------------------------------------------------------------------------
// CSV BUILDER (generic, universal bank-friendly)
// ----------------------------------------------------------------------------
// Layout chosen to match what every Egyptian bank's batch importer
// accepts: a header row + one row per employee with a stable column
// order. UTF-8 with BOM so Excel opens the file with Arabic intact.
export function buildBankCsv(
  rows: PayrollExportRow[],
  meta: PeriodMeta,
): string {
  const bankableRows = rows.filter((r) => r.payment_method === "bank");

  const headers = [
    "Employee Code",
    "Full Name",
    "Bank Name",
    "Account Number",
    "IBAN",
    "Net Salary (EGP)",
    "Period",
  ];

  const periodLabel = meta.start_date && meta.end_date
    ? `${meta.start_date} to ${meta.end_date}`
    : `${meta.year}-${String(meta.month).padStart(2, "0")}`;

  const csvRows = bankableRows.map((r) =>
    csvLine([
      r.employee_code ?? "",
      r.full_name,
      r.bank_name ?? "",
      r.bank_account_number ?? "",
      r.bank_iban ?? "",
      r.net_salary.toFixed(2),
      periodLabel,
    ]),
  );

  // Trailer: totals row so HR can sanity-check the file against the
  // sum on the screen before uploading to the bank portal.
  const total = bankableRows.reduce((s, r) => s + r.net_salary, 0);
  const trailer = csvLine([
    "",
    `TOTAL (${bankableRows.length} employees)`,
    "",
    "",
    "",
    total.toFixed(2),
    periodLabel,
  ]);

  // UTF-8 BOM so Excel reads Arabic correctly
  return (
    "﻿" +
    [csvLine(headers), ...csvRows, trailer].join("\r\n") +
    "\r\n"
  );
}

// ----------------------------------------------------------------------------
// CIB / NBE SIF BUILDER — Standard Information File
// ----------------------------------------------------------------------------
// The two biggest banks in Egypt accept a fixed-width text file (or a
// pipe-delimited variant) with this layout. Since CIB and NBE have
// near-identical schemas we produce a single SIF that BOTH banks
// accept after the HR user picks "salary batch" upload.
//
// Pipe-delimited (|) variant is the safer choice for ASCII portability
// — fixed-width breaks the moment a name has more characters than the
// field width and the user can't always tell why.
export function buildBankSif(
  rows: PayrollExportRow[],
  meta: PeriodMeta,
): string {
  const bankableRows = rows.filter((r) => r.payment_method === "bank");

  const lines: string[] = [];

  // Header: H | filename | upload date | total amount | record count
  const total = bankableRows.reduce((s, r) => s + r.net_salary, 0);
  const filename = `NIDHAM_${meta.year}_${String(meta.month).padStart(2, "0")}`;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  lines.push(`H|${filename}|${today}|${total.toFixed(2)}|${bankableRows.length}`);

  // Detail records: D | seq | account | iban | name | amount | reference
  bankableRows.forEach((r, i) => {
    const ref =
      r.employee_code || r.national_id || (i + 1).toString().padStart(6, "0");
    lines.push(
      [
        "D",
        (i + 1).toString().padStart(4, "0"),
        r.bank_account_number ?? "",
        r.bank_iban ?? "",
        // Strip pipe from the name just in case
        r.full_name.replace(/\|/g, " "),
        r.net_salary.toFixed(2),
        ref,
      ].join("|"),
    );
  });

  // Trailer: T | record count | total amount
  lines.push(`T|${bankableRows.length}|${total.toFixed(2)}`);

  return lines.join("\n") + "\n";
}

// ----------------------------------------------------------------------------
// XLSX BUILDER — full payroll register for the company accountant
// ----------------------------------------------------------------------------
// Two sheets:
//   1) "كشف المرتبات" — every employee, every line item
//   2) "ملخص" — totals + by-department breakdown
//
// Returns an ArrayBuffer so the route handler can stream it directly
// in the response body with the correct mime type.
export function buildPayrollXlsx(
  rows: PayrollExportRow[],
  meta: PeriodMeta,
): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // ===== Sheet 1: detailed register =====
  const headers = [
    "كود الموظف",
    "الاسم",
    "الرقم القومي",
    "الوظيفة",
    "القسم",
    "حضور",
    "نص يوم",
    "إجازة",
    "غياب",
    "الراتب الأساسي",
    "بدل سكن",
    "بدل انتقال",
    "بدلات أخرى",
    "حافز",
    "مكافآت",
    "أوفر تايم",
    "مكافأة نهاية الخدمة",
    "إجمالي الراتب",
    "خصم غياب",
    "خصم تأخير",
    "تأمينات",
    "ضريبة دخل",
    "أقساط سلف",
    "خصومات أخرى",
    "إجمالي الخصومات",
    "الصافي",
    "طريقة الدفع",
    "البنك",
    "حساب البنك",
    "ملاحظات",
  ];

  const dataRows = rows.map((r) => [
    r.employee_code ?? "",
    r.full_name,
    r.national_id ?? "",
    r.job_title ?? "",
    r.department ?? "",
    Number(r.attended_days),
    Number(r.half_day_days),
    Number(r.leave_days),
    Number(r.absent_days),
    Number(r.basic_salary),
    Number(r.housing_allowance),
    Number(r.transport_allowance),
    Number(r.other_allowances),
    Number(r.incentive_allowance),
    Number(r.bonuses),
    Number(r.overtime),
    Number(r.eos_gratuity),
    Number(r.gross_salary),
    Number(r.absence_deduction),
    Number(r.tardiness_deduction),
    Number(r.social_insurance),
    Number(r.income_tax),
    Number(r.loan_deduction),
    Number(r.other_deductions),
    Number(r.total_deductions),
    Number(r.net_salary),
    r.payment_method ?? "cash",
    r.bank_name ?? "",
    r.bank_account_number ?? r.bank_iban ?? "",
    r.notes ?? "",
  ]);

  const totalsRow = [
    "",
    `الإجمالي (${rows.length} موظف)`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    sumOf(rows, "basic_salary"),
    sumOf(rows, "housing_allowance"),
    sumOf(rows, "transport_allowance"),
    sumOf(rows, "other_allowances"),
    sumOf(rows, "incentive_allowance"),
    sumOf(rows, "bonuses"),
    sumOf(rows, "overtime"),
    sumOf(rows, "eos_gratuity"),
    sumOf(rows, "gross_salary"),
    sumOf(rows, "absence_deduction"),
    sumOf(rows, "tardiness_deduction"),
    sumOf(rows, "social_insurance"),
    sumOf(rows, "income_tax"),
    sumOf(rows, "loan_deduction"),
    sumOf(rows, "other_deductions"),
    sumOf(rows, "total_deductions"),
    sumOf(rows, "net_salary"),
    "",
    "",
    "",
    "",
  ];

  const sheet1 = XLSX.utils.aoa_to_sheet([
    [
      `${meta.company_name} — كشف المرتبات (${
        meta.start_date && meta.end_date
          ? `${meta.start_date} → ${meta.end_date}`
          : `${meta.year}/${meta.month}`
      })`,
    ],
    [],
    headers,
    ...dataRows,
    totalsRow,
  ]);
  // Title bold/merged across header columns; the cell A1 (title) is left
  // un-merged on purpose — many spreadsheet apps choke on merged ranges
  // for files this small. Auto column widths instead.
  sheet1["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, sheet1, "كشف المرتبات");

  // ===== Sheet 2: summary + dept breakdown =====
  const deptMap = new Map<string, { count: number; net: number; gross: number }>();
  for (const r of rows) {
    const k = (r.department && r.department.trim()) || "بدون قسم";
    const cur = deptMap.get(k) ?? { count: 0, net: 0, gross: 0 };
    cur.count += 1;
    cur.net += r.net_salary;
    cur.gross += r.gross_salary;
    deptMap.set(k, cur);
  }

  const summaryAOA: (string | number)[][] = [
    [`${meta.company_name} — ملخص`],
    [],
    ["الفترة", meta.start_date && meta.end_date
      ? `${meta.start_date} إلى ${meta.end_date}`
      : `${meta.year}/${meta.month}`],
    ["النوع", meta.frequency === "weekly" ? "أسبوعي" : "شهري"],
    ["أيام العمل", meta.working_days],
    [],
    ["", "العدد", "إجمالي الصافي", "إجمالي الإجمالي"],
    ["كل الموظفين", rows.length, sumOf(rows, "net_salary"), sumOf(rows, "gross_salary")],
    [],
    ["توزيع حسب القسم"],
    ["القسم", "عدد", "إجمالي الصافي", "إجمالي الإجمالي"],
    ...Array.from(deptMap.entries())
      .sort((a, b) => b[1].net - a[1].net)
      .map(([name, d]) => [name, d.count, d.net, d.gross]),
  ];

  const sheet2 = XLSX.utils.aoa_to_sheet(summaryAOA);
  sheet2["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, sheet2, "ملخص");

  // Generate ArrayBuffer (Buffer in Node returned as ArrayBuffer-like)
  const ab = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return ab as ArrayBuffer;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function csvLine(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  // Quote if contains comma, quote, newline, or leading/trailing spaces
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sumOf<K extends keyof PayrollExportRow>(
  rows: PayrollExportRow[],
  key: K,
): number {
  return Math.round(rows.reduce((s, r) => s + Number(r[key] ?? 0), 0) * 100) / 100;
}
