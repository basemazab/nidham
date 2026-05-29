"use client";

import { PwaInstallPrompt } from "./pwa-install-prompt";
import { useState, useEffect } from "react";

export function PwaWrapper({ children }: { children: React.ReactNode }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Only show on mobile devices, after 30s, if not already installed
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isMobile && !isStandalone) {
      const timer = setTimeout(() => setShowPrompt(true), 30000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <>
      {showPrompt && (
        <PwaInstallPrompt onClose={() => setShowPrompt(false)} />
      )}
      {children}
    </>
  );
}
