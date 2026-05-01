# V12–V17 EEG control workstation — modes, MIDI CC, and brainwave mapping

Routes: **`/v12`** … **`/v17`**. All variants share the **same** UI shell and the **same** browser Csound engine (`CsoundV12Renderer`); they differ in **default** matrix values (which band leads harmony, default palette, response/orchestration/motion indices, CC1 mode, and melody level sliders).

For the **full** V12 score logic (rich progressions, desktop OSC/MIDI orchestration), use the **downloaded `.csd`** in CsoundQt or the Csound Web IDE. This document focuses on what the **NeuroVis browser** patch actually does today, plus what each **`/v12`–`/v17`** preset is *for*.

---

## How sound is produced (browser)

1. Click **Start Audio** and wait until status is **running**.
2. **Auto bass + melody bed** (toggle in **Browser Csound Mix**, on by default) plays an eight-step progression from the current **palette** and **Bass / Melody / Rhythm** matrix columns — **no MIDI needed**.
3. Optionally **hold notes** (virtual keys, ASCII piano, or USB MIDI) to layer the thicker **pad** (`instr 901`) on top.
4. **Mind Monitor / Muse** data (or simulator) fills band and motion channels; MIDI faders send **CC1** and **CC21–CC28**.

## Harmonic palette (keys **1–9**, **0** on the workstation)

| Key | Index | Palette label (UI) |
|-----|-------|-------------------|
| 1 | 0 | Classical |
| 2 | 1 | Pop |
| 3 | 2 | Jazz |
| 4 | 3 | Lydian-Chromatic |
| 5 | 4 | Modal |
| 6 | 5 | Whole Tone |
| 7 | 6 | Schoenbergian |
| 8 | 7 | Fibonacci |
| 9 | 8 | Bohlen-Pierce-ish |
| 0 | 9 | Partch/Carlos-ish |

In the **browser** orchestra, palette (plus **Chord range**) sets **`nv_prog_root_semi`** — baseline transposition for both the **bed** (`instr 908`) and **held-note pad** (`instr 901`). **US Shift+digit** (`!` through `)`) selects the same ten palettes as **1–9, 0**.

---

## Auto arrangement bed — **`instr 908`** (bass + melody line)

When **Auto bass + melody bed** is on (`nv_arrangement_on` = 1):

| Role | Source |
|------|--------|
| **Key center** | `nv_prog_root_semi` from palette + chord range (same math as the pad). |
| **Chord degree** | Internal **8-step** cycle (scale degrees in semitones relative to that root). |
| **Step rate** | **MIDI note pulse scale** + normalized band chosen by **Rhythm driver** column. |
| **Bass pitch wobble** | Normalized band from **Bass driver** column × `nv_stream_bands`. |
| **Melody pitch wobble** | Normalized band from **Melody driver** column × `nv_stream_bands`. |
| **Levels** | **Global volume**, **Arrangement bed level** (`nv_arrangement_mix`), **Melody volume** slider (melody line only). |

Turn the bed **off** in Mix for **MIDI-only** silence before keys.

---

## MIDI — **CC1** and **CC21–CC28** (browser `instr 901`)

Values are **0–1** internally (7‑bit MIDI is divided by 127). Virtual knobs on the page mirror the same channels as USB MIDI.

| Control | Control channel | Role in browser engine |
|--------|-----------------|------------------------|
| **Pitch bend** | `nv_pitch_bend` | About **±2 semitones** on the played root (and arp layer). |
| **CC1** | `nv_cc1_value` (+ mode) | **Brightness** on the tone (`kBright`); if **CC1 mode** is *volume*, also drives `nv_melody_volume`. If *complexity*, ties to `nv_melody_complexity`. |
| **CC21** | `nv_cc21_value` | **Level shaping**: multiplies note loudness together with global volume and CC28 `(0.55 + CC21 × 0.70)`. |
| **CC22** | `nv_cc22_value` | **Tremolo / metro speed** (LFO rate) and a small bump to **arp mix**. |
| **CC23** | `nv_cc23_value` | **Brightness** (harmonic “edge” / filter emphasis). |
| **CC24** | `nv_cc24_value` | **Stereo width** (`kWide`), pan spread and delay send. |
| **CC25** | `nv_cc25_value` | **Arpeggio layer**: must be **> 0** to hear stepped partials; scales arp **rate** (with metro + CC26) and **arp loudness**. |
| **CC26** | `nv_cc26_value` | **Arp speed** (faster steps through 0 / +4 / +7 / +12 semitone offsets on the arp oscillator). |
| **CC27** | `nv_cc27_value` | Extra **width** (same family as CC24). |
| **CC28** | `nv_cc28_value` | **Master fader** on played voice: `kPlayVol` includes `(0.02 … 0.98)` from CC28. Default seeded **up** so silence is not the default. |

