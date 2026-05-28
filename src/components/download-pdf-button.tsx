"use client";

// Captures a DOM element as PNG (html2canvas-pro), wraps it in a
// multi-page A4 PDF (jsPDF), and triggers a browser download. Works
// regardless of whether window.print() succeeds, which has been the
// pain point on the desktop wrapper.
//
// Why html2canvas-pro instead of html2canvas? html2canvas hasn't
// shipped in years and chokes on modern CSS (oklch colours, color-mix,
// some flex/grid edge cases). The "-pro" fork is actively maintained
// and handles our Tailwind output without monkey-patching colours.
//
// Both libraries are dynamic-imported on click, so the gzipped
// payload (~120kb) never enters the initial bundle.

import { useState } from "react";

type Props = {
  /** CSS selector for the element to capture. */
  targetSelector: string;
  /** Suggested file name including .pdf */
  filename: string;
  /** Optional button label override. */
  label?: string;
  /** Optional Tailwind className override. */
  className?: string;
  /**
   * Elements matching this CSS selector inside the target are
   * excluded from the rendered PDF. Use for action buttons /
   * interactive cells that shouldn't appear in the print output.
   * Default: ".pdf-hide" — also matches `<div data-pdf-hide />`
   * because we union with `[data-pdf-hide]`.
   */
  hideSelector?: string;
};

export function DownloadPdfButton({
  targetSelector,
  filename,
  label = "📥 تنزيل PDF",
  className,
  hideSelector = ".pdf-hide, [data-pdf-hide]",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const target = document.querySelector(targetSelector) as HTMLElement | null;
      if (!target) {
        setError("ما لقيتش المحتوى اللي هينحفظ");
        return;
      }

      const [html2canvasMod, jsPDFMod] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const html2canvas = html2canvasMod.default;
      const jsPDF = jsPDFMod.default;

      // Render at 2x for a sharper PDF -- mobile screens are dense
      // and we want the printed sheet to look crisp on A4. The
      // ignoreElements callback drops action buttons / link cells
      // from the captured PDF so it reads as a clean report.
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        ignoreElements: (el) => {
          try {
            return el.matches(hideSelector);
          } catch {
            return false;
          }
        },
      });

      // Build an A4 portrait PDF and stretch the captured image across
      // it. If the content is taller than a page, split it across
      // multiple pages by translating the same image upward each time.
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      const imgData = canvas.toDataURL("image/png");

      if (imgH <= pageH) {
        // Fits on one page.
        pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
      } else {
        // Multi-page: place the image at progressively negative Y
        // offsets so each page shows the next slice.
        let remaining = imgH;
        let y = 0;
        while (remaining > 0) {
          pdf.addImage(imgData, "PNG", 0, y, imgW, imgH);
          remaining -= pageH;
          y -= pageH;
          if (remaining > 0) pdf.addPage();
        }
      }

      pdf.save(filename);
    } catch (err) {
       
      console.error("PDF generation failed:", err);
      setError("مش قادر يحضّر الـ PDF — جرّب تاني");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={
          className ??
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/40 transition font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
        }
      >
        {busy ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>...جاري التحضير</span>
          </>
        ) : (
          <span>{label}</span>
        )}
      </button>
      {error && (
        <span className="text-[11px] text-red-600 font-cairo">⚠ {error}</span>
      )}
    </div>
  );
}
