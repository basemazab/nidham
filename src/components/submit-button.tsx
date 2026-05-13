"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  loadingText?: string;
  className?: string;
};

/**
 * A submit button that automatically reflects the pending state of its
 * enclosing <form action={...}>. Disables itself + swaps to loadingText
 * while the server action is running. Drop-in replacement for <button type="submit">.
 */
export function SubmitButton({ children, loadingText, className }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} disabled:opacity-60 disabled:cursor-wait`}
      aria-busy={pending}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{loadingText ?? "جاري الحفظ..."}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
