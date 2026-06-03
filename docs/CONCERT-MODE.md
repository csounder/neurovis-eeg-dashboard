# Concert mode

Concert mode is the full-screen performance UI at **`/concert`**. It combines live EEG (WebSocket), optional browser or headless Csound (NIME `.csd` patches), WASM V12 audio, and a large library of 2D canvas + WebGL visualizers driven by band powers and an audio-reactive mix.

Launch NeuroVis, open <http://localhost:3001/concert>, connect a Muse or start the simulator, then pick a scene and tune sliders in **Tuning mode** or the on-stage **Tuning HUD** (`U`).

More docs: [docs/README.md](./README.md) (index) · [HANDOFF.md](./HANDOFF.md) · [LAUNCH.md](../LAUNCH.md)

---

## Quick workflow (performance night)

1. **Launch** — `Launch NeuroVis.command` or `npm start` + `cd web && npm run dev` → open `/concert`.
2. **EEG** — Connect Muse (or simulator); confirm band traces move on stage.
3. **Sound** — **Start patch** (NIME headless) and/or start **WASM V12** on the concert page; enable OSC if the patch expects `/muse/elements/*`.
4. **Optional set list** — In **Concert group**, **Add current scene** / **Add current patch** for each movement → **Save group** → **Play show** (set dwell seconds for auto-advance).
5. **Record** — **Record movie** for visuals + audio, or **Record audio only**. For headless Csound, check **Tab audio** and select this browser tab when prompted.
6. **Stop** — **Stop & download** (recording), **Stop show** (queues), **Stop patch** (NIME panel).

**Share with another machine:** performance preset JSON (single snapshot) or `.concert-group.json` (ordered show). See [CONCERT-SONIFICATION-DUAL-SOURCE.md](./CONCERT-SONIFICATION-DUAL-SOURCE.md) for two-performer setups.

---

## Architecture

| Layer | Role |
| --- | --- |
| **`web/app/concert/page.tsx`** | Stage layout, keyboard shortcuts, show queues, scene picker, NIME panel, recording, presets, WASM V12 |
| **`ConcertVisualizer`** | 2D canvas scenes (classic, pulse, neural art) |
| **`ConcertVisualizerWebGL`** | Fullscreen GLSL shaders + transform-feedback particle lace/macro |
| **`ConcertPerformanceRecorderPanel`** | UI for movie / audio-only capture |
| **`ConcertGroupPanel`** | Visual + patch queues, save/load concert groups, Play show |
| **`server-enhanced.js`** | Headless Csound, CsoundQt launch, OSC to patches, patch library from `csound-patches.js` |
| **`web/lib/concertVisualTuning.ts`** | Shared tuning sliders (EEG, GL, motion) |
| **`web/lib/concert/concertGroup.ts`** | Concert group JSON + `localStorage` persistence |
| **`web/lib/concert/concertPerformanceRecorder.ts`** | `MediaRecorder` capture (canvas + mixed audio) |
| **`web/lib/concertAudioMeter.ts`** | WASM RMS meter + **recording tap** (`getConcertRecordingAudioStream`) |
| **`web/lib/performancePreset.ts`** | Export/import concert + V12 performance presets (JSON) |

EEG flows: WebSocket → Zustand (`latestBandsAbs`, `latestBandTraces`, `rollingRaw`) → visualizers. Audio drive: mic / WASM meter / blend per **Audio + EEG drive** controls.

---

## Scene library (current)

Scenes are listed in picker groups. **↑ / ↓** steps through all scenes in this order: Classic → Pulse & lattice → Neural art → WebGL fullscreen → WebGL TF lace → WebGL TF macro.

### Classic (9)

Aurora Brain, Cortical Bloom, Spectral Tunnel, Synaptic Storm, Dream Ocean, Rotating Brain, Connectome Galaxy, Holographic Cortex, Limbic Nebula.

### Pulse & lattice (7)

Pulse Rings, Bass Bloom, Harmonic Orbits, Resonant Mesh, Cortical Lightning, Phase Lock Lattice.

### Neural art (10)

