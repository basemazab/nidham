import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { submitPublicApplication } from "../../actions";
import { SubmitButton } from "@/components/submit-button";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

type Job = {
  id: string;
  title: string;
  department: string | null;
  company_id: string;
};

type Company = { name: string };

export const dynamic = "force-dynamic";

export default async function PublicApplyPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { error } = await searchParams;

  const supabase = createPublicClient();
  const { data: job } = await supabase
    .from("public_jobs")
    .select("id, title, department, company_id")
    .eq("slug", slug)
    .single<Job>();

  if (!job) notFound();

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", job.company_id)
    .single<Company>();

  const submitAction = submitPublicApplication.bind(null, slug);

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-[calc(100vh-65px)] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/jobs/${slug}`}
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لتفاصيل الوظيفة
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black font-cairo text-slate-800 mb-1">
            قدم على وظيفة
          </h1>
          <p className="text-sm text-slate-600 font-cairo">
            <strong>{job.title}</strong>
            {company?.name && <> · في {company.name}</>}
          </p>
        </header>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(error)}
          </div>
        )}

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-100">
          <form
            action={submitAction}
            encType="multipart/form-data"
            className="space-y-5"
          >
            {/* Honeypot — invisible to humans, bots fill it */}
            <div className="absolute -left-[9999px] w-0 h-0 overflow-hidden" aria-hidden>
              <label htmlFor="website">Website (leave blank)</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="full_name" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                الاسم الكامل <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                placeholder="محمد أحمد علي"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                  الإيميل <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right"
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

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="current_title" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  الوظيفة الحالية
                </label>
                <input
                  id="current_title"
                  name="current_title"
                  type="text"
                  placeholder="Sales Rep في شركة ..."
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                />
              </div>
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

            {/* CV - PDF or paste */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3 font-cairo">
                📄 السيرة الذاتية <span className="text-red-500">*</span>
              </h3>

              <div className="mb-4">
                <label htmlFor="cv_pdf" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  ارفع ملف PDF
                </label>
                <input
                  id="cv_pdf"
                  name="cv_pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-brand-cyan/10 file:text-brand-cyan-dark hover:file:bg-brand-cyan/20 file:cursor-pointer cursor-pointer font-cairo"
                />
                <p className="text-xs text-slate-500 mt-1 font-cairo">
                  PDF فقط · الحد الأقصى 5 MB · يفضّل CV نصي (مش صورة مسحوبة).
                </p>
              </div>

              <div className="text-center text-xs text-slate-400 font-cairo mb-3">
                — أو —
              </div>

              <div>
                <label htmlFor="cv_text" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  الصق نص السيرة الذاتية
                </label>
                <textarea
                  id="cv_text"
                  name="cv_text"
                  rows={8}
                  placeholder="افتح CV-ك → Select All → Copy → الصق هنا"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-mono text-xs leading-relaxed"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cover_letter" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                ليه أنت مناسب للوظيفة دي؟ <span className="text-slate-400 text-xs">— اختياري</span>
              </label>
              <textarea
                id="cover_letter"
                name="cover_letter"
                rows={4}
                placeholder="2-3 جمل عن خبراتك المتعلقة بالوظيفة..."
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo resize-none"
              />
            </div>

            <div className="bg-cyan-50 border border-cyan-200 p-4 rounded-lg text-xs text-slate-700 font-cairo">
              <strong className="text-cyan-700">🤖 شفافية:</strong> لما تقدم،
              نِظام بيستخدم الذكاء الاصطناعي عشان يقرا CV-ك ويوصّل ملخّص ذكي
              للـ HR. الـ HR هو اللي بياخد القرار النهائي.
            </div>

            <div className="flex gap-3 pt-2">
              <SubmitButton
                loadingText="جاري التقديم..."
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
              >
                ✦ قدم دلوقتي
              </SubmitButton>
              <Link
                href={`/jobs/${slug}`}
                className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
              >
                إلغاء
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 font-cairo">
          بالتقديم انت موافق إن بياناتك ووصلت للشركة المعلنة والـ HR بتاعها.
        </p>
      </div>
    </div>
  );
}
