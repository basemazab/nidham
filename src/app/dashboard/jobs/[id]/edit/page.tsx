import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateJob } from "../../actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type Job = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
  job_type: string;
  location: string | null;
  remote_ok: boolean;
  salary_min: number | null;
  salary_max: number | null;
  experience_years_min: number | null;
  status: "draft" | "open" | "closed" | "filled" | "cancelled";
  is_public: boolean;
};

export default async function EditJobPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single<Job>();

  if (!job) notFound();

  const updateAction = updateJob.bind(null, id);

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/dashboard/jobs/${id}`}
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للوظيفة
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            تعديل الوظيفة
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            لو غيّرت المتطلبات، يفضل تعيد تشغيل الـ AI على المتقدمين الحاليين.
          </p>
        </header>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(error)}
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <form action={updateAction} className="space-y-5">
            <div>
              <label htmlFor="title" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                المسمى الوظيفي <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                defaultValue={job.title}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">القسم</label>
                <input
                  id="department"
                  name="department"
                  type="text"
                  defaultValue={job.department ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                />
              </div>
              <div>
                <label htmlFor="job_type" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">نوع الوظيفة</label>
                <select
                  id="job_type"
                  name="job_type"
                  defaultValue={job.job_type}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                >
                  <option value="full_time">دوام كامل</option>
                  <option value="part_time">دوام جزئي</option>
                  <option value="contract">عقد</option>
                  <option value="internship">تدريب</option>
                  <option value="remote">Remote</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">المكان</label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  defaultValue={job.location ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                />
              </div>
              <div>
                <label htmlFor="experience_years_min" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الحد الأدنى للخبرة (سنين)</label>
                <input
                  id="experience_years_min"
                  name="experience_years_min"
                  type="number"
                  min="0"
                  max="40"
                  defaultValue={job.experience_years_min ?? 0}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="salary_min" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">المرتب من (جنيه)</label>
                <input
                  id="salary_min"
                  name="salary_min"
                  type="number"
                  min="0"
                  step="100"
                  defaultValue={job.salary_min ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="salary_max" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">المرتب إلى (جنيه)</label>
                <input
                  id="salary_max"
                  name="salary_max"
                  type="number"
                  min="0"
                  step="100"
                  defaultValue={job.salary_max ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 rounded-lg p-4 border border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="remote_ok"
                  defaultChecked={job.remote_ok}
                  className="w-4 h-4 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
                />
                <span className="text-sm text-slate-700 font-cairo">يقبل العمل عن بُعد</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_public"
                  defaultChecked={job.is_public}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
                />
                <span className="text-sm text-slate-700 font-cairo">
                  <strong>منشورة على بورتال نِظام العام ✦</strong>
                  <br />
                  <span className="text-xs text-slate-500">
                    أي حد يقدر يشوف ويقدّم بدون تسجيل دخول.
                  </span>
                </span>
              </label>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">نظرة عامة عن الوظيفة</label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={job.description ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo resize-none"
                />
              </div>

              <div>
                <label htmlFor="requirements" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">المتطلبات (Must Have)</label>
                <textarea
                  id="requirements"
                  name="requirements"
                  rows={5}
                  defaultValue={job.requirements ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo resize-none"
                />
              </div>

              <div>
                <label htmlFor="responsibilities" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">المسؤوليات</label>
                <textarea
                  id="responsibilities"
                  name="responsibilities"
                  rows={4}
                  defaultValue={job.responsibilities ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo resize-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الحالة</label>
              <select
                id="status"
                name="status"
                defaultValue={job.status}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
              >
                <option value="draft">مسودة</option>
                <option value="open">مفتوحة</option>
                <option value="closed">مغلقة</option>
                <option value="filled">تم التعيين</option>
                <option value="cancelled">ملغية</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
              >
                حفظ التعديلات
              </button>
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