Axon Particle Storm, Neural Stream Cascade, Synapse Fine Web, Helix DNA Pulse, Spiral Galaxy Mind, Neuron Forest 3D, Synaptic Pulse Field, Cortical Particle Veil, Microglia Spark Sea, Activated Connectome.

### WebGL · fullscreen (7)

GL Aurora Drift, GL Caustic Weave, GL Deep Starfield, GL Curl Veil, GL Isoline Terrain, GL Moiré Lattice, GL Orbital Sparks.

### WebGL · TF neuro lace (10)

Delicate cortical particle lace (`glTfNeuroLace`, `glTfAxonStream`, …) — see `web/lib/concert/webgl/concertWebglTfPresets.ts`.

### WebGL · TF macro (10)

Larger field, more particles (`glTfGalaxyDisc`, `glTfNebulaScatter`, `glTfDnaBraid`, …).

**Total: 53 scenes.**

### Removed scenes (no longer in picker)

Legacy canvas: Stereo Shear, Scanline Wavefront, Spark Lattice, Spectral Cathedral, Neural Cathedral, FFT Ribbon Brain, Waterfall Cathedral, Data Stream Cathedral, Neuro Dashboard Dream, Band Monolith, Spectral HUD Oracle, Oscilloscope Garden, Meter Matrix, Analytic Aurora, Dual Spectrum.

Removed WebGL fullscreen: GL Twin Helix, GL Spectrum Ribbon, GL Band HUD, GL Waterfall 3D.

Old presets that reference removed IDs fall back to **Aurora Brain** on import.

---

## Keyboard shortcuts

Ignored when focus is in an `<input>` or `<select>`.

| Key | Action |
| --- | --- |
| **↑** | Previous visualizer (full library, or visual queue during **Play show**) |
| **↓** | Next visualizer (same) |
| **←** | Previous NIME patch + launch (full library, or patch queue during **Play show**) |
| **→** | Next NIME patch + launch (same) |
| **F** | Stage fullscreen |
| **H** | Toggle scene title HUD |
| **C** | Toggle control panels |
| **T** | Tuning mode vs performance layout |
| **U** | Tuning HUD on stage vs under stage |
| **M** | Csound mirror HUD |

When headless Csound is running, **sensekey** from the Concert Csound console is forwarded to the patch (see `useCsoundSensekeyForward`).

---

## Visual tuning

### Canvas (2D)

| Slider | Effect |
| --- | --- |
| EEG sensitivity | Scales band/channel energy |
| Visual size | Element scale × stage intensity |
| Canvas brightness | 2D global alpha |
| EEG influence | Live EEG vs neutral fallback |
| Animation speed | Global motion (`motionActivity`) |
| Stage intensity | Overall draw strength |
| Light trails | Canvas fade/trails (higher = longer persistence) |

### WebGL

| Slider | Effect |
| --- | --- |
| GL brightness | Present pass gain (fullscreen + TF) |
| GL motion | Shader time + TF flow multiplier |
| GL particle glow | TF points and filament strength |

### Audio + EEG drive

Modes: EEG only, mic, WASM, blend. **AR audio mix** weights EEG envelope vs audio tap.

---

## NIME Csound patches

**NIME Concert Patches** panel:

1. Connect Muse or simulator; ensure OSC sending is on.
2. **Start patch** — headless `csound` with CoreAudio + PortMidi (`-+rtmidi=portmidi`).
3. Optional **Open in CsoundQt** — same `.csd`; visuals stay in the browser.
4. **← / →** cycles patches and relaunches headless (server stops the previous process first).

Patch library: `csds-NIME-Selected/` + `csound-patches.js`. API: `GET/POST` via `web/lib/api.ts` → `server-enhanced.js` (`/api/instruments/…`).

Environment: `NEUROVIS_CSOUND_MIDI_DEVICE` for MIDI port index; `NEUROVIS_V12_CSD_PATH` for optional desktop V12 download path.

---

## Performance recording

**Performance recording** panel on the concert page captures to disk via the browser `MediaRecorder` API (typically **WebM**).

| Control | Action |
| --- | --- |
| **Record movie** | Stage `<canvas>` at 30 fps + selected audio tracks |
| **Record audio only** | Mixed audio only (no video) |
| **Stop & download** | Ends capture and saves a file (browser download folder) |

