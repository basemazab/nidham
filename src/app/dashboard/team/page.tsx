import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createInvitation,
  cancelInvitation,
  resendInvitation,
  removeMember,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type SearchParams = Promise<{ error?: string; deleted?: string }>;

type Member = {
  id: string;
  full_name: string | null;
  role: "admin" | "manager" | "employee";
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "manager" | "employee";
  status: "pending" | "accepted" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
};

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<Member["role"], string> = {
  admin: "مدير",
  manager: "مشرف",
  employee: "موظف",
};

const ROLE_DESCRIPTIONS: Record<Member["role"], string> = {
  admin: "صلاحيات كاملة + دعوة موظفين",
  manager: "يقدر يعدّل البيانات بس مش الإعدادات",
  employee: "قراءة فقط لبياناته",
};

const STATUS_LABELS: Record<Invitation["status"], { text: string; classes: string }> = {
  pending: { text: "في انتظار القبول", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  accepted: { text: "مقبولة", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expired: { text: "منتهية", classes: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelled: { text: "ملغية", classes: "bg-red-50 text-red-700 border-red-200" },
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  const isAdmin = myProfile?.role === "admin";

  const [membersRes, invitationsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("company_id", myProfile?.company_id)
      .order("created_at", { ascending: true })
      .returns<Member[]>(),
    supabase
      .from("team_invitations")
      .select("id, email, full_name, role, status, created_at, expires_at")
      .order("created_at", { ascending: false })
      .returns<Invitation[]>(),
  ]);

  const members = membersRes.data ?? [];
  const invitations = invitationsRes.data ?? [];
  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            فريق الشركة
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            {members.length} عضو · {pendingInvitations.length} دعوة في انتظار القبول
          </p>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(error)}
          </div>
        )}

        {/* Invite form — admins only */}
        {isAdmin && (
          <section className="bg-gradient-to-br from-cyan-50 to-white border-2 border-brand-cyan/30 p-6 rounded-2xl mb-8">
            <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
              ✦ ادعو عضو جديد
            </h2>
            <p className="text-xs text-slate-600 mb-4 font-cairo">
              املا البيانات، النظام هيعملك لينك دعوة تبعته على واتساب
            </p>

            <form action={createInvitation} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
                    إيميل العضو <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="employee@company.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
                    اسمه (اختياري)
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    placeholder="اسم العضو"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
                    الصلاحية <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="role"
                    defaultValue="employee"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                  >
                    <option value="employee">👤 موظف</option>
                    <option value="manager">⚙️ مشرف</option>
                    <option value="admin">👑 مدير</option>
                  </select>
                </div>
              </div>

              <SubmitButton
                loadingText="جاري إنشاء الدعوة..."
                className="w-full md:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-md hover:shadow-lg transition font-cairo"
              >
                ابعت دعوة ✦
              </SubmitButton>
            </form>

            <div className="mt-5 pt-5 border-t border-cyan-200/60 grid grid-cols-3 gap-3 text-xs text-slate-600 font-cairo">
              <div>
                <strong className="block text-slate-800">👤 موظف</strong>
                {ROLE_DESCRIPTIONS.employee}
              </div>
              <div>
                <strong className="block text-slate-800">⚙️ مشرف</strong>
                {ROLE_DESCRIPTIONS.manager}
              </div>
              <div>
                <strong className="block text-slate-800">👑 مدير</strong>
                {ROLE_DESCRIPTIONS.admin}
              </div>
            </div>
          </section>
        )}

        {/* Active members */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-bold font-cairo text-slate-700">
              الأعضاء الحاليين ({members.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {members.map((m) => {
              // Admins can remove anyone EXCEPT themselves. Self-removal
              // would lock the admin out of their own tenant with no
              // recovery path — refuse it both client-side (hide the
              // button) and server-side (action throws).
              const canRemove = isAdmin && m.id !== user.id;
              return (
                <div key={m.id} className="px-5 py-4 flex items-center gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white font-bold shrink-0">
                    {(m.full_name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 font-cairo">
                      {m.full_name ?? "بدون اسم"}
                      {m.id === user.id && (
                        <span className="text-xs text-slate-400 font-normal mx-2">(أنت)</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-cairo">
                      {ROLE_LABELS[m.role]} · انضم {new Date(m.created_at).toLocaleDateString("ar-EG")}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full border font-cairo ${
                      m.role === "admin"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : m.role === "manager"
                          ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {ROLE_LABELS[m.role]}
                  </span>
                  {canRemove && (
                    <form action={removeMember}>
                      <input type="hidden" name="member_id" value={m.id} />
                      <ConfirmSubmitButton
                        label="🗑 حذف"
                        message={`هتحذف "${m.full_name ?? "العضو"}" من فريق الشركة. مش هيقدر يدخل النظام تاني — لو حابب ترجّعه لازم تبعتله دعوة جديدة.`}
                        confirmLabel="نعم احذفه"
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold font-cairo border border-red-200 cursor-pointer"
                      />
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold font-cairo text-slate-700">
                الدعوات ({invitations.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {invitations.map((inv) => {
                const status = STATUS_LABELS[inv.status];
                return (
                  <div key={inv.id} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                      ✉
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 font-cairo truncate">
                        {inv.full_name ?? inv.email}
                      </div>
                      <div className="text-xs text-slate-500 font-mono truncate">
                        {inv.email} · {ROLE_LABELS[inv.role]}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-cairo whitespace-nowrap ${status.classes}`}>
                      {status.text}
                    </span>
                    {isAdmin && inv.status === "pending" && (
                      <>
                        <Link
                          href={`/dashboard/team/invited/${inv.id}`}
                          className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold whitespace-nowrap"
                        >
                          عرض اللينك
                        </Link>
                        <form
                          action={async () => {
                            "use server";
                            await cancelInvitation(inv.id);
                          }}
                        >
                          <ConfirmSubmitButton
                            label="إلغاء"
                            message={`هتلغي الدعوة المرسلة لـ "${inv.email}". مش هيقدر يستخدم اللينك تاني.`}
                            confirmLabel="نعم ألغِها"
                            className="text-xs text-red-500 hover:text-red-700 font-cairo cursor-pointer"
                          />
                        </form>
                      </>
                    )}
                    {isAdmin && (inv.status === "expired" || inv.status === "cancelled") && (
                      <form
                        action={async () => {
                          "use server";
                          await resendInvitation(inv.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold"
                        >
                          إعادة إرسال
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
