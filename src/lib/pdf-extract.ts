// PDF text extraction for uploaded CVs.
//
// Uses pdf-parse v2 (a PDFParse class wrapping pdfjs-dist). Returns clean text
// suitable for sending to the AI screener. Throws human-readable errors so
// the form action can surface them as a flash message.

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PAGES = 30; // generous — most CVs are 1-3 pages

export async function extractPdfText(file: File): Promise<string> {
  if (file.size === 0) {
    throw new Error("الملف فاضي");
  }
  if (file.size > MAX_BYTES) {
    throw new Error(
      `الملف كبير جدًا (${(file.size / 1024 / 1024).toFixed(1)} MB). الحد الأقصى 5 MB.`,
    );
  }

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("لازم الملف يكون PDF");
  }

  // Dynamic import — pdf-parse pulls in pdfjs which is heavy.
  const { PDFParse } = await import("pdf-parse");

  const arrayBuf = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuf);

  const parser = new PDFParse({ data });

  let pages: { text: string }[];
  let combined = "";
  try {
    const result = await parser.getText({ last: MAX_PAGES });
    pages = result.pages ?? [];
    // result.text on v2 is the concatenated document text
    combined =
      (result as unknown as { text?: string }).text ??
      pages.map((p) => p.text).join("\n\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`فشل قراءة الـ PDF: ${msg}`);
  } finally {
    await parser.destroy().catch(() => {
      // best-effort cleanup
    });
  }

  const text = combined.trim();
  if (text.length < 30) {
    throw new Error(
      "نص الـ PDF فارغ أو قصير جدًا — يمكن يكون الملف مسحوب من صور (scanned).",
    );
  }

  // Collapse excessive whitespace — PDFs love to insert extra newlines.
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
