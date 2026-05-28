"use client";

import { Shield, Smartphone, Users, AlertTriangle, Clock, CheckCircle, XCircle, LogIn } from "lucide-react";
import Link from "next/link";

interface SecurityEvent {
  id: string;
  event_type: string;
  ip_address: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface Props {
  activeSessions: number;
  failedLogins: number;
  twoFactorEnabled: boolean;
  customRoles: number;
  recentEvents: SecurityEvent[];
  userName: string;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  login_success: <LogIn className="h-4 w-4 text-green-500" />,
  login_fail: <XCircle className="h-4 w-4 text-red-500" />,
  password_change: <Shield className="h-4 w-4 text-amber-500" />,
  suspicious_ip: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

const EVENT_LABELS: Record<string, string> = {
  login_success: "تسجيل دخول ناجح",
  login_fail: "محاولة دخول فاشلة",
  password_change: "تغيير كلمة السر",
  suspicious_ip: "IP مشبوه",
};

export function SecurityDashboardClient({
  activeSessions,
  failedLogins,
  twoFactorEnabled,
  customRoles,
  recentEvents,
  userName,
}: Props) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">الأمان والحماية</h1>
        <p className="text-muted-foreground text-sm mt-1">
          راقب نشاط الحساب وصلاحيات الفريق
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">الجلسات النشطة</p>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-600">{activeSessions}</p>
          <Link href="/dashboard/security/sessions" className="text-xs text-cyan-600 hover:underline mt-1 block">
            عرض الجلسات ←
          </Link>
        </div>

        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">التحقق بخطوتين</p>
            <Smartphone className="h-4 w-4 text-purple-500" />
          </div>
          <p className={`mt-1 text-2xl font-bold ${twoFactorEnabled ? "text-green-600" : "text-amber-600"}`}>
            {twoFactorEnabled ? "مفعل" : "غير مفعل"}
          </p>
          {!twoFactorEnabled && (
            <Link href="/dashboard/profile/2fa" className="text-xs text-cyan-600 hover:underline mt-1 block">
              تفعيل الآن ←
            </Link>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">محاولات فاشلة (30 يوم)</p>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className={`mt-1 text-2xl font-bold ${failedLogins > 10 ? "text-red-600" : "text-amber-600"}`}>
            {failedLogins}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">الأدوار المخصصة</p>
            <Users className="h-4 w-4 text-cyan-500" />
          </div>
          <p className="mt-1 text-2xl font-bold text-cyan-600">{customRoles}</p>
          <Link href="/dashboard/security/roles" className="text-xs text-cyan-600 hover:underline mt-1 block">
            إدارة الأدوار ←
          </Link>
        </div>
      </div>

      {/* Security Checklist */}
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
        <h3 className="mb-4 font-semibold">قائمة التحقق الأمني</h3>
        <div className="space-y-3">
          {[
            {
              label: "تفعيل التحقق بخطوتين (2FA)",
              done: twoFactorEnabled,
              link: "/dashboard/profile/2fa",
            },
            {
              label: "كلمة سر قوية (أكثر من 12 حرف)",
              done: true,
              link: "/dashboard/profile",
            },
            {
              label: "مراجعة الجلسات النشطة",
              done: activeSessions <= 3,
              link: "/dashboard/security/sessions",
            },
            {
              label: "تحديد صلاحيات الأدوار",
              done: customRoles > 0,
              link: "/dashboard/security/roles",
            },
            {
              label: "تفعيل سجل التدقيق (Audit Log)",
              done: true,
              link: "/dashboard/audit-log",
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.done ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">{item.label}</span>
              </div>
              {!item.done && (
                <Link href={item.link} className="text-xs text-cyan-600 hover:underline">
                  إصلاح
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Security Events */}
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
        <h3 className="mb-4 font-semibold">أحداث أمنية حديثة</h3>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">لا توجد أحداث أمنية</p>
        ) : (
          <div className="space-y-2">
            {recentEvents.slice(0, 10).map((event) => (
              <div key={event.id} className="flex items-center gap-3 py-2 text-sm">
                {EVENT_ICONS[event.event_type] ?? <Shield className="h-4 w-4 text-slate-400" />}
                <span className="flex-1">
                  {EVENT_LABELS[event.event_type] ?? event.event_type}
                </span>
                {event.ip_address && (
                  <span className="text-xs text-slate-400 font-mono">{event.ip_address}</span>
                )}
                <span className="text-xs text-slate-400">
                  {new Date(event.created_at).toLocaleString("ar-EG")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
