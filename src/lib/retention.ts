// ============================================================================
// Employee Retention Insights — scoring engine
// ============================================================================
//
// The brain behind /dashboard/retention. Looks at every active employee
// and produces four kinds of insight:
//
//   1) RAISE        — long-tenured, high-performance employees whose
//                     compensation hasn't moved in a while. The most
//                     valuable insight: catching a raise BEFORE the
//                     employee quits is way cheaper than replacing them.
//   2) BONUS        — exceptional recent performance (perfect month,
//                     zero tardiness, productivity spikes). A one-shot
//                     bonus rewards the behaviour without permanently
//                     committing to higher cost.
//   3) FLIGHT RISK  — behavioural signals that the employee is
//                     disengaging: declining attendance rate, leave
//                     spikes, stale comp. HR can intervene with a 1:1.
//   4) ANNIVERSARY  — service-year milestones in the next 30 days.
//                     A small gesture (cake, note, mention) on the
//                     anniversary builds loyalty for cents on the dollar.
//
// All four insights are computed from data the system already has —
// employees, attendance, salary_history. No new fields required.
//
// The functions in this file are PURE: they take in EmployeeSignals
// (a normalised snapshot) and return an Insight | null. The data
// loading lives in /dashboard/retention/actions.ts so the scoring
// is testable without a database.

export const RETENTION_CONFIG = {
  // Minimum service before a raise insight even considers the employee.
  // Below 1 year, raises feel premature in the Egyptian SMB market.
  MIN_TENURE_MONTHS_FOR_RAISE: 12,

  // Attendance rate floor — under 85% suggests reliability issues
  // that should be addressed before rewarding.
  MIN_ATTENDANCE_RATE_FOR_RAISE: 0.85,

  // "Stale comp" thresholds. 12mo+ since last raise = candidate;
  // 24mo+ = urgent (flight risk multiplier).
  STALE_RAISE_MONTHS: 12,
  STALE_RAISE_CRITICAL_MONTHS: 24,

  // Raise sizing. We start at 5% and add up to +10% based on the
  // employee's score, capping at 15%. That keeps suggestions
  // reasonable (not "give them a 50% raise") and round-trippable.
  RAISE_PCT_BASE: 0.05,
  RAISE_PCT_BONUS_MAX: 0.10,

  // Bonus thresholds — minimum tenure (lower than raise; bonuses
  // can reward new top performers too) + perfect-month definition.
  MIN_TENURE_MONTHS_FOR_BONUS: 3,
  BONUS_MAX_TARDINESS_MINUTES: 0,
  BONUS_MIN_ATTENDANCE_RATE: 0.95,

  // Bonus sizing: 5-15% of monthly basic salary, capped at 2000 EGP
  // for V1 to avoid runaway suggestions for senior staff.
  BONUS_PCT_BASE: 0.05,
  BONUS_PCT_BONUS_MAX: 0.10,
  BONUS_AMOUNT_CAP: 2000,

  // Flight risk thresholds. We need TWO signals minimum to flag.
  FLIGHT_RISK_ATTENDANCE_DROP_DELTA: 0.10,    // 10% drop period-over-period
  FLIGHT_RISK_HIGH_TARDINESS_MINUTES: 60,     // avg tardiness > 60min/day
  FLIGHT_RISK_LEAVE_SPIKE_DAYS: 4,            // 4+ leave days last 30 days

  // Anniversary lookahead — flag service-year milestones within
  // this many days so HR has time to prepare.
  ANNIVERSARY_LOOKAHEAD_DAYS: 30,

  // Minimum scores to surface. Anything below = noise.
  MIN_SCORE_RAISE: 50,
  MIN_SCORE_BONUS: 55,
  MIN_SCORE_FLIGHT_RISK: 55,
} as const;

// ----------------------------------------------------------------------------
// Input — a single employee's snapshot
// ----------------------------------------------------------------------------
export type EmployeeSignals = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  hireDate: string; // YYYY-MM-DD
  basicSalary: number;
  totalCompensation: number; // basic + all allowances
  payFrequency: "monthly" | "weekly";

  // Derived from hire_date
  tenureMonths: number;

  // Derived from salary_history (latest change_date)
  monthsSinceLastRaise: number;

  // Computed from last 90 days of attendance
  attendanceRate: number; // 0-1
  totalAttendanceDays: number;
  absentDays: number;
  tardinessMinutesAvgPerDay: number; // 0 if no days
  earlyLeaveMinutesAvgPerDay: number;

  // Delta — last 30 days attendance rate vs previous 60 days.
  // Negative = declining (flight risk signal).
  attendanceRateDelta: number;

  // Leave days approved in last 30 days
  recentLeaveDays: number;
};

