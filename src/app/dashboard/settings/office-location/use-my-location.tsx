"use client";

import { useState } from "react";

// Asks the browser for the current GPS coordinates and writes them
// into the two number inputs (lat, lng) on the page. Browsers only
// hand out geolocation on https:// or localhost -- which is fine for
// our Vercel deploy and the local Enterprise dev box.
export function UseMyLocationButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const ask = () => {
    setError(null);
    setOkMessage(null);

    if (!("geolocation" in navigator)) {
      setError("المتصفح ده مش بيدعم GPS");
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const latInput = document.getElementById("office_lat") as HTMLInputElement | null;
        const lngInput = document.getElementById("office_lng") as HTMLInputElement | null;
        if (latInput) latInput.value = pos.coords.latitude.toFixed(7);
        if (lngInput) lngInput.value = pos.coords.longitude.toFixed(7);
        setOkMessage(
          `تم — الدقة ${Math.round(pos.coords.accuracy)} متر. ضغط احفظ في الأسفل.`,
        );
      },
      (err) => {
        setBusy(false);
        const messages: Record<number, string> = {
          1: "رفضت الإذن. لازم تسمح للموقع من إعدادات المتصفح.",
          2: "الكمبيوتر مش بيدعم GPS. استخدم الخريطة تحت — اضغط على مكان المكتب.",
          3: "انتهى وقت الطلب. حاول تاني، أو استخدم الخريطة.",
        };
        setError(messages[err.code] ?? err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={ask}
        disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-60 transition font-cairo"
      >
        {busy ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>جاري قراءة الموقع...</span>
          </>
        ) : (
          <>
            <span>📍</span>
            <span>استخدم موقعي الحالي</span>
          </>
        )}
      </button>
      {okMessage && (
        <p className="text-xs text-emerald-700 font-cairo">{okMessage}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 font-cairo">⚠ {error}</p>
      )}
    </div>
  );
}
