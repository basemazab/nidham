"use client";

// ============================================================================
// ThemeProvider — thin wrapper around next-themes
// ============================================================================
//
// Centralized so we can swap implementations later (e.g. add a "system"
// option, persist to user prefs, etc.) without touching every consumer.
//
// next-themes adds the `class="dark"` to <html> based on:
//   - The "theme" cookie / localStorage
//   - The system preference (when defaultTheme="system")
//
// We default to "system" so a user who hasn't toggled inherits their
// OS choice. attribute="class" matches the @custom-variant dark
// definition in globals.css.

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // The <html> tag transition flashes briefly during the theme
      // swap; disabling next-themes' own transition lets our CSS
      // transition (defined in globals.css on body) do the job
      // smoothly.
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
