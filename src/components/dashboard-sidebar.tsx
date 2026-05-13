"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

type Props = {
  userName: string;
  companyName: string;
  userEmail: string;
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠", section: "main" },
  { href: "/dashboard/employees", label: "الموظفين", icon: "👥", section: "main" },
  { href: "/dashboard/attendance", label: "الحضور", icon: "⏰", section: "main" },
  { href: "/dashboard/customers", label: "العملاء", icon: "💼", section: "main" },
  { href: "/dashboard/interactions", label: "التفاعلات", icon: "💬", section: "main" },
  { href: "/dashboard/reports/attendance", label: "تقرير الحضور", icon: "📊", section: "reports" },
  { href: "/dashboard/reports/bridge", label: "Bridge ✦", icon: "✦", section: "reports" },
] as const;

export function DashboardSidebar({ userName, companyName, userEmail }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const mainItems = NAV_ITEMS.filter((i) => i.section === "main");
  const reportItems = NAV_ITEMS.filter((i) => i.section === "reports");

  return (
    <aside className="hidden md:flex w-64 bg-white border-l border-slate-200 flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow-md shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition">
            <span className="text-xl font-black text-white font-display">ن</span>
          </div>
          <div>
            <div className="text-lg font-black font-display bg-gradient-to-r from-brand-cyan-dark to-brand-navy bg-clip-text text-transparent leading-none">
              نِظام
            </div>
            <div className="text-[10px] tracking-widest text-brand-gold font-semibold">
              NIDHAM
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="text-[10px] text-slate-400 font-bold tracking-wider mb-2 px-3 font-cairo uppercase">
          الموديولات
        </div>
        <div className="space-y-1 mb-5">
          {mainItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-cairo text-sm transition ${
                  active
                    ? "bg-brand-cyan/10 text-brand-cyan-dark font-bold border-r-4 border-brand-cyan-dark"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="text-[10px] text-slate-400 font-bold tracking-wider mb-2 px-3 font-cairo uppercase">
          التقارير
        </div>
        <div className="space-y-1">
          {reportItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-cairo text-sm transition ${
                  active
                    ? "bg-amber-50 text-amber-800 font-bold border-r-4 border-amber-500"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User card + Profile + Logout */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <Link
          href="/dashboard/profile"
          className={`block px-3 py-2 rounded-lg transition mb-1 ${
            isActive("/dashboard/profile")
              ? "bg-brand-cyan/10"
              : "hover:bg-slate-100"
          }`}
        >
          <div className="text-[10px] text-brand-gold font-bold tracking-wider mb-1 font-cairo uppercase">
            {companyName}
          </div>
          <div className="text-sm font-bold text-slate-800 font-cairo">{userName}</div>
          <div className="text-xs text-slate-500 truncate font-mono">{userEmail}</div>
          <div className="text-[10px] text-brand-cyan-dark font-cairo font-bold mt-1">
            ⚙ الإعدادات الشخصية ←
          </div>
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="w-full px-3 py-2 text-right text-sm text-red-600 hover:bg-red-50 rounded-lg font-cairo font-medium transition"
          >
            🚪 تسجيل الخروج
          </button>
        </form>
      </div>
    </aside>
  );
}
