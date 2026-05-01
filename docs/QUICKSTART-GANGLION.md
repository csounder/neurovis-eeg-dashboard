# Quick start — OpenBCI Ganglion (BrainFlow)

NeuroVis can stream **4-channel EEG** from a **Ganglion** board over a **BLED112 USB dongle** using the **BrainFlow** bindings already included with `server-enhanced.js`.

This path is **separate from Muse**: you do **not** need `npm run start:athena` or the Python `bleak` venv. You **do** need the `brainflow` npm package (installed by `npm install` at the repo root).

---

## Directories

| What | Path |
|------|------|
| **Repo root** | Folder with `server-enhanced.js`, `package.json`, `ganglion-test.js` |
| **Terminal 1** | `cd` **repo root** |
| **Terminal 2** (modern UI) | `cd` **repo root**`/web` |

---

## Hardware

- **OpenBCI Ganglion** board (powered on)
- **BLED112** (or compatible) **USB dongle** — the server uses BrainFlow’s **`GANGLION_BOARD`** mode (dongle / serial), not native BLE in this integration.

Find the serial device (macOS examples):

```bash
ls /dev/cu.usb*
```

Set the port when starting the backend (default in code is `/dev/cu.usbmodem11` if unset):

```bash
export GANGLION_SERIAL_PORT=/dev/cu.usbmodemXXXXXXXX
```

---

## One-time setup

From **repo root**:

```bash
cd /path/to/NeuroVis
npm install

cd web && npm install && cd ..
```

---

## Every session — two terminals

### Terminal 1 — backend

Use the **default Swift/Muse bridge** process manager, but start **Ganglion streaming** via the HTTP API once the server is up.

```bash
cd /path/to/NeuroVis
export GANGLION_SERIAL_PORT=/dev/cu.usbmodemMODEM   # if not the default
npm start
```

Wait for the usual **HTTP 3000** / **WebSocket 8080** ready messages.

**Start the Ganglion stream** (from any second shell or after server is ready):

```bash
curl -X POST http://localhost:3000/api/ganglion/start
```

**Stop:**

```bash
curl -X POST http://localhost:3000/api/ganglion/stop
```

### Terminal 2 — Next.js UI

```bash
cd /path/to/NeuroVis/web
npm run dev
```

Open **http://localhost:3001**. Use **Overview**, **Raw**, **Research**, or **OpenBCI-style time series** (`/openbci-time-series`) as needed.

Turn **Simulator** **off** in **Settings** when using real hardware.

---

## Standalone BrainFlow check (optional)

With the dongle connected and Ganglion powered:

```bash
cd /path/to/NeuroVis
# Edit ganglion-test.js if your serial port differs, then:
node ganglion-test.js
```

This confirms BrainFlow + hardware before relying on the full server.

---

## Ports (defaults)

| Service | Port |
|---------|------|
| HTTP API | **3000** |
| WebSocket | **8080** |
| Next.js dev UI | **3001** |

---

## Limits & troubleshooting

| Topic | Note |
|-------|------|
| **Channels** | Ganglion integration feeds **4 EEG channels**; no IMU/PPG on this path in NeuroVis. |
| **Sample rate** | **~200 Hz** (BrainFlow / board nominal). DSP and band-power code paths may still assume Muse-centric defaults in places — use Research / Raw for QC. |
| **Wrong serial** | Connection errors → set **`GANGLION_SERIAL_PORT`** correctly, power cycle Ganglion, replug dongle. |
| **`/api/connect` “ganglion not supported”** | Expected for legacy REST; use **`/api/ganglion/start`** for this server integration. |

Related: [RESEARCH-CAPTURE-AND-SYNC.md](./RESEARCH-CAPTURE-AND-SYNC.md) (Ganglion family), [`web/lib/researchDeviceProfile.ts`](../web/lib/researchDeviceProfile.ts).
