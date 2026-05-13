import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Summary = {
  id: string;
  job_title: string;
  applied_at: string;
  candidate_name: string;
};

export const dynamic = "force-dynamic";

export default async function AppliedPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc(
    "get_public_application_summary",
    { p_app_id: id },
  );

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    notFound();
  }

  const row = (Array.isArray(data) ? data[0] : data) as Summary;

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 sm:p-10 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center mx-auto mb-5 shadow-md">
          <span className="text-4xl">✅</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black font-cairo text-slate-800 mb-2">
          استلمنا طلبك يا {row.candidate_name.split(" ")[0]}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 font-cairo mb-6 leading-relaxed">
          تم تقديمك على وظيفة <strong>{row.job_title}</strong>.
          <br />
          الـ AI بدأ يحلل CV-ك دلوقتي، والـ HR هيتواصل معاك لو كنت مناسب.
        </p>

        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-sm text-slate-700 font-cairo mb-6 text-right">
          <strong className="text-cyan-700">رقم الطلب:</strong>
          <code className="font-mono text-xs mr-2 bg-white px-2 py-0.5 rounded border border-slate-200" dir="ltr">
            {row.id.slice(0, 8).toUpperCase()}
          </code>
          <br />
          <strong className="text-cyan-700">تاريخ التقديم:</strong>{" "}
          {new Date(row.applied_at).toLocaleString("ar-EG")}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/jobs"
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-md hover:shadow-lg transition font-cairo"
          >
            تصفح وظائف تانية
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
          >
            الرئيسية
          </Link>
        </div>

        <p className="text-xs text-slate-400 mt-6 font-cairo">
          خد screenshot للصفحة دي عشان تحتفظ برقم طلبك.
        </p>
      </div>
    </div>
  );
}
