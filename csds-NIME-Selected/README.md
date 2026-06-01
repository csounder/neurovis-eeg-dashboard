# NIME concert Csound patches

These `.csd` files are your **Mind Monitor–format** instruments (`OSCinit 7400`, `/muse/elements/*_absolute` with `"ffff"`). NeuroVis sends matching OSC when **OSC sending** is on (live Muse, simulator, or Mind Monitor relay).

## From NeuroVis Concert mode

1. Start NeuroVis; connect Muse (or simulator) with **OSC sending** on.
2. Open **Concert** → **NIME Concert Patches**.
3. **Open in CsoundQt** (recommended — same as your working external workflow, USB MIDI + keyboard).
4. Or **Start patch** — NeuroVis runs Csound with `-+rtmidi=portmidi` and `-+rtaudio=CoreAudio` so USB MIDI reaches `massign` (e.g. V12: MIDI ch 1 → instr 5 chords).
5. Play note groups on your Launchkey; use **⌥1–⌥0** for visuals (EEG-driven when patch is running).

**Not wired:** “Enable USB MIDI” under the browser V12 block only feeds **in-browser WASM** Csound, not the headless `.csd` launched from the server.

## Manual

```bash
curl -X POST http://localhost:3000/api/csound/patches/launch \
  -H 'Content-Type: application/json' \
  -d '{"library":"nime","id":"MuseV12-EEG-Control-Matrix-Cursor"}'
```

Stop: `curl -X POST http://localhost:3000/api/csound/patches/stop`
