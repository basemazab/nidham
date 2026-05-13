import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CopyButton } from "@/components/copy-button";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Invitation = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "manager" | "employee";
  token: string;
  status: string;
  expires_at: string;
};

const ROLE_LABELS: Record<Invitation["role"], string> = {
  admin: "مدير",
  manager: "مشرف",
  employee: "موظف",
};

export default async function InvitedPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: invitation } = await supabase
    .from("team_invitations")
    .select("id, email, full_name, role, token, status, expires_at")
    .eq("id", id)
    .single<Invitation>();

  if (!invitation) notFound();

  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const acceptUrl = `${protocol}://${host}/accept-invite/${invitation.token}`;

  const whatsappMessage = encodeURIComponent(
    `أهلًا ${invitation.full_name ?? ""}،\n\nأنا ضفتك في نِظام (نظام إدارة الشركة الجديد).\n\nاضغط اللينك ده عشان تعمل حساب وتدخل بصلاحية ${ROLE_LABELS[invitation.role]}:\n\n${acceptUrl}\n\n(اللينك صالح لمدة 7 أيام)`,
  );
  const whatsappLink = `https://wa.me/?text=${whatsappMessage}`;

  const emailSubject = encodeURIComponent("دعوة للانضمام في نِظام");
  const emailBody = encodeURIComponent(
    `أهلًا ${invitation.full_name ?? ""}،\n\nتم دعوتك للانضمام لشركتنا على نِظام بصلاحية ${ROLE_LABELS[invitation.role]}.\n\nاضغط اللينك ده عشان تعمل حسابك:\n${acceptUrl}\n\n(اللينك صالح لمدة 7 أيام)`,
  );
  // Open Gmail web compose directly (works for any user with a Gmail account,
  // no need for a desktop mail client to be configured).
  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invitation.email)}&su=${emailSubject}&body=${emailBody}`;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard/team" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع لصفحة الفريق
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✦</div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            الدعوة جاهزة!
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            ابعت اللينك ده لـ <strong>{invitation.full_name ?? invitation.email}</strong>
          </p>
        </div>

        <section className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 mb-6">
          <h2 className="text-sm font-bold font-cairo text-slate-700 mb-2">
            🔗 لينك الدعوة
          </h2>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs break-all text-slate-700 mb-4">
            {acceptUrl}
          </div>
          <p className="text-xs text-slate-500 font-cairo mb-4">
            ⏰ صالح لمدة 7 أيام · 👤 الصلاحية: <strong>{ROLE_LABELS[invitation.role]}</strong> · 📧 للإيميل: <strong className="font-mono">{invitation.email}</strong>
          </p>

          <div className="grid md:grid-cols-3 gap-3">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition font-cairo"
            >
              <span>💬</span>
              <span>واتساب</span>
            </a>
            <a
              href={gmailLink}
              target="_blank"
              rel="noopener"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shadow-md transition font-cairo"
            >
              <span>✉️</span>
              <span>Gmail</span>
            </a>
            <CopyButton
              text={acceptUrl}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
              copiedClassName="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 text-emerald-700 font-bold transition font-cairo"
            />
          </div>
        </section>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 font-cairo">
          <strong>📌 ملاحظة:</strong> العضو لازم يستخدم نفس الإيميل <span className="font-mono">{invitation.email}</span> عشان يقبل الدعوة. لو سجّل بإيميل تاني، هيتعمله شركة جديدة بدل ما يدخل شركتك.
        </div>
      </div>
    </main>
  );
}
