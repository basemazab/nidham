import Store from "electron-store";

// What we persist on the user's disk (Roaming\Nidham\config.json on Win).
// Kept tiny on purpose -- the actual app data lives on the server.
export type Settings = {
  serverUrl: string | null;       // "https://nidham.com" or "http://192.168.1.10:3001"
  windowBounds: {                  // remember where the user dragged the window
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  zoomLevel: number;
};

const DEFAULT_SETTINGS: Settings = {
  serverUrl: null,
  windowBounds: { width: 1280, height: 800 },
  zoomLevel: 0,
};

const store = new Store<Settings>({
  name: "nidham-config",
  defaults: DEFAULT_SETTINGS,
  // electron-store auto-encrypts under the OS DPAPI when this is set,
  // which is enough deterrent for non-sensitive config like a URL.
  encryptionKey: "nidham-desktop-v1",
});

export function getServerUrl(): string | null {
  return store.get("serverUrl");
}

export function setServerUrl(url: string): void {
  // Strip trailing slash for consistency (the app appends paths)
  store.set("serverUrl", url.replace(/\/+$/, ""));
}

export function clearServerUrl(): void {
  store.set("serverUrl", null);
}

export function getWindowBounds(): Settings["windowBounds"] {
  return store.get("windowBounds");
}

export function setWindowBounds(bounds: Settings["windowBounds"]): void {
  store.set("windowBounds", bounds);
}

export function getZoomLevel(): number {
  return store.get("zoomLevel");
}

export function setZoomLevel(level: number): void {
  store.set("zoomLevel", level);
}