Audio sources (checkboxes):

- **Microphone** — `getUserMedia` input  
- **Browser WASM Csound** — tap on the WASM output node (`web/lib/concertAudioMeter.ts`)  
- **Tab audio (headless)** — `getDisplayMedia` with audio; pick the NeuroVis tab when prompted. Required for headless NIME Csound, which is not in the browser audio graph.

Implementation: `web/lib/concert/concertPerformanceRecorder.ts`, UI: `ConcertPerformanceRecorderPanel.tsx`.

---

## Concert groups (show queue)

Build ordered **visualizer** and **NIME patch** lists, save as a named **concert group**, then **Play show** to step through the set.

| Feature | Details |
| --- | --- |
| Queues | **Add current scene** / **Add current patch**; reorder or remove rows |
| Auto-advance | Set dwell seconds (&gt; 0) per queue; timers run only while **Play show** is active |
| Save / load | `localStorage` key `neurovis.concertGroups.v1`; export/import `.concert-group.json` |
| Keyboard | During show: ↑↓ = visual queue, ←→ = patch queue. Random scene rotation is disabled while show is on |

Format: `neurovis-concert-group` v1 — `web/lib/concert/concertGroup.ts`, UI: `ConcertGroupPanel.tsx`.

Example export (abbreviated):

```json
{
  "format": "neurovis-concert-group",
  "version": 1,
  "id": "…",
  "name": "Opening set",
  "visualQueue": ["auroraBrain", "glTfNeuroLace", "synapticStorm"],
  "patchQueue": ["MuseV12-EEG-Control-Matrix-Cursor", "MuseV5_Jazz_Enhanced_Intelligent"],
  "visualDwellSeconds": 90,
  "patchDwellSeconds": 120
}
```

Invalid scene ids are dropped on import; patch ids are kept as strings (must exist in the NIME library when played).

---

## Performance presets

**Share performance preset** exports JSON (`neurovis-performance-preset` v1): concert scene, tuning, trails, HUD flags, scene rotation, V12 WASM controls, optional research band-edge preset.

Import applies valid fields; unknown scenes map to Aurora Brain.

Scene rotation (optional): random scene every N seconds — `web/lib/concert/concertSceneRotation.ts`, key `neurovis.concertSceneRotation.v1`.

---

## WebGL notes

- Requires **WebGL2**. Software renderer shows a warning; enable GPU acceleration for TF particle lines (texture buffer).
- TF scenes use transform feedback + optional TBO filament lines; macro presets use larger `worldScale` and boost uniforms.
- Fullscreen shaders use ping-pong feedback only on **GL Curl Veil** (`glCurlNoiseParticles`).
- FFT for shaders: `computeConcertSpectrum()` in `web/lib/concert/concertDataScenes.ts` (1D float texture).

Probe helpers: `web/lib/concert/webgl/webglSupport.ts`.

---

## Development

```bash
cd web && npm run dev    # http://localhost:3001/concert
npm start                # API :3000, WS :8080
cd web && npx tsc --noEmit
```

Key modules:

- `web/lib/concert/concertSceneNav.ts` — scene order for arrow keys  
- `web/lib/concert/concertGroup.ts` — saved show queues  
- `web/lib/concert/concertPerformanceRecorder.ts` — movie / audio capture  
- `web/components/concert/ConcertNimePatchPanel.tsx` — patch UI + `stepPatch` / `launchPatchId` ref API  
- `web/lib/concert/webgl/concertWebglScenes.ts` — fullscreen fragment shaders  
- `web/lib/concert/webgl/concertWebglTransformFeedback.ts` — TF simulation + lace mask (no center “egg”)  

---

## Related docs

- [CONCERT-SONIFICATION-DUAL-SOURCE.md](./CONCERT-SONIFICATION-DUAL-SOURCE.md) — EEG + audio sonification concepts  
- [LAUNCH.md](../LAUNCH.md) — one-click launcher and ports  
- [HANDOFF.md](./HANDOFF.md) — project handoff and bridge modes  
