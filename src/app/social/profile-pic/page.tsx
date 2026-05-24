// ============================================================================
// /social/profile-pic — Facebook / Instagram / LinkedIn profile picture
// ============================================================================
//
// Renders a fixed 1080x1080 square with the Nidham logo treatment, sized
// for direct screenshot into Meta / LinkedIn / X profile slots.
//
// Why 1080x1080? It's the largest size Facebook stores for circular
// profile pics. Smaller sizes (170x170, 50x50) are auto-derived by
// Facebook from this single upload — uploading 1080 means the avatar
// stays crisp from Page header down to comment-thumbnail.
//
// Usage:
//   1. Visit https://nidhamhr.com/social/profile-pic
//   2. Browser zoom 100% (Ctrl+0)
//   3. Snipping Tool → crop the square box exactly
//   4. Upload as profile picture on Facebook / Instagram / LinkedIn
//
// Design choice: the avatar is JUST the "ن" wordmark on a gradient
// background — no English text. Reasons:
//   - At 50x50 (comment thumbnails) anything more becomes mud
//   - "ن" is unique enough to register as Nidham at small sizes
//   - Matches the existing logo treatment in the brochure + dashboard
//
// Set noindex so we don't accidentally surface this as an SEO landing.

export const metadata = {
  title: "Profile picture — Nidham",
  robots: { index: false, follow: false },
};

export default function ProfilePicPage() {
  return (
    <main className="min-h-screen bg-slate-200 flex flex-col items-center justify-start py-8">
      {/* Instructions — won't be in the screenshot if you clip just the
          square below. */}
      <div className="no-print max-w-2xl mb-6 mx-4 p-4 rounded-2xl bg-white border-2 border-amber-300 text-sm font-cairo">
        <h2 className="font-black text-amber-900 mb-2">
          📸 طريقة الاستخدام
        </h2>
        <ol className="space-y-1 text-slate-700 list-decimal pr-5">
          <li>تأكد إن zoom المتصفح <strong>100%</strong> (Ctrl+0)</li>
          <li>افتح <strong>Snipping Tool</strong> (Windows) أو <strong>Cmd+Shift+4</strong> (Mac)</li>
          <li>اقص المربع الأزرق اللي تحت بالظبط (1080×1080)</li>
          <li>ارفع الصورة كـ Profile Picture على Facebook + Instagram + LinkedIn</li>
        </ol>
      </div>

      {/* The 1080x1080 avatar. Fixed pixel size so clipping is exact. */}
      <div
        className="shadow-2xl overflow-hidden"
        style={{ width: "1080px", height: "1080px" }}
      >
        <div
          className="w-full h-full flex items-center justify-center relative"
          style={{
            background:
              "linear-gradient(135deg, #22d3ee 0%, #0891b2 50%, #0a1428 100%)",
          }}
        >
          {/* Decorative geometric circles in the background — adds depth
              without distracting from the wordmark. Positioned with px
              offsets relative to the 1080x1080 frame so they survive
              the crop. */}
          <div
            className="absolute rounded-full bg-white/5"
            style={{ width: "500px", height: "500px", top: "-100px", right: "-100px" }}
          />
          <div
            className="absolute rounded-full bg-white/5"
            style={{ width: "400px", height: "400px", bottom: "-80px", left: "-80px" }}
          />
          <div
            className="absolute rounded-full bg-amber-400/10"
            style={{ width: "200px", height: "200px", top: "150px", left: "120px" }}
          />

          {/* The wordmark itself */}
          <div
            className="font-black text-white font-display select-none"
            style={{
              fontSize: "600px",
              lineHeight: "1",
              textShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
            }}
          >
            ن
          </div>

          {/* Tiny tagline at the bottom — barely visible at 50x50 but
              gives the full-size avatar a polished feel. */}
          <div
            className="absolute bottom-12 left-0 right-0 text-center text-white/80 font-bold tracking-[0.4em]"
            style={{ fontSize: "32px" }}
          >
            NIDHAM
          </div>
        </div>
      </div>
    </main>
  );
}
