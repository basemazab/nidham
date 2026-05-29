export interface HealthScoreInput {
  totalEmployees: number;
  activeEmployees: number;
  terminatedLast90Days: number;
  attendanceRate: number;
  tardinessAvgMinutes: number;
  avgTenureMonths: number;
  pendingLeaveRequests: number;
  pendingAdvanceRequests: number;
  completedPayrollPeriods: number;
  avgBasicSalary: number;
  turnoverRate: number;
  femaleRatio: number;
  departmentsCount: number;
  employeesWithCode: number;
  employeesWithNationalId: number;
}

export interface HealthScoreResult {
  overall: number;
  grade: string;
  gradeColor: string;
  dimensions: HealthDimension[];
  recommendations: HealthRecommendation[];
}

interface HealthDimension {
  name: string;
  key: string;
  score: number;
  maxScore: number;
  weight: number;
  status: "excellent" | "good" | "fair" | "poor";
  description: string;
}

interface HealthRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string;
}

const GRADE_THRESHOLDS = [
  { min: 90, grade: "A+", color: "text-emerald-500" },
  { min: 80, grade: "A", color: "text-emerald-500" },
  { min: 70, grade: "B+", color: "text-cyan-500" },
  { min: 60, grade: "B", color: "text-cyan-500" },
  { min: 50, grade: "C+", color: "text-amber-500" },
  { min: 40, grade: "C", color: "text-amber-500" },
  { min: 30, grade: "D", color: "text-orange-500" },
  { min: 0, grade: "F", color: "text-red-500" },
];

function getGrade(score: number): { grade: string; color: string } {
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.min) return { grade: t.grade, color: t.color };
  }
  return { grade: "F", color: "text-red-500" };
}

function getStatus(score: number, max: number): "excellent" | "good" | "fair" | "poor" {
  const pct = score / max;
  if (pct >= 0.9) return "excellent";
  if (pct >= 0.7) return "good";
  if (pct >= 0.5) return "fair";
  return "poor";
}

