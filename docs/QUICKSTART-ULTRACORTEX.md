# Quick start — OpenBCI Ultra Cortex (Cyton + Daisy)

**Ultra Cortex** here means the OpenBCI **Cyton + Daisy** stack (typically **16 EEG channels**, printed helmet / “Mark IV” style cap). NeuroVis defines **device scaling specs** and **Research UI** behavior for this family (`OpenBCI Ultra Cortex` in `server-enhanced.js`, `openbci_cyton` profile in the web app).

---

## How NeuroVis fits today

| Layer | Status |
|-------|--------|
| **Live streaming in `server-enhanced.js`** | **Ganglion** has a dedicated BrainFlow starter (`POST /api/ganglion/start`). **Cyton / Daisy does not** use the same one-click starter in this file — plan on **OpenBCI GUI**, **BrainFlow scripts**, or your lab recorder for **gap-free 16-channel acquisition**. |
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

## Suggested lab workflow

1. **Acquire** with **OpenBCI GUI** or a **BrainFlow** Python/Node script at **full rate**, saving **bdf/csv** as your ground truth.
2. Run **NeuroVis** in parallel when you have a **live feed** into the stack you use (e.g. OSC from a forwarder, or development streams from your own bridge).
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
