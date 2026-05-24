"use client";

// ============================================================================
// MetaPixel — Facebook/Instagram tracking pixel
// ============================================================================
//
// Drops the standard fbq init + PageView ping into the page <head> when
// NEXT_PUBLIC_META_PIXEL_ID is set. No-op (renders null) when the env var
// is absent — that's what lets us check this into main without dropping
// a half-configured pixel into production right away.
//
// Wired in src/app/layout.tsx so every route auto-fires PageView.
//
// To add the pixel to a deployment:
//   1. Get Pixel ID from Meta Events Manager → Data Sources → your pixel
//   2. Vercel → Project → Settings → Environment Variables → Add new:
//      Key   = NEXT_PUBLIC_META_PIXEL_ID
//      Value = <the 15-16 digit pixel id, e.g. 1234567890123456>
//      Env   = Production + Preview (skip Development unless you want it
//              firing on localhost)
//   3. Redeploy.
//
// Why client component? Meta's pixel script is browser-side JS that
// reads document.referrer + window.location and posts to Facebook. Can't
// run server-side.
//
// Why next/script with strategy="afterInteractive"? The pixel doesn't
// need to block render — letting it load after hydration keeps Largest
// Contentful Paint clean.

import Script from "next/script";

export function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  // No pixel configured — render nothing rather than half-installing fbq.
  // Catches the local-dev + first-deploy cases cleanly.
  if (!pixelId) return null;

  return (
    <>
      {/* Pixel base code — the unminified version from Meta Events Manager
          with the dynamic ID interpolated. The IIFE swallows duplicate
          inits gracefully (the `if (f.fbq) return;` guard), so even if
          this component renders twice during a transition the pixel only
          loads once. */}
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
        }}
      />

      {/* Noscript fallback — fires a 1x1 tracking pixel when the user has
          JS disabled. Same image Meta auto-generates in their snippet
          builder. */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

// ============================================================================
// Helper: trackPixelEvent
// ============================================================================
//
// Call from client components to fire custom events (Lead, ViewContent,
// CompleteRegistration, etc.). Safe to call even when the pixel is not
// configured — the `window.fbq` check short-circuits the call.
//
// Standard events list:
//   https://developers.facebook.com/docs/meta-pixel/reference#standard-events
//
// Example:
//   trackPixelEvent("Lead", { content_name: "WhatsApp click from brochure" });

type FbqWindow = Window & {
  fbq?: (
    method: "track" | "trackCustom",
    event: string,
    params?: Record<string, unknown>,
  ) => void;
};

export function trackPixelEvent(
  event: string,
  params?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  const w = window as FbqWindow;
  if (typeof w.fbq !== "function") return;
  w.fbq("track", event, params);
}
