"use client";

import { useRouter } from "next/navigation";
import { Smartphone, Monitor, Globe, Trash2, Clock } from "lucide-react";

interface Session {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  is_current: boolean;
  last_active_at: string;
  created_at: string;
  expires_at: string;
}

interface Props {
  sessions: Session[];
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  mobile: <Smartphone className="h-4 w-4" />,
  tablet: <Smartphone className="h-4 w-4" />,
  desktop: <Monitor className="h-4 w-4" />,
};

export function SessionsClient({ sessions }: Props) {
  const router = useRouter();

  async function revokeSession(sessionId: string) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.from("user_sessions").delete().eq("id", sessionId);
    router.refresh();
  }

  async function revokeAllSessions() {
    if (!confirm("هل أنت متأكد من إنهاء جميع الجلسات الأخرى؟")) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.from("user_sessions").delete().neq("is_current", true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الجلسات النشطة</h1>
          <p className="text-muted-foreground text-sm mt-1">
            جميع الأجهزة المتصلة بحسابك حالياً
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={revokeAllSessions}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            إنهاء الكل
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Globe className="mx-auto mb-4 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">لا توجد جلسات نشطة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`rounded-xl border bg-white p-4 dark:bg-slate-900 ${
                session.is_current ? "ring-2 ring-cyan-500" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800">
                    {DEVICE_ICONS[session.device_type ?? ""] ?? <Monitor className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {session.browser || "متصفح"} {session.os ? `- ${session.os}` : ""}
                      </span>
                      {session.is_current && (
                        <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                          هذه الجلسة
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {session.ip_address && <span>IP: {session.ip_address}</span>}
                      {session.country && <span>{session.city ? `${session.city}, ` : ""}{session.country}</span>}
                      <span>
                        <Clock className="inline h-3 w-3 ml-1" />
                        آخر نشاط: {new Date(session.last_active_at).toLocaleString("ar-EG")}
                      </span>
                      <span>ينتهي: {new Date(session.expires_at).toLocaleDateString("ar-EG")}</span>
                    </div>
                  </div>
                </div>
                {!session.is_current && (
                  <button
                    onClick={() => revokeSession(session.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="إنهاء الجلسة"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
