export interface PayrollAuditInput {
  employees: {
    id: string;
    full_name: string;
    basic_salary: number | null;
    housing_allowance: number | null;
    transport_allowance: number | null;
    other_allowances: number | null;
    incentive_allowance: number | null;
    pay_frequency: string | null;
    status: string;
    department: string | null;
    hire_date: string | null;
  }[];
  payrollEntries: {
    id: string;
    employee_id: string;
    period_id: string;
    gross_salary: number;
    net_salary: number;
    bonuses: number;
    overtime: number;
    total_deductions: number;
    absence_deduction: number;
    tardiness_deduction: number;
    loan_deduction: number;
    social_insurance: number;
    income_tax: number;
    other_deductions: number;
  }[];
  payrollPeriods: {
    id: string;
    frequency: string;
    start_date: string;
    end_date: string;
    status: string;
  }[];
  attendance: {
    employee_id: string;
    date: string;
    status: string;
    tardiness_minutes: number | null;
    early_leave_minutes: number | null;
  }[];
}

export interface PayrollAnomaly {
  severity: "critical" | "high" | "medium" | "low";
  type: string;
  title: string;
  description: string;
  employee_name?: string;
  employee_id?: string;
  amount?: number;
  recommendation: string;
}

export interface PayrollAuditResult {
  anomalies: PayrollAnomaly[];
  summary: {
    total_entries: number;
    anomalies_count: number;
    critical_count: number;
    high_count: number;
    total_payroll: number;
    avg_net_salary: number;
    total_bonuses: number;
    total_overtime: number;
    total_deductions: number;
  };
  health_status: "good" | "fair" | "poor";
}

