# Quick start — Muse 2 (Swift / LibMuse bridge)

Use this path for **Muse 2**, **Muse 3**, **Muse S** (non-Athena), and typical **Muse-…** BLE names served by the **Swift** `MuseBridge` binary. **Muse S Athena** (direct Python BLE) needs [QUICKSTART-ATHENA.md](./QUICKSTART-ATHENA.md).

---

## Directories (same on any machine)

| What | Path |
|------|------|
| **Repo root** | The folder that contains `server-enhanced.js`, `package.json`, and `MuseBridge` |
| **Terminal 1 (backend)** | `cd` into **repo root** |
| **Terminal 2 (modern UI)** | `cd` into **repo root**`/web` |

Example (replace with your clone):

```text
/Users/you/Documents/NeuroVis          ← Terminal 1 starts here
/Users/you/Documents/NeuroVis/web      ← Terminal 2 starts here
```

“Another machine” means **any computer** with its own clone — use **that machine’s** path to the same two folders, not two computers required.

---

## Do you need two terminals?

| Goal | Terminals |
|------|-----------|
| **Modern Next.js UI** at **http://localhost:3001** | **Two** — backend + `web` dev server |
| **Legacy static UI** only at **http://localhost:3000** | **One** — backend only |

---

## One-time setup (per clone)

From **repo root**:

```bash
cd /path/to/NeuroVis

npm install

cd web && npm install && cd ..
```

Ensure **`MuseBridge`** exists and is executable for your OS (see `swift-bridge/` / project docs if you build from source).

**No Python `bleak` is required** for Muse 2 / Swift mode.

---

## Every session — two terminals

### Terminal 1 — backend (repo root)

**Default (Swift / LibMuse)** — matches `BRIDGE_MODE=swift`:

```bash
cd /path/to/NeuroVis
npm start
```

Explicit Swift:

```bash
npm run start:swift
```

Wait for: WebSocket listening, Swift / MuseBridge launch messages, and device discovery in the log.

### Terminal 2 — Next.js (inside `web/`)

```bash
cd /path/to/NeuroVis/web
npm run dev
```

Open **http://localhost:3001**. Confirm WebSocket **connected** in the top bar.

---

## App settings (Muse 2)

1. **Settings** → **Muse BLE backend** → **Swift (LibMuse) — Muse 2, Muse 3, Muse S, …**
2. Turn **Simulator** **off** for real hardware.
3. Pair the headset in **macOS System Settings → Bluetooth**, then **Settings → Devices** → **Rescan** → **connect**.

If Athena was selected while using a Muse 2, switch to **Swift** and let the server respawn the bridge (or restart Terminal 1 with `npm start` / `npm run start:swift`).

---

## Ports (defaults)

| Service | Port |
|---------|------|
| HTTP API + legacy static | **3000** |
| WebSocket | **8080** |
| Next.js dev UI | **3001** |
| OSC input (Mind Monitor, optional) | **5000** UDP |
| OSC output (Csound / Max) | **7400** UDP |

---

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| `EADDRINUSE` on 3000 / 8080 | Only one backend; find PID with `lsof -nP -iTCP:3000 -sTCP:LISTEN`, then `kill`. |
| No devices | Power on Muse, Bluetooth on, **Rescan**; check Terminal 1 for MuseBridge errors. |
| Athena errors / wrong mode | Muse 2 must use **Swift** — not `npm run start:athena`. |
| Black screen / no WS | Terminal 1 must be running; firewall allowing **8080** locally. |

More detail: [QUICKSTART-LAUNCH-PAIR-PLAY.md](./QUICKSTART-LAUNCH-PAIR-PLAY.md), [MUSE_INTEGRATION.md](../MUSE_INTEGRATION.md).
