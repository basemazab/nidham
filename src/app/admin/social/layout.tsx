import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// /admin/social — Layout (super-admin gate)
// ============================================================================
//
// Every child route inherits this gate. Anyone who isn't on super_admins
// gets redirected to /dashboard with an error toast. This is the
// "exclusive to Basem" enforcement layer at the route level. RLS on the
// underlying tables (mig 043) is a second wall.

export default async function SocialAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: superAdmin } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!superAdmin) {
    redirect(
      "/dashboard?error=" +
        encodeURIComponent("الصفحة دي للـ Super-Admin فقط"),
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-lg">
              <span className="text-xl">📣</span>
            </div>
            <div>
              <div className="text-lg font-black font-display">Social Growth Suite</div>
              <div className="text-[10px] tracking-widest text-rose-300 font-semibold">
                NIDHAM · أداة Basem للنمو
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1 flex-wrap">
            <SocialNavLink href="/admin/social" label="🏠 الرئيسية" />
            <SocialNavLink href="/admin/social/composer" label="✦ الكاتب" />
            <SocialNavLink href="/admin/social/accounts" label="🔌 الحسابات" />
            <SocialNavLink href="/admin/social/inbox" label="💬 التعليقات" />
            <Link
              href="/admin"
              className="text-xs text-slate-300 hover:text-white font-cairo ml-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition"
            >
              ← لوحة الإدارة
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function SocialNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-xs px-3 py-1.5 rounded-lg text-rose-200 hover:text-white hover:bg-white/10 font-bold font-cairo transition"
    >
      {label}
    </Link>
  );
}
