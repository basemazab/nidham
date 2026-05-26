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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isCheckOut = checkedInAt !== null && checkedOutAt === null;
  const isAlreadyDone = checkedInAt !== null && checkedOutAt !== null;

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
  const openCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 720, height: 720 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("camera_on");
    } catch {
      setError("ما قدرناش نشغّل الكاميرا. اسمح للكاميرا من إعدادات المتصفح.");
      setPhase("error");
    }
  };

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
        cacheControl: "private, max-age=3600",
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
