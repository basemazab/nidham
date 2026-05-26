import { createServiceClient } from "@/lib/supabase/service";
import { SignPad } from "./sign-pad";

// ============================================================================
// /sign/[token] — public signing page (no auth required)
// ============================================================================
//
// The signer opens this from a WhatsApp link, reads the document, draws
// their signature on the canvas, types their name, and submits. All in
// one page, mobile-first.
//
// Auth: NONE — the token in the URL is the access control. Token is a
// 36-char UUID, unguessable. We block expired / signed / cancelled
// requests from showing the signing pad.

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function SignTokenPage({ params }: Props) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from("signature_requests")
    .select(
      "id, title, document_html, recipient_name, status, expires_at, signed_at, companies(name)",
    )
    .eq("token", token)
    .maybeSingle<{
      id: string;
      title: string;
      document_html: string;
      recipient_name: string;
      status: string;
      expires_at: string | null;
      signed_at: string | null;
      companies: { name: string } | null;
    }>();

  if (!request) {
    return (
      <CenterCard>
        <div className="text-5xl mb-3">⚠</div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          اللينك ده مش صحيح
        </h1>
        <p className="text-sm text-slate-600">
          ممكن يكون اتنسخ غلط أو اتلغى. كلم اللي بعت اللينك.
        </p>
      </CenterCard>
    );
  }

  // State checks
  if (request.status === "signed") {
    return (
      <CenterCard>
        <div className="text-5xl mb-3">✓</div>
        <h1 className="text-xl font-bold text-emerald-700 mb-2">
          المستند ده اتوقّع بالفعل
        </h1>
        <p className="text-sm text-slate-600">
          اتوقّع في{" "}
          {request.signed_at
            ? new Date(request.signed_at).toLocaleString("ar-EG")
            : "—"}
        </p>
      </CenterCard>
    );
  }

  if (request.status === "cancelled") {
    return (
      <CenterCard>
        <div className="text-5xl mb-3">🚫</div>
        <h1 className="text-xl font-bold text-rose-700 mb-2">
          طلب التوقيع اتلغى
        </h1>
        <p className="text-sm text-slate-600">
          اللي بعت اللينك ألغى الطلب. تواصل معاه لو محتاج توضيح.
        </p>
      </CenterCard>
    );
  }

  if (
    request.expires_at &&
    new Date(request.expires_at) < new Date()
  ) {
    return (
      <CenterCard>
        <div className="text-5xl mb-3">⏰</div>
        <h1 className="text-xl font-bold text-amber-700 mb-2">
          اللينك انتهت صلاحيته
        </h1>
        <p className="text-sm text-slate-600">
          كلم اللي بعتهولك علشان يبعتلك لينك جديد.
        </p>
      </CenterCard>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 p-4 font-cairo">
      <div className="max-w-2xl mx-auto pt-4">
        <header className="text-center mb-5">
          <div className="text-xs text-violet-700 tracking-widest font-bold uppercase mb-1">
            {request.companies?.name ?? "نِظام"} · توقيع إلكتروني
          </div>
          <h1 className="text-2xl font-black text-slate-800">
            {request.title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            مرحباً {request.recipient_name}، اقرأ المستند ووقّع تحت
          </p>
        </header>

        {/* Document */}
        <article className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <div className="text-xs text-slate-500 mb-3 font-bold uppercase tracking-wider">
            📄 المستند
          </div>
          <div className="text-slate-800 leading-loose whitespace-pre-wrap text-sm">
            {request.document_html}
          </div>
        </article>

        {/* Sign pad (client) */}
        <SignPad
          token={token}
          defaultName={request.recipient_name}
        />

        <div className="text-center mt-6 text-[10px] text-slate-400">
          نِظام · توقيع إلكتروني آمن · IP والوقت بيتسجّلوا للتوثيق
        </div>
      </div>
    </main>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-cairo">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {children}
      </div>
    </main>
  );
}
