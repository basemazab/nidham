import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addApplicantToJob } from "../../../actions";
import { SubmitButton } from "@/components/submit-button";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type Job = {
  id: string;
  title: string;
  department: string | null;
};

export default async function NewApplicantPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, department")
    .eq("id", id)
    .single<Job>();

  if (!job) notFound();

  const submitAction = addApplicantToJob.bind(null, id);

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/dashboard/jobs/${id}`}
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لـ {job.title}
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            إضافة مرشح جديد
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed">
            للوظيفة: <strong className="text-slate-700">{job.title}</strong>
            {job.department && ` · ${job.department}`}
            <br />
            <span className="text-brand-cyan-dark font-bold">
              ✦ بمجرد ما تحفظ، Gemini AI هيقرا الـ CV ويفرز المرشح تلقائيًا
            </span>
          </p>
        </header>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(error)}
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <form action={submitAction} className="space-y-5">
            {/* Identity */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 font-cairo">
                👤 بيانات المرشح
              </h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    الاسم الكامل <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    required
                    placeholder="مثلًا: محمد أحمد علي"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                      الإيميل
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="candidate@example.com"
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                      الموبايل
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      dir="ltr"
                      placeholder="01XXXXXXXXX"
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="current_title" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                      الوظيفة الحالية
                    </label>
                    <input
                      id="current_title"
                      name="current_title"
                      type="text"
                      placeholder="Sales Rep"
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                    />
                  </div>
                  <div>
                    <label htmlFor="current_company" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                      الشركة الحالية
                    </label>
                    <input
                      id="current_company"
                      name="current_company"
                      type="text"
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="years_experience" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                      سنين الخبرة
                    </label>
                    <input
                      id="years_experience"
                      name="years_experience"
                      type="number"
                      min="0"
                      max="50"
                      step="0.5"
                      placeholder="3"
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                      المكان
                    </label>
                    <input
                      id="location"
                      name="location"
                      type="text"
                      placeholder="القاهرة"
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                    />
                  </div>
                  <div>
                    <label htmlFor="expected_salary" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                      الراتب المتوقع
                    </label>
                    <input
                      id="expected_salary"
                      name="expected_salary"
                      type="number"
                      min="0"
                      step="100"
                      placeholder="15000"
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="linkedin_url" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    LinkedIn
                  </label>
                  <input
                    id="linkedin_url"
                    name="linkedin_url"
                    type="url"
                    dir="ltr"
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right"
                  />
                </div>
              </div>
            </div>

            {/* CV text */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-800 mb-1 font-cairo">
                📄 نص السيرة الذاتية
              </h3>
              <p className="text-xs text-slate-500 mb-3 font-cairo">
                افتح الـ CV (PDF أو Word) → Select All → Copy → الصق هنا. الـ AI هيستخرج المهارات والخبرات من النص ده.
              </p>
              <textarea
                id="cv_text"
                name="cv_text"
                rows={12}
                required
                minLength={30}
                placeholder="الصق هنا كل نص السيرة الذاتية..."
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Cover letter (optional) */}
            <div>
              <label htmlFor="cover_letter" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                خطاب التقديم <span className="text-slate-400 text-xs">— اختياري</span>
              </label>
              <textarea
                id="cover_letter"
                name="cover_letter"
                rows={3}
                placeholder="لو المرشح بعت رسالة تقديم..."
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo resize-none"
              />
            </div>

            <div className="bg-cyan-50 border border-cyan-200 p-4 rounded-lg text-xs text-slate-700 font-cairo">
              <strong className="text-cyan-700">⏳ ملاحظة:</strong> بعد ما تحفظ، الـ AI هياخد من 5 لـ 20 ثانية لحد ما يخلّص الفرز. صفحة المرشح هتفتحلك مباشرة بعد التقييم.
            </div>

            <div className="flex gap-3 pt-2">
              <SubmitButton
                loadingText="جاري الحفظ + الـ AI يفرز..."
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
              >
                ✦ احفظ + فرز AI
              </SubmitButton>
              <Link
                href={`/dashboard/jobs/${id}`}
                className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
              >
                إلغاء
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
