"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { TierBadge } from "@/components/tier-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { hasFeature, type Plan, type Feature } from "@/lib/subscriptions";

type Role = "admin" | "manager" | "employee";

type Props = {
  userName: string;
  companyName: string;
  userEmail: string;
  isSuperAdmin?: boolean;
  role?: Role;
  plan?: Plan | null;
  daysLeft?: number;
  /**
   * Per-tenant feature flag overrides (mig 041). When a feature is
   * explicitly disabled in this map, the corresponding nav item is
   * HIDDEN entirely (vs. the old behavior of showing it with a 🔒).
   * Lets super-admin sculpt the dashboard for "Marketing-only" or
   * "HR-only" customers.
   */
  featureOverrides?: Partial<Record<Feature, boolean>>;
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  section: "main" | "ai" | "reports" | "settings";
  // Roles that may see + click this item. Defaults to HR (admin + manager).
  // Settings + team management are admin-only.
  visibleTo?: Role[];
  // Subscription feature gate. ALL business items have one now so the
  // super-admin can hide modules per-tenant via Migration-041 overrides.
  // Items with feature=undefined are always visible (dashboard home,
  // forms hub, etc.). The render below decides between "lock icon"
  // (tier-locked) and "hide entirely" (explicit override=false).
  feature?: Feature;
};

const NAV_ITEMS: readonly NavItem[] = [
  // Always-visible essentials
  { href: "/dashboard", label: "الرئيسية", icon: "🏠", section: "main" },

  // Core HR (gated on individual features so super-admin can sell
  // an "HR-only" or "Marketing-only" package)
  { href: "/dashboard/employees", label: "الموظفين", icon: "👥", section: "main", feature: "employees" },
  { href: "/dashboard/org-chart", label: "الهيكل التنظيمي 🌳", icon: "🌳", section: "main", feature: "employees" },
  { href: "/dashboard/team-calendar", label: "تقويم الإجازات 📅", icon: "📅", section: "main", feature: "requests" },
  { href: "/dashboard/assets", label: "إدارة الأصول 📦", icon: "📦", section: "main", feature: "employees" },
  { href: "/dashboard/performance", label: "تقييم الأداء 📊", icon: "📊", section: "main", feature: "employees" },
  { href: "/dashboard/celebrations", label: "احتفالات 🎉", icon: "🎉", section: "main", feature: "employees" },
  { href: "/dashboard/attendance", label: "الحضور", icon: "⏰", section: "main", feature: "attendance" },
  { href: "/dashboard/shifts", label: "الورديات", icon: "🕒", section: "main", feature: "shifts_rotations" },
  { href: "/dashboard/payroll", label: "الرواتب", icon: "💰", section: "main", feature: "payroll" },
  { href: "/dashboard/loans", label: "السلف والمرتجعات 💵", icon: "💵", section: "main", feature: "payroll" },
  { href: "/dashboard/eos-calculator", label: "مكافأة نهاية الخدمة ⚖", icon: "⚖", section: "main", feature: "payroll" },
  { href: "/dashboard/requests", label: "طلبات الموظفين", icon: "📨", section: "main", feature: "requests" },
  { href: "/dashboard/jobs", label: "التوظيف ✦", icon: "🎯", section: "main", feature: "recruitment" },

  // CRM
  { href: "/dashboard/customers", label: "العملاء", icon: "💼", section: "main", feature: "crm" },
  { href: "/dashboard/interactions", label: "التفاعلات", icon: "💬", section: "main", feature: "crm" },
  { href: "/dashboard/contracts", label: "العقود", icon: "📋", section: "main", feature: "crm" },

  // Forms hub + compliance — always visible (no feature gate, useful to all tiers)
  { href: "/dashboard/forms", label: "النماذج 📋", icon: "📄", section: "main" },
  { href: "/dashboard/compliance", label: "دليل الامتثال ⚖", icon: "🏛", section: "main" },

  // Admin-only
  { href: "/dashboard/team", label: "فريق الشركة", icon: "🤝", section: "main", visibleTo: ["admin"] },

  // AI + Marketing section
  { href: "/dashboard/ai", label: "المساعد الذكي ✦", icon: "🤖", section: "ai", feature: "ai_assistant" },
  { href: "/dashboard/marketing", label: "Marketing Studio 👑", icon: "✦", section: "ai", feature: "marketing_studio" },
  // Leads inbox surfaces the day-to-day workflow on its own row so users
  // don't have to dive into Marketing Hub every time they want to check
  // who came in via the funnel.
  { href: "/dashboard/marketing/leads", label: "Leads Inbox 📥", icon: "📥", section: "ai", feature: "marketing_studio" },
  { href: "/dashboard/marketing/landing-pages", label: "صفحات الهبوط", icon: "🏠", section: "ai", feature: "marketing_studio" },
  { href: "/dashboard/marketing/analytics", label: "تحليل التسويق", icon: "📊", section: "ai", feature: "marketing_studio" },
  { href: "/dashboard/retention", label: "احتفاظ بالموظفين 🎯", icon: "🎯", section: "ai", feature: "retention_insights" },

  // Reports
  { href: "/dashboard/reports/attendance", label: "تقرير الحضور", icon: "📊", section: "reports", feature: "attendance" },
  { href: "/dashboard/reports/bridge", label: "Bridge ✦", icon: "✦", section: "reports", feature: "bridge_analytics" },
  { href: "/dashboard/audit-log", label: "سجل النشاط", icon: "📋", section: "reports", visibleTo: ["admin"], feature: "audit_log" },

  // Settings
  { href: "/dashboard/settings/office-location", label: "موقع المكتب 📍", icon: "⚙", section: "settings", visibleTo: ["admin"] },
  { href: "/dashboard/settings/leave-rollover", label: "ترحيل الإجازات", icon: "🗓", section: "settings", visibleTo: ["admin"] },
  { href: "/dashboard/settings/holidays", label: "العطلات الرسمية 📅", icon: "📅", section: "settings", visibleTo: ["admin"] },

  // Always-visible help — across every plan, every role, never hidden
  // by per-tenant overrides
  { href: "/dashboard/help", label: "مركز المساعدة 📚", icon: "📚", section: "settings" },
];

