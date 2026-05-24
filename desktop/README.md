# Nidham Desktop

Electron-based desktop client for Nidham. Wraps the same web app the
Cloud (Vercel) and Enterprise (Docker) deployments serve, but ships it
as a real Windows program — Start menu entry, Desktop shortcut, taskbar
icon, native menu in Arabic.

The desktop client itself doesn't carry any business data. On first run
the HR user picks which Nidham server to connect to (their company's
on-prem install, or the cloud), and that choice is persisted to
`%APPDATA%\nidham-desktop\` for next launches.

## Layout

```
desktop/
├── package.json          electron + electron-forge devDeps
├── forge.config.ts       Squirrel.Windows maker config
├── tsconfig.json
├── vite.main.config.ts   build config for the main process
├── vite.preload.config.ts
├── vite.renderer.config.ts
├── src/
│   ├── main/
│   │   ├── main.ts       app lifecycle, window creation, IPC handlers
│   │   ├── settings.ts   electron-store wrapper for serverUrl / window state
│   │   └── menu.ts       Arabic-RTL native menu
│   ├── preload/
│   │   └── preload.ts    contextBridge exposes window.nidham.{test,save}
│   └── renderer/
│       ├── index.html    first-run setup screen
│       ├── setup.css
│       └── setup.ts
└── assets/
    ├── icon.png          512×512 (you provide — see assets/README.md)
    └── icon.ico          multi-res Windows icon (you provide)
```

## Build the installer (Windows)

> Run from the `desktop/` folder on a Windows machine that has Node 20+
> installed.

```powershell
cd desktop
npm install          # ~3 min first time
npm run make         # ~5 min — produces out/make/squirrel.windows/x64/Nidham-1.0.0 Setup.exe
```

The `Setup.exe` is what HR staff actually run. It self-extracts into
`%LOCALAPPDATA%\Nidham\`, adds Start-menu + Desktop shortcuts, and
auto-runs the app on first install.

### Dev mode (no installer, hot-reload)

```powershell
cd desktop
npm install
npm start
```

Opens the Electron window pointed at the dev renderer. Saves changes
to `src/renderer/*` reload instantly; changes to `src/main/*` need a
`Ctrl+C` + `npm start`.

## How the first run works

1. App launches → checks `settings.serverUrl`.
2. Empty → renders `src/renderer/index.html` (the setup form).
3. User types `http://192.168.1.10:3001` (their Enterprise box) or
   `https://nidhamhr.com` (cloud).
4. "اختبر الاتصال" pings `<url>/login` through Electron's `net.request`
   to verify reachability.
5. "احفظ وادخل" persists the URL to `electron-store` and closes the
   setup window.
6. Main window opens at the saved URL — same Next.js app the user knows
   from the browser, but inside a native frame.

Every subsequent launch goes straight to step 6.

## What's NOT yet here (planned)

- **Code signing** — Without it, Windows SmartScreen warns "publisher
  unknown" the first time a user runs `Setup.exe`. They can click "More
  info" → "Run anyway". A real Authenticode certificate (~$300/year)
  removes the warning entirely.
- **Auto-update** — `electron-updater` is the standard wiring. We've
  left the hook points but haven't published a release manifest yet.
  Phase 2.
- **macOS / Linux** — the forge config already produces ZIP archives
  for those platforms, but we haven't tested or branded them.
- **License key activation** — Phase 2.
