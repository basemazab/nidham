import { app, BrowserWindow, ipcMain, Menu, shell, net } from "electron";
import path from "node:path";
import {
  getServerUrl,
  setServerUrl,
  getWindowBounds,
  setWindowBounds,
  getZoomLevel,
} from "./settings";
import { buildAppMenu } from "./menu";

// Squirrel runs the installer's pre/post hooks via the same exe, with
// flags like --squirrel-install. This module short-circuits the app boot
// during those hooks so the user doesn't see a window flash.
//   eslint-disable-next-line @typescript-eslint/no-var-requires
if (require("electron-squirrel-startup")) {
  app.quit();
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
      preload: path.join(__dirname, "../preload/preload.js"),
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

  // Use Electron's net module so we go through the same proxy/cookie jar
  // the renderer eventually will, instead of Node's http (which doesn't).
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const req = net.request(`${url}/login`);
    req.on("response", (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 200 && status < 500) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: `الخادم رد بـ HTTP ${status}` });
      }
      // Drain so the connection closes cleanly
      res.on("data", () => undefined);
      res.on("end", () => undefined);
    });
    req.on("error", (err) => {
      resolve({ ok: false, error: arabicizeNetError(err.message) });
    });
    req.setHeader("User-Agent", "Nidham-Desktop/1.0.0");
    req.end();
  });
});

ipcMain.handle("setup:save-and-open", (_evt, rawUrl: string) => {
  const url = sanitizeUrl(rawUrl);
  if (!url) return { ok: false, error: "URL مش صحيح" };
  setServerUrl(url);

  // Swap the setup window for the real app window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  mainWindow = createWindow(url, /* isSetup */ false);
  Menu.setApplicationMenu(buildAppMenu(() => mainWindow));
  return { ok: true };
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
