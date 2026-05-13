import { app, BrowserWindow, ipcMain, Menu, shell, net } from "electron";
import path from "node:path";
import squirrelStartup from "electron-squirrel-startup";
import {
  getServerUrl,
  setServerUrl,
  getWindowBounds,
  setWindowBounds,
  getZoomLevel,
} from "./settings";
import { buildAppMenu } from "./menu";

// Squirrel runs the installer's pre/post hooks via the same exe, with
// flags like --squirrel-install. The default export is a boolean: true
// when the process was launched as a hook (create shortcuts / update /
// uninstall) -- in which case the module already spawned Update.exe to
// do the work and we just need to exit before showing a window.
//
// Use ES import (not require) so Vite's SSR build actually inlines the
// module instead of leaving a runtime require() the packaged asar
// can't resolve.
if (squirrelStartup) {
  app.quit();
}

// Enable Chrome DevTools Protocol on port 9222 in dev mode so we can
// automate / inspect the renderer remotely (e.g. via Puppeteer or curl
// against /json/version). Harmless if no one connects.
if (!app.isPackaged) {
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
}

// Globals injected by electron-forge's Vite plugin. They point to the
// built setup-window HTML at runtime.
declare const SETUP_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const SETUP_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

// ----------------------------------------------------------------------------
// Window helpers
// ----------------------------------------------------------------------------

function createWindow(loadUrl: string, isSetup: boolean): BrowserWindow {
  const bounds = getWindowBounds();

  const window = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1024,
    minHeight: 600,
    title: "Nidham",
    backgroundColor: "#0a1428", // brand navy -- matches Nidham's loading screen
    show: false, // wait for first paint to prevent white flash
    icon: path.join(process.resourcesPath, "assets", "icon.png"),
    autoHideMenuBar: isSetup, // hide menu on first-run setup
    webPreferences: {
      // Both main.js and preload.js end up in .vite/build/ side by side
      // -- electron-forge plugin-vite emits all targets into the same
      // build directory. Pointing this at "../preload/preload.js" used
      // to send Electron looking for .vite/preload/preload.js, which
      // doesn't exist; the preload silently failed to load and the
      // renderer's window.nidham bridge was undefined.
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // off so preload can use 'electron' module
      // Apply the persisted zoom level on first paint
      zoomFactor: zoomLevelToFactor(getZoomLevel()),
    },
  });

  window.once("ready-to-show", () => {
    window.show();
    window.webContents.setZoomLevel(getZoomLevel());

    // Auto-open DevTools when running via `npm start` (not when packaged).
    // Makes it trivial to spot a typo in the renderer without forcing the
    // HR user to learn keyboard shortcuts in production.
    if (!app.isPackaged && isSetup) {
      window.webContents.openDevTools({ mode: "detach" });
    }
  });

  // Persist size/position as the user moves the window
  const persistBounds = () => {
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
    setWindowBounds(window.getBounds());
  };
  window.on("resize", persistBounds);
  window.on("move", persistBounds);

  // Open external links in the system browser instead of inside Electron
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const configured = getServerUrl();
      // Same-origin (the user's Nidham server) -> open in this window
      if (configured && url.startsWith(configured)) {
        return { action: "allow" };
      }
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "deny" };
  });

  if (isSetup) {
    // First-run setup screen -- bundled HTML in our app
    if (SETUP_WINDOW_VITE_DEV_SERVER_URL) {
      window.loadURL(SETUP_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      window.loadFile(
        path.join(
          __dirname,
          `../renderer/${SETUP_WINDOW_VITE_NAME}/index.html`,
        ),
      );
    }
  } else {
    // The Nidham web app -- could be Cloud or self-hosted
    window.loadURL(loadUrl);
  }

  return window;
}

// ----------------------------------------------------------------------------
// Setup-window IPC
// Renderer asks us to test/save a server URL.
// ----------------------------------------------------------------------------

ipcMain.handle("setup:test-connection", async (_evt, rawUrl: string) => {
  const url = sanitizeUrl(rawUrl);
  if (!url) return { ok: false, error: "URL مش صحيح" };

  // Hard timeout: Electron's net.request has NO default deadline and will
  // happily wait forever on a wrong host. Without this, an HR typo would
  // hang the spinner indefinitely.
  const TIMEOUT_MS = 8000;

  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    let settled = false;
    const settle = (result: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        req.abort();
      } catch {
        /* already finished */
      }
      resolve(result);
    };

    const timer = setTimeout(
      () => settle({ ok: false, error: "السيرفر مش بيرد (انتهت المهلة 8 ثواني)" }),
      TIMEOUT_MS,
    );

    const req = net.request(`${url}/login`);
    req.on("response", (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 200 && status < 500) {
        settle({ ok: true });
      } else {
        settle({ ok: false, error: `الخادم رد بـ HTTP ${status}` });
      }
      res.on("data", () => undefined);
      res.on("end", () => undefined);
    });
    req.on("error", (err) => {
      settle({ ok: false, error: arabicizeNetError(err.message) });
    });
    req.setHeader("User-Agent", "Nidham-Desktop/1.0.0");
    req.end();
  });
});

ipcMain.handle("setup:save-and-open", (_evt, rawUrl: string) => {
  const url = sanitizeUrl(rawUrl);
  if (!url) return { ok: false, error: "URL مش صحيح" };
  try {
    setServerUrl(url);
  } catch (err) {
    return {
      ok: false,
      error: `فشل الحفظ: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Reveal the app menu now that we're leaving setup mode. The renderer
  // takes care of the actual navigation (window.location.href = url) so
  // the IPC reply + navigation stay in a single JS context.
  if (mainWindow && !mainWindow.isDestroyed()) {
    Menu.setApplicationMenu(buildAppMenu(() => mainWindow));
    mainWindow.setAutoHideMenuBar(false);
    mainWindow.setMenuBarVisibility(true);
  }

  return { ok: true, sanitizedUrl: url };
});

// ----------------------------------------------------------------------------
// App lifecycle
// ----------------------------------------------------------------------------

app.whenReady().then(() => {
  const savedUrl = getServerUrl();

  if (savedUrl) {
    // Returning user -- jump straight to the app
    mainWindow = createWindow(savedUrl, /* isSetup */ false);
    Menu.setApplicationMenu(buildAppMenu(() => mainWindow));
  } else {
    // First run -- show the setup form
    mainWindow = createWindow("", /* isSetup */ true);
    Menu.setApplicationMenu(null);
  }
});

app.on("window-all-closed", () => {
  // Standard Electron pattern: stay alive on Mac, quit elsewhere
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const savedUrl = getServerUrl();
    mainWindow = createWindow(savedUrl ?? "", !savedUrl);
  }
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function sanitizeUrl(raw: string): string | null {
  try {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Default to http:// if the user just typed an IP without a scheme
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function arabicizeNetError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("enotfound")) return "السيرفر مش موجود (DNS error)";
  if (m.includes("econnrefused")) return "السيرفر رفض الاتصال — اتأكد إنه شغّال";
  if (m.includes("etimedout") || m.includes("timeout")) return "انتهت مهلة الاتصال";
  if (m.includes("certificate") || m.includes("ssl")) return "مشكلة في شهادة الـ HTTPS";
  return message;
}

function zoomLevelToFactor(level: number): number {
  // Electron's `zoomFactor` is a multiplier (1.0 = 100%). Each `zoomLevel`
  // step is roughly a 20% change. -3 -> 0.5x, +3 -> ~1.75x.
  return Math.pow(1.2, level);
}
