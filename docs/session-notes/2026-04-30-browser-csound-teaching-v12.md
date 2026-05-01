# Session notes: Browser Csound (V12 & Teaching), Teaching orchestra, UI — 2026-04-30

This file summarizes work on the NeuroVis **web** app: `@csound/browser` integration, Teaching page reliability, Launchkey-style controls, Overview streaming UX, and Csound parser pitfalls.

## V12 (`CsoundV12Renderer.tsx`)

- **Audio / engine**
  - Shared **AudioContext** (create/resume, pass into `Csound({ audioContext })`); orchestra SR matches host (`browserNeuroVisOrc(sr)`).
  - **`perform()`** loop started after `start()` so WASM drives Web Audio where the bindings expect it.
  - **`realtimePerformanceEnded`** no longer calls `setStatus("idle")` (that event can fire spuriously with `start()` + `perform()` and made **Start Audio** look like it turned off immediately).
- **Chord audition** uses **instr 901** stacked voicing via **`playBrowserNote`** + **`getOrchestraVoicing`** (finite note stack), not only bare sustained MIDI notes.
- **Stop / errors**: `stop(endStatus?)` supports **`"error"`** on failed start so `finally` does not always wipe to `"idle"`.
- **Logs**: EEG-orchestra / sensor-mix log lines deduped under React Strict Mode (refs track last logged transition so pairs of duplicate lines are avoided).
- **Launchkey UI**: Imported from **`VirtualLaunchkeyControls.tsx`**; **CC 21–24** row above **25–28**; **CC1** is a **large standalone** vertical slider; **PB** in its own strip.

## Teaching (`TeachingCsoundRenderer.tsx`)

- **Start path** aligned with V12: **host AudioContext** first, then `Csound({ audioContext: hostCtx })`, **`teachingOrc(srHost)`** for correct SR.
- **`realtimePerformanceStarted`** does not set `running` early; **`running`** only when `start()` completes successfully.
- **Failed `start()`**: teardown without `stop()` so status stays **`error`** (no silent reset to idle).
- **Csound orchestra — `pan` / `iPan` / `ixpos` / `kPb`**
  - **Never** use identifiers like **`iPan`** or assignment **`pan =`** — the lexer treats **`pan`** as the **`pan`** opcode.
  - **Do not** put the word **`pan`** in `;;` comments if WASM/parser quirks treat the line as code.
  - **Current fix**: instr 911 uses inline stereo gains only:
    - `outs aMix * (0.42 + ilayer * 0.14), aMix * (0.58 - ilayer * 0.14)`
  - Instr 907: **`kPb` / `kPg`** renamed to **`kEdgeHitBeta` / `kEdgeHitGamma`** (avoid parser edge cases).
- **UI**: Duplicate **MidiCcTile** rotary grid under USB MIDI **removed**; CC mirrors virtual Launchkey only.
- **Teaching keyboard**: Duplicate on-screen piano removed earlier; Launchkey **MiniKeyboard** covers instr **913** plucks.

## Shared (`VirtualLaunchkeyControls.tsx`)

- **`LAUNCHKEY_CC_ROW_TOP`** (21–24), **`LAUNCHKEY_CC_ROW_BOTTOM`** (25–28).
- **`VerticalControl`**: `size="large"` for CC1; column layout for label / slider / value.

## Overview (`QuickActions.tsx`)

- **Start stream** gives visible feedback: **`streamArmed`** after successful `api.start()`, plus **`packetCount` / `lastMessageAt`** for “live” (**Streaming** label, primary styling). Clears when disconnect / WS not open.

## Reference: UDP OSC vs browser Csound

- **Browser WASM Csound** does **not** use **`OSCinit` / `OSClisten`**; control is **`chnget` / `setControlChannel`** from TypeScript.
- **UDP OSC** (e.g. port 7400) targets **desktop** Csound / Max when the app relay is running — separate from the embedded engine.

## Testing checklist (quick)

1. **Teaching**: Start Teaching Audio → compile OK (no `pan` error) → **Audition tone** → toggle **Hear teaching instrument**.
2. **V12**: Start Audio → badge stays **running** → **Audition** chord + engine → USB MIDI if available.
3. **Overview**: Connect + **Start stream** → control shows **Streaming** when armed or packets live.

## Backup (run locally if not committed)

```bash
cd /Users/richardboulanger/dB-Studio/NeuroVis
git status
git add -A
git commit -m "fix(web): Teaching Csound orchestra pan parse, Launchkey layout, V12 status; docs session notes

- Teaching: inline instr 911 outs; kEdgeHitBeta/Gamma; no pan in comments
- QuickActions: Streaming feedback after Start stream / live packets
- CsoundV12: realtimePerformanceEnded no longer forces idle; log dedupe
- VirtualLaunchkeyControls: CC rows + large CC1
- docs/session-notes/2026-04-30-browser-csound-teaching-v12.md"
git push origin HEAD
```

Optional tag: `git tag -a browser-csound-2026-04-30 -m "Browser Csound session"`
