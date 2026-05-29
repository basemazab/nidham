export type ComplianceAuthority = {
  id: string;
  name: string;
  icon: string;
  description: string;
  frequency: "monthly" | "quarterly" | "yearly" | "event_based";
  items: ComplianceItem[];
};

export type ComplianceItem = {
  id: string;
  title: string;
  description: string;
  deadline: string;
  legalRef: string;
  penalty?: string;
};

export type ComplianceStatus = {
  authorityId: string;
  overallScore: number;
  itemStatuses: { itemId: string; completed: boolean; lastChecked: string | null; notes: string | null }[];
  risk: "low" | "medium" | "high";
  nextDeadline: string | null;
};

const AUTHORITIES: ComplianceAuthority[] = [
  {
    id: "labor_office",
    name: "مكتب العمل",
    icon: "🏛️",
    description: "الامتثال لقوانين وزارة القوى العاملة — عقود العمل، الإجراءات التأديبية، سجل العاملين",
    frequency: "event_based",
    items: [
      { id: "employment_contracts", title: "عقود العمل المختومة", description: "جميع عقود العمل مختومة من مكتب العمل", deadline: "خلال 7 أيام من التعيين", legalRef: "قانون العمل 12/2003 مادة 37", penalty: "غرامة 500-1000 جنيه" },
      { id: "workforce_register", title: "سجل العاملين", description: "سجل قوى عاملة محدث ومختوم", deadline: "شهرياً", legalRef: "القرار الوزاري 252 لسنة 2015", penalty: "غرامة 200-500 جنيه" },
      { id: "termination_notification", title: "إخطار إنهاء الخدمة", description: "إخطار مكتب العمل بإنهاء خدمة الموظف", deadline: "خلال 7 أيام من الإنهاء", legalRef: "قانون العمل 12/2003 مادة 128", penalty: "غرامة 300-800 جنيه" },
    ],
  },
  {
    id: "social_insurance",
    name: "التأمينات الاجتماعية",
    icon: "🛡️",
    description: "الامتثال لقوانين التأمينات الاجتماعية — التسجيل، الاشتراكات، الملفات",
    frequency: "monthly",
    items: [
      { id: "employee_registration", title: "تسجيل الموظفين بنظام التأمينات", description: "نموذج 1 تأمينات لكل موظف جديد", deadline: "خلال 7 أيام من التعيين", legalRef: "قانون التأمينات 148/2019 مادة 12", penalty: "غرامة 1000-3000 جنيه" },
      { id: "monthly_contributions", title: "سداد الاشتراكات الشهرية", description: "سداد حصة الشركة والموظف من التأمينات", deadline: "شهرياً — آخر يوم في الشهر التالي", legalRef: "قانون التأمينات 148/2019 مادة 37", penalty: "فوائد تأخير 1.5% شهرياً" },
      { id: "salary_adjustment", title: "تعديل الأجر التأميني", description: "نموذج 2 عند زيادة المرتب أو الترقية", deadline: "خلال 14 يوم من التعديل", legalRef: "قانون التأمينات 148/2019 مادة 14", penalty: "غرامة 500-1000 جنيه" },
      { id: "termination_form_6", title: "نموذج 6 — ترك الخدمة", description: "إخطار التأمينات بترك الموظف الخدمة", deadline: "خلال 7 أيام من ترك الخدمة", legalRef: "قانون التأمينات 148/2019 مادة 16", penalty: "غرامة 200-500 جنيه" },
    ],
  },
  {
    id: "tax_authority",
    name: "مصلحة الضرائب",
    icon: "📊",
    description: "الامتثال لقوانين ضريبة الدخل — ضريبة المرتبات، الإقرارات الشهرية",
    frequency: "monthly",
    items: [
      { id: "monthly_tax_return", title: "إقرار ضريبة المرتبات الشهري", description: "نموذج 41 — إقرار ضريبة الرواتب والأجور", deadline: "شهرياً — أول 15 يوم من الشهر التالي", legalRef: "قانون الضرائب 91/2005 مادة 57", penalty: "غرامة 2000-5000 جنيه" },
      { id: "annual_tax_return", title: "الإقرار السنوي", description: "إقرار ضريبة المرتبات السنوي", deadline: "سنوياً — آخر يناير", legalRef: "قانون الضرائب 91/2005 مادة 58", penalty: "غرامة 5000-20000 جنيه" },
      { id: "tax_cards", title: "بطاقات ضريبية محدثة", description: "جميع الموظفين لديهم بطاقة ضريبية سارية", deadline: "سنوياً", legalRef: "قانون الضرائب 91/2005 مادة 42", penalty: "رفض الخصم الضريبي" },
    ],
  },
  {
    id: "health_safety",
    name: "الصحة والسلامة المهنية",
    icon: "🦺",
    description: "الامتثال لقوانين الصحة والسلامة المهنية — التدريب، الإسعافات، المعدات",
    frequency: "quarterly",
    items: [
      { id: "safety_training", title: "تدريب السلامة المهنية", description: "تدريب دوري للموظفين على السلامة المهنية", deadline: "نصف سنوي", legalRef: "القرار الوزاري 134/2003", penalty: "غرامة 1000-3000 جنيه" },
      { id: "first_aid", title: "صناديق إسعافات أولية", description: "صندوق إسعافات أولية في كل طابق", deadline: "شهرياً — مراجعة المخزون", legalRef: "القرار الوزاري 134/2003 مادة 8", penalty: "إنذار من مكتب العمل" },
      { id: "fire_extinguishers", title: "طفايات حريق", description: "طفايات حريق سارية الصلاحية في كل طابق", deadline: "سنوياً — الصيانة", legalRef: "قانون الدفاع المدني", penalty: "غرامة 2000-5000 جنيه" },
    ],
  },
  {
    id: "civil_defense",
    name: "الدفاع المدني",
    icon: "🔥",
    description: "الامتثال لقوانين الحماية المدنية والدفاع المدني — التراخيص والإخلاء",
    frequency: "yearly",
    items: [
      { id: "fire_license", title: "ترخيص الدفاع المدني", description: "ترخيص سنوي ساري من الدفاع المدني", deadline: "سنوياً — قبل شهر من انتهاء الترخيص", legalRef: "قانون الدفاع المدني 71/2015", penalty: "غرامة 5000-10000 جنيه وإغلاق" },
      { id: "evacuation_drill", title: "تجربة إخلاء سنوية", description: "تنفيذ تجربة إخلاء وهمية للشركة", deadline: "سنوياً", legalRef: "القرار الوزاري 134/2003", penalty: "غرامة 1000-3000 جنيه" },
    ],
  },
  {
    id: "pdpl",
    name: "حماية البيانات الشخصية",
    icon: "🔒",
    description: "الامتثال لقانون حماية البيانات الشخصية رقم 151/2020",
    frequency: "yearly",
    items: [
      { id: "data_registration", title: "التسجيل بمركز حماية البيانات", description: "تسجيل الشركة كمعالج بيانات", deadline: "سنوياً — تجديد", legalRef: "قانون حماية البيانات 151/2020 مادة 5", penalty: "غرامة 50000-500000 جنيه" },
      { id: "employee_consent", title: "موافقة الموظفين على معالجة البيانات", description: "الحصول على موافقة خطية من كل موظف", deadline: "مرة واحدة — تحديث كل سنتين", legalRef: "قانون حماية البيانات 151/2020 مادة 6", penalty: "غرامة 20000-100000 جنيه" },
      { id: "data_breach_notification", title: "الإبلاغ عن اختراق البيانات", description: "إخطار المركز عند حدوث اختراق", deadline: "خلال 72 ساعة من الاختراق", legalRef: "قانون حماية البيانات 151/2020 مادة 32", penalty: "غرامة 100000-500000 جنيه" },
    ],
  },
];

