"use client";

// ============================================================================
// FileInputAutoSubmit — file input that submits its enclosing form on pick
// ============================================================================
//
// Companion to AutoSubmitFileForm: when the parent form already has other
// fields (doc_type, name, expires_at, etc.) we don't want to wrap the
// entire form in a client boundary. This tiny component is just the
// <input type="file"> + the onChange behaviour, sitting inside an
// otherwise server-rendered form. Pick a file → e.target.form.requestSubmit().

import type { ReactNode } from "react";

export function FileInputAutoSubmit({
  accept,
  label,
  name = "file",
  className,
}: {
  accept: string;
  label: ReactNode;
  name?: string;
  className?: string;
}) {
  return (
    <label
      className={
        className ??
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white text-xs font-black font-cairo cursor-pointer transition shadow shrink-0"
      }
    >
      {label}
      <input
        type="file"
        name={name}
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const form = (e.target as HTMLInputElement).form;
          if (form) form.requestSubmit();
        }}
      />
    </label>
  );
}
