import { contextBridge, ipcRenderer } from "electron";

// Whitelist of IPC channels exposed to the renderer. Anything else throws.
// Keeps the attack surface tiny -- the renderer is loading our own bundled
// setup HTML, but the same preload runs and we shouldn't leak ipcRenderer.
const api = {
  testConnection: (url: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("setup:test-connection", url),

  // Persists the URL in the main process and reveals the app menu.
  // On success returns the sanitized URL so the renderer can navigate
  // to it via window.location.href.
  saveAndOpen: (
    url: string,
  ): Promise<{ ok: boolean; error?: string; sanitizedUrl?: string }> =>
    ipcRenderer.invoke("setup:save-and-open", url),
};

// Exposed at `window.nidham` inside the renderer
contextBridge.exposeInMainWorld("nidham", api);

// Mirror the type so the renderer can `declare global { Window: { nidham: ... } }`
export type NidhamApi = typeof api;
