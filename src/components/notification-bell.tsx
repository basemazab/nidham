"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  link_url: string | null;
  created_at: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const fetch = async () => {
      try {
        const { data } = await supabase
          .from("notifications")
          .select("*")
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(5);
        if (!cancelled && data) setNotifications(data);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  const unreadCount = notifications.length;

  if (!enabled) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="الإشعارات"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-3 border-b border-gray-100 dark:border-gray-700">
              <h4 className="font-semibold text-sm">الإشعارات</h4>
            </div>
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                لا توجد إشعارات جديدة
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link_url || "#"}
                    onClick={() => setOpen(false)}
                    className="block p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                  >
                    <p className="text-sm font-medium line-clamp-1">{n.title}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.body}</p>
                  </Link>
                ))}
              </div>
            )}
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="block p-3 text-center text-xs text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-b-xl border-t border-gray-100 dark:border-gray-700"
            >
              عرض الكل
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