// ----------------------------------------------------------------------------
// Output — one insight per type per employee
// ----------------------------------------------------------------------------
export type InsightType = "raise" | "bonus" | "flight_risk" | "anniversary";

export type RetentionInsight = {
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  department: string | null;
  insightType: InsightType;
  score: number; // 0-100
  reasoning: string[]; // Arabic bullet points
  suggestedAmount: number | null; // EGP — raise (monthly delta) or bonus
  // Free-form metadata mirroring the migration's JSONB column.
  metadata: Record<string, number | string | boolean>;
};

// ----------------------------------------------------------------------------
// 1) RAISE
// ----------------------------------------------------------------------------
export function computeRaiseInsight(
  s: EmployeeSignals,
): RetentionInsight | null {
  // Gating: tenure, attendance rate, comp staleness
  if (s.tenureMonths < RETENTION_CONFIG.MIN_TENURE_MONTHS_FOR_RAISE)
    return null;
  if (s.attendanceRate < RETENTION_CONFIG.MIN_ATTENDANCE_RATE_FOR_RAISE)
    return null;
  if (s.monthsSinceLastRaise < RETENTION_CONFIG.STALE_RAISE_MONTHS) return null;
  if (s.basicSalary <= 0) return null; // can't propose a raise on 0

  // Score components (max 30 + 30 + 25 + 10 + 5 = 100)
  let score = 0;

  // Component 1: Attendance reliability (up to 30 pts)
  // 100% = 30, 85% = 0, linearly between.
  score +=
    Math.max(
      0,
      Math.min(30, (s.attendanceRate - 0.85) * (30 / 0.15)),
    );

  // Component 2: Tenure (up to 30 pts)
  // 1yr = 6pts, 2yr = 12, 3yr = 18, ..., 5yr+ = 30 cap
  score += Math.min(30, (s.tenureMonths / 12) * 6);

  // Component 3: Stale comp severity (up to 25 pts)
  // 12mo = 8pts, 24mo = 17pts, 36mo+ = 25pts (cap)
  score += Math.min(25, ((s.monthsSinceLastRaise - 12) / 12) * 8 + 8);

  // Component 4: Low tardiness (up to 10 pts)
  // 0min/day = 10pts, 30min/day = 0pts
  score +=
    Math.max(0, Math.min(10, 10 - s.tardinessMinutesAvgPerDay * (10 / 30)));

  // Component 5: Zero absences (5 pts bonus)
  if (s.absentDays === 0) score += 5;

  score = Math.round(score * 10) / 10;
  if (score < RETENTION_CONFIG.MIN_SCORE_RAISE) return null;

  // Amount: 5% base + scaled bonus based on score
  const pct =
    RETENTION_CONFIG.RAISE_PCT_BASE +
    (score / 100) * RETENTION_CONFIG.RAISE_PCT_BONUS_MAX;
  const rawDelta = s.basicSalary * pct;
  // Round to nearest 50 EGP so suggestions feel clean (e.g. 1,350 not 1,348.50)
  const suggestedAmount = Math.round(rawDelta / 50) * 50;
  const newSalary = s.basicSalary + suggestedAmount;
  const raisePct = Math.round(pct * 1000) / 10; // e.g. 8.5

  // Reasoning — Arabic, grounded in actual numbers
  const reasoning: string[] = [];
  reasoning.push(
    `موظف ملتزم منذ ${formatTenure(s.tenureMonths)} (نسبة حضور ${Math.round(s.attendanceRate * 100)}%)`,
  );
  if (s.monthsSinceLastRaise >= RETENTION_CONFIG.STALE_RAISE_CRITICAL_MONTHS) {
    reasoning.push(
      `🚨 لم يحصل على زيادة منذ ${Math.floor(s.monthsSinceLastRaise)} شهر — تأخر بشكل ملحوظ`,
    );
  } else {
    reasoning.push(
      `آخر زيادة منذ ${Math.floor(s.monthsSinceLastRaise)} شهر`,
    );
  }
  if (s.absentDays === 0) {
    reasoning.push(`صفر أيام غياب في آخر ٩٠ يوم`);
  }
  if (s.tardinessMinutesAvgPerDay < 5) {
    reasoning.push(`متوسط تأخير أقل من ٥ دقائق/يوم`);
  }
  reasoning.push(
    `الراتب الأساسي حالياً ${formatEGP(s.basicSalary)} — اقتراح: +${formatEGP(suggestedAmount)} (${raisePct}%)`,
  );

  return {
    employeeId: s.id,
    employeeName: s.fullName,
    jobTitle: s.jobTitle,
    department: s.department,
    insightType: "raise",
    score,
    reasoning,
    suggestedAmount,
    metadata: {
      tenureMonths: Math.round(s.tenureMonths),
      attendanceRate: Math.round(s.attendanceRate * 100) / 100,
      monthsSinceLastRaise: Math.floor(s.monthsSinceLastRaise),
      currentSalary: s.basicSalary,
      newSalary,
      raisePct,
    },
  };
}

