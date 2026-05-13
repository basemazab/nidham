// Renderer logic for the first-run setup screen.
//
// The IPC API is exposed by ../preload/preload.ts on window.nidham.
// We deliberately avoid importing any node/electron module here -- this
// file runs in a regular sandboxed browser context.

import type { NidhamApi } from "../preload/preload";

declare global {
  interface Window {
    nidham: NidhamApi;
  }
}

const form = document.getElementById("setup-form") as HTMLFormElement;
const input = document.getElementById("server-url") as HTMLInputElement;
const status = document.getElementById("status") as HTMLDivElement;
const testBtn = document.getElementById("test-btn") as HTMLButtonElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;

// Quick-fill chips ("استخدم نسخة Nidham السحابية" etc.)
document.querySelectorAll<HTMLButtonElement>(".example").forEach((btn) => {
  btn.addEventListener("click", () => {
    const url = btn.dataset.url ?? "";
    input.value = url;
    input.focus();
    setStatus("idle");
  });
});

// ----------------------------------------------------------------------------
// Test connection
// ----------------------------------------------------------------------------

testBtn.addEventListener("click", async () => {
  const url = input.value.trim();
  if (!url) {
    setStatus("error", "اكتب رابط أولًا");
    input.focus();
    return;
  }

  setStatus("loading", "بنحاول نوصل للسيرفر...");
  toggleButtons(true);

  const result = await window.nidham.testConnection(url);

  toggleButtons(false);

  if (result.ok) {
    setStatus("ok", "✓ الاتصال نجح — تقدر تحفظ وتدخل");
  } else {
    setStatus("error", `✗ ${result.error ?? "فشل الاتصال"}`);
  }
});

// ----------------------------------------------------------------------------
// Save and enter
// ----------------------------------------------------------------------------

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const url = input.value.trim();
  if (!url) {
    setStatus("error", "اكتب رابط أولًا");
    input.focus();
    return;
  }

  setStatus("loading", "بنحفظ ونفتح Nidham...");
  toggleButtons(true);

  let result: Awaited<ReturnType<typeof window.nidham.saveAndOpen>>;
  try {
    result = await window.nidham.saveAndOpen(url);
  } catch (err) {
    // window.nidham would be missing if the preload script failed to load
    // (path bug, sandbox restriction, etc.) — surface it clearly instead
    // of leaving the form locked in the loading state.
    toggleButtons(false);
    setStatus(
      "error",
      `✗ IPC error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  if (!result.ok || !result.sanitizedUrl) {
    toggleButtons(false);
    setStatus("error", `✗ ${result.error ?? "فشل الحفظ"}`);
    return;
  }

  // Navigate this same window to the Nidham server we just saved. Doing
  // it from the renderer (instead of mainWindow.loadURL) keeps the IPC
  // reply and the navigation in a single deterministic JS context.
  setStatus("loading", `بنفتح ${result.sanitizedUrl}...`);
  window.location.href = result.sanitizedUrl;
});

// ----------------------------------------------------------------------------
// UI helpers
// ----------------------------------------------------------------------------

type StatusKind = "idle" | "ok" | "error" | "loading";

function setStatus(kind: StatusKind, message?: string): void {
  if (kind === "idle" || !message) {
    status.className = "status hidden";
    status.textContent = "";
    return;
  }
  status.className = `status ${kind}`;
  if (kind === "loading") {
    status.innerHTML = `<span class="spinner"></span><span>${message}</span>`;
  } else {
    status.textContent = message;
  }
}

function toggleButtons(disabled: boolean): void {
  testBtn.disabled = disabled;
  saveBtn.disabled = disabled;
}

// Auto-focus the input on first paint
window.addEventListener("DOMContentLoaded", () => {
  input.focus();
});
