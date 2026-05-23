# Launching NeuroVis

This folder contains a one-click launcher for macOS:

> **`Launch NeuroVis.command`**

Double-click it in Finder and NeuroVis will start in a Terminal window and open in your default browser.

---

## What the launcher does

When you double-click `Launch NeuroVis.command`, it runs through these steps automatically:

1. **Frees the ports** NeuroVis uses (3000, 8080, 3001) by stopping any stale processes — uses the existing `scripts/neurovis-stop.sh`.
2. **Installs dependencies** if `node_modules/` is missing (one-time, both at the root and inside `web/`).
3. **Starts the Node bridge** — `npm start` → `server-enhanced.js`
   - HTTP REST API on **`http://localhost:3000`**
   - WebSocket on **`ws://localhost:8080`**
4. **Starts the Next.js frontend** — `cd web && npm run dev`
   - **`http://localhost:3001`**
5. **Waits up to 90 seconds** for the frontend to respond, then **opens it in your default browser**.
6. **Streams both server logs** into the Terminal window so you can see what's happening.

To stop both servers cleanly, press **Ctrl+C** in the Terminal window the launcher opened.

---

## First-time setup

### 1. Make sure Node.js is installed

The launcher needs **Node 20 or newer** and **npm**.

Check:

```bash
node -v
npm -v
```

If either command is missing, install Node from <https://nodejs.org/> (LTS is fine) and try again.

### 2. macOS Gatekeeper one-time approval

The very first time you double-click a `.command` file, macOS may say:

> "Launch NeuroVis.command" cannot be opened because it is from an unidentified developer.

To clear this once:

1. **Right-click** (or Control-click) `Launch NeuroVis.command`.
2. Choose **Open**.
3. Confirm with **Open** in the dialog.

After that, normal double-clicking works.

---

## Day-to-day use

1. Open Finder and navigate to this folder.
2. **Double-click `Launch NeuroVis.command`**.
3. A Terminal window opens with progress messages, then your browser opens at <http://localhost:3001>.
4. When you're done, click the Terminal window and press **Ctrl+C**. It will stop both servers and tell you you can close the window.

If anything goes wrong, full logs are kept in:

- `.launcher-logs/bridge.log` — Node backend / MuseBridge / OSC
- `.launcher-logs/web.log` — Next.js frontend

You can tail them live in another Terminal:

```bash
tail -f .launcher-logs/bridge.log .launcher-logs/web.log
```

---

## Optional: launch directly into a specific page

By default the launcher opens `http://localhost:3001/`.

To open a specific NeuroVis page (for example the **Research** page with the AI · Replicate · Gemini 3.5 Flash card), set `NEUROVIS_OPEN_PATH` before launching:

```bash
NEUROVIS_OPEN_PATH=/research open "Launch NeuroVis.command"
```

Or, to make that the default, edit one line near the top of `Launch NeuroVis.command`:

```bash
OPEN_PATH="${NEUROVIS_OPEN_PATH:-/research}"
```

Common targets:

| Page | Path |
| --- | --- |
| Dashboard home | `/` |
| Teaching mode | `/teaching` |
| Concert mode | `/concert` |
| Research mode (AI · Gemini lives here) | `/research` |
| Settings | `/settings` |
| Simulator | `/simulator` |

---

## Troubleshooting

### "Port 3001 already in use"

Something is already running on one of the NeuroVis ports. The launcher tries to clear them, but if it can't (e.g. another tool is holding port 3000), run the stop script manually:

```bash
npm stop
```

Then launch again.

### Browser doesn't open automatically

If `open` is blocked or your default browser is misconfigured, the launcher prints the URL — copy <http://localhost:3001> into your browser manually.

### "Frontend did not respond within 90 seconds"

Usually a one-time slow build on a fresh checkout. Check `.launcher-logs/web.log` for the actual error. The most common causes:

- `npm install` interrupted earlier — run `cd web && npm install` once and try again.
- TypeScript or build error in a recent edit — fix the error reported in the log.

### Stop everything in a panic

```bash
npm stop
```

This kills every listener on ports 3000, 3001, and 8080 (kill, then kill -9 if needed).

---

## What gets started, technically

| Process | Command | Started by |
| --- | --- | --- |
| Node backend | `node server-enhanced.js` | `npm start` (root `package.json`) |
| MuseBridge / Athena (when devices connect) | `./MuseBridge` or `python3 scripts/athena_ble_bridge.py` | spawned by the Node backend |
| Next.js frontend | `next dev -p 3001` | `npm run dev` (`web/package.json`) |

The launcher is just a friendly wrapper — everything it does is the same as running those `npm` commands by hand in two terminals.
