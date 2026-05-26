"use client";

// ============================================================================
// PWAInstaller — registers the service worker
// ============================================================================
//
// Mounts once at the root layout. Registers /sw.js after first paint so
// the SW work doesn't block the LCP. Also caches the `beforeinstallprompt`
// event in `window.__nidhamInstall` so any other client component (e.g.
// the install button) can read + fire it later.
//
// We DON'T show a prompt automatically — that's spammy. The "Add to
// Home Screen" CTA lives in <PWAInstallButton> and the user has to opt in.

import { useEffect } from "react";

declare global {
  interface Window {
    __nidhamInstall?: BeforeInstallPromptEvent;
  }
}

// Chrome-specific event type missing from lib.dom.d.ts
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstaller() {
  useEffect(() => {
    // 1. Register the service worker (gates installability on Chrome)
    if ("serviceWorker" in navigator) {
      // Defer registration off the critical path
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .catch((err) => console.warn("[pwa] SW registration failed:", err));
      });
    }

    // 2. Capture the install prompt event when Chrome fires it. We stash
    //    it on window so any other component can call .prompt() later.
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__nidhamInstall = e as BeforeInstallPromptEvent;
      // Notify any listeners (the install button) so they can re-render
      window.dispatchEvent(new CustomEvent("nidham:install-available"));
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // 3. Track successful installs (could later send analytics)
    const onAppInstalled = () => {
      window.__nidhamInstall = undefined;
      window.dispatchEvent(new CustomEvent("nidham:installed"));
    };
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // Headless — no UI
  return null;
}
