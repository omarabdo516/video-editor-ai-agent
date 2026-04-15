# RS Reels Dashboard — Launcher

One-click launcher for the Dashboard (API + UI + auto-open browser).
Replaces `npm run dashboard` in a terminal.

## Quick start (first time)

1. Open PowerShell in this folder (`launcher/`).
2. Run the installer:
   ```powershell
   powershell -ExecutionPolicy Bypass -File install-shortcut.ps1
   ```
3. Check your Desktop — you'll find a new **"RS Reels Dashboard"** icon
   with the RS logo.
4. Double-click it. After ~10-15 seconds the Dashboard opens in your
   default browser.

Run the installer ONE time. The shortcut keeps working forever unless
you move the repo to a different folder, in which case re-run it.

## Files in this folder

| File | Role |
|------|------|
| `launcher.mjs` | Node script — starts API + Vite, waits for both, opens browser |
| `rs-dashboard.cmd` | Visible-terminal wrapper (use if you want Ctrl+C to stop cleanly) |
| `rs-dashboard.vbs` | Hidden-window wrapper (what the desktop shortcut uses) |
| `install-shortcut.ps1` | Creates the desktop `.lnk` with the icon |
| `generate-icon.cmd` | Regenerates the `.ico` from `brands/rs/assets/logo.png` via ffmpeg |
| `rs-dashboard.ico` | The desktop icon (256×256, generated from the RS logo) |
| `README.md` | This file |

## How it works

1. The desktop shortcut runs `wscript.exe rs-dashboard.vbs`.
2. The VBS runs `rs-dashboard.cmd` with WindowStyle=0 (hidden).
3. The CMD `cd`s to the repo root and runs `node launcher/launcher.mjs`.
4. `launcher.mjs`:
   - spawns `node dashboard-api/server.mjs` (yellow lane)
   - spawns `npm run dev` inside `dashboard-ui/` (cyan lane)
   - polls both TCP ports (7778 for API, auto-detected for Vite) until
     they accept connections (probes both IPv4 and IPv6 because Vite
     binds IPv6-only on Windows)
   - reads Vite's stdout to detect the actual port (usually 5174, may
     fall through to 5175/5176/… if other dev servers are running)
   - opens `http://localhost:<vitePort>/` in the default browser
5. Both children keep running until the launcher is killed. On
   Ctrl+C / window close, the launcher calls `taskkill /F /T /PID` on
   both child PIDs so the npm/vite/node grandchildren die too — no
   orphan processes holding ports.

## Stopping the dashboard

**Visible terminal (`rs-dashboard.cmd` directly)** — just press Ctrl+C
or close the window. Clean shutdown.

**Hidden shortcut (desktop `.lnk`)** — there's no window to close.
Open Task Manager, find the `node.exe` process named
`launcher.mjs` (or the parent `wscript.exe` → `cmd.exe` tree) and
End task. The launcher handles SIGTERM and tears everything down.

Easier option: just double-click `rs-dashboard.cmd` directly. You
get a visible terminal with Ctrl+C support and all the same output.
The hidden shortcut is nice for a "feels like a real app" experience;
the visible cmd is nicer while you're iterating on the dashboard
itself.

## Troubleshooting

**"ERROR: rs-dashboard.vbs not found"**
Run `install-shortcut.ps1` from inside the `launcher/` folder, not
from a random PowerShell prompt.

**"api did not respond within 45s"**
Check for orphan `node.exe` processes holding port 7778:
```
netstat -ano | findstr :7778
taskkill /F /PID <pid>
```

**"ui never printed a port line"**
Vite crashed on startup. Try `npm run dashboard:ui` manually from the
repo root to see the error. Usually a dependency issue —
`cd dashboard-ui && npm install` fixes it.

**The shortcut on Desktop opens a PowerShell window and dies**
You're running the .ps1 directly. The shortcut should target
`wscript.exe rs-dashboard.vbs`, not the .ps1. Re-run
`install-shortcut.ps1`.

**The icon is generic/blank**
Either `rs-dashboard.ico` is missing (run `generate-icon.cmd`) or
Explorer's icon cache is stale. Restart Explorer:
```
taskkill /f /im explorer.exe && start explorer.exe
```
