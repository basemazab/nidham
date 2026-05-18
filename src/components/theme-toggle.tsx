"use client";

// ============================================================================
// ThemeToggle — sun / moon button that flips between light + dark
// ============================================================================
//
// next-themes' useTheme() returns:
//   - theme       — what was REQUESTED ("light" | "dark" | "system")
//   - resolvedTheme — what's actually applied (system resolves to one of two)
//
// We track resolvedTheme for the icon so the button shows the OPPOSITE of
// what's currently rendered (clicking the sun switches to light; moon to
// dark). Mounted guard prevents SSR/CSR mismatch — the theme is unknown
// during SSR, so we render a static placeholder until hydration.

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sizeCls =
    size === "sm" ? "w-8 h-8 text-base" : size === "lg" ? "w-12 h-12 text-2xl" : "w-10 h-10 text-xl";

  // Placeholder during SSR — same dimensions as the real button so
  // there's no layout shift on hydration.
  if (!mounted) {
    return (
      <div
        className={`${sizeCls} rounded-xl bg-slate-100 ${className ?? ""}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`${sizeCls} rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition flex items-center justify-center ${className ?? ""}`}
      aria-label={isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}
