"use client";

import { useState } from "react";

type Props = {
  text: string;
  className?: string;
  copiedClassName?: string;
};

export function CopyButton({ text, className, copiedClassName }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / unsupported environments
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={copied && copiedClassName ? copiedClassName : className}
    >
      {copied ? (
        <span className="inline-flex items-center gap-2">
          <span>✓</span>
          <span>اتنسخ!</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <span>📋</span>
          <span>انسخ اللينك</span>
        </span>
      )}
    </button>
  );
}
