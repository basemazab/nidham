import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  screen,
  shell,
  net,
  session,
  dialog,
} from "electron";
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

// Single-instance lock. Double-clicking the desktop shortcut while the
// app is already running used to spin up a second window with its own
// session, which split the user's login cookie across two processes
// and confused everyone. Now the second instance immediately quits and
// asks the first instance to surface its window.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Catch otherwise-unhandled promise rejections + sync exceptions so the
// process doesn't die silently. We log to the console (visible in dev)
// and pop up a dialog in production so the HR user has a chance to
// screenshot the error.
process.on("uncaughtException", (err) => {
   
  console.error("[main] uncaughtException:", err);
  if (app.isReady()) {
    dialog.showErrorBox(
      "خطأ غير متوقع في Nidham",
      `حصل خطأ في النظام. حاول تعيد فتح البرنامج.\n\n${err?.stack ?? err}`,
    );
  }
});
process.on("unhandledRejection", (reason) => {
   
  console.error("[main] unhandledRejection:", reason);
});

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
  const bounds = sanitizeBounds(getWindowBounds());

  // Resolve the window icon path with a dev/prod fallback. In a packaged
  // build the assets live under `resources/assets/`; in dev (`npm start`)
  // there is no resources dir, so fall back to the source `desktop/assets/`.
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "assets", "icon.png")
    : path.join(__dirname, "..", "..", "assets", "icon.png");

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
    icon: iconPath,
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
    },
  });

  // Track recent error-page renders so a server that's down doesn't
  // bounce the user between the error page and a retry forever. Reset
  // whenever a real navigation succeeds.
  let recentErrorPageAt = 0;

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

  // Persist size/position as the user moves the window. Debounced because
  // a single drag fires `move` ~60 times per second; writing to disk on
  // every event hammers the FS and slows the drag visibly.
  let persistTimer: NodeJS.Timeout | null = null;
  const persistBounds = () => {
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen())
      return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      if (!window.isDestroyed()) setWindowBounds(window.getBounds());
    }, 400);
  };
  window.on("resize", persistBounds);
  window.on("move", persistBounds);
  window.on("closed", () => {
    if (persistTimer) clearTimeout(persistTimer);
  });

  // Open external links in the system browser instead of inside Electron.
  // Same-origin links (the user's Nidham server) stay in the window so
  // the SPA navigation works correctly.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (isSameOrigin(url, getServerUrl())) return { action: "allow" };
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "deny" };
  });

  // SECURITY: prevent the renderer from navigating to an unrelated
  // origin. Without this, a phishing link inside Nidham — or a redirect
  // chain through a compromised dependency — could take over the whole
  // window. The configured server origin is allow-listed; everything
  // else is opened in the system browser and the navigation cancelled.
  window.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("data:") || url.startsWith("about:")) return; // internal recovery pages OK
    if (isSameOrigin(url, getServerUrl())) return;
    event.preventDefault();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
  });

  // SECURITY: deny all permission requests by default. The web app
  // running inside Nidham asks for geolocation (for GPS attendance) —
  // we let that one through if the request comes from the configured
  // server origin. Everything else (notifications, camera, mic, etc.)
  // is denied. The user can still grant explicitly from their browser
  // if they really need it.
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const allowGeolocation =
        permission === "geolocation" &&
        isSameOrigin(details.requestingUrl, getServerUrl());
      callback(!!allowGeolocation);
    },
  );

  // Recovery: if the renderer process crashes (OOM, native panic, etc.)
  // Electron shows a blank window. Detect it and offer a one-click reload.
  window.webContents.on("render-process-gone", (_event, details) => {
    // "clean-exit" / "exited-from-renderer" are normal shutdowns; only
    // act on actual crashes.
    if (details.reason === "clean-exit") return;
    const result = dialog.showMessageBoxSync(window, {
      type: "error",
      title: "Nidham توقّف فجأة",
      message: "صفحة Nidham وقفت بسبب خطأ غير متوقع.",
      detail: `السبب: ${details.reason}\n\nتقدر تعيد تحميل الصفحة أو تقفل البرنامج.`,
      buttons: ["إعادة تحميل", "إغلاق البرنامج"],
      defaultId: 0,
      cancelId: 1,
    });
    if (result === 0) {
      window.webContents.reload();
    } else {
      app.quit();
    }
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

    // Recovery overlay: when the renderer fails to load (network error,
    // 5xx response, CSP block, etc.) Electron shows a raw chrome error
    // page that's confusing in Arabic. Replace it with our own panel
    // that gives the HR user a 1-click "try again" + "go to login".
    //
    // Loop guard: if the user clicks "retry" on a server that's still
    // down, we'll receive another did-fail-load and re-render the error
    // page. That's the right behaviour ONCE, but if it happens twice
    // within 2 seconds we suppress the second render — Electron's
    // default chrome error page shows instead, which is honest about
    // the persistent failure.
    window.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame) return; // ignore sub-resource failures
        if (errorCode === -3) return; // ABORTED — fires on legitimate navs

        const now = Date.now();
        if (now - recentErrorPageAt < 2000) return; // loop guard
        recentErrorPageAt = now;

        const url = getServerUrl() ?? "";
        const html = renderErrorPage({
          errorCode,
          errorDescription,
          attemptedUrl: validatedURL || url,
          serverUrl: url,
        });
        window.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
        );
      },
    );

    // Clear the loop guard on every successful navigation, so a retry
    // that finally lands resets the counter for future failures.
    window.webContents.on("did-finish-load", () => {
      recentErrorPageAt = 0;
    });
  }

  return window;
}

