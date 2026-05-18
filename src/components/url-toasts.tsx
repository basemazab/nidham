"use client";

// ============================================================================
// UrlToasts — read transient search params on mount, fire toasts, clean URL
// ============================================================================
//
// Pattern we already use across the app: server actions redirect to a URL
// like `?saved=1` or `?error=Something`. Pre-toast, the destination
// rendered an inline <Flash> banner that the user could see for a
// moment before navigating away. That works but feels old — banners
// reflow the page, can't auto-dismiss, can't stack, and don't tell the
// user the action belonged to (was it the post they just clicked? or
// something else?).
//
// This component replaces the banners with sonner toasts:
//   1) On mount + every URL change, scan known toast keys.
//   2) Fire toast.success / toast.error / toast.info accordingly.
//   3) router.replace() the URL with the matched keys stripped so a
//      refresh doesn't re-fire the same toast.
//
// IMPORTANT: this is purely additive. The old <Flash> banners are also
// kept (for now) because there's a brief moment between server-render
// and client-hydration where the toast hasn't fired yet. We can remove
// <Flash> banners later once we trust the toast flow.

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

// Each entry says: when ?<key>=... appears, fire a toast.
//   type:    success | error | info — drives icon + accent
//   message: the toast body. Can take the value (for ?error=text) or
//            be a static string (for ?saved=1).
//   read:    optional transform — e.g. for ?recovered=3 we want
//            "تم استعادة 3 بوست".
type ToastEntry = {
  type: "success" | "error" | "info";
  message: string | ((value: string) => string);
};

const TOAST_MAP: Record<string, ToastEntry> = {
  // Generic success keys reused across actions
  saved: { type: "success", message: "✅ تم الحفظ" },
  deleted: { type: "success", message: "🗑 تم الحذف" },
  toggled: { type: "success", message: "✓ تم التحديث" },
  archived: { type: "success", message: "✓ تم الأرشفة" },
  marked: { type: "success", message: "✓ تم التحديث" },
  uploaded: { type: "success", message: "📤 تم الرفع بنجاح" },

  // Social Growth Suite
  drafted: { type: "success", message: "✨ تم درافت رد AI — راجعه تحت" },
  published: { type: "success", message: "✅ تم النشر" },
  img: {
    type: "success",
    message: (v) => (v === "removed" ? "🗑 تم حذف الصورة" : "🖼 تم توليد صورة جديدة"),
  },
  profile: { type: "success", message: "✅ تم تحديث الصورة الشخصية" },
  cover: { type: "success", message: "✅ تم تحديث الغلاف" },
  recovered: {
    type: "success",
    message: (v) =>
      `🔧 تم استعادة ${v} بوست كانوا عالقين (رجّعتهم لـ مسودة)`,
  },
  synced: {
    type: "success",
    message: "🔄 تم الـ Sync — شوف التفاصيل تحت",
  },
  long_lived: {
    type: "success",
    message: (v) =>
      v === "permanent"
        ? "🔐 Token دائم — مش هينتهي"
        : `🔐 الـ Token هينتهي في ${new Date(v).toLocaleDateString("ar-EG", { dateStyle: "medium" })}`,
  },
  generated: {
    type: "success",
    message: (v) => `✨ تم توليد ${v} variant`,
  },

  // Error (catch-all key — most actions surface failures via ?error=msg)
  error: {
    type: "error",
    message: (v) => `⚠ ${v}`,
  },
};

// Search-param names that should be REMOVED after the toast fires.
// Any param not listed here is preserved (e.g. ?first=<post-id> which
// the composer uses to focus on a specific draft).
const TRANSIENT_KEYS = new Set([
  ...Object.keys(TOAST_MAP),
  // Sync summary keys — shown via the synced toast above. Strip them
  // so the URL stays clean.
  "scanned",
  "seen",
  "new",
  "errors",
  "first_error",
]);

export function UrlToasts() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Guard against double-firing in dev (StrictMode mounts effects
  // twice). The ref tracks which param signature we've already
  // toasted so the second mount is a no-op.
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    const signature = params.toString();
    if (signature === firedRef.current) return;
    firedRef.current = signature;

    let firedAny = false;

    for (const [key, entry] of Object.entries(TOAST_MAP)) {
      const value = params.get(key);
      if (value === null) continue;

      const message =
        typeof entry.message === "function"
          ? entry.message(value)
          : entry.message;

      // Error toasts get longer duration + dismiss-on-click so the
      // operator has time to copy any URL / id.
      const opts =
        entry.type === "error"
          ? { duration: 8000, closeButton: true }
          : { duration: 4000 };

      if (entry.type === "success") toast.success(message, opts);
      else if (entry.type === "error") toast.error(message, opts);
      else toast.info(message, opts);

      firedAny = true;
    }

    // Strip transient keys from the URL so refreshing doesn't fire
    // the same toast twice. We preserve any non-transient params
    // (e.g. ?first=<id>, ?tab=overview) the route relies on.
    if (firedAny) {
      const next = new URLSearchParams(params.toString());
      let mutated = false;
      for (const key of TRANSIENT_KEYS) {
        if (next.has(key)) {
          next.delete(key);
          mutated = true;
        }
      }
      if (mutated) {
        const qs = next.toString();
        // router.replace() without scroll preserves position; ok
        // because we're just cleaning the URL, not navigating.
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    }
  }, [params, router, pathname]);

  return null;
}
