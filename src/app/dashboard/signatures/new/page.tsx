import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { createSignatureRequest } from "../actions";

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
};

type SearchParams = Promise<{ error?: string; employee_id?: string }>;

const TEMPLATES = [
  {
    key: "contract",
    title: "عقد عمل",
    body: `عقد عمل\n\nالطرف الأول: {اسم الشركة}\nالطرف الثاني: {اسم الموظف}\n\nاتفق الطرفان على أن يعمل الطرف الثاني لدى الطرف الأول بوظيفة {الوظيفة} براتب أساسي قدره {الراتب} جنيه شهرياً، اعتباراً من {التاريخ}.\n\nشروط أخرى: ساعات العمل من 9 صباحاً إلى 5 مساءً، ستة أيام أسبوعياً.\n\nأقرّ بقبولي لهذه الشروط.`,
  },
  {
    key: "amendment",
    title: "تعديل راتب",
    body: `تعديل راتب\n\nالموظف: {اسم الموظف}\n\nاعتباراً من {تاريخ التعديل}، يتم تعديل الراتب الأساسي للموظف إلى {الراتب الجديد} جنيه شهرياً.\n\nباقي شروط العقد كما هي.`,
  },
  {
    key: "nda",
    title: "اتفاقية سرية (NDA)",
    body: `اتفاقية عدم الإفصاح\n\nيلتزم الموقّع بالحفاظ على سرية جميع المعلومات التي يطّلع عليها بسبب علاقته بالشركة، ولا يفصح عنها لأي طرف ثالث دون موافقة كتابية، حتى بعد انتهاء علاقته بالشركة بسنتين.\n\nيشمل ذلك: قوائم العملاء، الأسعار، الأنظمة الداخلية، البيانات المالية، الخطط المستقبلية.`,
  },
];

export default async function NewSignatureRequestPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getMyProfile();
  const companyId = profile?.company_id ?? "";

  const params = await searchParams;

  const { data: empData } = await supabase
    .from("employees")
    .select("id, full_name, phone, email")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("full_name")
    .returns<Employee[]>();
  const employees = empData ?? [];

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/signatures"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للقائمة
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            طلب توقيع جديد
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            اختار قالب جاهز أو اكتب المستند يدوياً. هيتولّد لك لينك آمن
            تبعته للمستلم على واتساب.
          </p>
        </header>

        {params.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(params.error)}
          </div>
        )}

        <form
          action={createSignatureRequest}
          className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 space-y-5"
        >
          {/* Template picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
              قالب جاهز (اختياري)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="text-right p-3 rounded-xl border-2 border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition font-cairo text-sm font-bold text-slate-700"
                  data-template-name={t.title}
                  data-template-body={t.body}
                >
                  📄 {t.title}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-cairo">
              اضغط على قالب علشان يتنسخ في الخانتين تحت — وعدّل بعد كده.
            </p>
          </div>

          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
            >
              عنوان المستند *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="مثلاً: عقد عمل أحمد محمد"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-slate-900 font-cairo"
            />
          </div>

          <div>
            <label
              htmlFor="document_html"
              className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
            >
              محتوى المستند *
            </label>
            <textarea
              id="document_html"
              name="document_html"
              required
              rows={10}
              placeholder="اكتب نص المستند هنا — أو اختار قالب فوق."
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-slate-900 font-cairo resize-vertical leading-relaxed"
            />
            <p className="text-[10px] text-slate-400 mt-1 font-cairo">
              يدعم النص العادي + فواصل أسطر. للأبسط، استخدم القوالب أعلاه.
            </p>
          </div>

          {/* Recipient block */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3 font-cairo">
              📨 المستلم
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <label
                  htmlFor="employee_id"
                  className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
                >
                  اربط بموظف (اختياري)
                </label>
                <select
                  id="employee_id"
                  name="employee_id"
                  defaultValue=""
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-500 outline-none text-slate-900 font-cairo"
                >
                  <option value="">— مش مرتبط بموظف —</option>
                  {employees.map((e) => (
                    <option
                      key={e.id}
                      value={e.id}
                      data-phone={e.phone ?? ""}
                      data-email={e.email ?? ""}
                      data-name={e.full_name}
                    >
                      {e.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="recipient_name"
                  className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
                >
                  اسم المستلم *
                </label>
                <input
                  id="recipient_name"
                  name="recipient_name"
                  type="text"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-500 outline-none text-slate-900 font-cairo"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="recipient_phone"
                  className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
                >
                  موبايل المستلم
                </label>
                <input
                  id="recipient_phone"
                  name="recipient_phone"
                  type="tel"
                  placeholder="01055356622"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-500 outline-none text-slate-900 font-mono"
                  dir="ltr"
                />
              </div>
              <div>
                <label
                  htmlFor="recipient_email"
                  className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
                >
                  إيميل المستلم
                </label>
                <input
                  id="recipient_email"
                  name="recipient_email"
                  type="email"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-500 outline-none text-slate-900"
                  dir="ltr"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-cairo">
              لازم رقم أو إيميل واحد على الأقل — هتستخدمه لإرسال اللينك.
            </p>
          </div>

          <div>
            <label
              htmlFor="expires_days"
              className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
            >
              اللينك يفضل صالح لمدة كام يوم؟
            </label>
            <select
              id="expires_days"
              name="expires_days"
              defaultValue="14"
              className="px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-500 outline-none text-slate-900 font-cairo"
            >
              <option value="3">3 أيام</option>
              <option value="7">أسبوع</option>
              <option value="14">أسبوعين (مقترح)</option>
              <option value="30">شهر</option>
              <option value="60">شهرين</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Link
              href="/dashboard/signatures"
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm font-cairo transition"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white font-bold text-sm shadow-md font-cairo transition"
            >
              ✍ أنشئ طلب التوقيع
            </button>
          </div>
        </form>
      </div>

      {/* Tiny client script to wire template buttons + employee auto-fill */}
      <script
         
        dangerouslySetInnerHTML={{
          __html: `
            document.querySelectorAll('[data-template-body]').forEach(btn => {
              btn.addEventListener('click', () => {
                document.getElementById('title').value = btn.dataset.templateName;
                document.getElementById('document_html').value = btn.dataset.templateBody;
              });
            });
            const empSel = document.getElementById('employee_id');
            if (empSel) {
              empSel.addEventListener('change', () => {
                const opt = empSel.selectedOptions[0];
                if (!opt) return;
                const phone = opt.dataset.phone;
                const email = opt.dataset.email;
                const name = opt.dataset.name;
                if (name) document.getElementById('recipient_name').value = name;
                if (phone) document.getElementById('recipient_phone').value = phone;
                if (email) document.getElementById('recipient_email').value = email;
              });
            }
          `,
        }}
      />
    </main>
  );
}
