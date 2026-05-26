"use client";

// ============================================================================
// PWAInstallButton — "Add to Home Screen" CTA
// ============================================================================
//
// Three visual states based on the user's environment:
//
//   1. Standalone mode (already installed) → render NOTHING
//   2. Chrome (Android/desktop) with prompt available → "🚀 ثبّت التطبيق"
//      button that fires window.__nidhamInstall.prompt()
//   3. iOS Safari (no prompt support) → show short instructions
//      ("اضغط Share → Add to Home Screen") inline
//   4. Other browsers without prompt → tooltip-style hint
//
// Designed to slot into any container — the wrapping element controls
// position. Just <PWAInstallButton /> and it figures out the rest.

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "loading" | "installed" | "can_prompt" | "ios_hint" | "unsupported";

function detectMode(): Mode {
  if (typeof window === "undefined") return "loading";

  // Already in standalone mode → user installed it already
  if (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  ) {
    return "installed";
  }

  // Chrome / Edge / Samsung Internet — they fire beforeinstallprompt
  if (window.__nidhamInstall) {
    return "can_prompt";
  }

  // iOS Safari — no programmatic prompt; only manual via Share menu.
  // Detect with userAgent: "iPhone" / "iPad" / "iPod" + Safari (not Chrome iOS)
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  const isIosSafari = isIos && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
  if (isIosSafari) return "ios_hint";

  return "unsupported";
}

export function PWAInstallButton() {
  const [mode, setMode] = useState<Mode>("loading");
  const [busy, setBusy] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    setMode(detectMode());
    const refresh = () => setMode(detectMode());
    window.addEventListener("nidham:install-available", refresh);
    window.addEventListener("nidham:installed", refresh);
    // Re-check when the user switches between standalone and tab modes
    const mql = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener("change", refresh);
    return () => {
      window.removeEventListener("nidham:install-available", refresh);
      window.removeEventListener("nidham:installed", refresh);
      mql.removeEventListener("change", refresh);
    };
  }, []);

  const fireInstall = async () => {
    const promptEvent = window.__nidhamInstall as
      | BeforeInstallPromptEvent
      | undefined;
    if (!promptEvent) return;
    setBusy(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setMode("installed");
      }
      // Once fired, the event can't be re-used
      window.__nidhamInstall = undefined;
    } finally {
      setBusy(false);
    }
  };

  if (mode === "loading" || mode === "installed") return null;

  if (mode === "can_prompt") {
    return (
      <button
        type="button"
        onClick={fireInstall}
        disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition font-cairo"
      >
        <span>🚀</span>
        <span>{busy ? "بنثبّت..." : "ثبّت التطبيق"}</span>
      </button>
    );
  }

  if (mode === "ios_hint") {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowIosTip((s) => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md font-cairo"
        >
          <span>📱</span>
          <span>ثبّت على الموبايل</span>
        </button>
        {showIosTip && (
          <div className="absolute z-40 mt-2 right-0 w-72 p-4 rounded-2xl bg-white border-2 border-slate-200 shadow-xl text-right text-sm text-slate-700 font-cairo">
            <button
              type="button"
              onClick={() => setShowIosTip(false)}
              className="absolute top-2 left-2 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold"
              aria-label="إغلاق"
            >
              ✕
            </button>
            <div className="font-bold text-slate-900 mb-2">
              لتثبيت Nidham على iPhone:
            </div>
            <ol className="space-y-2 list-decimal pr-5 text-xs leading-relaxed">
              <li>
                اضغط زرار <strong>المشاركة</strong> في الأسفل (مربع وفيه سهم
                طالع لفوق)
              </li>
              <li>
                مرّر لتحت ولاقي <strong>Add to Home Screen</strong>
              </li>
              <li>
                اضغط <strong>Add</strong> في أعلى اليمين
              </li>
            </ol>
            <p className="mt-2 text-[10px] text-slate-400">
              لو فاتح من تطبيق Chrome، الخطوات هتشتغل بس لازم تفتح من Safari
              علشان iOS يقبل التثبيت.
            </p>
          </div>
        )}
      </div>
    );
  }

  // unsupported — desktop Safari without standalone, Firefox Android, etc.
  return null;
}
