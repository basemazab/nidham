"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

type Props = {
  userName: string;
  companyName: string;
  userEmail: string;
  isSuperAdmin?: boolean;
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠", section: "main" },
  { href: "/dashboard/employees", label: "الموظفين", icon: "👥", section: "main" },
  { href: "/dashboard/attendance", label: "الحضور", icon: "⏰", section: "main" },
  { href: "/dashboard/payroll", label: "الرواتب", icon: "💰", section: "main" },
  { href: "/dashboard/requests", label: "طلبات الموظفين", icon: "📨", section: "main" },
  { href: "/dashboard/jobs", label: "التوظيف ✦", icon: "🎯", section: "main" },
  { href: "/dashboard/customers", label: "العملاء", icon: "💼", section: "main" },
  { href: "/dashboard/interactions", label: "التفاعلات", icon: "💬", section: "main" },
  { href: "/dashboard/contracts", label: "العقود", icon: "📋", section: "main" },
  { href: "/dashboard/team", label: "فريق الشركة", icon: "🤝", section: "main" },
  { href: "/dashboard/ai", label: "المساعد الذكي ✦", icon: "🤖", section: "ai" },
  { href: "/dashboard/reports/attendance", label: "تقرير الحضور", icon: "📊", section: "reports" },
  { href: "/dashboard/reports/bridge", label: "Bridge ✦", icon: "✦", section: "reports" },
  { href: "/dashboard/settings/office-location", label: "موقع المكتب 📍", icon: "⚙", section: "settings" },
] as const;

export function DashboardSidebar({ userName, companyName, userEmail, isSuperAdmin }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const mainItems = NAV_ITEMS.filter((i) => i.section === "main");
  const aiItems = NAV_ITEMS.filter((i) => i.section === "ai");
  const reportItems = NAV_ITEMS.filter((i) => i.section === "reports");
  const settingsItems = NAV_ITEMS.filter((i) => i.section === "settings");

  const NavSection = ({ label, items }: { label: string; items: typeof NAV_ITEMS[number][] }) => (
    <>
      <div className="text-[10px] text-slate-400 font-bold tracking-wider mb-2 px-3 font-cairo uppercase">
        {label}
      </div>
      <div className="space-y-1 mb-5">
        {items.map((item) => {
          const active = isActive(item.href);
          const isReport = item.section === "reports";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-cairo text-sm transition ${
                active
                  ? isReport
                    ? "bg-amber-50 text-amber-800 font-bold border-r-4 border-amber-500"
                    : "bg-brand-cyan/10 text-brand-cyan-dark font-bold border-r-4 border-brand-cyan-dark"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );

  const UserFooter = () => (
    <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-1">
      {isSuperAdmin && (
        <Link
          href="/admin"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 text-amber-800 font-cairo text-sm font-bold hover:from-amber-100 hover:to-yellow-100 transition"
        >
          <span>👑</span>
          <span>Super Admin Panel</span>
        </Link>
      )}
      <Link
        href="/dashboard/subscription"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition font-cairo text-sm ${
          isActive("/dashboard/subscription")
            ? "bg-amber-50 text-amber-700 font-bold"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <span>💎</span>
        <span>خطتك واشتراكك</span>
      </Link>
      <Link
        href="/dashboard/profile"
        className={`block px-3 py-2 rounded-lg transition ${
          isActive("/dashboard/profile") ? "bg-brand-cyan/10" : "hover:bg-slate-100"
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
  );

  const Logo = () => (
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
  );

  return (
    <>
      {/* Mobile top bar — visible only on small screens */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <Logo />
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="القائمة"
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
        >
          {mobileOpen ? (
            <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed top-0 right-0 bottom-0 w-72 bg-white z-50 flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
                aria-label="إغلاق"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <NavSection label="الموديولات" items={[...mainItems]} />
              <NavSection label="✦ ذكاء" items={[...aiItems]} />
              <NavSection label="التقارير" items={[...reportItems]} />
              <NavSection label="الإعدادات" items={[...settingsItems]} />
            </nav>
            <UserFooter />
          </aside>
        </>
      )}

      {/* Desktop sidebar — visible on md+ */}
      <aside className="hidden md:flex w-64 bg-white border-l border-slate-200 flex-col shrink-0">
        <div className="p-5 border-b border-slate-100">
          <Logo />
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <NavSection label="الموديولات" items={[...mainItems]} />
          <NavSection label="✦ ذكاء" items={[...aiItems]} />
          <NavSection label="التقارير" items={[...reportItems]} />
        </nav>
        <UserFooter />
      </aside>
    </>
  );
}
