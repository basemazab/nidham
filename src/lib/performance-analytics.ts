export type DeptPerformance = {
  department: string;
  employeeCount: number;
  reviewCount: number;
  avgRating: number;
  avgKpiCompletion: number;
  topOutcome: string | null;
  trend: "up" | "down" | "stable";
};

export type EmployeeTrend = {
  employeeId: string;
  employeeName: string;
  department: string;
  reviews: { period: string; rating: number; date: string }[];
  avgRating: number;
  trend: "up" | "down" | "stable";
};

export type AnalyticsSummary = {
  totalReviews: number;
  avgRating: number;
  avgKpiCompletion: number;
  reviewCountByStatus: Record<string, number>;
  outcomeDistribution: Record<string, number>;
  ratingDistribution: Record<string, number>;
  departments: DeptPerformance[];
  employeeTrends: EmployeeTrend[];
  periodComparison: { period: string; avgRating: number; reviewCount: number }[];
};

type ReviewRow = {
  id: string;
  employee_id: string;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  manager_rating: number | null;
  self_rating: number | null;
  kpis: Array<{ name: string; target: number | null; achieved: number | null; weight: number | null; score: number | null }>;
  outcome: string | null;
  status: string;
  created_at: string;
  employees: { full_name: string; job_title: string | null; department: string | null } | null;
};

