"use client";

// ============================================================================
// ClockInClient — geolocation + selfie + RPC client component
// ============================================================================
//
// Big single-file component because the flow is sequential — break it
// into pieces and you spend more time wiring state than reading. Phases:
//   1. idle / requesting GPS
//   2. camera open, preview
//   3. selfie captured (showing preview + confirm/retake)
//   4. uploading + RPC
//   5. done — success card with timestamp
//
// On success, the UI is the source of truth — we don't refresh the page
// (would lose camera state). Server-side data updates next page load.

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PWAInstallButton } from "@/components/pwa-install-button";

// ============================================================================
// In-app browser detection
// ============================================================================
// WhatsApp / Facebook / Instagram open external links in their OWN in-app
// browser instead of Safari/Chrome. These browsers:
//   - Cannot access the camera (getUserMedia silently fails or returns
//     a black video element)
//   - Cannot install PWAs (no Share button visible)
//   - Have aggressive cookie restrictions
//
// Critical for our flow: HR sends the /clock-in link via WhatsApp →
// employee taps it → opens in WhatsApp's browser → camera broken.
// We detect this client-side and prompt the user to switch browsers.
type BrowserHost =
  | "safari"
  | "chrome"
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "messenger"
  | "tiktok"
  | "snapchat"
  | "telegram"
  | "twitter"
  | "linkedin"
  | "other_in_app"
  | "unknown";

function detectBrowserHost(): BrowserHost {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;

  // In-app browsers — order matters; WhatsApp UA contains "Safari" so
  // we MUST check for the specific in-app markers first.
  if (/WhatsApp/i.test(ua)) return "whatsapp";
  if (/FBAN|FBAV|FB_IAB|Facebook/i.test(ua)) return "facebook";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/Messenger/i.test(ua)) return "messenger";
  if (/TikTok|Bytedance|musical_ly/i.test(ua)) return "tiktok";
  if (/Snapchat/i.test(ua)) return "snapchat";
  if (/Telegram/i.test(ua)) return "telegram";
  if (/Twitter|TwitterAndroid/i.test(ua)) return "twitter";
  if (/LinkedInApp/i.test(ua)) return "linkedin";

  // Standard browsers
  if (/CriOS|Chrome/i.test(ua)) return "chrome";
  if (/Safari/i.test(ua)) return "safari";

  return "unknown";
}

const IN_APP_HOSTS: ReadonlySet<BrowserHost> = new Set([
  "whatsapp",
  "facebook",
  "instagram",
  "messenger",
  "tiktok",
  "snapchat",
  "telegram",
  "twitter",
  "linkedin",
  "other_in_app",
]);

const HOST_LABELS: Record<BrowserHost, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  telegram: "Telegram",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  other_in_app: "تطبيق آخر",
  safari: "Safari",
  chrome: "Chrome",
  unknown: "متصفح",
};

type Props = {
  employeeId: string;
  employeeName: string;
  companyName: string;
  officeLat: number | null;
  officeLng: number | null;
  radiusMeters: number;
  geofenceEnabled: boolean;
  todayAttendanceId: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

type Phase =
  | "idle"
  | "locating"
  | "camera_off"
  | "camera_on"
  | "captured"
  | "uploading"
  | "done"
  | "error";

/** Haversine distance in metres between two lat/lng pairs. */
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
}

