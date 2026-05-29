export interface AttendanceAnomaly {
  employeeId: string;
  employeeName: string;
  type:
    | "fake_gps"
    | "unusual_overtime"
    | "repeated_pattern"
    | "suspicious_attendance"
    | "missing_checkout"
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
  overtime_minutes: number;
  status: string;
  department_name?: string;
  gps_lat?: number | null;
  gps_lng?: number | null;
};

export function analyzeAttendanceAnomalies(
  attendanceData: AttendanceRow[],
  employees: { id: string; full_name: string; department_name?: string }[],
  companyLat?: number,
  companyLng?: number,
  geofenceRadiusMeters?: number,
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

  for (const row of attendanceData) {
    const date = row.date;

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
    if (row.overtime_minutes > 180) {
      addAnomaly(
        "unusual_overtime",
        row.overtime_minutes > 300 ? "critical" : "warning",
        row.employee_id,
        `أوفرتايم غير معتاد: ${minutesToHours(row.overtime_minutes)} ساعة في ${date}`,
        { overtime_minutes: row.overtime_minutes, date },
        date,
        row.overtime_minutes > 300
          ? "مراجعة فورية — أوفرتايم يتجاوز 5 ساعات"
          : "مراجعة أسباب الأوفرتايم المستمر",
      );
    }

    // --- 3. GPS anomaly detection (fake GPS) ---
    if (row.gps_lat && row.gps_lng && companyLat && companyLng) {
      const dist = getDistanceFromLatLngInMeters(
        row.gps_lat,
        row.gps_lng,
        companyLat,
        companyLng,
      );
      const radius = geofenceRadiusMeters || 500;
      if (dist > radius * 3) {
        addAnomaly(
          "fake_gps",
          "critical",
          row.employee_id,
          `تسجيل حضور من خارج النطاق الجغرافي للشركة (${dist.toFixed(0)}م)`,
          { gps_lat: row.gps_lat, gps_lng: row.gps_lng, distance_meters: Math.round(dist) },
          date,
          "التحقق من صحة تسجيل الحضور — قد يكون GPS مزيف",
        );
      }
    }

    // --- 4. Repeated pattern (same check-in time for 3+ consecutive days) ---
    // (this is checked below after grouping)

    // --- 5. Abnormal behavior: weekend attendance without overtime ---
    if (row.check_in && row.overtime_minutes === 0) {
      const d = new Date(date);
      const day = d.getDay();
      if (day === 5 || day === 6) {
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

    // --- 6. Repeated late check-in pattern (within same employee) ---
  }

  // Detect repeated patterns: same employee checking in at same time 3+ times
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

  // Sort by severity: critical first
  anomalies.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
  const warningCount = anomalies.filter((a) => a.severity === "warning").length;
  const infoCount = anomalies.filter((a) => a.severity === "info").length;

  // Top issues
  const typeCounts: Record<string, number> = {};
  for (const a of anomalies) {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  }
  const topIssues = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([type]) => {
      const labels: Record<string, string> = {
        fake_gps: "GPS مشبوه",
        unusual_overtime: "أوفرتايم غير معتاد",
        repeated_pattern: "أنماط متكررة",
        suspicious_attendance: "حضور مشبوه",
        missing_checkout: "خروج غير مسجل",
        abnormal_behavior: "سلوك غير معتاد",
      };
      return labels[type] || type;
    });

  // Department ranks
  const deptMap = new Map<
    string,
    { total: number; tardy: number; overtime: number; anomalies: number; present: number }
  >();
  for (const emp of employees) {
    const dept = emp.department_name || "بدون قسم";
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { total: 0, tardy: 0, overtime: 0, anomalies: 0, present: 0 });
    }
  }
  for (const row of attendanceData) {
    const emp = employeeMap.get(row.employee_id);
    const dept = emp?.department_name || "بدون قسم";
    const d = deptMap.get(dept);
    if (!d) continue;
    d.total++;
    if (row.status === "present" || row.check_in) d.present++;
    if (row.status === "late") d.tardy++;
    d.overtime += row.overtime_minutes || 0;
  }
  for (const a of anomalies) {
    const emp = employeeMap.get(a.employeeId);
    const dept = emp?.department_name || "بدون قسم";
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

function getDistanceFromLatLngInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
