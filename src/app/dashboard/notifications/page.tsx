import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listNotifications } from "./actions";
import { NotificationsClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الإشعارات",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ marked?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id")
    .single();

  const notifications = await listNotifications();

  const unreadCount = notifications?.filter((n) => !n.read_at).length ?? 0;

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        {params.marked && (
          <div className="mb-5 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 font-cairo text-emerald-800 flex items-start gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <div className="font-bold">تم التحديث</div>
              <p className="text-sm mt-0.5">{params.marked}</p>
            </div>
          </div>
        )}

        {params.error && (
          <div className="mb-5 bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
            ⚠ {decodeURIComponent(params.error)}
          </div>
        )}

        <header className="flex items-start justify-between gap-3 flex-wrap mb-6">
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-[11px] font-bold mb-2 font-cairo">
              🔔 الإشعارات
            </div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              الإشعارات
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {notifications?.length
                ? `${notifications.length} إشعار · ${unreadCount} غير مقروء`
                : "مفيش إشعارات — هتظهر هنا أول ما يحصل حاجة"}
            </p>
          </div>
        </header>

        <NotificationsClient
          notifications={notifications ?? []}
          profileId={profile?.id ?? ""}
        />
      </div>
    </main>
  );
}