export function auditPayroll(input: PayrollAuditInput): PayrollAuditResult {
  const anomalies: PayrollAnomaly[] = [];
  const { employees, payrollEntries, payrollPeriods, attendance } = input;

  const totalPayroll = payrollEntries.reduce((s, e) => s + e.gross_salary, 0);
  const avgNet = payrollEntries.length > 0
    ? payrollEntries.reduce((s, e) => s + e.net_salary, 0) / payrollEntries.length
    : 0;
  const totalBonuses = payrollEntries.reduce((s, e) => s + e.bonuses, 0);
  const totalOvertime = payrollEntries.reduce((s, e) => s + e.overtime, 0);
  const totalDeductions = payrollEntries.reduce((s, e) => s + e.total_deductions, 0);

  const empMap = new Map(employees.map((e) => [e.id, e]));

  // 1. Check employees with no payroll entries
  const activeEmpIds = new Set(employees.filter((e) => e.status === "active").map((e) => e.id));
  const entryEmpIds = new Set(payrollEntries.map((e) => e.employee_id));
  const missingEntries = [...activeEmpIds].filter((id) => !entryEmpIds.has(id));
  if (missingEntries.length > 0) {
    anomalies.push({
      severity: "high",
      type: "missing_entries",
      title: "موظفون بدون مرتبات",
      description: `${missingEntries.length} موظف نشط بدون entries مرتبات في آخر دورة`,
      recommendation: "راجع بيانات الموظفين وتأكد من إدراجهم في دورة المرتبات",
    });
  }

  // 2. Detect suspiciously high bonuses
  for (const entry of payrollEntries) {
    const emp = empMap.get(entry.employee_id);
    const salary = emp?.basic_salary ?? 0;
    if (entry.bonuses > salary * 0.5 && salary > 0) {
      anomalies.push({
        severity: "medium",
        type: "high_bonus",
        title: "مكافأة عالية بشكل غير معتاد",
        description: `${emp?.full_name ?? "موظف"} عنده مكافأة ${entry.bonuses.toLocaleString("ar-EG")} ج (${Math.round(entry.bonuses / salary * 100)}% من الراتب)`,
        employee_name: emp?.full_name,
        employee_id: entry.employee_id,
        amount: entry.bonuses,
        recommendation: "تأكد من الموافقة على المكافأة وتوثيقها",
      });
    }
  }

  // 3. Detect excessive overtime
  for (const entry of payrollEntries) {
    const emp = empMap.get(entry.employee_id);
    const salary = emp?.basic_salary ?? 0;
    if (entry.overtime > salary * 0.4 && salary > 0) {
      anomalies.push({
        severity: "medium",
        type: "excessive_overtime",
        title: "أوفرتايم مرتفع",
        description: `${emp?.full_name ?? "موظف"} عنده أوفرتايم ${entry.overtime.toLocaleString("ar-EG")} ج (${Math.round(entry.overtime / salary * 100)}% من الراتب)`,
        employee_name: emp?.full_name,
        employee_id: entry.employee_id,
        amount: entry.overtime,
        recommendation: "اتأكد من تسجيل ساعات العمل الفعلية",
      });
    }
  }

  // 4. Detect negative or zero net salary
  for (const entry of payrollEntries) {
    if (entry.net_salary <= 0) {
      const emp = empMap.get(entry.employee_id);
      anomalies.push({
        severity: "critical",
        type: "negative_net",
        title: "صافي مرتب صفر أو سالب",
        description: `${emp?.full_name ?? "موظف"} صافي مرتبه ${entry.net_salary} ج — الخصومات أكبر من الراتب`,
        employee_name: emp?.full_name,
        employee_id: entry.employee_id,
        amount: entry.net_salary,
        recommendation: "راجع الخصومات — في خطأ في حسابات الخصم",
      });
    }
  }

  // 5. Discrepancy: high deductions vs net
  for (const entry of payrollEntries) {
    if (entry.gross_salary > 0 && entry.total_deductions > entry.gross_salary * 0.6) {
      const emp = empMap.get(entry.employee_id);
      anomalies.push({
        severity: "high",
        type: "high_deductions",
        title: "نسبة خصومات مرتفعة",
        description: `${emp?.full_name ?? "موظف"} — الخصومات ${Math.round(entry.total_deductions / entry.gross_salary * 100)}% من الراتب`,
        employee_name: emp?.full_name,
        employee_id: entry.employee_id,
        amount: entry.total_deductions,
        recommendation: "راجع تفاصيل الخصومات — تأكد من صحتها",
      });
    }
  }

  // 6. Employees with no attendance records
  if (attendance.length > 0 && payrollPeriods.length > 0) {
    const lastPeriod = payrollPeriods[payrollPeriods.length - 1];
    const periodStart = lastPeriod.start_date;
    const periodEnd = lastPeriod.end_date;
    const attEmpIds = new Set(
      attendance
        .filter((a) => a.date >= periodStart && a.date <= periodEnd)
        .map((a) => a.employee_id)
    );
    const noAtt = [...activeEmpIds].filter((id) => !attEmpIds.has(id));
    if (noAtt.length > 3) {
      anomalies.push({
        severity: "medium",
        type: "missing_attendance",
        title: "موظفون بدون تسجيل حضور",
        description: `${noAtt.length} موظف نشط ليس لهم أي تسجيل حضور في آخر دورة مرتبات`,
        recommendation: "تأكد من تسجيل حضورهم أو تحديث حالتهم",
      });
    }
  }

  // 7. Workers with zero salary
  const zeroSalary = employees.filter((e) => e.status === "active" && (!e.basic_salary || e.basic_salary <= 0));
  if (zeroSalary.length > 0) {
    anomalies.push({
      severity: "critical",
      type: "zero_salary",
      title: "موظفون نشطون بدون راتب",
      description: `${zeroSalary.length} موظف نشط مرتبهم الأساسي ٠ جنيه`,
      recommendation: "حدّث الراتب الأساسي للموظفين — في خطأ في البيانات",
    });
  }

  // 8. Unusually high salary variance
  const salaries = employees.filter((e) => e.status === "active" && (e.basic_salary ?? 0) > 0).map((e) => e.basic_salary!);
  if (salaries.length > 5) {
    const avg = salaries.reduce((s, v) => s + v, 0) / salaries.length;
    const outliers = employees.filter(
      (e) => e.status === "active" && (e.basic_salary ?? 0) > avg * 3
    );
    for (const emp of outliers) {
      anomalies.push({
        severity: "low",
        type: "salary_outlier",
        title: "راتب خارج النطاق المتوقع",
        description: `${emp.full_name} راتبه ${(emp.basic_salary ?? 0).toLocaleString("ar-EG")} ج (أعلى من المتوسط ب ${Math.round((emp.basic_salary ?? 0) / avg)}x)`,
        employee_name: emp.full_name,
        employee_id: emp.id,
        amount: emp.basic_salary ?? 0,
        recommendation: "تأكد من صحة الراتب — قد يكون خطأ إدخال",
      });
    }
  }

  const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
  const highCount = anomalies.filter((a) => a.severity === "high").length;

  const health_status: "good" | "fair" | "poor" =
    criticalCount > 0 ? "poor" : highCount > 2 ? "fair" : "good";

  return {
    anomalies,
    summary: {
      total_entries: payrollEntries.length,
      anomalies_count: anomalies.length,
      critical_count: criticalCount,
      high_count: highCount,
      total_payroll: Math.round(totalPayroll * 100) / 100,
      avg_net_salary: Math.round(avgNet * 100) / 100,
      total_bonuses: Math.round(totalBonuses * 100) / 100,
      total_overtime: Math.round(totalOvertime * 100) / 100,
      total_deductions: Math.round(totalDeductions * 100) / 100,
    },
    health_status,
  };
}
