import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "ai";
import { pickAgentModelLargeContext } from "@/lib/ai-models";

export const maxDuration = 60;

const DOCUMENT_TYPES = {
  employment_contract: {
    label: "عقد عمل",
    prompt: "أنت خبير قانوني في قانون العمل المصري 12/2003. قم بكتابة عقد عمل كامل بالعربية لموظف في شركة مصرية. استخدم هذا الهيكل: بيانات الطرفين، المسمى الوظيفي، الراتب والمزايا، مدة العقد، ساعات العمل، الإجازات، الإنهاء، التوقيعات. اكتب بصيغة رسمية قانونية.",
  },
  warning_letter: {
    label: "إنذار موظف",
    prompt: "أنت مدير موارد بشرية في شركة مصرية. قم بكتابة إنذار رسمي لموظف بالعربية. استخدم هذا الهيكل: بيانات الموظف، تاريخ الإنذار، سبب الإنذار (تأخير، غياب، تقصير في العمل)، التحذير من العواقب، التوقيعات. اكتب بأسلوب رسمي.",
  },
  penalty_letter: {
    label: "جزاء تأديبي",
    prompt: "أنت مدير موارد بشرية في شركة مصرية. قم بكتابة قرار جزاء تأديبي لموظف وفقاً لقانون العمل المصري 12/2003. استخدم الهيكل: بيانات الموظف، المخالفة، نص المادة المخالفة، نوع الجزاء، التوقيعات.",
  },
  offer_letter: {
    label: "عرض وظيفي",
    prompt: "أنت مدير توظيف في شركة مصرية. قم بكتابة عرض وظيفي بالعربية لمرشح جديد. استخدم: بيانات الشركة، المسمى الوظيفي، الراتب والمزايا، تاريخ البدء، شروط القبول. اكتب بأسلوب احترافي جذاب.",
  },
  experience_certificate: {
    label: "شهادة خبرة",
    prompt: "أنت مدير موارد بشرية في شركة مصرية. قم بكتابة شهادة خبرة لموظف بالعربية. استخدم: بيانات الموظف، تاريخ التعيين والانتهاء، المسمى الوظيفي، التقييم السلوكي، التوقيعات.",
  },
  salary_certificate: {
    label: "شهادة راتب",
    prompt: "أنت مدير موارد بشرية في شركة مصرية. قم بكتابة شهادة راتب بالعربية لموظف. استخدم: بيانات الموظف، الراتب الأساسي، البدلات، إجمالي الدخل، التوقيعات. اكتب بصيغة خطاب رسمي.",
  },
  settlement_agreement: {
    label: "مخالصة مالية",
    prompt: "أنت خبير قانوني في قانون العمل المصري. قم بكتابة مخالصة مالية بالعربية بين شركة وموظف. استخدم: بيانات الطرفين، المبلغ المدفوع، تفاصيل المستحقات (راتب، إجازات، نهاية خدمة)، إقرار بالبراءة الذمة، التوقيعات.",
  },
  termination_letter: {
    label: "إنهاء خدمة",
    prompt: "أنت مدير موارد بشرية في شركة مصرية. قم بكتابة قرار إنهاء خدمة بالعربية وفقاً لقانون العمل المصري 12/2003. استخدم: بيانات الموظف، سبب الإنهاء، تاريخ الإنهاء، المستحقات المالية، التوقيعات.",
  },
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { docType, employeeName, employeeTitle, companyName, additionalContext } = await req.json();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, company_id, full_name, role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
      return Response.json({ error: "HR only" }, { status: 403 });
    }

    let compName = companyName || "الشركة";
    if (profile.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .single();
      compName = companyName || company?.name || "الشركة";
    }

    if (!docType || !DOCUMENT_TYPES[docType as keyof typeof DOCUMENT_TYPES]) {
      return Response.json({ error: "نوع المستند غير صالح" }, { status: 400 });
    }

    const docInfo = DOCUMENT_TYPES[docType as keyof typeof DOCUMENT_TYPES];
    const today = new Date().toLocaleDateString("ar-EG", {
      year: "numeric", month: "long", day: "numeric",
    });

    const prompt = `${docInfo.prompt}

بيانات إضافية:
- اسم الشركة: ${compName}
- اسم الموظف: ${employeeName || "[اسم الموظف]"}
- المسمى الوظيفي: ${employeeTitle || "[المسمى الوظيفي]"}
- التاريخ: ${today}
${additionalContext ? `\nسياق إضافي:\n${additionalContext}` : ""}

اكتب المستند بصيغة عربية فصحى قانونية واضحة، مع فراغات للتوقيعات والتواريخ.`;

    const model = pickAgentModelLargeContext();
    const result = await generateText({
      model: model.model,
      prompt,
      temperature: 0.3,
    });

    return Response.json({
      ok: true,
      content: result.text,
      docType,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    types: Object.entries(DOCUMENT_TYPES).map(([key, val]) => ({
      id: key,
      label: val.label,
    })),
  });
}