export function computePerformanceAnalytics(reviews: ReviewRow[]): AnalyticsSummary {
  const totalReviews = reviews.length;

  const closed = reviews.filter((r) => r.status === "closed" && r.manager_rating);
  const avgRating = closed.length > 0
    ? closed.reduce((s, r) => s + (r.manager_rating ?? 0), 0) / closed.length
    : 0;

  // KPI completion rate
  let totalKpiTargets = 0;
  let totalKpiAchieved = 0;
  for (const r of reviews) {
    for (const k of r.kpis) {
      if (k.target && k.achieved) {
        totalKpiTargets += k.target;
        totalKpiAchieved += k.achieved;
      }
    }
  }
  const avgKpiCompletion = totalKpiTargets > 0 ? Math.round((totalKpiAchieved / totalKpiTargets) * 100) : 0;

  // Count by status
  const reviewCountByStatus: Record<string, number> = {};
  for (const r of reviews) {
    reviewCountByStatus[r.status] = (reviewCountByStatus[r.status] || 0) + 1;
  }

  // Outcome distribution
  const outcomeDistribution: Record<string, number> = {};
  for (const r of reviews) {
    if (r.outcome) {
      outcomeDistribution[r.outcome] = (outcomeDistribution[r.outcome] || 0) + 1;
    }
  }

  // Rating distribution (1-5)
  const ratingDistribution: Record<string, number> = {};
  for (const r of closed) {
    const key = r.manager_rating?.toString() || "0";
    ratingDistribution[key] = (ratingDistribution[key] || 0) + 1;
  }

  // Department performance
  const deptMap = new Map<string, { ratings: number[]; reviews: number; kpiCompletion: number; kpiCount: number; employees: Set<string>; outcomes: string[] }>();
  for (const r of reviews) {
    const dept = r.employees?.department || "بدون قسم";
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { ratings: [], reviews: 0, kpiCompletion: 0, kpiCount: 0, employees: new Set(), outcomes: [] });
    }
    const d = deptMap.get(dept)!;
    d.reviews++;
    if (r.manager_rating) d.ratings.push(r.manager_rating);
    if (r.employee_id) d.employees.add(r.employee_id);
    if (r.outcome) d.outcomes.push(r.outcome);
    for (const k of r.kpis) {
      if (k.target && k.achieved) {
        d.kpiCompletion += k.achieved;
        d.kpiCount += k.target;
      }
    }
  }

  const departments: DeptPerformance[] = Array.from(deptMap.entries()).map(([name, data]) => {
    const avgDeptRating = data.ratings.length > 0
      ? data.ratings.reduce((s, v) => s + v, 0) / data.ratings.length
      : 0;

    // Find top outcome
    const outcomeCounts: Record<string, number> = {};
    for (const o of data.outcomes) {
      outcomeCounts[o] = (outcomeCounts[o] || 0) + 1;
    }
    const topOutcome = Object.entries(outcomeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    // Trend: compare recent vs older
    // Simple heuristic: first half vs second half
    const mid = Math.ceil(data.ratings.length / 2);
    const firstHalf = data.ratings.slice(0, mid);
    const secondHalf = data.ratings.slice(mid);
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length : 0;
    const trend: "up" | "down" | "stable" = secondAvg > firstAvg + 0.3 ? "up" : secondAvg < firstAvg - 0.3 ? "down" : "stable";

    return {
      department: name,
      employeeCount: data.employees.size,
      reviewCount: data.reviews,
      avgRating: Math.round(avgDeptRating * 10) / 10,
      avgKpiCompletion: data.kpiCount > 0 ? Math.round((data.kpiCompletion / data.kpiCount) * 100) : 0,
      topOutcome,
      trend,
    };
  });

  departments.sort((a, b) => b.avgRating - a.avgRating);

  // Employee trends
  const empMap = new Map<string, { name: string; dept: string; reviews: { period: string; rating: number; date: string }[] }>();
  for (const r of closed) {
    const empId = r.employee_id;
    if (!empMap.has(empId)) {
      empMap.set(empId, {
        name: r.employees?.full_name || "—",
        dept: r.employees?.department || "—",
        reviews: [],
      });
    }
    const e = empMap.get(empId)!;
    e.reviews.push({
      period: r.period_label,
      rating: r.manager_rating ?? 0,
      date: r.created_at,
    });
  }

  const employeeTrends: EmployeeTrend[] = Array.from(empMap.entries()).map(([id, data]) => {
    data.reviews.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const avg = data.reviews.length > 0
      ? data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length
      : 0;
    const trend: "up" | "down" | "stable" = data.reviews.length >= 2
      ? data.reviews[data.reviews.length - 1].rating > data.reviews[0].rating + 0.5
        ? "up"
        : data.reviews[data.reviews.length - 1].rating < data.reviews[0].rating - 0.5
          ? "down"
          : "stable"
      : "stable";
    return { employeeId: id, employeeName: data.name, department: data.dept, reviews: data.reviews, avgRating: Math.round(avg * 10) / 10, trend };
  });

  employeeTrends.sort((a, b) => b.avgRating - a.avgRating);

  // Period comparison
  const periodMap = new Map<string, { ratings: number[]; count: number }>();
  for (const r of closed) {
    const p = r.period_label;
    if (!periodMap.has(p)) {
      periodMap.set(p, { ratings: [], count: 0 });
    }
    const pm = periodMap.get(p)!;
    pm.count++;
    if (r.manager_rating) pm.ratings.push(r.manager_rating);
  }
  const periodComparison = Array.from(periodMap.entries())
    .map(([period, data]) => ({
      period,
      avgRating: data.ratings.length > 0 ? Math.round((data.ratings.reduce((s, v) => s + v, 0) / data.ratings.length) * 10) / 10 : 0,
      reviewCount: data.count,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return {
    totalReviews,
    avgRating: Math.round(avgRating * 10) / 10,
    avgKpiCompletion,
    reviewCountByStatus,
    outcomeDistribution,
    ratingDistribution,
    departments,
    employeeTrends,
    periodComparison,
  };
}

export const OUTCOME_LABELS: Record<string, string> = {
  extend_probation: "تمديد فترة الاختبار",
  continue: "استمرار",
  promote: "ترقية",
  pip_30_day: "خطة تحسين 30 يوم",
  pip_60_day: "خطة تحسين 60 يوم",
  terminate: "إنهاء خدمة",
};
