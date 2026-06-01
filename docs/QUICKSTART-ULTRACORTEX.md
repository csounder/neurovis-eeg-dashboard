# Quick start — OpenBCI Ultra Cortex (Cyton + Daisy)

**Ultra Cortex** here means the OpenBCI **Cyton + Daisy** stack (typically **16 EEG channels**, printed helmet / “Mark IV” style cap). NeuroVis defines **device scaling specs** and **Research UI** behavior for this family (`OpenBCI Ultra Cortex` in `server-enhanced.js`, `openbci_cyton` profile in the web app).

---

## How NeuroVis fits today

| Layer | Status |
|-------|--------|
| **Live streaming in `server-enhanced.js`** | BrainFlow starters: `POST /api/openbci/start` with `board` = `ganglion`, `cyton`, or `ultracortex` (Cyton+Daisy, 16ch). Set `serial_port` or env `CYTON_SERIAL_PORT` / `CYTON_DAISY_SERIAL_PORT`. Research UI still **4-channel–shaped** for tiles/export — document which hardware channels map to Ch1–4. |
| **Dashboard / Research** | When the active device name matches **Cyton** / **Ultra Cortex** / **Daisy** heuristics, the UI picks **16ch (or 8ch Cyton)** profiles, **OpenBCI-style** traces, and shows a **Cyton acquisition callout** on the Research page. |
| **OSC / Mind Monitor** | If you forward band or EEG data into NeuroVis via existing OSC/WebSocket paths, device naming can still tag the session as Ultra Cortex–class for documentation exports. |

So: **this quick start is “run NeuroVis + use OpenBCI-class workflows”**, not “plug Cyton USB and one REST call starts 16ch” (that would be a future BrainFlow hook similar to Ganglion).

---

## Directories (two terminals for the modern UI)

| What | Path |
|------|------|
| **Repo root** | Folder with `server-enhanced.js`, `package.json` |
| **Terminal 1** | `cd` **repo root** → `npm start` |
| **Terminal 2** | `cd` **repo root**`/web` → `npm run dev` |

Open **http://localhost:3001**.

---

## Start Ultra Cortex streaming (BrainFlow)

With dongle serial visible in `ls /dev/cu.usbserial*`:

```bash
export CYTON_DAISY_SERIAL_PORT=/dev/cu.usbserial-YOURPORT
curl -X POST http://localhost:3000/api/openbci/start \
  -H 'Content-Type: application/json' \
  -d '{"board":"ultracortex"}'
```

8-channel Cyton only: use `"board":"cyton"` and `CYTON_SERIAL_PORT`.

---

## Suggested lab workflow

1. **Acquire** with NeuroVis BrainFlow (above) and/or **OpenBCI GUI** for ground-truth **bdf/csv** when you need full 16ch exports outside the 4-column UI.
2. Run **NeuroVis** with the live stream for band powers, OSC, markers, and Research QC.
3. In the app, open **Research** for **session recorder**, **markers**, and **device-aware QC**. Read the blue **“Cyton / Daisy users — start here”** callout for export expectations.
4. Use **OpenBCI-style time series**: sidebar → **OpenBCI-style TS** (`/openbci-time-series`) for a 4-lane-friendly view (first channels of the incoming stream; adjust expectations if your bridge only sends 4 columns).

---

## Hardware checklist (typical)

- **Cyton** board + **Daisy** module, **USB dongle**, drivers installed per [OpenBCI docs](https://docs.openbci.com/)
- Correct **RF / serial** link; board powered and samples visible in OpenBCI GUI before worrying about NeuroVis

---

## Ports (defaults)

| Service | Port |
|---------|------|
| HTTP API | **3000** |
| WebSocket | **8080** |
| Next.js dev UI | **3001** |

---

## Related docs

- Research capture context: [RESEARCH-CAPTURE-AND-SYNC.md](./RESEARCH-CAPTURE-AND-SYNC.md)
- Ganglion (working BrainFlow path in this repo): [QUICKSTART-GANGLION.md](./QUICKSTART-GANGLION.md)
- Muse paths (different hardware): [QUICKSTART-MUSE2.md](./QUICKSTART-MUSE2.md), [QUICKSTART-ATHENA.md](./QUICKSTART-ATHENA.md)
