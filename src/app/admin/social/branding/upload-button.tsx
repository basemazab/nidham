"use client";

// ============================================================================
// UploadButton — file picker that auto-submits its form on selection
// ============================================================================
//
// Extracted to its own "use client" file because the branding page is a
// server component (it does server-side data loading via the supabase
// server client). The auto-submit behaviour relies on the browser's
// HTMLFormElement.requestSubmit() and the onChange handler, neither of
// which work in a server component.
//
// The form action itself (`uploadBrandImage`) is a server action that
// the client component imports as a prop. We don't import it directly
// here so the bundler doesn't try to serialize the server-only
// dependencies of the action into the client bundle.

import type { ReactNode } from "react";

export function UploadButton({
  action,
  slot,
  label,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  slot: "profile" | "cover";
  label: ReactNode;
  className?: string;
}) {
  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="slot" value={slot} />
      <label
        className={
          className ??
          "cursor-pointer px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black font-cairo shadow inline-block transition"
        }
      >
        {label}
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const form = (e.target as HTMLInputElement).form;
            if (form) form.requestSubmit();
          }}
        />
      </label>
    </form>
  );
}
