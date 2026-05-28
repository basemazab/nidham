import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { cancelSignatureRequest } from "../actions";

// ============================================================================
// /dashboard/signatures/[id] — view a signed/pending signature request
// ============================================================================

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type RequestDetail = {
  id: string;
  title: string;
  document_html: string;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  token: string;
  status: string;
  expires_at: string | null;
  signed_at: string | null;
  created_at: string;
  employees: { full_name: string } | null;
};

type Capture = {
  id: string;
  signer_name: string;
  signature_png_data_url: string;
  signer_ip: string | null;
  signer_user_agent: string | null;
  signed_at: string;
};

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nidhamhr.com"
  ).replace(/\/$/, "");
}

export default async function SignatureDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getMyProfile();
  const companyId = profile?.company_id ?? "";

  const { data: request } = await supabase
    .from("signature_requests")
    .select(
      "id, title, document_html, recipient_name, recipient_phone, recipient_email, token, status, expires_at, signed_at, created_at, employees(full_name)",
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle<RequestDetail>();

  if (!request) notFound();

  // Pull capture if signed
  const { data: captureData } = await supabase
    .from("signature_captures")
    .select(
      "id, signer_name, signature_png_data_url, signer_ip, signer_user_agent, signed_at",
    )
    .eq("request_id", request.id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle<Capture>();

  const capture = captureData;
  const baseUrl = getBaseUrl();
  const signUrl = `${baseUrl}/sign/${request.token}`;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen print:bg-white print:px-2">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 print:hidden">
          <Link
            href="/dashboard/signatures"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للقائمة
          </Link>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3 mb-5 print:mb-3">
          <div>
            <div className="text-xs text-slate-500 font-cairo mb-1 print:hidden">
              طلب توقيع #{request.id.slice(0, 8)}
            </div>
            <h1 className="text-3xl font-black font-cairo text-slate-800">
              {request.title}
            </h1>
            <div className="text-sm text-slate-500 mt-1 font-cairo">
              للمستلم: <strong>{request.recipient_name}</strong>
              {request.employees?.full_name && (
                <span> · موظف: {request.employees.full_name}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              data-print="1"
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm font-cairo transition"
            >
              🖨 طباعة
            </button>
            {request.status === "pending" && (
              <form action={cancelSignatureRequest}>
                <input type="hidden" name="id" value={request.id} />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-sm font-cairo transition"
                >
                  ✕ إلغاء الطلب
                </button>
              </form>
            )}
          </div>
        </header>

        {/* Status + sign URL */}
        {request.status === "pending" && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-4 print:hidden">
            <div className="text-xs text-amber-700 font-bold uppercase tracking-wider mb-2 font-cairo">
              ⏳ منتظر التوقيع
            </div>
            <div className="text-sm text-amber-900 font-cairo mb-2">
              ابعت اللينك ده للمستلم — لما يفتحه، يقرأ المستند، ويوقّع بإصبعه.
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="flex-1 bg-white px-3 py-2 rounded-lg border border-amber-300 text-xs font-mono break-all" dir="ltr">
                {signUrl}
              </code>
              {request.recipient_phone && (
                <a
                  href={`https://wa.me/${request.recipient_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `أهلاً ${request.recipient_name}، عندي مستند محتاج توقيعك:\n${request.title}\n\nاضغط هنا واوقّع: ${signUrl}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold font-cairo transition whitespace-nowrap"
                >
                  💬 واتساب
                </a>
              )}
            </div>
          </div>
        )}

        {/* Document */}
        <article className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4 print:shadow-none print:border-0">
          <div className="text-xs text-slate-500 mb-3 font-bold uppercase tracking-wider print:hidden">
            📄 محتوى المستند
          </div>
          <div className="text-slate-800 leading-loose whitespace-pre-wrap text-sm font-cairo">
            {request.document_html}
          </div>
        </article>

        {/* Signature (if signed) */}
        {capture && (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 print:bg-white print:border-0 print:p-0 print:shadow-none">
            <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider mb-3 font-cairo print:hidden">
              ✓ التوقيع المسجّل
            </div>
            <div className="bg-white rounded-xl p-4 mb-3 border border-emerald-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capture.signature_png_data_url}
                alt="Signature"
                className="max-h-32 mx-auto"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-cairo text-slate-700">
              <div>
                <span className="text-slate-500">الموقّع:</span>{" "}
                <strong>{capture.signer_name}</strong>
              </div>
              <div>
                <span className="text-slate-500">الوقت:</span>{" "}
                <strong>
                  {new Date(capture.signed_at).toLocaleString("ar-EG")}
                </strong>
              </div>
              {capture.signer_ip && (
                <div className="font-mono text-[10px]" dir="ltr">
                  <span className="text-slate-500">IP:</span> {capture.signer_ip}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <script
         
        dangerouslySetInnerHTML={{
          __html: `document.querySelector('[data-print="1"]')?.addEventListener('click', () => window.print());`,
        }}
      />
    </main>
  );
}
