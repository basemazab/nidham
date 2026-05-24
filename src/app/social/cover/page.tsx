// ============================================================================
// /social/cover — Facebook / LinkedIn cover photo
// ============================================================================
//
// Renders a fixed 1640x859 banner sized for Facebook Page covers (the
// modern dimensions — old 851x315 still works but looks blurry on
// retina displays).
//
// Why 1640x859?
//   - Desktop Facebook: 851 wide × 315 tall (≈2.7:1 aspect)
//   - Mobile Facebook crops both sides — visible area is ~640px wide
//   - LinkedIn Page cover: 1128 wide × 191 tall
//   - 1640x859 matches Facebook's official high-resolution recommended
//     size and downscales cleanly to LinkedIn too
//
// SAFE ZONE (centered ~820x312 area) — anything outside this gets
// cropped on mobile. Important info stays inside the dashed inner box.
//
// Usage:
//   1. Visit https://nidhamhr.com/social/cover
//   2. Browser zoom 100% (Ctrl+0)
//   3. Snipping Tool → clip the gradient rectangle exactly
//   4. Upload as Cover Photo on Facebook / LinkedIn Page

export const metadata = {
  title: "Cover photo — Nidham",
  robots: { index: false, follow: false },
};

export default function CoverPhotoPage() {
  return (
    <main className="min-h-screen bg-slate-200 flex flex-col items-center justify-start py-8">
      {/* Instructions */}
      <div className="no-print max-w-3xl mb-6 mx-4 p-4 rounded-2xl bg-white border-2 border-amber-300 text-sm font-cairo">
        <h2 className="font-black text-amber-900 mb-2">
          📸 طريقة الاستخدام
        </h2>
        <ol className="space-y-1 text-slate-700 list-decimal pr-5">
          <li>تأكد إن zoom المتصفح <strong>100%</strong> (Ctrl+0)</li>
          <li>افتح <strong>Snipping Tool</strong> أو <strong>Cmd+Shift+4</strong></li>
          <li>اقص الـ banner اللي تحت بالظبط (1640×859)</li>
          <li>ارفعها كـ Cover Photo على Facebook + LinkedIn Page</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          ⚠️ على الموبايل بيتقصّ من الجوانب — الجزء الأساسي في النص.
        </p>
      </div>

      {/* The 1640x859 banner */}
      <div
        className="shadow-2xl overflow-hidden relative"
        style={{ width: "1640px", height: "859px" }}
      >
        <div
          className="w-full h-full flex relative"
          style={{
            background:
              "linear-gradient(120deg, #0a1428 0%, #0891b2 60%, #22d3ee 100%)",
          }}
        >
          {/* Decorative geometric shapes */}
          <div
            className="absolute rounded-full bg-amber-400/10 blur-3xl"
            style={{ width: "600px", height: "600px", top: "-200px", left: "-100px" }}
          />
          <div
            className="absolute rounded-full bg-cyan-300/15 blur-3xl"
            style={{ width: "500px", height: "500px", bottom: "-150px", right: "-100px" }}
          />

          {/* Subtle dot pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />

          {/* Content — RTL, right-aligned. Padded into mobile safe zone. */}
          <div
            className="relative flex items-center justify-between w-full"
            style={{ padding: "0 250px" }}
            dir="rtl"
          >
            {/* Right side: text block */}
            <div className="flex-1">
              {/* Logo + wordmark */}
              <div className="flex items-center gap-5 mb-8">
                <div
                  className="rounded-3xl flex items-center justify-center shadow-2xl"
                  style={{
                    width: "120px",
                    height: "120px",
                    background:
                      "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
                  }}
                >
                  <span className="font-black text-white font-display" style={{ fontSize: "80px", lineHeight: "1" }}>
                    ن
                  </span>
                </div>
                <div>
                  <div
                    className="font-black text-white font-display"
                    style={{ fontSize: "72px", lineHeight: "1" }}
                  >
                    نِظام
                  </div>
                  <div
                    className="text-amber-300 font-bold tracking-[0.4em] mt-2"
                    style={{ fontSize: "16px" }}
                  >
                    NIDHAM · HR · AI · EGYPT
                  </div>
                </div>
              </div>

              {/* Big headline */}
              <h1
                className="font-black text-white mb-5 font-cairo leading-tight"
                style={{ fontSize: "64px" }}
              >
                نظام HR + Payroll<br />
                <span className="text-amber-300">للشركات المصرية</span>
              </h1>

              {/* Subtitle */}
              <p
                className="text-cyan-50 font-cairo mb-7 leading-relaxed"
                style={{ fontSize: "26px", maxWidth: "680px" }}
              >
                مرتبات بقانون 2026 · نماذج تأمينات تلقائية · AI Agent · موبايل app
              </p>

              {/* Trust signal */}
              <div
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 backdrop-blur border-2 border-white/20"
              >
                <span className="text-3xl">✨</span>
                <span className="text-white font-bold font-cairo" style={{ fontSize: "20px" }}>
                  شغّال دلوقتي عند 200+ موظف
                </span>
              </div>
            </div>

            {/* Left side: CTA box */}
            <div
              className="flex flex-col items-center justify-center rounded-3xl shadow-2xl"
              style={{
                width: "380px",
                height: "380px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
                border: "2px solid rgba(255,255,255,0.25)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div
                className="text-amber-300 font-bold tracking-[0.3em] mb-3"
                style={{ fontSize: "14px" }}
              >
                🎁 برنامج BETA
              </div>
              <div
                className="text-white font-black font-cairo text-center mb-3"
                style={{ fontSize: "44px", lineHeight: "1.1" }}
              >
                3 شهور<br/>مجاناً
              </div>
              <div
                className="text-cyan-100 font-cairo text-center"
                style={{ fontSize: "18px" }}
              >
                + 50% خصم سنة
              </div>
              <div
                className="mt-5 px-6 py-3 rounded-2xl bg-amber-400 text-slate-900 font-black font-cairo"
                style={{ fontSize: "20px" }}
              >
                nidhamhr.com
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
