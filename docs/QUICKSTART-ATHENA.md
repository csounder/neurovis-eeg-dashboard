# Quick start — Muse S Athena (Python BLE)

Use this path for **Muse S Athena** headsets that talk to NeuroVis over **direct BLE** (`scripts/athena_ble_bridge.py`, GATT `273e0013`). **Muse 2** and most **Muse-33xx** units use the **Swift** bridge instead — see [QUICKSTART-MUSE2.md](./QUICKSTART-MUSE2.md).

---

## Directories (same on any machine)

| What | Path |
|------|------|
| **Repo root** | The folder that contains `server-enhanced.js`, `package.json`, and `scripts/` |
| **Terminal 1 (backend)** | `cd` into **repo root** |
| **Terminal 2 (modern UI)** | `cd` into **repo root**`/web` |

Example (replace with your clone):

```text
/Users/you/Documents/NeuroVis          ← Terminal 1 starts here
/Users/you/Documents/NeuroVis/web      ← Terminal 2 starts here
```

---

## Do you need two terminals?

| Goal | Terminals |
|------|-----------|
| **Modern Next.js UI** at **http://localhost:3001** | **Two** — backend + `web` dev server |
| **Legacy static UI** only at **http://localhost:3000** | **One** — backend only |

The modern app proxies `/api/*` to the backend on **3000**; WebSocket live data uses **8080**.

---

## One-time setup (per clone)

From **repo root**:

```bash
cd /path/to/NeuroVis

npm install

cd web && npm install && cd ..
```

**Python / `bleak`:** On Homebrew Python (PEP 668), do **not** use system `pip install`. Create the project venv:

```bash
cd /path/to/NeuroVis
./scripts/setup-athena-venv.sh
```

That creates **`.venv/`** and installs `bleak`. The server **auto-uses** `.venv/bin/python3` for Athena when that file exists. Optional override:

```bash
export ATHENA_PYTHON="/path/to/NeuroVis/.venv/bin/python3"
```

---

## Every session — two terminals

### Terminal 1 — backend (repo root)

```bash
cd /path/to/NeuroVis
npm run start:athena
```

Wait for: WebSocket listening, **`BLE bridge: ATHENA`**, and no repeated `No module named 'bleak'` errors.

### Terminal 2 — Next.js (inside `web/`)

```bash
cd /path/to/NeuroVis/web
npm run dev
```

Open **http://localhost:3001**. Confirm the top bar shows WebSocket **connected**.

---

## App settings (Athena)

1. **Settings** → **Muse BLE backend** → **Python (Athena) — Muse S Athena direct BLE** (should match `npm run start:athena`).
2. Turn **Simulator** **off** for real hardware.
3. Pair the headset in **macOS System Settings → Bluetooth**, then in **Settings → Devices** use **Rescan** and **connect**.

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
| `No module named 'bleak'` | Run `./scripts/setup-athena-venv.sh` from repo root; restart Terminal 1. |
| `EADDRINUSE` on 3000 / 8080 | Only one `server-enhanced.js`; `lsof -nP -iTCP:3000 -sTCP:LISTEN` then `kill <PID>`. |
| Bridge exits in a loop | Fix Python deps first; check Terminal 1 log for the first error line. |
| Wrong headset / no devices | Athena is **only** for Muse S Athena; Muse 2 needs [QUICKSTART-MUSE2.md](./QUICKSTART-MUSE2.md). |

Extended context: [QUICKSTART-LAUNCH-PAIR-PLAY.md](./QUICKSTART-LAUNCH-PAIR-PLAY.md), [MUSE_PAIRING_GUIDE.md](../MUSE_PAIRING_GUIDE.md).