**Global volume**, **MIDI note pulse scale** (metro), and **Chord range** are sliders in the **Browser Csound Mix** card (not MIDI CC).

---

## Brainwave / sensor input (default routing)

Data comes from the NeuroVis store (**bands**, **raw EEG**, **accel / gyro / PPG / fNIRS** magnitudes) written every ~100 ms into Csound **control channels** (`nv_delta_1` … `nv_gamma_4`, `nv_raw_*`, `nv_accel_mag`, etc.). Per-band values are **normalized** to about **0–1** in the orchestra (`kAlphaN`, `kBetaN`, …).

### Harmony band (which column you set as **Harmony** on the matrix)

The band selected as **Harmony** drives **live pitch nudge** on held notes (on top of palette transposition):

- Its normalized level is compared to a midpoint; the result is scaled (and by **Bands** stream gain, see below) and **clamped to about ±4 semitones**.

So by default, whichever band is **Harmony** (e.g. **Alpha** on `/v12`, **Theta** on `/v13`) is the one whose **relative level** you hear **wobbling** the chord most directly.

### Palette + chord range

Together they set **semitone transpose** for the **fundamental stack** and the **arp partial** (same transpose added to both).

### Stream gains (renderer **Sensor mix**)

For each stream (**Raw**, **Bands**, **Accel**, **Gyro**, **PPG**, **fNIRS**), the card can **mute**, **solo**, or leave at full **1.0**. Those set `nv_stream_*` gains:

- **`nv_stream_bands`** scales: harmony nudge, band-driven **pitch drift**, **pulse depth** ripples, and several **orchestra model** branches (see below).
- **`nv_stream_raw`**: mainly **orchestra model 0** (raw pitch lab).
- **`nv_stream_accel` / `nv_stream_gyro`**: **model 2** (sensor quartet).
- **`nv_stream_ppg`**: **model 3** (heart / motion temple).
- **`nv_stream_fnirs`**: **model 5+** (beyond V12 branch).

**Default**: all streams **on** (no solo/mute) unless you change them.

### Orchestra model dropdown (**EEG orchestra** in the Mix card)

This is **`nv_orchestra_model`** (**0–5**). It selects different **timbre / motion** behavior for **held MIDI notes** (`instr 901`).

| ID | Label | Rough EEG focus in browser |
|----|--------|----------------------------|
| 0 | 01 Raw EEG Pitch Lab | **Raw** channels → pitch drift; sparse spectrum. |
| 1 | 02 Band Power Organ | **Delta / gamma** bands → sub + brightness + octaves. |
| 2 | 03 Sensor Quartet | **Accel + gyro** → pulse + width. |
| 3 | 04 Heart / Motion Temple | **PPG** → pulse; subdued highs. |
| 4 | 05 V12 Concert Pad | **Alpha** emphasis on bed; general pad (default for many presets). |
| 5 | 06 Beyond V12 Generative | **Gamma + fNIRS** (if present) → color. |

After the model branch runs, **all models** get extra **shared** modulation: **α / β / θ** push **pitch drift** and **pulse depth** (so you always hear some “living” motion when bands move).

### Matrix fields **not** read by browser WASM

**These `nv_*` channels are sent but not used by `instr 901` or `instr 908`:**

- **Response** (Smooth…Meditative), **Orchestration** (Classic / Glass / Dark), **Harmony motion** (Block / Arp / Glide) indices  

The **Bass / Melody / Rhythm** columns **are** read by **`instr 908`** (bed). **Harmony** column still drives **`instr 901`** pitch nudge on held notes only.

For **desktop CSD** / `instr 90`, all matrix channels apply.

---

## Per-variant defaults (`/v12`–`/v17`)

Each variant sets **starting** `harmonyBand`, **palette**, **responseMode**, **orchestration**, **motion**, **cc1Mode**, and melody sliders. Names below match `web/components/v12/V12WorkstationPage.tsx`.