export function ClockInClient(props: Props) {
  const {
    employeeId,
    employeeName,
    companyName,
    officeLat,
    officeLng,
    radiusMeters,
    geofenceEnabled,
    checkedInAt: initialCheckedIn,
    checkedOutAt: initialCheckedOut,
  } = props;

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [doneMessage, setDoneMessage] = useState("");
  const [checkedInAt, setCheckedInAt] = useState<string | null>(initialCheckedIn);
  const [checkedOutAt, setCheckedOutAt] = useState<string | null>(initialCheckedOut);

  // Detect in-app browser AFTER mount to avoid hydration mismatch (server
  // can't know userAgent reliably). Default to "unknown" until we know.
  const [browserHost, setBrowserHost] = useState<BrowserHost>("unknown");
  const [isIos, setIsIos] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => {
    setBrowserHost(detectBrowserHost());
    setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
  }, []);

  const isInAppBrowser = IN_APP_HOSTS.has(browserHost);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isCheckOut = checkedInAt !== null && checkedOutAt === null;
  const isAlreadyDone = checkedInAt !== null && checkedOutAt !== null;

  // Helper: try to open the current URL in the system browser.
  // On iOS, x-safari-https:// is the standard way to force-launch Safari
  // from a webview. On Android, intent:// is the equivalent for Chrome.
  const openInSystemBrowser = () => {
    const currentUrl =
      typeof window !== "undefined" ? window.location.href : "";
    if (!currentUrl) return;
    if (isIos) {
      // x-safari-https:// only works on iOS Safari handler. Strip the
      // scheme prefix to reuse the original URL.
      const stripped = currentUrl.replace(/^https?:\/\//, "");
      window.location.href = `x-safari-https://${stripped}`;
    } else {
      // Android intent: scheme — Chrome registers itself as a handler
      const stripped = currentUrl.replace(/^https?:\/\//, "");
      window.location.href = `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end`;
    }
  };

  const copyUrlToClipboard = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 3000);
    } catch {
      // Fallback for older browsers — create a temp input
      const tmp = document.createElement("input");
      tmp.value = url;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      document.body.removeChild(tmp);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 3000);
    }
  };

  // ── Phase 1: request geolocation ──
  const requestLocation = () => {
    setError("");
    setPhase("locating");
    if (!navigator.geolocation) {
      setError("الجهاز ده ما يدعمش تحديد الموقع");
      setPhase("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        if (officeLat !== null && officeLng !== null) {
          const d = distanceMeters(lat, lng, officeLat, officeLng);
          setDistance(d);
        }
        setPhase("camera_off");
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "اسمح للموقع علشان نقدر نسجّل حضورك"
            : "ما قدرناش نلاقي موقعك. تأكد من تشغيل الـ GPS",
        );
        setPhase("error");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  // ── Phase 2: open the camera ──
  //
  // SUBTLE BUG WE HIT: the <video ref={videoRef}> element is rendered
  // INSIDE `{phase === "camera_on" && ...}`. If we attach the stream
  // BEFORE setPhase, videoRef.current is still null (element not mounted).
  // Attaching AFTER setPhase doesn't work either because React batches
  // the re-render — the ref isn't populated until the render flushes.
  //
  // Fix: stash the stream in streamRef, then setPhase, then let a
  // useEffect below (watching phase) attach the stream once React has
  // rendered the <video> element. This guarantees ref.current is non-null
  // by the time we touch it.
  const openCamera = async () => {
    setError("");
    // J6: stop any previously-acquired stream BEFORE asking for a new one.
    // The retake flow used to overwrite streamRef.current without stopping
    // the old tracks, leaking the camera + microphone indicator until the
    // tab was closed. Stopping the old stream first releases the device
    // and keeps the indicator honest.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 720, height: 720 },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("camera_on"); // useEffect below attaches the stream
    } catch (err) {
      // Surface a more helpful message based on the error type — iOS Safari
      // gives different reasons (PermissionDenied, NotAllowedError, etc.)
      const name = err instanceof Error ? err.name : "";
      const friendly =
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "اسمح للكاميرا من إعدادات المتصفح وحاول تاني"
          : name === "NotFoundError"
            ? "الجهاز ده مفيش فيه كاميرا أمامية"
            : name === "NotReadableError"
              ? "الكاميرا مشغولة من تطبيق تاني — اقفل التطبيقات وحاول تاني"
              : "ما قدرناش نشغّل الكاميرا. حاول تاني أو افتح اللينك في Safari/Chrome";
      setError(friendly);
      setPhase("error");
    }
  };

  // Attach the media stream once React has rendered the <video> element.
  // Fires after every transition to "camera_on" — guarantees videoRef is
  // populated. play() may need a user gesture on iOS; we already had one
  // (the "open camera" tap) so it should pass.
  useEffect(() => {
    if (phase !== "camera_on") return;
    if (!videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch((err) => {
      console.warn("[clock-in] video play failed:", err);
    });
  }, [phase]);

  // ── Phase 3: capture selfie ──
  const captureSelfie = () => {
    if (!videoRef.current || !streamRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 720;
    canvas.height = v.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPhotoBlob(blob);
        setPhotoUrl(URL.createObjectURL(blob));
        // Stop the camera once captured to free the resource
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setPhase("captured");
      },
      "image/jpeg",
      0.85,
    );
  };

  const retakeSelfie = () => {
    setPhotoBlob(null);
    setPhotoUrl("");
    void openCamera();
  };

  // ── Phase 4: upload + RPC ──
  const submitClockEvent = async () => {
    if (!coords || !photoBlob) {
      setError("الموقع أو الصورة ناقصة. ابدأ تاني.");
      setPhase("error");
      return;
    }
    setPhase("uploading");
    setError("");

    const supabase = createClient();

    // 1. Upload photo to the attendance-photos bucket. The bucket must
    //    be created in Supabase Dashboard (private). RLS on the bucket
    //    should allow authenticated users to write under their
    //    own employee folder, and HR to read everything.
    const todayIso = new Date().toISOString().split("T")[0];
    const eventLabel = isCheckOut ? "check-out" : "check-in";
    const path = `${employeeId}/${todayIso}/${eventLabel}-${Date.now()}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from("attendance-photos")
      .upload(path, photoBlob, {
        contentType: "image/jpeg",
        // J6: Supabase Storage's cacheControl expects a numeric seconds
        // value, not the full Cache-Control header. Previous value
        // "private, max-age=3600" was silently dropped. Use just "3600"
        // so the photo is cached for an hour in the signed-URL response.
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadErr) {
      // If the bucket doesn't exist yet, fall through to RPC without
      // photo. HR can still verify by GPS coords.
      console.warn("[clock-in] photo upload failed:", uploadErr.message);
    }

    // 2. Call the RPC
    const rpc = isCheckOut ? "mobile_clock_out" : "mobile_clock_in";
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(rpc, {
      p_lat: coords.lat,
      p_lng: coords.lng,
      p_device_id: navigator.userAgent.slice(0, 200),
    });

    if (rpcErr) {
      setError(rpcErr.message || "ما قدرناش نسجّل الحضور");
      setPhase("error");
      return;
    }

    // 3. Patch the photo URL onto the attendance row (best-effort).
    const rpcRow = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
    const attendanceId =
      rpcRow && typeof rpcRow === "object" && "attendance_id" in rpcRow
        ? (rpcRow as { attendance_id: string }).attendance_id
        : null;

    if (attendanceId && !uploadErr) {
      await supabase
        .from("attendance")
        .update(
          isCheckOut
            ? { check_out_photo_url: path }
            : { check_in_photo_url: path },
        )
        .eq("id", attendanceId);
    }

    const nowStr = new Date().toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setDoneMessage(
      isCheckOut
        ? `✓ اتسجّل انصرافك الساعة ${nowStr}`
        : `✓ اتسجّل حضورك الساعة ${nowStr}`,
    );
    if (isCheckOut) {
      setCheckedOutAt(new Date().toISOString());
    } else {
      setCheckedInAt(new Date().toISOString());
    }
    setPhase("done");
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-4 font-cairo">
      <div className="max-w-md mx-auto pt-6">
        {/* ──────────────────────────────────────────────────────────────
            CRITICAL: In-app browser warning
            ──────────────────────────────────────────────────────────────
            WhatsApp / Facebook / Instagram / Telegram open external links
            in their own in-app browser, which BLOCKS:
              ✗ Camera (getUserMedia returns black video)
              ✗ PWA install (no Share button)
              ✗ Cookies between sessions
            Without this banner, the employee would just see broken UI
            and assume the app is broken. Shown ABOVE everything else so
            they fix the issue before tapping anything. */}
        {isInAppBrowser && (
          <div className="mb-5 bg-gradient-to-br from-amber-50 to-rose-50 border-2 border-amber-300 rounded-2xl p-4 shadow-md">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl">⚠</span>
              <div className="flex-1">
                <h2 className="font-black text-amber-900 mb-1">
                  افتح اللينك في متصفّحك
                </h2>
                <p className="text-xs text-amber-800 leading-relaxed">
                  أنت بتفتح الصفحة من جوّه{" "}
                  <strong>{HOST_LABELS[browserHost]}</strong>، والكاميرا
                  والـ GPS ما يقدروش يشتغلوا هنا. لازم تفتح اللينك في{" "}
                  <strong>{isIos ? "Safari" : "Chrome"}</strong> علشان كل
                  حاجة تشتغل صح.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={openInSystemBrowser}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm shadow-md transition active:scale-95"
              >
                🌐 افتح في {isIos ? "Safari" : "Chrome"}
              </button>

              <button
                type="button"
                onClick={copyUrlToClipboard}
                className="w-full px-4 py-3 rounded-xl bg-white border-2 border-amber-300 hover:border-amber-500 text-amber-900 font-bold text-sm transition active:scale-95"
              >
                {copyDone ? "✓ اتنسخ — افتح المتصفح والصق" : "📋 انسخ الرابط"}
              </button>
            </div>

            <details className="mt-3 text-xs text-amber-800">
              <summary className="cursor-pointer font-bold">
                مش شغّال؟ اعمل ده يدوياً ←
              </summary>
              <ol className="mt-2 space-y-1 list-decimal pr-5 leading-relaxed">
                <li>اضغط على القائمة (الـ <strong>...</strong> أو الـ ٣ نقط)</li>
                <li>
                  لاقي <strong>"Open in {isIos ? "Safari" : "Chrome"}"</strong>{" "}
                  أو <strong>"Open in Browser"</strong>
                </li>
                <li>أو ابسط: انسخ الرابط افتح متصفحك والصقه</li>
              </ol>
            </details>
          </div>
        )}

        {/* Header */}
        <header className="text-center mb-5">
          <div className="text-xs text-slate-500 tracking-widest font-bold uppercase mb-1">
            {companyName}
          </div>
          <h1 className="text-2xl font-black text-slate-800">
            أهلاً يا {employeeName.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isCheckOut
              ? "سجّل انصرافك دلوقتي"
              : isAlreadyDone
                ? "خلصت يومك — لقاء الغد!"
                : "ابدأ بتسجيل حضورك"}
          </p>
          {/* PWA install nudge — only shows on installable browsers when
              the app isn't already installed. Hidden in in-app browsers
              because they can't install PWAs anyway. */}
          {!isInAppBrowser && (
            <div className="mt-3">
              <PWAInstallButton />
            </div>
          )}
        </header>

        {/* Status pills (today's current state) */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div
            className={`p-3 rounded-xl text-center border-2 ${
              checkedInAt
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <div className="text-xs font-bold mb-1">دخول</div>
            <div className="text-lg font-black">{formatTime(checkedInAt)}</div>
          </div>
          <div
            className={`p-3 rounded-xl text-center border-2 ${
              checkedOutAt
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <div className="text-xs font-bold mb-1">خروج</div>
            <div className="text-lg font-black">{formatTime(checkedOutAt)}</div>
          </div>
        </div>

        {/* Done state — short and sweet */}
        {(phase === "done" || isAlreadyDone) && (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
            <div className="text-6xl mb-3">✓</div>
            <div className="text-emerald-800 font-bold text-lg mb-2">
              {phase === "done" ? doneMessage : "خلصت كل حاجة"}
            </div>
            {distance !== null && (
              <div className="text-xs text-emerald-700">
                المسافة من المكتب: {distance}م
              </div>
            )}
          </div>
        )}

        {/* Main action card */}
        {phase !== "done" && !isAlreadyDone && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5">
            {/* Phase 1: ask for location */}
            {phase === "idle" && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-5xl mb-2">📍</div>
                  <h2 className="font-bold text-slate-800 text-lg mb-1">
                    خطوة 1 من 3
                  </h2>
                  <p className="text-sm text-slate-600">
                    اسمح للموقع علشان نتأكد إنك في {geofenceEnabled
                      ? "مكان العمل"
                      : "الموقع المسجّل"}
                    .
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg active:scale-95 transition"
                >
                  📍 شارك موقعك
                </button>
              </div>
            )}

            {/* Locating spinner */}
            {phase === "locating" && (
              <div className="text-center py-6">
                <div className="text-5xl mb-3 animate-pulse">📡</div>
                <div className="text-slate-700 font-bold">بنحدّد موقعك...</div>
                <div className="text-xs text-slate-500 mt-1">
                  يا ريت تخرج برّه لو في مبنى مغلق
                </div>
              </div>
            )}

            {/* Phase 2: camera off — show location result + camera button */}
            {phase === "camera_off" && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <div className="text-xs text-emerald-700 mb-1">
                    📍 موقعك محدّد
                  </div>
                  {distance !== null && (
                    <div className="text-sm font-bold text-emerald-800">
                      المسافة من المكتب: {distance}م
                      {geofenceEnabled && distance > radiusMeters && (
                        <div className="text-xs text-rose-700 mt-1">
                          ⚠ خارج النطاق المسموح ({radiusMeters}م)
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-5xl mb-2">📸</div>
                  <h2 className="font-bold text-slate-800 text-lg mb-1">
                    خطوة 2 من 3
                  </h2>
                  <p className="text-sm text-slate-600">
                    صورة سيلفي علشان نتأكد إنك أنت اللي بتسجّل
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCamera}
                  className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg active:scale-95 transition"
                >
                  📸 افتح الكاميرا
                </button>
              </div>
            )}

            {/* Camera live view */}
            {phase === "camera_on" && (
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full rounded-xl bg-slate-900 aspect-square object-cover"
                />
                <button
                  type="button"
                  onClick={captureSelfie}
                  className="w-full px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg active:scale-95 transition"
                >
                  📸 خد الصورة
                </button>
              </div>
            )}

            {/* Captured — confirm or retake */}
            {phase === "captured" && photoUrl && (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt="Selfie"
                  className="w-full rounded-xl aspect-square object-cover"
                />
                <h2 className="text-center font-bold text-slate-800">
                  خطوة 3 من 3
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={retakeSelfie}
                    className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                  >
                    ↻ إعادة
                  </button>
                  <button
                    type="button"
                    onClick={submitClockEvent}
                    className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-md transition"
                  >
                    {isCheckOut ? "✓ سجّل الانصراف" : "✓ سجّل الحضور"}
                  </button>
                </div>
              </div>
            )}

            {/* Uploading spinner */}
            {phase === "uploading" && (
              <div className="text-center py-8">
                <div className="text-5xl mb-3 animate-spin">⏳</div>
                <div className="text-slate-700 font-bold">بنسجّل الحضور...</div>
              </div>
            )}

            {/* Error */}
            {phase === "error" && (
              <div className="space-y-3">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                  <div className="text-3xl mb-2">⚠</div>
                  <div className="text-rose-800 font-bold">{error}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setPhase("idle");
                  }}
                  className="w-full px-6 py-3 rounded-xl bg-brand-cyan text-white font-bold transition"
                >
                  جرب تاني
                </button>
              </div>
            )}
          </div>
        )}

        <div className="text-center mt-6 text-xs text-slate-400">
          نِظام · حضور وانصراف من الموبايل
        </div>
      </div>
    </main>
  );
}
