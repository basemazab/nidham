# Desktop assets

Drop these two files here before building the installer:

| File | Purpose | Size |
|---|---|---|
| `icon.png` | App icon in window, system tray, etc. | **512×512 PNG** |
| `icon.ico` | Windows installer + .exe icon | **multi-resolution ICO** (16/32/48/256) |

## Quickest path

1. Design a 1024×1024 PNG of the Nidham "ن" mark (or export from Figma / the existing landing-page logo).
2. Use <https://icoconvert.com> (free, browser-based):
   - Upload the PNG.
   - Pick "Multi-Size in One Icon".
   - Tick 16, 32, 48, 128, 256.
   - Download → save as `icon.ico` here.
3. Resize the original PNG to 512×512 (any image editor) → save as `icon.png` here.

Both files MUST sit next to this README (`desktop/assets/icon.png`,
`desktop/assets/icon.ico`). The forge build will look for them by name.

Until you supply them, the installer will fall back to Electron's default
icon — the build still succeeds, but the .exe looks generic.
