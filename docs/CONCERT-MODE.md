# Concert mode

Concert mode is the full-screen performance UI at **`/concert`**. It combines live EEG (WebSocket), optional browser or headless Csound (NIME `.csd` patches), WASM V12 audio, and a large library of 2D canvas + WebGL visualizers driven by band powers and an audio-reactive mix.

Launch NeuroVis, open <http://localhost:3001/concert>, connect a Muse or start the simulator, then pick a scene and tune sliders in **Tuning mode** or the on-stage **Tuning HUD** (`U`).

---

## Architecture

| Layer | Role |
| --- | --- |
| **`web/app/concert/page.tsx`** | Stage layout, keyboard shortcuts, scene picker groups, NIME panel, presets, WASM V12 card |
| **`ConcertVisualizer`** | 2D canvas scenes (classic, pulse, neural art) |
| **`ConcertVisualizerWebGL`** | Fullscreen GLSL shaders + transform-feedback particle lace/macro |
| **`server-enhanced.js`** | Headless Csound, CsoundQt launch, OSC to patches, patch library from `csound-patches.js` |
| **`web/lib/concertVisualTuning.ts`** | Shared tuning sliders (EEG, GL, motion) |
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
| **↑** | Previous visualizer |
| **↓** | Next visualizer |
| **←** | Previous NIME patch (dropdown) + **Start patch** (headless) |
| **→** | Next NIME patch + **Start patch** (headless) |
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
- `web/components/concert/ConcertNimePatchPanel.tsx` — patch UI + `stepPatch` ref API  
- `web/lib/concert/webgl/concertWebglScenes.ts` — fullscreen fragment shaders  
- `web/lib/concert/webgl/concertWebglTransformFeedback.ts` — TF simulation + lace mask (no center “egg”)  

---

## Related docs

- [CONCERT-SONIFICATION-DUAL-SOURCE.md](./CONCERT-SONIFICATION-DUAL-SOURCE.md) — EEG + audio sonification concepts  
- [LAUNCH.md](../LAUNCH.md) — one-click launcher and ports  
- [HANDOFF.md](./HANDOFF.md) — project handoff and bridge modes  
