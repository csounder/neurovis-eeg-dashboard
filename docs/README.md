# NeuroVis documentation index

Canonical guides for setup, performance, and development. Start with **[HANDOFF.md](./HANDOFF.md)** for architecture and continuation prompts.

---

## Launch and devices

| Doc | Use when |
| --- | --- |
| [../LAUNCH.md](../LAUNCH.md) | One-click macOS launcher, ports, troubleshooting |
| [QUICKSTART-LAUNCH-PAIR-PLAY.md](./QUICKSTART-LAUNCH-PAIR-PLAY.md) | Two terminals, pair Muse, play Concert / OSC |
| [QUICKSTART-ATHENA.md](./QUICKSTART-ATHENA.md) | Muse S Athena (Python BLE bridge) |
| [QUICKSTART-MUSE2.md](./QUICKSTART-MUSE2.md) | Muse 2 / 3 (Swift MuseBridge) |
| [QUICKSTART-GANGLION.md](./QUICKSTART-GANGLION.md) | OpenBCI Ganglion |
| [QUICKSTART-ULTRACORTEX.md](./QUICKSTART-ULTRACORTEX.md) | Ultra Cortex (Cyton+Daisy) |

---

## Concert mode (performance)

**URL:** <http://localhost:3001/concert>

| Doc | Contents |
| --- | --- |
| **[CONCERT-MODE.md](./CONCERT-MODE.md)** | **Primary reference:** 53 visualizers, WebGL, tuning, NIME patches, keyboard shortcuts |
| [CONCERT-SONIFICATION-DUAL-SOURCE.md](./CONCERT-SONIFICATION-DUAL-SOURCE.md) | Two-performer audio/visual strategies, shared presets, hardware mixer |
| [../csds-NIME-Selected/README.md](../csds-NIME-Selected/README.md) | NIME `.csd` patch library and headless launch |

### Concert features (2026-06)

| Feature | Summary |
| --- | --- |
| **Performance recording** | **Record movie** (stage canvas + audio) or **Record audio only** → WebM download. Enable **Tab audio** for headless NIME Csound. |
| **Concert groups** | Ordered visualizer + patch queues, **Play show**, dwell auto-advance, save/load in browser, export `.concert-group.json`. |
| **Performance presets** | Single JSON snapshot of scene, tuning, V12 controls (on Concert page). |

---

## Csound and sonification

| Doc | Contents |
| --- | --- |
| [V12-V17-WORKSTATION-MODES.md](./V12-V17-WORKSTATION-MODES.md) | `/v12`–`/v17` MIDI CC and EEG mapping |
| [CSOUND-WASM-V12-LESSONS.md](./CSOUND-WASM-V12-LESSONS.md) | Browser WASM Csound pitfalls, `/concert` vs `/v12` |

---

## Research and capture

| Doc | Contents |
| --- | --- |
| [RESEARCH-CAPTURE-AND-SYNC.md](./RESEARCH-CAPTURE-AND-SYNC.md) | Server disk recording, stimulus clock, research routes |
| [RESEARCH-EEG-AND-BASELINE-PATHS.md](./RESEARCH-EEG-AND-BASELINE-PATHS.md) | Trace sources, DSP, conditioning lab |

---

## Code map (concert)

| Path | Role |
| --- | --- |
| `web/app/concert/page.tsx` | Concert route, show mode, keyboard |
| `web/components/concert/ConcertVisualizer*.tsx` | 2D + WebGL scenes |
| `web/components/concert/ConcertPerformanceRecorderPanel.tsx` | Recording UI |
| `web/components/concert/ConcertGroupPanel.tsx` | Show queues UI |
| `web/lib/concert/concertPerformanceRecorder.ts` | `MediaRecorder` capture |
| `web/lib/concert/concertGroup.ts` | Group JSON + `localStorage` |
| `web/lib/concert/webgl/` | WebGL shaders, TF particles, GPU passes |
| `server-enhanced.js` | Headless Csound, NIME patch API |
| `csound-patches.js` + `csds-NIME-Selected/` | Patch catalog |