// Inline error page shown when did-fail-load fires. Self-contained HTML
// + CSS so it works even when the configured server is completely
// unreachable. Uses query-string-based action triggers we intercept
// with a will-navigate handler on the window.
function renderErrorPage(opts: {
  errorCode: number;
  errorDescription: string;
  attemptedUrl: string;
  serverUrl: string;
}): string {
  const { errorCode, errorDescription, attemptedUrl, serverUrl } = opts;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>تعذّر الاتصال — Nidham</title>
<style>
  body { margin: 0; min-height: 100vh; background: #0a1428; color: #f8fafc;
         display: flex; align-items: center; justify-content: center;
         font-family: "Tajawal", "Cairo", system-ui, sans-serif; padding: 2rem; }
  .card { max-width: 480px; background: rgba(255,255,255,0.04); border: 1px solid #1e293b;
          border-radius: 20px; padding: 2rem; box-shadow: 0 24px 48px rgba(0,0,0,0.4); }
  h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
  p { color: #94a3b8; line-height: 1.7; margin: 0 0 1rem; }
  .err { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3);
         border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1.5rem;
         color: #fca5a5; font-size: 0.85rem; line-height: 1.6; }
  .err code { background: #0a1428; padding: 2px 6px; border-radius: 4px; direction: ltr;
              display: inline-block; }
  .actions { display: flex; flex-direction: column; gap: 0.5rem; }
  a { display: block; padding: 0.85rem 1.25rem; border-radius: 12px;
      text-align: center; text-decoration: none; font-weight: 700;
      transition: transform 0.1s ease; }
  a.primary { background: linear-gradient(135deg, #22d3ee, #0891b2); color: white; }
  a.secondary { background: rgba(255,255,255,0.08); color: #f8fafc;
                border: 1px solid #334155; }
  a:hover { transform: translateY(-1px); }
  .logo { width: 56px; height: 56px; border-radius: 16px;
          background: linear-gradient(135deg, #22d3ee, #0a1428);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.75rem; font-weight: 900; color: white; margin-bottom: 1rem; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">ن</div>
    <h1>تعذّر الاتصال بسيرفر نِظام</h1>
    <p>التطبيق ما قدرش يحمّل الصفحة. ممكن يكون الاتصال بالإنترنت متقطع أو السيرفر يحدّث.</p>
    <div class="err">
      <div><b>الخطأ:</b> ${escapeHtml(errorDescription)} (${errorCode})</div>
      <div><b>الرابط:</b> <code>${escapeHtml(attemptedUrl)}</code></div>
    </div>
    <div class="actions">
      <a class="primary" href="${escapeHtml(serverUrl || "https://nidhamhr.com")}/login">
        ↻ حاول تاني — صفحة الدخول
      </a>
      <a class="secondary" href="${escapeHtml(serverUrl || "https://nidhamhr.com")}">
        🏠 الصفحة الرئيسية
      </a>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  // hang the spinner indefinitely. 15s tolerates slow Egyptian 3G + the
  // Vercel cold-start latency that Pro free tenants sometimes see.
  const TIMEOUT_MS = 15000;

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
      () =>
        settle({
          ok: false,
          error: "السيرفر مش بيرد (انتهت المهلة 15 ثانية)",
        }),
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

// When a second instance is launched (user double-clicks the shortcut
// again), Electron fires this on the FIRST instance. Bring its window
// forward instead of starting a new process.
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app
  .whenReady()
  .then(() => {
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
  })
  .catch((err) => {
     
    console.error("[main] whenReady failed:", err);
    dialog.showErrorBox(
      "تعذّر بدء Nidham",
      `حصل خطأ أثناء فتح البرنامج:\n\n${
        err instanceof Error ? err.stack : String(err)
      }`,
    );
    app.exit(1);
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

// ----------------------------------------------------------------------------
// sanitizeBounds — make sure persisted window position is still on a
// visible display. Saving (x: 1800, y: 200) on a 3-monitor setup and
// then launching the app on a single laptop screen would open the
// window completely off-screen with no way to drag it back. We clamp
// to the work area of the nearest monitor.
// ----------------------------------------------------------------------------
function sanitizeBounds(b: ReturnType<typeof getWindowBounds>) {
  const width = Math.max(1024, Math.min(b.width ?? 1280, 3840));
  const height = Math.max(600, Math.min(b.height ?? 800, 2160));

  if (b.x === undefined || b.y === undefined) {
    return { width, height };
  }

  // Find the display that contains the requested top-left point. If
  // none does, we'll have to re-center on the primary display.
  const displays = screen.getAllDisplays();
  const inside = displays.find((d) => {
    const wa = d.workArea;
    return (
      b.x! >= wa.x &&
      b.y! >= wa.y &&
      b.x! < wa.x + wa.width &&
      b.y! < wa.y + wa.height
    );
  });

  if (!inside) {
    // Off-screen — center on the primary display's work area
    const wa = screen.getPrimaryDisplay().workArea;
    return {
      width,
      height,
      x: wa.x + Math.max(0, Math.round((wa.width - width) / 2)),
      y: wa.y + Math.max(0, Math.round((wa.height - height) / 2)),
    };
  }

  return { width, height, x: b.x, y: b.y };
}

// ----------------------------------------------------------------------------
// isSameOrigin — compares the navigation URL's origin to the configured
// server origin. Used by setWindowOpenHandler + will-navigate to keep
// the app pinned to the user's Nidham instance and bounce everything
// else out to the system browser.
// ----------------------------------------------------------------------------
function isSameOrigin(url: string, serverUrl: string | null): boolean {
  if (!serverUrl) return false;
  try {
    return new URL(url).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}