// ----------------------------------------------------------------------------
// 2) BONUS
// ----------------------------------------------------------------------------
export function computeBonusInsight(
  s: EmployeeSignals,
): RetentionInsight | null {
  if (s.tenureMonths < RETENTION_CONFIG.MIN_TENURE_MONTHS_FOR_BONUS)
    return null;
  if (s.attendanceRate < RETENTION_CONFIG.BONUS_MIN_ATTENDANCE_RATE)
    return null;
  if (s.tardinessMinutesAvgPerDay > 5) return null; // <5min tardiness avg
  if (s.absentDays > 0) return null; // perfect attendance only
  if (s.basicSalary <= 0) return null;

  let score = 0;

  // Component 1: Attendance excellence (up to 40 pts)
  // 95% = 0, 100% = 40, linearly between
  score +=
    Math.max(0, Math.min(40, (s.attendanceRate - 0.95) * (40 / 0.05)));

  // Component 2: Zero tardiness (up to 30 pts)
  // 0min = 30, 5min/day = 0
  score += Math.max(0, Math.min(30, 30 - s.tardinessMinutesAvgPerDay * 6));

  // Component 3: Recent improvement (up to 20 pts)
  // +10% delta = full 20pts; +0% = 0pts; negative = 0pts
  score += Math.max(0, Math.min(20, s.attendanceRateDelta * 200));

  // Component 4: Tenure bonus (up to 10 pts) — reward stickiness
  score += Math.min(10, (s.tenureMonths / 12) * 3);

  score = Math.round(score * 10) / 10;
  if (score < RETENTION_CONFIG.MIN_SCORE_BONUS) return null;

  // Amount: 5-15% of basic salary, capped at 2000 EGP
  const pct =
    RETENTION_CONFIG.BONUS_PCT_BASE +
    (score / 100) * RETENTION_CONFIG.BONUS_PCT_BONUS_MAX;
  const rawBonus = s.basicSalary * pct;
  const capped = Math.min(rawBonus, RETENTION_CONFIG.BONUS_AMOUNT_CAP);
  const suggestedAmount = Math.round(capped / 50) * 50; // round to 50

  const reasoning: string[] = [];
  reasoning.push(
    `أداء استثنائي: حضور ${Math.round(s.attendanceRate * 100)}% آخر ٩٠ يوم`,
  );
  if (s.absentDays === 0 && s.tardinessMinutesAvgPerDay === 0) {
    reasoning.push(`صفر غياب وصفر تأخير في الفترة — التزام مثالي`);
  } else {
    reasoning.push(`غياب: ${s.absentDays} يوم · تأخير متوسط ${Math.round(s.tardinessMinutesAvgPerDay)} دقيقة`);
  }
  if (s.attendanceRateDelta > 0.05) {
    reasoning.push(
      `تحسّن في الحضور آخر شهر مقارنة بالشهرين السابقين (+${Math.round(s.attendanceRateDelta * 100)}%)`,
    );
  }
  reasoning.push(
    `اقتراح مكافأة لمرة واحدة: ${formatEGP(suggestedAmount)} (${Math.round(pct * 1000) / 10}% من الراتب)`,
  );

  return {
    employeeId: s.id,
    employeeName: s.fullName,
    jobTitle: s.jobTitle,
    department: s.department,
    insightType: "bonus",
    score,
    reasoning,
    suggestedAmount,
    metadata: {
      tenureMonths: Math.round(s.tenureMonths),
      attendanceRate: Math.round(s.attendanceRate * 100) / 100,
      tardinessMinutes: Math.round(s.tardinessMinutesAvgPerDay),
      attendanceRateDelta: Math.round(s.attendanceRateDelta * 100) / 100,
    },
  };
}

