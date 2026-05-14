"use client";

import { useEffect } from "react";

// Fires window.print() once on mount. Used by /print/* pages so the
// user lands on the printable view and the dialog opens immediately.
// We use a tiny timeout so the browser has time to paint the content
// before invoking print -- otherwise the preview can come up blank in
// Chromium / Edge.
export function AutoPrint() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      window.print();
    }, 350);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
