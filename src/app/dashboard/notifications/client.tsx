"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markAsRead, markAllAsRead, deleteNotification, clearAllRead } from "./actions";
import Link from "next/link";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

interface Props {
  notifications: Notification[];
  profileId: string;
}

const TYPE_ICONS: Record<string, string> = {
  general: "🔔", warning: "⚠️", success: "✅", error: "❌",
  info: "ℹ️", leave: "🏖", payroll: "💰", attendance: "⏰", advance: "💵",
};

export function NotificationsClient({ notifications, profileId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  if (!profileId) return null;

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleMarkRead = async (id: string) => {
    setLoading(id);
    await markAsRead(id);
    setLoading(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف الإشعار؟")) return;
    setLoading(id);
    await deleteNotification(id);
    setLoading(null);
    router.refresh();
  };

  if (notifications.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
        <div className="text-6xl mb-4">🔔</div>
        <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">مفيش إشعارات</h2>
        <p className="text-slate-500 mb-2 font-cairo">
          هتظهر هنا أول ما يحصل حاجة — زي الموافقة على طلبات أو تشغيل قواعد الأتمتة
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-block px-3 py-1.5 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan-dark text-sm font-bold font-cairo">
            {unreadCount} إشعار غير مقروء
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={async () => { await markAllAsRead(); router.refresh(); }}
              className="px-4 py-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 text-brand-cyan-dark font-bold hover:bg-brand-cyan/10 transition font-cairo text-sm"
            >
              ✅ تحديد الكل كمقروء
            </button>
            <button type="button" onClick={async () => { await clearAllRead(); router.refresh(); }}
              className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold hover:bg-red-100 transition font-cairo text-sm"
            >
              🗑 حذف المقروء
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo w-14">النوع</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">العنوان</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo hidden md:table-cell">المحتوى</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo hidden sm:table-cell">التاريخ</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo w-20">الحالة</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notifications.map((n) => {
                const isUnread = !n.read_at;
                const isLoading = loading === n.id;
                return (
                  <tr key={n.id}
                    className={`transition cursor-pointer ${isUnread ? "bg-cyan-50/40 hover:bg-cyan-50/80" : "hover:bg-slate-50"}`}
                    onClick={() => isUnread && handleMarkRead(n.id)}
                  >
                    <td className="px-4 py-4 text-center">
                      <span className="text-xl">{TYPE_ICONS[n.type] ?? TYPE_ICONS.general}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-cairo text-sm ${isUnread ? "font-bold text-slate-800" : "text-slate-500"}`}>
                          {n.title}
                        </span>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-brand-cyan-dark shrink-0" />}
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <p className={`text-sm line-clamp-2 ${isUnread ? "text-slate-600" : "text-slate-400"}`}>{n.body}</p>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell whitespace-nowrap">
                      <span className="text-sm text-slate-400 font-cairo">
                        {new Date(n.created_at).toLocaleDateString("ar-EG", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {isUnread ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold border bg-cyan-50 text-cyan-700 border-cyan-200 font-cairo">جديد</span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold border bg-slate-50 text-slate-400 border-slate-200 font-cairo">مقروء</span>
                      )}
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {n.link_url && (
                          <Link href={n.link_url} className="p-1.5 rounded-lg hover:bg-brand-cyan/10 text-slate-400 hover:text-brand-cyan-dark transition" title="فتح الرابط">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        )}
                        {isUnread && (
                          <button type="button" onClick={() => handleMarkRead(n.id)} disabled={isLoading}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition disabled:opacity-50" title="تحديد كمقروء"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <button type="button" onClick={() => handleDelete(n.id)} disabled={isLoading}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition disabled:opacity-50" title="حذف"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center font-cairo">
        الإشعارات بتتحذف تلقائياً بعد 30 يوم
      </p>
    </div>
  );
}