export function getAuthorities(): ComplianceAuthority[] {
  return AUTHORITIES;
}

export function getAuthorityById(id: string): ComplianceAuthority | undefined {
  return AUTHORITIES.find((a) => a.id === id);
}

export function computeComplianceScore(statuses: Pick<ComplianceItem, "id">[], completedIds: Set<string>): {
  score: number;
  completedCount: number;
  totalCount: number;
  risk: "low" | "medium" | "high";
} {
  const totalCount = statuses.length;
  const completedCount = completedIds.size;
  const score = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const risk: "low" | "medium" | "high" = score >= 80 ? "low" : score >= 50 ? "medium" : "high";
  return { score, completedCount, totalCount, risk };
}

export function getUpcomingDeadlines(authorities: ComplianceAuthority[]): {
  authorityName: string;
  authorityIcon: string;
  itemTitle: string;
  deadline: string;
}[] {
  const result: { authorityName: string; authorityIcon: string; itemTitle: string; deadline: string }[] = [];
  for (const auth of authorities) {
    for (const item of auth.items) {
      result.push({
        authorityName: auth.name,
        authorityIcon: auth.icon,
        itemTitle: item.title,
        deadline: item.deadline,
      });
    }
  }
  return result;
}

export function getPenaltiesSummary(authorities: ComplianceAuthority[]): {
  maxPenalty: string;
  minPenalty: string;
  totalItems: number;
} {
  const penalties: number[] = [];
  for (const auth of authorities) {
    for (const item of auth.items) {
      if (item.penalty) {
        const nums = item.penalty.match(/\d+/g);
        if (nums) {
          nums.forEach((n) => penalties.push(parseInt(n)));
        }
      }
    }
  }
  return {
    maxPenalty: penalties.length > 0 ? Math.max(...penalties).toLocaleString("ar-EG") + " جنيه" : "غير محدد",
    minPenalty: penalties.length > 0 ? Math.min(...penalties).toLocaleString("ar-EG") + " جنيه" : "غير محدد",
    totalItems: authorities.reduce((acc, a) => acc + a.items.length, 0),
  };
}
