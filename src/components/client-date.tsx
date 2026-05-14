"use client";

// Renders "today" without causing a server/client hydration mismatch.
//
// `new Date().toLocaleDateString("ar-EG")` is non-deterministic across
// server and client: Vercel's server runs in UTC, the user's browser
// runs in Egypt time, and the same instant can land on different
// calendar dates (or different locale formats). React 19 catches that
// mismatch as a hard error and unmounts the page.
//
// This component renders nothing on the server and fills in the date
// only after mount, so the server-side HTML and the client-side
// hydrated DOM are byte-identical.

import { useEffect, useState } from "react";

type Props = {
  /** Locale, defaults to ar-EG. */
  locale?: string;
  /** Intl.DateTimeFormat options, e.g. { day: "numeric", month: "long" }. */
  options?: Intl.DateTimeFormatOptions;
};

export function ClientDate({ locale = "ar-EG", options }: Props) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    setText(new Date().toLocaleDateString(locale, options));
    // Intentionally not depending on `options` (a new object every
    // render would trigger a refresh on every parent re-render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);
  return <>{text}</>;
}
