"use client";

// ============================================================================
// SignPad — HTML5 canvas signature capture + submit
// ============================================================================
//
// Mobile-first canvas component. Supports both touch and mouse events.
// On submit:
//   1. Validates: name typed + canvas has been drawn on (non-blank)
//   2. Exports canvas as PNG data URL
//   3. POSTs to /api/sign/[token]/submit
//   4. On success, shows the "✓ done" state — the parent page is
//      stateless so refresh would show the same "already signed" view.

import { useEffect, useRef, useState } from "react";

type Props = {
  token: string;
  defaultName: string;
};

export function SignPad({ token, defaultName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState(defaultName);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Resize canvas to its actual DOM size + reset background once mounted
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  // ── Drawing handlers ──
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  // J6: total pixel-distance drawn. The previous "hasDrawn" flag flipped
  // true on the first 2-pixel move, which accepted near-empty signatures
  // (a single twitch). Require ~50px of actual ink before enabling submit.
  const totalDrawnRef = useRef(0);
  const MIN_SIGNATURE_DISTANCE = 50;

  const startDraw = (x: number, y: number) => {
    drawingRef.current = true;
    lastPointRef.current = { x, y };
  };

  const moveDraw = (x: number, y: number) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    // Track cumulative pixel distance so we can reject blank-ish signatures
    const dx = x - last.x;
    const dy = y - last.y;
    totalDrawnRef.current += Math.sqrt(dx * dx + dy * dy);
    lastPointRef.current = { x, y };
    if (!hasDrawn && totalDrawnRef.current >= MIN_SIGNATURE_DISTANCE) {
      setHasDrawn(true);
    }
  };

  const endDraw = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    totalDrawnRef.current = 0; // J6: reset the stroke counter on clear
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("اكتب اسمك");
      return;
    }
    if (!hasDrawn) {
      setError("ارسم توقيعك في الصندوق");
      return;
    }
    if (!canvasRef.current) return;
    setError("");
    setBusy(true);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const res = await fetch(`/api/sign/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer_name: name.trim(),
          signature_png: dataUrl,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "ما قدرناش نسجّل التوقيع. جرب تاني.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("ما قدرناش نتواصل مع السيرفر. تأكد من الإنترنت.");
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-8 text-center font-cairo">
        <div className="text-6xl mb-3">✓</div>
        <div className="text-xl font-black text-emerald-800 mb-2">
          تم التوقيع بنجاح
        </div>
        <div className="text-sm text-emerald-700">
          شكراً يا {name.split(" ")[0]}! المرسل هيتلقى إشعار خلال لحظات.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 font-cairo">
      <div className="text-xs text-slate-500 mb-3 font-bold uppercase tracking-wider">
        ✍ التوقيع
      </div>

      <label className="block text-xs text-slate-600 mb-1">اسمك بالكامل *</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 mb-4 rounded-lg border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-slate-900 text-sm"
      />

      <label className="block text-xs text-slate-600 mb-1">
        ارسم توقيعك في الصندوق *
      </label>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-48 rounded-lg border-2 border-dashed border-slate-300 bg-white touch-none"
          onMouseDown={(e) => {
            const { x, y } = getCanvasCoords(e);
            startDraw(x, y);
          }}
          onMouseMove={(e) => {
            const { x, y } = getCanvasCoords(e);
            moveDraw(x, y);
          }}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={(e) => {
            e.preventDefault();
            const { x, y } = getCanvasCoords(e);
            startDraw(x, y);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const { x, y } = getCanvasCoords(e);
            moveDraw(x, y);
          }}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm">
            ارسم هنا بإصبعك
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
        <button
          type="button"
          onClick={clear}
          className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
        >
          ↻ مسح
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={busy || !hasDrawn || !name.trim()}
          className="flex-1 max-w-[260px] px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold text-sm shadow-md transition active:scale-95"
        >
          {busy ? "⏳ بنسجّل التوقيع..." : "✍ سجّل التوقيع"}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
          ⚠ {error}
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-3 text-center">
        بتوقيعك أنت تأكد إنك اطلعت على المستند ووافقت على شروطه. الـ IP
        والوقت بيتسجّلوا للتوثيق.
      </p>
    </div>
  );
}