export function DashboardSidebar({
  userName,
  companyName,
  userEmail,
  isSuperAdmin,
  role,
  plan,
  daysLeft,
  featureOverrides,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer whenever the route changes. The setState is
  // intentional here — we're syncing UI to an external state (the URL),
  // which is a legitimate effect use case. The lint rule is overzealous
  // for this pattern, so we suppress it on the offending line.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const canSee = (item: NavItem) => {
    // Role gate
    if (item.visibleTo && (role === undefined || !item.visibleTo.includes(role))) {
      return false;
    }
    // Per-tenant override gate — if super-admin explicitly DISABLED the
    // feature for this tenant, hide the nav item entirely so the customer
    // never sees the module they didn't pay for. Override=true (or no
    // override at all) falls through to the rank-based render.
    if (
      item.feature &&
      featureOverrides &&
      featureOverrides[item.feature] === false
    ) {
      return false;
    }
    return true;
  };

  const mainItems = NAV_ITEMS.filter((i) => i.section === "main" && canSee(i));
  const aiItems = NAV_ITEMS.filter((i) => i.section === "ai" && canSee(i));
  const reportItems = NAV_ITEMS.filter((i) => i.section === "reports" && canSee(i));
  const settingsItems = NAV_ITEMS.filter((i) => i.section === "settings" && canSee(i));

  return (
    <>
      {/* Mobile top bar — visible only on small screens */}
      <header className="md:hidden sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle size="sm" />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="القائمة"
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed top-0 right-0 bottom-0 w-72 bg-white dark:bg-slate-900 z-50 flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="إغلاق"
              >
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <NavSection label="الموديولات" items={mainItems} isActive={isActive} plan={plan} featureOverrides={featureOverrides} />
              <NavSection label="✦ ذكاء" items={aiItems} isActive={isActive} plan={plan} featureOverrides={featureOverrides} />
              <NavSection label="التقارير" items={reportItems} isActive={isActive} plan={plan} featureOverrides={featureOverrides} />
              <NavSection label="الإعدادات" items={settingsItems} isActive={isActive} plan={plan} featureOverrides={featureOverrides} />
            </nav>
            <UserFooter
              userName={userName}
              userEmail={userEmail}
              companyName={companyName}
              isSuperAdmin={isSuperAdmin}
              isActive={isActive}
              plan={plan}
              daysLeft={daysLeft}
            />
          </aside>
        </>
      )}

      {/* Desktop sidebar — visible on md+ */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex-col shrink-0">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <Logo />
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <NavSection label="الموديولات" items={mainItems} isActive={isActive} plan={plan} featureOverrides={featureOverrides} />
          <NavSection label="✦ ذكاء" items={aiItems} isActive={isActive} plan={plan} featureOverrides={featureOverrides} />
          <NavSection label="التقارير" items={reportItems} isActive={isActive} plan={plan} featureOverrides={featureOverrides} />
          <NavSection label="الإعدادات" items={settingsItems} isActive={isActive} plan={plan} featureOverrides={featureOverrides} />
        </nav>
        <UserFooter
          userName={userName}
          userEmail={userEmail}
          companyName={companyName}
          isSuperAdmin={isSuperAdmin}
          isActive={isActive}
        />
      </aside>
    </>
  );
}

