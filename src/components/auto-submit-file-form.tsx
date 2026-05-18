"use client";

// ============================================================================
// AutoSubmitFileForm — wrapper that auto-submits when a file is picked
// ============================================================================
//
// Server components can't attach onChange to a native <input type="file">,
// so any "upload" UI inside an .tsx file that doesn't say "use client" has
// to either (a) demand a separate click on a submit button, or (b) farm
// the auto-submit out to a tiny client wrapper like this one.
//
// We pass the server action in as a prop (it stays a "use server" function
// — the prop boundary is fine), plus an optional name (defaults to "file")
// and an `accept` MIME list. Hidden inputs are rendered from a record so
// the calling page can stash any per-row context (employee_id, doc_type,
// etc.) without bespoke wrappers per caller.

import type { ReactNode } from "react";

export function AutoSubmitFileForm({
  action,
  hiddenFields,
  accept,
  label,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden inputs to include — e.g. { employee_id: "uuid", doc_type: "cv" } */
  hiddenFields?: Record<string, string>;
  /** Comma-separated MIME list, mirrors the bucket's allowed_mime_types */
  accept: string;
  label: ReactNode;
  className?: string;
}) {
  return (
    <form action={action} encType="multipart/form-data" className="inline-block">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <label
        className={
          className ??
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white text-xs font-black font-cairo cursor-pointer transition shadow"
        }
      >
        {label}
        <input
          type="file"
          name="file"
          accept={accept}
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
