// Single source of truth for Nidham brand colors + typography on mobile.
// Stays in sync with the web app + desktop client.

export const colors = {
  // Brand
  navy: "#0a1428",
  navyLight: "#152540",
  cyan: "#22d3ee",
  cyanDark: "#0891b2",
  gold: "#c9a84c",

  // Neutrals (Tailwind-ish slate ramp)
  white: "#ffffff",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",

  // Status
  emerald400: "#34d399",
  emerald500: "#10b981",
  emerald600: "#059669",
  amber500: "#f59e0b",
  red400: "#f87171",
  red500: "#ef4444",
  red600: "#dc2626",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  "2xl": 26,
  "3xl": 32,
} as const;