// ----------------------------------------------------------------------------
// Module-level helper components.
//
// Defining these inside DashboardSidebar (the previous shape) made React
// rebuild them on every render, blowing away local state and triggering
// the react-hooks/static-components lint rule. Hoisting them here keeps
// them stable across renders.
// ----------------------------------------------------------------------------

function NavSection({
  label,
  items,
  isActive,
  plan,
  featureOverrides,
}: {
  label: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
  plan?: Plan | null;
  featureOverrides?: Partial<Record<Feature, boolean>>;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-wider mb-2 px-3 font-cairo uppercase">
        {label}
      </div>
      <div className="space-y-1 mb-5">
        {items.map((item) => {
          const active = isActive(item.href);
          const isReport = item.section === "reports";
          // Tier-locking only — explicit override=false items are already
          // filtered out by canSee() above; override=true items pass
          // through here as "unlocked" via hasFeature's overrides arg.
          const locked =
            !!item.feature &&
            !hasFeature(plan, item.feature, featureOverrides);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-cairo text-sm transition ${
                active
                  ? isReport
                    ? "bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-bold border-r-4 border-amber-500"
                    : "bg-brand-cyan/10 dark:bg-brand-cyan/20 text-brand-cyan-dark dark:text-brand-cyan font-bold border-r-4 border-brand-cyan-dark"
                  : locked
                    ? "text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-400"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {locked && (
                <span
                  className="text-[10px] opacity-70"
                  title="يتطلب ترقية الاشتراك"
                >
                  🔒
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}

function UserFooter({
  userName,
  userEmail,
  companyName,
  isSuperAdmin,
  isActive,
  plan,
  daysLeft,
}: {
  userName: string;
  userEmail: string;
  companyName: string;
  isSuperAdmin?: boolean;
  isActive: (href: string) => boolean;
  plan?: Plan | null;
  daysLeft?: number;
}) {
  return (
    <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
      {plan && (
        <div className="flex justify-center pb-1">
          <TierBadge plan={plan} daysLeft={daysLeft} />
        </div>
      )}
      {isSuperAdmin && (
        <Link
          href="/admin"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-cairo text-sm font-bold hover:from-amber-100 hover:to-yellow-100 dark:hover:from-amber-900/50 dark:hover:to-yellow-900/50 transition"
        >
          <span>👑</span>
          <span>Super Admin Panel</span>
        </Link>
      )}
      <Link
        href="/dashboard/subscription"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition font-cairo text-sm ${
          isActive("/dashboard/subscription")
            ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        <span>💎</span>
        <span>خطتك واشتراكك</span>
      </Link>
      <Link
        href="/dashboard/profile"
        className={`block px-3 py-2 rounded-lg transition ${
          isActive("/dashboard/profile") ? "bg-brand-cyan/10 dark:bg-brand-cyan/20" : "hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        <div className="text-[10px] text-brand-gold font-bold tracking-wider mb-1 font-cairo uppercase">
          {companyName}
        </div>
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-cairo">{userName}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">{userEmail}</div>
        <div className="text-[10px] text-brand-cyan-dark dark:text-brand-cyan font-cairo font-bold mt-1">
          ⚙ الإعدادات الشخصية ←
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 pt-1">
        <form action={logout} className="flex-1">
          <button
            type="submit"
            className="w-full px-3 py-2 text-right text-sm text-red-600 hover:bg-red-50 dark:text-rose-400 dark:hover:bg-rose-900/20 rounded-lg font-cairo font-medium transition"
          >
            🚪 تسجيل الخروج
          </button>
        </form>
        <ThemeToggle size="sm" />
      </div>
    </div>
  );
}

function Logo() {
  return (
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
}