export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  const dims: HealthDimension[] = [];

  // 1. Workforce Stability (weight: 25)
  const stabilityScore = Math.min(25, 
    (input.activeEmployees / Math.max(input.totalEmployees, 1)) * 8 +
    (1 - Math.min(input.terminatedLast90Days / Math.max(input.activeEmployees, 1), 1)) * 8 +
    (Math.min(input.avgTenureMonths / 36, 1)) * 9
  );
  dims.push({
    name: "استقرار القوى العاملة",
    key: "stability",
    score: Math.round(stabilityScore * 100 / 25),
    maxScore: 100,
    weight: 25,
    status: getStatus(stabilityScore, 25),
    description: "معدل الاحتفاظ بالموظفين ومتوسط مدة الخدمة",
  });

  // 2. Attendance Health (weight: 20)
  const attScore = Math.min(20,
    input.attendanceRate * 10 +
    (1 - Math.min(input.tardinessAvgMinutes / 60, 1)) * 10
  );
  dims.push({
    name: "صحة الحضور",
    key: "attendance",
    score: Math.round(attScore * 100 / 20),
    maxScore: 100,
    weight: 20,
    status: getStatus(attScore, 20),
    description: "نسبة الحضور ومتوسط التأخير اليومي",
  });

  // 3. Data Completeness (weight: 15)
  const dataScore = Math.min(15,
    (input.employeesWithCode / Math.max(input.activeEmployees, 1)) * 5 +
    (input.employeesWithNationalId / Math.max(input.activeEmployees, 1)) * 5 +
    (input.departmentsCount > 1 ? 5 : input.departmentsCount > 0 ? 2 : 0)
  );
  dims.push({
    name: "اكتمال البيانات",
    key: "data",
    score: Math.round(dataScore * 100 / 15),
    maxScore: 100,
    weight: 15,
    status: getStatus(dataScore, 15),
    description: "نسبة الموظفين ببيانات مكتملة",
  });

  // 4. Pending Requests (weight: 15)
  const pendingTotal = input.pendingLeaveRequests + input.pendingAdvanceRequests;
  const pendingScore = Math.max(0, 15 - pendingTotal * 2);
  dims.push({
    name: "كفاءة الطلبات",
    key: "requests",
    score: Math.round(Math.max(0, Math.min(100, (1 - pendingTotal / 20) * 100))),
    maxScore: 100,
    weight: 15,
    status: pendingTotal === 0 ? "excellent" : pendingTotal <= 3 ? "good" : pendingTotal <= 8 ? "fair" : "poor",
    description: "الطلبات المعلقة — إجازات وسلف",
  });

  // 5. Payroll Consistency (weight: 15)
  const payrollScore = Math.min(15, input.completedPayrollPeriods * 3 + 
    (1 - Math.min(input.turnoverRate, 0.5)) * 7);
  dims.push({
    name: "انتظام المرتبات",
    key: "payroll",
    score: Math.round(payrollScore * 100 / 15),
    maxScore: 100,
    weight: 15,
    status: getStatus(payrollScore, 15),
    description: "عدد دورات المرتبات المكتملة ومعدل الدوران",
  });

  // 6. Compensation Adequacy (weight: 10)
  const compScore = Math.min(10,
    Math.min(input.avgBasicSalary / 5000, 1) * 10
  );
  dims.push({
    name: "مستوى التعويضات",
    key: "compensation",
    score: Math.round(compScore * 100 / 10),
    maxScore: 100,
    weight: 10,
    status: getStatus(compScore, 10),
    description: "متوسط الرواتب مقارنة بالسوق",
  });

  const overall = Math.round(
    (dims[0].score * dims[0].weight +
     dims[1].score * dims[1].weight +
     dims[2].score * dims[2].weight +
     dims[3].score * dims[3].weight +
     dims[4].score * dims[4].weight +
     dims[5].score * dims[5].weight) / 100
  );

  const { grade, color } = getGrade(overall);

  const recommendations: HealthRecommendation[] = [];
  if (input.turnoverRate > 0.15) {
    recommendations.push({
      priority: "high",
      title: "ارتفاع معدل الدوران الوظيفي",
      description: "معدل ترك الموظفين أعلى من ١٥٪ في آخر ٣ شهور",
      impact: "يحتاج تدخل فوري — راجع أسباب ترك الخدمة",
    });
  }
  if (input.attendanceRate < 0.85) {
    recommendations.push({
      priority: "high",
      title: "نسبة حضور منخفضة",
      description: "نسبة الحضور أقل من ٨٥٪",
      impact: "يؤثر على الإنتاجية وروح الفريق",
    });
  }
  if (input.pendingLeaveRequests > 5) {
    recommendations.push({
      priority: "medium",
      title: "تراكم طلبات الإجازات",
      description: `فيه ${input.pendingLeaveRequests} طلب إجازة معلق`,
      impact: "يحتاج مراجعة سريعة من HR",
    });
  }
  if (input.employeesWithCode < input.activeEmployees * 0.8) {
    recommendations.push({
      priority: "medium",
      title: "نقص أكواد الموظفين",
      description: `${input.activeEmployees - input.employeesWithCode} موظف بدون كود بصمة`,
      impact: "يمنع تسجيل الحضور بدقة",
    });
  }
  if (input.tardinessAvgMinutes > 30) {
    recommendations.push({
      priority: "medium",
      title: "متوسط تأخير مرتفع",
      description: `متوسط التأخير ${Math.round(input.tardinessAvgMinutes)} دقيقة يومياً`,
      impact: "يحتاج سياسة انضباط أو حوار مع الفريق",
    });
  }
  recommendations.push({
    priority: "medium",
    title: "مراجعة دورية للبيانات",
    description: "تأكد من اكتمال بيانات جميع الموظفين",
    impact: "بيانات نظيفة = تقارير دقيقة",
  });

  return { overall, grade, gradeColor: color, dimensions: dims, recommendations };
}
