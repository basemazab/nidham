import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Skip the proxy for:
  // - Next.js internals (_next/static, _next/image)
  // - Common static binary types served from /public
  // - PWA manifest + service worker + offline fallback (must reach the
  //   browser unchanged for install to work — Supabase session refresh
  //   would rewrite them through a 200 → 302 chain that breaks the SW
  //   registration handshake)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|webmanifest)$).*)",
  ],
};
