export interface AttendanceAnomaly {
  employeeId: string;
  employeeName: string;
  type:
    | "unusual_overtime"
    | "repeated_pattern"
    | "missing_checkout"
    | "excessive_tardiness"
    | "abnormal_behavior";
  severity: "critical" | "warning" | "info";
  description: string;
  details: Record<string, unknown>;
  date: string;
  recommendation: string;
}

export interface AttendanceInsights {
  anomalies: AttendanceAnomaly[];
  summary: {
    totalAnomalies: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    topIssues: string[];
  };
  departmentRanks?: {
    departmentName: string;
    attendanceRate: number;
    tardinessRate: number;
    overtimeAvg: number;
    anomalyCount: number;
  }[];
}

function getDayName(date: Date): string {
  return date.toLocaleDateString("ar-EG", { weekday: "long" });
}

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}:${m.toString().padStart(2, "0")}` : `${h}`;
}

type AttendanceRow = {
  employee_id: string;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  department?: string;
  tardiness_minutes?: number | null;
  early_leave_minutes?: number | null;
};

function computeOvertimeMinutes(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const [inH, inM] = checkIn.split(":").map(Number);
  const [outH, outM] = checkOut.split(":").map(Number);
  if (!Number.isFinite(inH) || !Number.isFinite(inM) || !Number.isFinite(outH) || !Number.isFinite(outM)) return 0;
  let inMins = inH * 60 + inM;
  let outMins = outH * 60 + outM;
  if (outMins < inMins) outMins += 24 * 60;
  const worked = outMins - inMins;
  const expected = 9 * 60;
  return Math.max(0, worked - expected);
}

export function analyzeAttendanceAnomalies(
  attendanceData: AttendanceRow[],
  employees: { id: string; full_name: string; department?: string }[],
): AttendanceInsights {
  const anomalies: AttendanceAnomaly[] = [];
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const summaryMap: Record<string, number> = {};

  function addAnomaly(
    type: AttendanceAnomaly["type"],
    severity: AttendanceAnomaly["severity"],
    employeeId: string,
    description: string,
    details: Record<string, unknown>,
    date: string,
    recommendation: string,
  ) {
    const emp = employeeMap.get(employeeId);
    anomalies.push({
      employeeId,
      employeeName: emp?.full_name || "موظف غير معروف",
      type,
      severity,
      description,
      details,
      date,
      recommendation,
    });
    summaryMap[type] = (summaryMap[type] || 0) + 1;
  }

  const employeeOvertimeCount = new Map<string, number>();
  const employeeDaysMap = new Map<string, { dates: string[]; checkIns: string[] }>();

  for (const row of attendanceData) {
    const date = row.date;

    if (!employeeDaysMap.has(row.employee_id)) {
      employeeDaysMap.set(row.employee_id, { dates: [], checkIns: [] });
    }
    const dayEntry = employeeDaysMap.get(row.employee_id)!;
    dayEntry.dates.push(date);
    if (row.check_in) dayEntry.checkIns.push(row.check_in);

    // --- 1. Missing check-out detection ---
    if (row.check_in && !row.check_out) {
      addAnomaly(
        "missing_checkout",
        "warning",
        row.employee_id,
        `تسجيل دخول بدون خروج في ${date}`,
        { check_in: row.check_in },
        date,
        "يرجى التأكد من تسجيل وقت الخروج للموظف",
      );
    }

    // --- 2. Unusual overtime detection ---
    if (row.check_in && row.check_out) {
      const overtime = computeOvertimeMinutes(row.check_in, row.check_out);
      if (overtime > 180) {
        employeeOvertimeCount.set(row.employee_id, (employeeOvertimeCount.get(row.employee_id) || 0) + 1);
        addAnomaly(
          "unusual_overtime",
          overtime > 300 ? "critical" : "warning",
          row.employee_id,
          `أوفرتايم غير معتاد: ${minutesToHours(overtime)} ساعة في ${date}`,
          { overtime_minutes: overtime, date },
          date,
          overtime > 300
            ? "مراجعة فورية — أوفرتايم يتجاوز 5 ساعات"
            : "مراجعة أسباب الأوفرتايم المستمر",
        );
      }
    }

    // --- 3. Excessive tardiness ---
    if ((row.tardiness_minutes ?? 0) > 60) {
      addAnomaly(
        "excessive_tardiness",
        row.tardiness_minutes! > 120 ? "critical" : "warning",
        row.employee_id,
        `تأخير كبير: ${row.tardiness_minutes} دقيقة في ${date}`,
        { tardiness_minutes: row.tardiness_minutes, date },
        date,
        "تحقق من سبب التأخير المستمر — قد يحتاج إنذار",
      );
    }

    // --- 4. Abnormal behavior: weekend attendance ---
    if (row.check_in) {
      const d = new Date(date);
      const day = d.getDay();
      if (day === 5 || day === 6) {
        const overtime = computeOvertimeMinutes(row.check_in, row.check_out);
        if (overtime === 0) {
          addAnomaly(
            "abnormal_behavior",
            "info",
            row.employee_id,
            `حضور يوم ${getDayName(d)} بدون أوفرتايم مسجل`,
            { date, day_name: getDayName(d) },
            date,
            "تحقق من تسجيل الأوفرتايم في الإجازة الأسبوعية",
          );
        }
      }
    }
  }

  // --- 5. Repeated late check-in pattern (3+ same time) ---
  const timePatterns = new Map<string, { dates: string[]; times: string[] }>();
  for (const row of attendanceData) {
    if (!row.check_in || !row.check_out) continue;
    const key = `${row.employee_id}::${row.check_in}`;
    if (!timePatterns.has(key)) {
      timePatterns.set(key, { dates: [], times: [] });
    }
    const entry = timePatterns.get(key)!;
    entry.dates.push(row.date);
    entry.times.push(row.check_in);
  }
  for (const [key, val] of timePatterns) {
    if (val.dates.length >= 3) {
      const [empId, checkInTime] = key.split("::");
      addAnomaly(
        "repeated_pattern",
        "info",
        empId,
        `تسجيل دخول في نفس التوقيت ${checkInTime} لـ ${val.dates.length} أيام متتالية`,
        { check_in_time: checkInTime, dates: val.dates, count: val.dates.length },
        val.dates[0],
        "مراجعة — قد يكون تسجيل تلقائي أو نمط متكرر غير طبيعي",
      );
    }
  }

  anomalies.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
  const warningCount = anomalies.filter((a) => a.severity === "warning").length;
  const infoCount = anomalies.filter((a) => a.severity === "info").length;

  const typeCounts: Record<string, number> = {};
  for (const a of anomalies) {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  }
  const topIssues = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([type]) => {
      const labels: Record<string, string> = {
        unusual_overtime: "أوفرتايم غير معتاد",
        repeated_pattern: "أنماط متكررة",
        missing_checkout: "خروج غير مسجل",
        excessive_tardiness: "تأخير مفرط",
        abnormal_behavior: "سلوك غير معتاد",
      };
      return labels[type] || type;
    });

  // Department ranks
  const deptMap = new Map<string, { total: number; tardy: number; overtime: number; anomalies: number; present: number }>();
  for (const emp of employees) {
    const dept = emp.department || "بدون قسم";
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { total: 0, tardy: 0, overtime: 0, anomalies: 0, present: 0 });
    }
  }
  for (const row of attendanceData) {
    const emp = employeeMap.get(row.employee_id);
    const dept = emp?.department || "بدون قسم";
    const d = deptMap.get(dept);
    if (!d) continue;
    d.total++;
    if (row.status === "present" || row.check_in) d.present++;
    if (row.status === "late" || (row.tardiness_minutes ?? 0) > 0) d.tardy++;
    d.overtime += computeOvertimeMinutes(row.check_in, row.check_out);
  }
  for (const a of anomalies) {
    const emp = employeeMap.get(a.employeeId);
    const dept = emp?.department || "بدون قسم";
    const d = deptMap.get(dept);
    if (d) d.anomalies++;
  }
  const departmentRanks = Array.from(deptMap.entries())
    .map(([name, data]) => ({
      departmentName: name,
      attendanceRate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      tardinessRate: data.total > 0 ? Math.round((data.tardy / data.total) * 100) : 0,
      overtimeAvg: data.total > 0 ? Math.round(data.overtime / data.total) : 0,
      anomalyCount: data.anomalies,
    }))
    .sort((a, b) => b.anomalyCount - a.anomalyCount);

  return {
    anomalies,
    summary: {
      totalAnomalies: anomalies.length,
      criticalCount,
      warningCount,
      infoCount,
      topIssues,
    },
    departmentRanks,
  };
}