// ----------------------------------------------------------------------------
// 3) FLIGHT RISK
// ----------------------------------------------------------------------------
export function computeFlightRiskInsight(
  s: EmployeeSignals,
): RetentionInsight | null {
  // Need at least 6 months tenure — flight risk in first 6mo is
  // usually a bad hire, not a retention issue.
  if (s.tenureMonths < 6) return null;

  // Need at least 2 signals to flag
  const signals: string[] = [];

  // Signal 1: Attendance dropping
  if (
    s.attendanceRateDelta <=
    -RETENTION_CONFIG.FLIGHT_RISK_ATTENDANCE_DROP_DELTA
  ) {
    signals.push(
      `⚠ نسبة الحضور هبطت ${Math.abs(Math.round(s.attendanceRateDelta * 100))}% آخر شهر مقارنة بالشهرين قبله`,
    );
  }

  // Signal 2: High tardiness
  if (
    s.tardinessMinutesAvgPerDay >
    RETENTION_CONFIG.FLIGHT_RISK_HIGH_TARDINESS_MINUTES
  ) {
    signals.push(
      `⚠ متوسط تأخير ${Math.round(s.tardinessMinutesAvgPerDay)} دقيقة/يوم — أعلى من المعتاد`,
    );
  }

  // Signal 3: Leave spike
  if (
    s.recentLeaveDays >= RETENTION_CONFIG.FLIGHT_RISK_LEAVE_SPIKE_DAYS
  ) {
    signals.push(
      `⚠ ${s.recentLeaveDays} أيام إجازة آخر ٣٠ يوم — أعلى من المعدل`,
    );
  }

  // Signal 4: Stale comp on long-tenured employee
  if (
    s.tenureMonths >= 24 &&
    s.monthsSinceLastRaise >=
      RETENTION_CONFIG.STALE_RAISE_CRITICAL_MONTHS
  ) {
    signals.push(
      `⚠ لم يحصل على زيادة منذ ${Math.floor(s.monthsSinceLastRaise)} شهر مع خدمة ${formatTenure(s.tenureMonths)}`,
    );
  }

  if (signals.length < 2) return null;

  // Score = signals_count × 25, capped 100
  const score = Math.min(100, signals.length * 25);
  if (score < RETENTION_CONFIG.MIN_SCORE_FLIGHT_RISK) return null;

  const reasoning: string[] = [...signals];
  reasoning.push(`توصية: اعمل اجتماع ١:١ مع الموظف ده الأسبوع ده لو ممكن`);

  return {
    employeeId: s.id,
    employeeName: s.fullName,
    jobTitle: s.jobTitle,
    department: s.department,
    insightType: "flight_risk",
    score,
    reasoning,
    suggestedAmount: null,
    metadata: {
      attendanceRate: Math.round(s.attendanceRate * 100) / 100,
      attendanceRateDelta: Math.round(s.attendanceRateDelta * 100) / 100,
      recentLeaveDays: s.recentLeaveDays,
      signalCount: signals.length,
    },
  };
}

