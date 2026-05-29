"use client";

import { useEffect, useState, useCallback } from "react";

export function PwaInstallPrompt({ onClose }: { onClose?: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);

    // Check if push is supported
    setPushSupported("serviceWorker" in navigator && "PushManager" in window);

    const beforeInstallHandler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", beforeInstallHandler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstallHandler);
      window.removeEventListener("appinstalled", () => setInstalled(true));
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const result = await (deferredPrompt as any).userChoice;
    if (result.outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
    onClose?.();
  }, [deferredPrompt, onClose]);

  // If already installed or no install prompt available, hide
  if (installed || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg" dir="rtl">
      <div className="max-w-md mx-auto space-y-3">
        <h3 className="font-semibold text-sm">تثبيت تطبيق نِظام HR</h3>
        <p className="text-xs text-gray-500">
          حمل التطبيق على جهازك للوصول السريع من الشاشة الرئيسية
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            تثبيت التطبيق
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}
