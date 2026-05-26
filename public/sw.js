// ============================================================================
// Nidham Service Worker — minimal install-eligibility SW
// ============================================================================
//
// We DELIBERATELY do almost no caching. HR data (attendance, leaves,
// payroll) is sensitive and time-sensitive — showing stale "your leave
// balance is 15 days" when it's actually 0 is a bug, not a feature.
//
// The SW exists so:
//   1. Chrome considers the app "installable" (it requires an SW that
//      handles fetch, even if pass-through, to fire `beforeinstallprompt`)
//   2. We can show a minimal offline fallback when the network drops
//   3. Future iterations can layer in selective caching for fonts /
//      static assets without redoing the install flow
//
// Cache versioning: bump CACHE_NAME whenever we change the SW so old
// clients evict on next load.

// Bumped to v2 (2026-05-26): force eviction of v1 caches that may have
// staled HTML for dashboard pages. Increase this whenever a major UI
// change ships so old PWA installs evict the cached shell.
const CACHE_NAME = "nidham-v2";

// Pre-cache the offline fallback + icon — tiny payload, must-have for
// the install to look professional when the user is offline.
const PRECACHE_URLS = ["/icon.svg", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Take control of all clients (open tabs) immediately
      self.clients.claim(),
      // Evict any caches that don't match the current version
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls, server actions, auth flows, or anything POST.
  // These return live data; serving stale would be a bug.
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;
  if (url.pathname.includes("/_next/data/")) return;
  // Dashboard pages are dynamic + frequently updated. Caching the HTML
  // shell of /dashboard/* would freeze data the user expects to be live
  // (the payslip is the worst offender). Always pass through to network.
  if (url.pathname.startsWith("/dashboard/")) return;

  // Network-first for navigation requests, with an offline fallback so the
  // app doesn't show the browser's default "no internet" page when the
  // user is on the subway / in a basement.
  //
  // J6 fix: the previous `.catch(...)` only triggered on NETWORK errors
  // (DNS fail, request aborted). A 5xx from the origin is a SUCCESSFUL
  // fetch with `response.ok === false`, so the user got the server's
  // 500 page instead of our friendly offline.html. Now we explicitly
  // reject non-OK navigations (except 304 Not Modified) so the fallback
  // also catches origin outages.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok || response.status === 304) return response;
          throw new Error(`Upstream returned ${response.status}`);
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match("/offline.html")) ||
            new Response("Offline. Reconnect to access Nidham.", {
              headers: { "Content-Type": "text/plain" } },
            )
          );
        }),
    );
    return;
  }

  // For static assets (the icon, fonts, etc.), use cache-first to speed
  // up repeat visits. Network fallback fills the cache as we go.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    /\.(woff2?|ttf|otf|css|js|png|svg|webp|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        });
      }),
    );
    return;
  }

  // Default: pass through to network. No caching, no surprises.
});
