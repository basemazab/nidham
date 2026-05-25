import { Menu, BrowserWindow, app, shell, dialog, session } from "electron";
import { clearServerUrl, getServerUrl, getZoomLevel, setZoomLevel } from "./settings";

// Arabic menu for the HR user. Keep it short -- just the actions someone
// using a self-hosted desktop client actually wants.
export function buildAppMenu(getWindow: () => BrowserWindow | null): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "ملف",
      submenu: [
        {
          label: "تحديث",
          // Two accelerators: F5 (Windows convention) + Ctrl+R (web/Mac
          // convention). Electron's MenuItem.accelerator is single-binding
          // only — we add a hidden duplicate item below to register the
          // second shortcut.
          accelerator: "F5",
          click: () => getWindow()?.webContents.reload(),
        },
        // Hidden duplicate so Ctrl+R also reloads. Setting `visible: false`
        // keeps it out of the menu UI while still binding the accelerator.
        {
          label: "Reload (Ctrl+R)",
          accelerator: "CmdOrCtrl+R",
          visible: false,
          click: () => getWindow()?.webContents.reload(),
        },
        {
          // Force-reload bypasses HTTP cache + Service Workers. The
          // single best recovery action when the page renders blank or
          // shows stale JS after a deploy -- the previous reload may
          // have been serving a stale bundle reference.
          label: "تحديث قسري (مسح الـ cache)",
          accelerator: "CmdOrCtrl+Shift+R",
          click: async () => {
            const w = getWindow();
            if (!w) return;
            try {
              await session.defaultSession.clearCache();
              await session.defaultSession.clearStorageData({
                storages: ["cachestorage", "serviceworkers", "shadercache"],
              });
            } catch {
              /* best effort */
            }
            w.webContents.reloadIgnoringCache();
          },
        },
        {
          label: "العودة لصفحة الدخول",
          click: () => {
            const w = getWindow();
            const url = getServerUrl();
            if (w && url) w.loadURL(`${url}/login`);
          },
        },
        {
          label: "أدوات المطوّر",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => {
            const w = getWindow();
            if (!w) return;
            if (w.webContents.isDevToolsOpened()) {
              w.webContents.closeDevTools();
            } else {
              w.webContents.openDevTools({ mode: "detach" });
            }
          },
        },
        { type: "separator" },
        {
          label: "تكبير",
          accelerator: "CmdOrCtrl+=",
          click: () => zoomBy(+1, getWindow),
        },
        {
          label: "تصغير",
          accelerator: "CmdOrCtrl+-",
          click: () => zoomBy(-1, getWindow),
        },
        {
          label: "حجم طبيعي",
          accelerator: "CmdOrCtrl+0",
          click: () => zoomBy(0, getWindow, /* reset */ true),
        },
        { type: "separator" },
        {
          label: "ملء الشاشة",
          accelerator: "F11",
          click: () => {
            const w = getWindow();
            if (w) w.setFullScreen(!w.isFullScreen());
          },
        },
        { type: "separator" },
        {
          label: "تغيير سيرفر الشركة",
          click: async () => {
            const choice = await dialog.showMessageBox({
              type: "warning",
              title: "تغيير السيرفر",
              message: "هتقدر تستخدم البرنامج مع سيرفر تاني بعد إعادة التشغيل.",
              detail: `السيرفر الحالي: ${getServerUrl() ?? "—"}`,
              buttons: ["إلغاء", "تغيير وأعد التشغيل"],
              cancelId: 0,
              defaultId: 0,
            });
            if (choice.response === 1) {
              clearServerUrl();
              app.relaunch();
              app.exit(0);
            }
          },
        },
        { type: "separator" },
        { label: "خروج", role: "quit" },
      ],
    },
    {
      label: "تحرير",
      submenu: [
        { label: "تراجع", role: "undo" },
        { label: "إعادة", role: "redo" },
        { type: "separator" },
        { label: "قص", role: "cut" },
        { label: "نسخ", role: "copy" },
        { label: "لصق", role: "paste" },
        { label: "تحديد الكل", role: "selectAll" },
      ],
    },
    {
      label: "مساعدة",
      submenu: [
        {
          label: "موقع نِظام",
          click: () => shell.openExternal("https://nidhamhr.com"),
        },
        {
          label: "تواصل مع الدعم (واتساب)",
          click: () => shell.openExternal("https://wa.me/201055356622"),
        },
        { type: "separator" },
        {
          label: "حول البرنامج",
          click: () => {
            const window = getWindow();
            dialog.showMessageBox(window ?? undefined!, {
              type: "info",
              title: "حول Nidham Desktop",
              message: `Nidham Desktop\nالإصدار ${app.getVersion()}`,
              detail:
                "نظام HR + CRM + AI Recruitment\nمصمم خصيصًا للشركات المصرية\n\n" +
                "© Basem Azab",
              buttons: ["موافق"],
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

// Renderer zoom level is a number from -3 (zoomed out) to +3 (zoomed in).
// We persist the chosen level so the next launch restores it.
function zoomBy(delta: number, getWindow: () => BrowserWindow | null, reset = false): void {
  const w = getWindow();
  if (!w) return;
  const next = reset ? 0 : Math.max(-3, Math.min(3, getZoomLevel() + delta));
  setZoomLevel(next);
  w.webContents.setZoomLevel(next);
}