### Index lookups (shared)

- **Response**: 0 Smooth, 1 Stepped, 2 Rhythmic, 3 Dramatic, 4 Meditative  
- **Orchestration**: 0 Classic, 1 Glass, 2 Dark  
- **Motion**: 0 Block, 1 Arp/Stride, 2 Slow Glide  

### V12 — default workstation

| Field | Default |
|-------|---------|
| Harmony band | Alpha |
| Bass / Melody / Rhythm / Register | Delta / Gamma / Beta / Alpha |
| Response / Orchestration / Motion | Stepped / Classic / Block |
| Palette | Jazz (index 2) |
| CC1 mode | Volume |
| Melody volume / complexity | 0.7 / 0.35 |

**Intent:** Balanced “control matrix” — alpha‑weighted harmony nudge, jazz palette, melody volume on CC1.

### V13 — Spectral drift lab

| Field | Default |
|-------|---------|
| Harmony band | **Theta** |
| Bass / Melody / Rhythm / Register | Delta / **Beta** / **Alpha** / Theta |
| Response / Orchestration / Motion | **Meditative** / **Glass** / **Arp/Stride** |
| Palette | Jazz (2) |
| CC1 mode | **Complexity** |
| Melody volume / complexity | 0.55 / **0.5** |

**Intent:** Slower, glassy, theta‑led harmony; **CC1** biased toward **complexity** mapping.

### V14 — Rhythm & motion bench

| Field | Default |
|-------|---------|
| Harmony band | **Beta** |
| Bass / Melody / Rhythm / Register | Theta / Gamma / **Gamma** / Beta |
| Response / Orchestration / Motion | **Rhythmic** / Classic / **Slow Glide** |
| Palette | **Whole Tone** (5) |
| CC1 mode | Complexity |
| Melody volume / complexity | 0.65 / 0.55 |

**Intent:** Beta‑centric harmony, dual **gamma** drivers, whole‑tone palette — good for **timing / motion** experiments.

### V15 — Dense harmony explorer

| Field | Default |
|-------|---------|
| Harmony band | **Gamma** |
| Bass / Melody / Rhythm / Register | Delta / **Alpha** / Beta / Gamma |
| Response / Orchestration / Motion | **Dramatic** / **Dark** / Block |
| Palette | **Schoenbergian** (6) |
| CC1 mode | Volume |
| Melody volume / complexity | 0.55 / **0.62** |

**Intent:** Gamma harmony, dark orchestration (desktop), **high complexity** default — stress‑testing dense harmony.

### V16 — Pulse & pattern lab

| Field | Default |
|-------|---------|
| Harmony band | **Beta** |
| Bass / Melody / Rhythm / Register | Delta / Gamma / **Beta** / Theta |
| Response / Orchestration / Motion | **Rhythmic** / **Glass** / **Arp/Stride** |
| Palette | **Modal** (4) |
| CC1 mode | Complexity |
| Melody volume / complexity | 0.62 / 0.52 |

**Intent:** “Groove” comparison preset — beta harmony + rhythm on beta, modal palette, rhythmic response index.

### V17 — Modular motion lane

| Field | Default |
|-------|---------|
| Harmony band | **Gamma** |
| Bass / Melody / Rhythm / Register | **Beta** / **Beta** / **Gamma** / Alpha |
| Response / Orchestration / Motion | **Stepped** / Classic / **Slow Glide** |
| Palette | **Lydian-Chromatic** (3) |
| CC1 mode | Complexity |
| Melody volume / complexity | **0.58 / 0.58** |

**Intent:** Stepped response index + **double beta** in bass/melody columns, **gamma** rhythm lane, chromatic palette — **sequencer‑adjacent** defaults.

---

## File references

| Piece | Path |
|-------|------|
| Variant defaults + meta | `web/components/v12/V12WorkstationPage.tsx` |
| Browser orchestra (`instr 901` pad + `instr 908` bed) | `web/components/csound/CsoundV12Renderer.tsx` → `browserNeuroVisOrc()` |
| Control channel sync | `syncControls`, `syncEeg`, `syncSensors` in same file |

---

*Last updated: 2026-04-30 — CC21–28, palette transpose, harmony-band nudge, v12–v17 default table.*