// ----------------------------------------------------------------------------
// 4) ANNIVERSARY
// ----------------------------------------------------------------------------
export function computeAnniversaryInsight(
  s: EmployeeSignals,
  today: Date = new Date(),
): RetentionInsight | null {
  if (!s.hireDate) return null;

  const hire = new Date(s.hireDate + "T00:00:00");
  if (Number.isNaN(hire.getTime())) return null;

  // Next anniversary year
  const nextAnniv = new Date(hire);
  nextAnniv.setFullYear(today.getFullYear());
  if (nextAnniv < today) {
    nextAnniv.setFullYear(today.getFullYear() + 1);
  }

  const daysUntil = Math.round(
    (nextAnniv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntil < 0 || daysUntil > RETENTION_CONFIG.ANNIVERSARY_LOOKAHEAD_DAYS)
    return null;

  const tenureYears = nextAnniv.getFullYear() - hire.getFullYear();
  if (tenureYears < 1) return null;

  // Score based on milestone significance (1yr=20, 3yr=50, 5yr=70, 10yr=100)
  let score = 20 + (tenureYears - 1) * 8;
  if (tenureYears >= 5) score = 70 + (tenureYears - 5) * 5;
  if (tenureYears >= 10) score = 100;
  score = Math.min(100, score);

  const milestone = milestoneLabel(tenureYears);

  const reasoning: string[] = [];
  reasoning.push(`🎉 ${milestone} على تعيين الموظف (${formatDate(s.hireDate)})`);
  if (daysUntil === 0) {
    reasoning.push(`اليوم هو الذكرى!`);
  } else if (daysUntil === 1) {
    reasoning.push(`الذكرى بكره`);
  } else {
    reasoning.push(`الذكرى بعد ${daysUntil} يوم`);
  }
  if (tenureYears >= 5) {
    reasoning.push(
      `موظف من النوادر — ${tenureYears} سنة خدمة، يستحق التقدير`,
    );
  } else {
    reasoning.push(`فرصة لإيماءة صغيرة (تهنئة، شكر، شهادة) تبني الولاء`);
  }

  return {
    employeeId: s.id,
    employeeName: s.fullName,
    jobTitle: s.jobTitle,
    department: s.department,
    insightType: "anniversary",
    score,
    reasoning,
    suggestedAmount: null,
    metadata: {
      tenureYears,
      hireDate: s.hireDate,
      daysUntil,
      milestone,
    },
  };
}

// ----------------------------------------------------------------------------
// Entry point: run all 4 analyses for a list of employees
// ----------------------------------------------------------------------------
export function analyzeAll(
  employees: EmployeeSignals[],
  today: Date = new Date(),
): RetentionInsight[] {
  const out: RetentionInsight[] = [];
  for (const emp of employees) {
    const raise = computeRaiseInsight(emp);
    if (raise) out.push(raise);
    const bonus = computeBonusInsight(emp);
    if (bonus) out.push(bonus);
    const risk = computeFlightRiskInsight(emp);
    if (risk) out.push(risk);
    const anniv = computeAnniversaryInsight(emp, today);
    if (anniv) out.push(anniv);
  }
  // Sort by (type, score desc) so the UI groups + ranks naturally
  return out.sort((a, b) => {
    const typeOrder: Record<InsightType, number> = {
      raise: 0,
      bonus: 1,
      flight_risk: 2,
      anniversary: 3,
    };
    const t = typeOrder[a.insightType] - typeOrder[b.insightType];
    if (t !== 0) return t;
    return b.score - a.score;
  });
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
export function formatTenure(months: number): string {
  const m = Math.floor(months);
  if (m < 12) return `${m} شهر`;
  const years = Math.floor(m / 12);
  const rem = m % 12;
  if (rem === 0) return `${years} سنة`;
  return `${years} سنة و${rem} شهر`;
}

function formatEGP(n: number): string {
  return `${Math.round(n).toLocaleString("ar-EG")} ج`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function milestoneLabel(years: number): string {
  if (years === 1) return "أول سنة كاملة";
  if (years === 2) return "سنتين خدمة";
  if (years === 3) return "٣ سنوات خدمة";
  if (years === 5) return "٥ سنوات خدمة 🌟";
  if (years === 10) return "١٠ سنوات خدمة 🏆";
  if (years >= 15) return `${years} سنة خدمة 🏆`;
  return `${years} سنوات خدمة`;
}

// ----------------------------------------------------------------------------
// Tenure / months helpers (exported for the data loader)
// ----------------------------------------------------------------------------
export function monthsBetween(start: string | Date, end: string | Date): number {
  const a = typeof start === "string" ? new Date(start + "T00:00:00") : start;
  const b = typeof end === "string" ? new Date(end + "T00:00:00") : end;
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const ms = b.getTime() - a.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24 * 30.44));
}
