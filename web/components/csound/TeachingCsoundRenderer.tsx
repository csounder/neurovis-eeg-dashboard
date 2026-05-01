"use client";

import * as React from "react";
import { BookOpen, Clipboard, Download, Music2, Power, Square } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import type { BandName, BandPowers, EEGMessage } from "@/lib/types";
import {
  yieldAfterCsoundStart,
  yieldAfterOrchestraCompiled,
  yieldCsoundInstanceReady,
} from "@/lib/csoundWasmYield";
import { wireCsoundBeforeStart } from "@/lib/csoundWebAudioWire";
import type { CsoundObj } from "@csound/browser";
import {
  LAUNCHKEY_CC_ROW_BOTTOM,
  LAUNCHKEY_CC_ROW_TOP,
  LAUNCHKEY_DEFAULT_START_NOTE,
  LAUNCHKEY_KEY_COUNT,
  midiNoteName,
  MiniKeyboard,
  VerticalControl,
  VirtualKnob,
} from "./VirtualLaunchkeyControls";
import { cn } from "@/lib/utils";

type MotionStreams = {
  accel: number[] | null;
  gyro: number[] | null;
  ppg: number[] | null;
  fnirs?: number[] | null;
};

type TeachingScales = {
  raw: number;
  motion: number;
  ppg: number;
  fnirs: number;
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
};

type MidiInputInfo = { id: string; name: string; manufacturer?: string };

const TEACHING_KEYBOARD = [
  { label: "C", key: "z", transpose: 0 },
  { label: "D", key: "x", transpose: 2 },
  { label: "E", key: "c", transpose: 4 },
  { label: "F", key: "v", transpose: 5 },
  { label: "G", key: "b", transpose: 7 },
  { label: "A", key: "n", transpose: 9 },
  { label: "B", key: "m", transpose: 11 },
  { label: "C", key: ",", transpose: 12 },
];

const activeToggleClass =
  "rounded-md border border-emerald-400 bg-emerald-400 px-3 py-2 text-sm font-medium text-zinc-950";
const inactiveToggleClass =
  "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-emerald-400";

/**
 * Relative δ from typical Muse / band pipelines often reads high while awake and focused;
 * teaching meters + Csound norms use this trim so δ does not dominate the UI during concentration.
 */
const TEACH_DELTA_DISPLAY_TRIM = 0.62;

const DRY_FLAVORS = [
  { id: 0 as const, label: "Clinical", hint: "Tighter bandwidth, least ambience." },
  { id: 1 as const, label: "Minimal", hint: "Balanced lab demo (closest to old Clear)." },
  { id: 2 as const, label: "Wide-field", hint: "More stereo spread while staying dry." },
];

const MUSICAL_FLAVORS = [
  { id: 0 as const, label: "Warm pad", hint: "Soft halo (closest to old Musical)." },
  { id: 1 as const, label: "Bright chorus", hint: "Extra shimmer on the dub layer." },
  { id: 2 as const, label: "Immersive hall", hint: "More late reflections and depth." },
];

/** Listening styles: dry vs tonal vs transient-forward — works with every teaching tile. */
const RHYTHMIC_FLAVORS = [
  { id: 0 as const, label: "Gamelan-ish pings", hint: "Struck metal partials; theta biases pitch steps." },
  { id: 1 as const, label: "Drum circle", hint: "Noise bursts + resonances; beta speeds the pulse." },
  { id: 2 as const, label: "Clock / modular", hint: "Short FM blips; gamma adds jitter." },
];

const BASE_TEACHING_SCALES: TeachingScales = {
  raw: 1.5,
  motion: 5,
  ppg: 8,
  fnirs: 4,
  delta: 3,
  theta: 4,
  alpha: 5,
  beta: 5,
  gamma: 6,
};

/** Per-model starting scales when you switch tiles (helps SATB vs rhythm demos). */
const MODEL_SCALE_DEFAULTS: Partial<Record<number, Partial<TeachingScales>>> = {
  0: { raw: 2 },
  1: { ppg: 10 },
  2: { motion: 7 },
  3: { motion: 7 },
  4: { alpha: 7 },
  5: { beta: 7 },
  6: { gamma: 8 },
  7: { delta: 5, theta: 5, alpha: 5, beta: 5, gamma: 5 },
  8: { fnirs: 6 },
  9: { raw: 2.5, beta: 6 },
  10: { beta: 9, gamma: 9, theta: 6, alpha: 5 },
};

const TEACHING_MODELS = [
  {
    id: 0,
    label: "Raw EEG -> Pitch",
    short: "Raw pitch",
    explanation: "Raw TP9/AF7/AF8/TP10 motion bends the pitch of one clean sine-like tone.",
  },
  {
    id: 1,
    label: "PPG / Heart -> Rhythm",
    short: "Heart rhythm",
    explanation: "PPG energy changes the pulse rate and depth of a simple tone.",
  },
  {
    id: 2,
    label: "Gyro -> Filter",
    short: "Gyro filter",
    explanation: "Head rotation opens and closes a low-pass filter.",
  },
  {
    id: 3,
    label: "Accel -> Tremolo",
    short: "Accel tremolo",
    explanation: "Movement controls amplitude tremolo speed and depth.",
  },
  {
    id: 4,
    label: "Alpha -> Melody",
    short: "Alpha melody",
    explanation: "Alpha power chooses the pitch center for a calm melodic tone.",
  },
  {
    id: 5,
    label: "Beta -> Harmony",
    short: "Beta harmony",
    explanation: "Beta power brightens and thickens a three-note harmony.",
  },
  {
    id: 6,
    label: "Gamma -> Brightness",
    short: "Gamma color",
    explanation: "Gamma power opens the timbre and adds upper partials.",
  },
  {
    id: 7,
    label: "Band Compare",
    short: "Band compare",
    explanation: "Delta through gamma each contribute one clear register to the sound.",
  },
  {
    id: 8,
    label: "fNIRS -> Timbre",
    short: "fNIRS color",
    explanation: "Optical/fNIRS movement slowly opens a warm timbre and stereo space.",
  },
  {
    id: 9,
    label: "Four Sensors -> SATB Chord",
    short: "SATB chord",
    explanation: "TP9, AF7, AF8, and TP10 independently bend bass, tenor, alto, and soprano chord tones.",
  },
  {
    id: 10,
    label: "Bands -> Groove pulse",
    short: "EEG groove",
    explanation:
      "Beta + gamma set pulse speed; theta nudges pitch; accel adds shuffle. Best with Rhythmic listening variants.",
  },
];

export function TeachingCsoundRenderer({
  latestEEG,
  latestBandsAbs,
  latestBandsRel,
  motion,
}: {
  latestEEG: EEGMessage | null;
  latestBandsAbs: BandPowers | null;
  latestBandsRel: BandPowers | null;
  motion: MotionStreams;
}) {
  const csoundRef = React.useRef<CsoundObj | null>(null);
  /** Prevents overlapping start() — `status === "loading"` is async; without this, double calls corrupt the engine. */
  const teachingStartInFlightRef = React.useRef(false);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const midiAccessRef = React.useRef<any>(null);
  const midiHeldNotesRef = React.useRef<Set<number>>(new Set());
  const lastCcLogRef = React.useRef(0);
  const [status, setStatus] = React.useState<"idle" | "loading" | "running" | "error">("idle");
  const [midiStatus, setMidiStatus] = React.useState<"idle" | "ready" | "unsupported" | "error">("idle");
  const [midiInputs, setMidiInputs] = React.useState<MidiInputInfo[]>([]);
  const [selectedMidiInputId, setSelectedMidiInputId] = React.useState("");
  const [model, setModel] = React.useState(0);
  /** Latched “hear instrument” (toggle + Space). Z–M keys / on-screen keys are momentary and do not clear this. */
  const [instrumentOn, setInstrumentOn] = React.useState(false);
  /** Physical Z–M row + on-screen gate keys held (each keydown +1, keyup −1). */
  const [momentaryGateHeld, setMomentaryGateHeld] = React.useState(0);
  /** USB MIDI held notes — separate so releasing keys does not mute a latched master toggle. */
  const [midiSustainGate, setMidiSustainGate] = React.useState(false);
  const [volume, setVolume] = React.useState(0.4);
  const [transpose, setTranspose] = React.useState(0);
  const [teachingPitchBend, setTeachingPitchBend] = React.useState(0);
  const [styleFamily, setStyleFamily] = React.useState<"dry" | "musical" | "rhythmic">("dry");
  const [dryFlavor, setDryFlavor] = React.useState<0 | 1 | 2>(1);
  const [musicalFlavor, setMusicalFlavor] = React.useState<0 | 1 | 2>(0);
  const [rhythmicFlavor, setRhythmicFlavor] = React.useState<0 | 1 | 2>(0);
  const [edgeTriggersEnabled, setEdgeTriggersEnabled] = React.useState(false);
  const [edgeThreshold, setEdgeThreshold] = React.useState(0.52);
  const [edgeDebounceMs, setEdgeDebounceMs] = React.useState(220);
  const [edgeBetaOn, setEdgeBetaOn] = React.useState(true);
  const [edgeGammaOn, setEdgeGammaOn] = React.useState(true);
  const teachingEdgeRefs = React.useRef({
    prevBeta: 0,
    prevGamma: 0,
    lastBetaMs: 0,
    lastGammaMs: 0,
  });
  const [heldTeachingKey, setHeldTeachingKey] = React.useState<string | null>(null);
  const [scales, setScales] = React.useState<TeachingScales>(() => ({
    ...BASE_TEACHING_SCALES,
    ...(MODEL_SCALE_DEFAULTS[0] ?? {}),
  }));
  const [rollingTrace, setRollingTrace] = React.useState<number[]>([]);
  const [logs, setLogs] = React.useState<string[]>([]);
  const [teachingLaunchkeyStart, setTeachingLaunchkeyStart] = React.useState(LAUNCHKEY_DEFAULT_START_NOTE);
  const [launchkeyHeldNotes, setLaunchkeyHeldNotes] = React.useState<Set<number>>(() => new Set());
  const demoSignals = React.useMemo(
    () => buildDemoSignals({ latestEEG, latestBandsAbs, latestBandsRel, motion, scales }),
    [latestEEG, latestBandsAbs, latestBandsRel, motion, scales],
  );
  const selected = React.useMemo(() => selectedSignal(model, demoSignals), [model, demoSignals]);

  const teachGateOpen = instrumentOn || momentaryGateHeld > 0 || midiSustainGate;

  const teachingConsoleRef = React.useRef<HTMLTextAreaElement>(null);

  const appendLog = React.useCallback((line: string) => {
    const cleaned = line.trim();
    if (!cleaned) return;
    setLogs((prev) => [...prev.slice(-39), `[Teaching] ${cleaned}`]);
  }, []);

  function copyTeachingLogsViaExecCommand(text: string): boolean {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "2px";
    ta.style.height = "2px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  async function copyTeachingLogs() {
    const text = logs.join("\n").trim();
    if (!text) {
      appendLog("Console is empty — nothing to copy.");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        appendLog("Copied Teaching console to clipboard.");
        return;
      } catch {
        /* try legacy path */
      }
    }
    if (copyTeachingLogsViaExecCommand(text)) {
      appendLog("Copied Teaching console to clipboard.");
      return;
    }
    const el = teachingConsoleRef.current;
    if (el) {
      el.focus();
      el.select();
      appendLog("Press Cmd/Ctrl+C now (console is selected).");
    } else {
      appendLog("Copy failed — use Select all, then Cmd/Ctrl+C.");
    }
  }

  function selectTeachingConsole() {
    const el = teachingConsoleRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }

  function downloadTeachingLogs() {
    const text = logs.join("\n").trim();
    if (!text) {
      appendLog("Console is empty — nothing to download.");
      return;
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neurovis-teaching-csound-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    appendLog("Downloaded console as .txt (check your Downloads folder).");
  }

  React.useEffect(() => {
    return () => {
      disconnectMidiInputs();
      void stop();
    };
  }, []);

  React.useEffect(() => {
    const access = midiAccessRef.current;
    if (!access) return;
    for (const input of access.inputs.values()) {
      input.onmidimessage = null;
    }
    const selected = access.inputs.get(selectedMidiInputId);
    if (!selected) return;
    selected.onmidimessage = (event: { data?: Uint8Array }) => {
      if (!event.data) return;
      const [statusByte = 0, data1 = 0, data2 = 0] = Array.from(event.data);
      const kind = statusByte & 0xf0;
      if (kind === 0x90 && data2 > 0) {
        const transposeFromMidi = clamp(data1 - 60, -24, 24);
        midiHeldNotesRef.current.add(data1);
        setTranspose(transposeFromMidi);
        setHeldTeachingKey(`midi-${data1}`);
        setMidiSustainGate(true);
      } else if (kind === 0x80 || (kind === 0x90 && data2 === 0)) {
        midiHeldNotesRef.current.delete(data1);
        if (midiHeldNotesRef.current.size === 0) {
          setHeldTeachingKey(null);
          setMidiSustainGate(false);
        } else {
          const last = Array.from(midiHeldNotesRef.current).at(-1) ?? 60;
          setTranspose(clamp(last - 60, -24, 24));
          setHeldTeachingKey(`midi-${last}`);
        }
      } else if (kind === 0xb0) {
        const value = data2 / 127;
        applyTeachingCc(data1, value);
        const csound = csoundRef.current;
        if (csound) {
          void csound.setControlChannel(`teach_cc${data1}`, value);
        }
        const now = performance.now();
        if (now - lastCcLogRef.current > 500) {
          appendLog(`Teaching MIDI CC${data1}: ${value.toFixed(3)}`);
          lastCcLogRef.current = now;
        }
      } else if (kind === 0xe0) {
        const raw14 = data1 + data2 * 128;
        const value = clamp((raw14 - 8192) / 8192, -1, 1);
        setTeachingPitchBend(value);
      }
    };
    appendLog(`Teaching USB MIDI input connected: ${selected.name || "MIDI input"}`);
  }, [appendLog, selectedMidiInputId]);

  React.useEffect(() => {
    const csound = csoundRef.current;
    if (!csound) return;
    const betaN = scaledBandNorm("beta", latestBandsAbs, latestBandsRel, scales);
    const gammaN = scaledBandNorm("gamma", latestBandsAbs, latestBandsRel, scales);
    const edge = computeTeachingEdgeChannels(
      betaN,
      gammaN,
      teachGateOpen && edgeTriggersEnabled,
      edgeThreshold,
      edgeDebounceMs,
      edgeBetaOn,
      edgeGammaOn,
      teachingEdgeRefs.current,
      typeof performance !== "undefined" ? performance.now() : Date.now(),
    );
    void syncTeaching(csound, {
      latestEEG,
      latestBandsAbs,
      latestBandsRel,
      motion,
      model,
      volume,
      transpose,
      pitchBend: teachingPitchBend,
      styleFamily,
      dryFlavor,
      musicalFlavor,
      rhythmicFlavor,
      scales,
      instrumentOn: teachGateOpen,
      edge,
    });
  }, [
    latestEEG,
    latestBandsAbs,
    latestBandsRel,
    motion,
    model,
    volume,
    transpose,
    teachingPitchBend,
    styleFamily,
    dryFlavor,
    musicalFlavor,
    rhythmicFlavor,
    scales,
    teachGateOpen,
    edgeTriggersEnabled,
    edgeThreshold,
    edgeDebounceMs,
    edgeBetaOn,
    edgeGammaOn,
  ]);

  React.useEffect(() => {
    setRollingTrace((prev) => [...prev.slice(-239), selected.normalized]);
  }, [selected.normalized]);

  React.useEffect(() => {
    function spaceWouldActivateFocusedControl(event: KeyboardEvent) {
      if (event.code !== "Space") return false;
      const el = event.target;
      if (!(el instanceof HTMLElement)) return false;
      return Boolean(
        el.closest(
          'button:not([disabled]), [role="button"]:not([aria-disabled="true"]), [role="switch"], input, textarea, select, a[href]',
        ),
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.code === "Space") {
        if (spaceWouldActivateFocusedControl(event)) {
          return;
        }
        event.preventDefault();
        setInstrumentOn((current) => !current);
        return;
      }
      const key = event.key.toLowerCase();
      const note = TEACHING_KEYBOARD.find((item) => item.key === key);
      if (note) {
        if (event.repeat) return;
        event.preventDefault();
        setTranspose(note.transpose);
        setHeldTeachingKey(note.key);
        setMomentaryGateHeld((c) => c + 1);
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (TEACHING_KEYBOARD.some((item) => item.key === key)) {
        event.preventDefault();
        setHeldTeachingKey((held) => (held === key ? null : held));
        setMomentaryGateHeld((c) => Math.max(0, c - 1));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  async function start() {
    if (csoundRef.current || teachingStartInFlightRef.current) return;
    teachingStartInFlightRef.current = true;
    setStatus("loading");
    setLogs([]);
    try {
      const { Csound } = await import("@csound/browser");

      const csound = await Csound({ useWorker: false, autoConnect: false });
      if (!csound) throw new Error("Csound WASM failed to initialize");
      csoundRef.current = csound;
      await yieldCsoundInstanceReady();

      const audioContextInit = await csound.getAudioContext();
      if (audioContextInit) {
        audioContextRef.current = audioContextInit;
        await audioContextInit.resume().catch(() => {});
      }
      const srHost = Math.round(audioContextInit?.sampleRate || 48000);
      appendLog(
        `[Teaching] Csound AudioContext "${audioContextInit?.state ?? "?"}", ${srHost} Hz (library-owned context).`,
      );

      csound.on("message", (msg: unknown) => appendLog(String(msg)));
      csound.on("realtimePerformanceStarted", () => {
        appendLog("Teaching Csound performance started.");
      });
      csound.on("realtimePerformanceEnded", () => {
        appendLog("Teaching Csound performance ended.");
      });

      await csound.setOption("-odac");
      await csound.setOption("-m128");
      const result = await csound.compileOrc(teachingOrc(srHost));
      if (result !== 0) throw new Error(`Teaching orchestra compilation failed: ${result}`);
      await yieldAfterOrchestraCompiled();

      setInstrumentOn(true);
      setMomentaryGateHeld(0);
      setMidiSustainGate(false);
      const betaNStart = scaledBandNorm("beta", latestBandsAbs, latestBandsRel, scales);
      const gammaNStart = scaledBandNorm("gamma", latestBandsAbs, latestBandsRel, scales);
      const edgeStart = computeTeachingEdgeChannels(
        betaNStart,
        gammaNStart,
        edgeTriggersEnabled,
        edgeThreshold,
        edgeDebounceMs,
        edgeBetaOn,
        edgeGammaOn,
        teachingEdgeRefs.current,
        typeof performance !== "undefined" ? performance.now() : Date.now(),
      );
      await syncTeaching(csound, {
        latestEEG,
        latestBandsAbs,
        latestBandsRel,
        motion,
        model,
        volume,
        transpose,
        pitchBend: teachingPitchBend,
        styleFamily,
        dryFlavor,
        musicalFlavor,
        rhythmicFlavor,
        scales,
        instrumentOn: true,
        edge: edgeStart,
      });
      await csound.readScore(
        "f 1 0 4096 10 1\nf 0 86400\ni 907 0 86400\ni 990 0 86400\ni 910 0 86400\n",
      );
      const wiredCtx = await wireCsoundBeforeStart(csound, appendLog, {
        concertMeter: false,
        logLabel: "[Teaching] Csound",
      });
      if (!wiredCtx) {
        throw new Error("[Teaching] Csound audio node was not available to wire before start().");
      }
      audioContextRef.current = wiredCtx;
      await csound.start();
      await csound.inputMessage("i 907 0 86400");
      await csound.inputMessage("i 990 0 86400");
      await csound.inputMessage("i 910 0 86400");
      await yieldAfterCsoundStart();
      const ctxAfter = (await csound.getAudioContext()) ?? wiredCtx ?? audioContextInit ?? null;
      if (ctxAfter) {
        audioContextRef.current = ctxAfter;
        await ctxAfter.resume().catch(() => {});
      }
      if (ctxAfter && ctxAfter.state !== "running") {
        appendLog(
          `[Teaching] Csound output is "${ctxAfter.state}" — use Resume Csound output, check autoplay / site mute.`,
        );
      }
      appendLog(`Teaching model: ${TEACHING_MODELS[model].label}`);
      appendLog("Teaching instrument gate opened. Use Instrument Off or Space to mute it.");
      setStatus("running");
    } catch (error) {
      appendLog(`Start error: ${error instanceof Error ? error.message : String(error)}`);
      const cs = csoundRef.current;
      csoundRef.current = null;
      try {
        if (cs) {
          await cs.stop();
          await cs.destroy();
        }
      } catch {
        /* teardown best-effort */
      }
      setLaunchkeyHeldNotes(new Set());
      setMomentaryGateHeld(0);
      setMidiSustainGate(false);
      setInstrumentOn(false);
      setStatus("error");
    } finally {
      teachingStartInFlightRef.current = false;
    }
  }

  async function auditionTeachingTone() {
    const csound = csoundRef.current;
    if (!csound || status !== "running") {
      appendLog("Start Teaching audio first, then press Audition tone.");
      return;
    }
    await csound.inputMessage("i 912 0 0.55");
    appendLog("Audition: 0.55s test tone (instr 912 — bypasses instrument gate).");
  }

  async function resumeTeachingCsoundOutput() {
    let ctx = audioContextRef.current;
    const cs = csoundRef.current;
    if (!ctx && cs) {
      try {
        ctx = (await cs.getAudioContext()) ?? null;
      } catch {
        ctx = null;
      }
    }
    if (!ctx) {
      appendLog("Resume Csound output: start Teaching audio first.");
      return;
    }
    audioContextRef.current = ctx;
    await ctx.resume().catch(() => {});
    appendLog(`Resume Csound output: graph state is "${ctx.state}" (want "running").`);
  }

  const teachingLaunchkeyNoteOn = React.useCallback(
    (note: number) => {
      const cs = csoundRef.current;
      if (!cs || status !== "running") {
        appendLog("Start Teaching audio before using the virtual Launchkey.");
        return;
      }
      void cs.inputMessage(`i 913 0 0.32 ${note} 0.24`);
      setLaunchkeyHeldNotes((prev) => new Set(prev).add(note));
    },
    [appendLog, status],
  );

  const teachingLaunchkeyNoteOff = React.useCallback((note: number) => {
    setLaunchkeyHeldNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  async function stop() {
    const csound = csoundRef.current;
    if (!csound) {
      return;
    }
    try {
      await csound.stop();
      await csound.destroy();
    } catch (error) {
      appendLog(`Stop error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLaunchkeyHeldNotes(new Set());
      audioContextRef.current = null;
      csoundRef.current = null;
      setMomentaryGateHeld(0);
      setMidiSustainGate(false);
      setInstrumentOn(false);
      setStatus("idle");
      setTeachingPitchBend(0);
    }
  }

  function selectModel(next: number) {
    setModel(next);
    setScales({
      ...BASE_TEACHING_SCALES,
      ...(MODEL_SCALE_DEFAULTS[next] ?? {}),
    });
    appendLog(`Teaching model: ${TEACHING_MODELS[next].label}`);
  }

  function applyTeachingCc(cc: number, value: number) {
    if (cc === 1) {
      setVolume(clamp(0.12 + value * 0.85, 0, 1));
    } else if (cc === 21) {
      setScales((s) => ({ ...s, raw: 0.25 + value * 11.75 }));
    } else if (cc === 22) {
      setScales((s) => ({ ...s, motion: 0.25 + value * 11.75 }));
    } else if (cc === 23) {
      setScales((s) => ({ ...s, alpha: 0.25 + value * 11.75 }));
    } else if (cc === 24) {
      setScales((s) => ({ ...s, beta: 0.25 + value * 11.75 }));
    } else if (cc === 25) {
      setScales((s) => ({ ...s, gamma: 0.25 + value * 11.75 }));
    } else if (cc === 26) {
      const zone = Math.min(8, Math.floor(Number.EPSILON + value * 9));
      if (zone <= 2) {
        setStyleFamily("dry");
        setDryFlavor(zone as 0 | 1 | 2);
      } else if (zone <= 5) {
        setStyleFamily("musical");
        setMusicalFlavor((zone - 3) as 0 | 1 | 2);
      } else {
        setStyleFamily("rhythmic");
        setRhythmicFlavor((zone - 6) as 0 | 1 | 2);
      }
    } else if (cc === 27) {
      setScales((s) => ({ ...s, ppg: 0.25 + value * 11.75 }));
    } else if (cc === 28) {
      setScales((s) => ({ ...s, fnirs: 0.25 + value * 11.75 }));
    }
  }

  function teachingStyleZoneIndex(): number {
    if (styleFamily === "dry") return dryFlavor;
    if (styleFamily === "musical") return 3 + musicalFlavor;
    return 6 + rhythmicFlavor;
  }

  function teachingKnobNorm(cc: number): number {
    const scaleTo01 = (s: number) => clamp((s - 0.25) / 11.75, 0, 1);
    switch (cc) {
      case 21:
        return scaleTo01(scales.raw);
      case 22:
        return scaleTo01(scales.motion);
      case 23:
        return scaleTo01(scales.alpha);
      case 24:
        return scaleTo01(scales.beta);
      case 25:
        return scaleTo01(scales.gamma);
      case 26:
        return clamp((teachingStyleZoneIndex() + 0.5) / 9, 0, 1);
      case 27:
        return scaleTo01(scales.ppg);
      case 28:
        return scaleTo01(scales.fnirs);
      default:
        return 0;
    }
  }

  const teachingCc1Norm = clamp((volume - 0.12) / 0.85, 0, 1);

  function pushTeachingCc(cc: number, value: number) {
    applyTeachingCc(cc, value);
    const cs = csoundRef.current;
    if (cs) void cs.setControlChannel(`teach_cc${cc}`, value);
  }

  function pushTeachingCc1(value: number) {
    setVolume(clamp(0.12 + value * 0.85, 0, 1));
    const cs = csoundRef.current;
    if (cs) void cs.setControlChannel("teach_cc1", value);
  }

  async function enableMidi() {
    if (typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) {
      setMidiStatus("unsupported");
      appendLog("Web MIDI is not supported in this browser.");
      return;
    }
    try {
      const access = await (navigator as any).requestMIDIAccess();
      midiAccessRef.current = access;
      setMidiStatus("ready");
      refreshMidiInputs(access);
      access.onstatechange = () => refreshMidiInputs(access);
      appendLog("Teaching USB MIDI access enabled.");
    } catch (error) {
      setMidiStatus("error");
      appendLog(`Teaching MIDI error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function refreshMidiInputs(access = midiAccessRef.current) {
    if (!access) return;
    const inputs = Array.from(access.inputs.values()).map((input: any) => ({
      id: input.id,
      name: input.name || "MIDI input",
      manufacturer: input.manufacturer || "",
    }));
    setMidiInputs(inputs);
    setSelectedMidiInputId((current) => current || inputs[0]?.id || "");
  }

  function disconnectMidiInputs() {
    const access = midiAccessRef.current;
    if (!access) return;
    for (const input of access.inputs.values()) {
      input.onmidimessage = null;
    }
    midiHeldNotesRef.current.clear();
    setMidiSustainGate(false);
    access.onstatechange = null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[min(100%,280px)] flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status === "running" ? "emerald" : status === "error" ? "rose" : "neutral"} dot>
                Teaching Csound {status}
              </Badge>
              <Badge tone="indigo">One sensor, one sound</Badge>
            </div>
            <p className="text-xs leading-5 text-zinc-400">
              Each preset isolates one mapping. Log lines are prefixed{" "}
              <span className="font-mono text-zinc-400">[Teaching]</span> — V12 / Concert Pad text means a{" "}
              <span className="text-zinc-300">/v12</span> tab, not this page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={status === "running" || status === "loading" ? "primary" : "secondary"}
              onClick={() => void start()}
              aria-busy={status === "loading"}
              aria-pressed={status === "running"}
              title={
                status === "running"
                  ? "Engine running — use Stop to unload Csound."
                  : status === "loading"
                    ? "Starting…"
                    : "Start the browser Csound engine"
              }
              className={cn(
                (status === "running" || status === "loading") &&
                  "cursor-default shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)] ring-2 ring-emerald-400/55",
                status === "loading" && "pointer-events-none !opacity-100",
              )}
              leftIcon={<Power className="h-4 w-4" />}
            >
              {status === "loading"
                ? "Starting…"
                : status === "running"
                  ? "Engine on"
                  : "Start Teaching Audio"}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void auditionTeachingTone()}
              disabled={status !== "running"}
            >
              Audition tone
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void resumeTeachingCsoundOutput()}
              disabled={status !== "running"}
            >
              Resume Csound output
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void stop()}
              disabled={status !== "running"}
              leftIcon={<Square className="h-4 w-4" />}
            >
              Stop
            </Button>
          </div>
        </div>

        <div className="grid gap-4 border-t border-emerald-500/20 pt-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">Sound output</div>
            <Toggle
              checked={instrumentOn}
              onCheckedChange={setInstrumentOn}
              disabled={status !== "running"}
              label="Hear teaching instrument"
              hint="Latched master gate (Space toggles this when a button/field is not focused). Z–M keys are momentary and no longer force-mute when you release them. Stop unloads Csound."
            />
            <Slider
              label="Teaching output volume"
              value={volume}
              min={0}
              max={1}
              step={0.01}
              onChange={setVolume}
              format={(v) => v.toFixed(2)}
            />
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3 text-[11px] leading-relaxed text-zinc-500">
            <div className="font-medium text-zinc-300">Audio controls</div>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                <span className="text-zinc-200">Start / Engine on</span> — load Csound WASM and run the teaching orchestra in the browser.
              </li>
              <li>
                <span className="text-zinc-200">Hear teaching instrument</span> — open or close the Csound gate (no reload).
              </li>
              <li>
                <span className="text-zinc-200">Stop</span> — tear down the engine (use Start again afterward).
              </li>
              <li>
                <span className="text-zinc-200">Resume Csound output</span> — if autoplay policy left the engine’s output graph suspended after Start.
              </li>
              <li>
                <span className="text-zinc-200">Audition tone</span> — short beep that bypasses the gate (routing check).
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {TEACHING_MODELS.map((item) => (
          <button
            key={item.id}
            onClick={() => selectModel(item.id)}
            className={[
              "rounded-xl border p-3 text-left transition",
              model === item.id
                ? "border-emerald-400/80 bg-emerald-500/15 shadow-[0_0_28px_-16px_rgba(16,185,129,.95)]"
                : "border-zinc-800 bg-zinc-950/45 hover:border-zinc-600 hover:bg-zinc-900/70",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <BookOpen className="h-4 w-4 text-emerald-300" />
              {item.label}
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{item.explanation}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">Per-stream & band gains</div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            The δ column uses a teaching trim so relative delta from the pipeline does not dominate the meters while you
            are awake and concentrating. Tune with the <span className="text-zinc-400">Delta scale</span> slider as needed.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <ScaleSlider label="Raw EEG scale" value={scales.raw} onChange={(raw) => setScales((s) => ({ ...s, raw }))} />
            <ScaleSlider label="Motion scale" value={scales.motion} onChange={(motionScale) => setScales((s) => ({ ...s, motion: motionScale }))} />
            <ScaleSlider label="PPG scale" value={scales.ppg} onChange={(ppg) => setScales((s) => ({ ...s, ppg }))} />
            <ScaleSlider label="fNIRS scale" value={scales.fnirs} onChange={(fnirs) => setScales((s) => ({ ...s, fnirs }))} />
            <ScaleSlider label="Delta scale" value={scales.delta} onChange={(delta) => setScales((s) => ({ ...s, delta }))} />
            <ScaleSlider label="Theta scale" value={scales.theta} onChange={(theta) => setScales((s) => ({ ...s, theta }))} />
            <ScaleSlider label="Alpha scale" value={scales.alpha} onChange={(alpha) => setScales((s) => ({ ...s, alpha }))} />
            <ScaleSlider label="Beta scale" value={scales.beta} onChange={(beta) => setScales((s) => ({ ...s, beta }))} />
            <ScaleSlider label="Gamma scale" value={scales.gamma} onChange={(gamma) => setScales((s) => ({ ...s, gamma }))} />
          </div>
          <div className="mt-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className={styleFamily === "dry" ? activeToggleClass : inactiveToggleClass}
                onClick={() => setStyleFamily("dry")}
              >
                Dry
              </button>
              <button
                type="button"
                className={styleFamily === "musical" ? activeToggleClass : inactiveToggleClass}
                onClick={() => setStyleFamily("musical")}
              >
                Musical
              </button>
              <button
                type="button"
                className={styleFamily === "rhythmic" ? activeToggleClass : inactiveToggleClass}
                onClick={() => setStyleFamily("rhythmic")}
              >
                Rhythmic
              </button>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs text-zinc-400">
                {styleFamily === "dry"
                  ? "Dry character (every teaching example)"
                  : styleFamily === "musical"
                    ? "Musical character (every teaching example)"
                    : "Rhythmic character (mix bus + pulse-forward)"}
              </span>
              <select
                className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/70"
                value={
                  styleFamily === "dry"
                    ? dryFlavor
                    : styleFamily === "musical"
                      ? musicalFlavor
                      : rhythmicFlavor
                }
                onChange={(event) => {
                  const next = Number(event.target.value) as 0 | 1 | 2;
                  if (styleFamily === "dry") setDryFlavor(next);
                  else if (styleFamily === "musical") setMusicalFlavor(next);
                  else setRhythmicFlavor(next);
                }}
              >
                {(styleFamily === "dry"
                  ? DRY_FLAVORS
                  : styleFamily === "musical"
                    ? MUSICAL_FLAVORS
                    : RHYTHMIC_FLAVORS
                ).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} — {item.hint}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 space-y-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-amber-100/90">
                Band edges → Csound (schedkwhen stubs)
              </span>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  className="rounded border-zinc-600 bg-zinc-950"
                  checked={edgeTriggersEnabled}
                  onChange={(e) => setEdgeTriggersEnabled(e.target.checked)}
                />
                Arm triggers
              </label>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Rising crossings on scaled beta/gamma (same norms as sliders). Pulses hit instr 907 → short gamelan-ish pings in
              instr 911 (debounced in TS + mintime in Csound).
            </p>
            <Slider
              label="Edge threshold (teach_thresh)"
              value={edgeThreshold}
              min={0.12}
              max={0.92}
              step={0.01}
              onChange={setEdgeThreshold}
              format={(v) => v.toFixed(2)}
            />
            <Slider
              label="Debounce (ms)"
              value={edgeDebounceMs}
              min={60}
              max={600}
              step={10}
              onChange={setEdgeDebounceMs}
              format={(v) => `${Math.round(v)} ms`}
            />
            <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-zinc-600 bg-zinc-950"
                  checked={edgeBetaOn}
                  onChange={(e) => setEdgeBetaOn(e.target.checked)}
                />
                Beta → edge pulse
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-zinc-600 bg-zinc-950"
                  checked={edgeGammaOn}
                  onChange={(e) => setEdgeGammaOn(e.target.checked)}
                />
                Gamma → edge pulse
              </label>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs leading-5 text-zinc-400">
            <div className="font-semibold text-zinc-200">{TEACHING_MODELS[model].label}</div>
            <div className="mt-1">{TEACHING_MODELS[model].explanation}</div>
            <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/70 p-2 font-mono text-[11px] text-zinc-300">
              Press Space to toggle, or Z X C V B N M , to momentarily gate and transpose the current demo.
            </div>
          </div>
        </div>
        <DemoSignalPanel model={model} signals={demoSignals} selected={selected} instrumentOn={teachGateOpen} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <WaveformTrace selected={selected} values={rollingTrace} />
        <TeachingKeyboard
          transpose={transpose}
          pitchBend={teachingPitchBend}
          heldKey={heldTeachingKey}
          onGate={(item) => {
            setTranspose(item.transpose);
            setHeldTeachingKey(item.key);
            setMomentaryGateHeld((c) => c + 1);
          }}
          onRelease={() => {
            setHeldTeachingKey(null);
            setMomentaryGateHeld((c) => Math.max(0, c - 1));
          }}
        />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <Music2 className="h-4 w-4 text-emerald-400" />
            Virtual controller (Launchkey-style)
          </div>
          <Badge tone="indigo">
            PB + standalone CC1 · CC21–24 / CC25–28 · {LAUNCHKEY_KEY_COUNT} keys
          </Badge>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-zinc-500">
          Pitch bend alone in its strip; <strong className="text-zinc-400">CC1</strong> is a separate tall mod slider. Encoders are two rows (
          <span className="font-mono text-zinc-400">21–24</span> above{" "}
          <span className="font-mono text-zinc-400">25–28</span>
          ); CC27 = PPG, CC28 = fNIRS.
        </p>
        <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex justify-center rounded-xl border border-zinc-800 bg-zinc-950/70 px-2 py-3">
              <VerticalControl
                label="PB"
                value={teachingPitchBend}
                min={-1}
                max={1}
                step={0.01}
                center
                onChange={(v) => setTeachingPitchBend(v)}
              />
            </div>
            <div className="flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <span className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                Mod wheel
              </span>
              <VerticalControl
                label="CC1"
                value={teachingCc1Norm}
                min={0}
                max={1}
                step={0.01}
                size="large"
                onChange={(v) => pushTeachingCc1(v)}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1.5">
                {LAUNCHKEY_CC_ROW_TOP.map((cc) => (
                  <VirtualKnob
                    key={cc}
                    cc={cc}
                    value={teachingKnobNorm(cc)}
                    onChange={(v) => pushTeachingCc(cc, v)}
                  />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {LAUNCHKEY_CC_ROW_BOTTOM.map((cc) => (
                  <VirtualKnob
                    key={cc}
                    cc={cc}
                    value={teachingKnobNorm(cc)}
                    onChange={(v) => pushTeachingCc(cc, v)}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
              <div className="font-mono text-[11px] text-zinc-400">
                Range {midiNoteName(teachingLaunchkeyStart)}–
                {midiNoteName(teachingLaunchkeyStart + LAUNCHKEY_KEY_COUNT - 1)}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setTeachingLaunchkeyStart((n) => Math.max(0, n - 12))}
                >
                  Octave Down
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() =>
                    setTeachingLaunchkeyStart((n) =>
                      Math.min(127 - LAUNCHKEY_KEY_COUNT + 1, n + 12),
                    )
                  }
                >
                  Octave Up
                </Button>
              </div>
            </div>
            <MiniKeyboard
              startNote={teachingLaunchkeyStart}
              disabled={status !== "running"}
              heldNotes={launchkeyHeldNotes}
              onNoteOn={teachingLaunchkeyNoteOn}
              onNoteOff={teachingLaunchkeyNoteOff}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              USB MIDI Teaching Control
            </div>
            <div className="mt-1 text-sm text-zinc-300">
              Notes gate/transpose. Pitch wheel and CC1/CC21-28 use the virtual Launchkey above.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={enableMidi}>
              Enable USB MIDI
            </Button>
            <Badge tone={midiStatus === "ready" ? "emerald" : midiStatus === "error" || midiStatus === "unsupported" ? "rose" : "neutral"} dot={midiStatus === "ready"}>
              {midiStatus}
            </Badge>
          </div>
        </div>
        <div className="grid gap-3">
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">MIDI keyboard/controller</span>
            <select
              className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/70"
              value={selectedMidiInputId}
              onChange={(event) => setSelectedMidiInputId(event.target.value)}
              disabled={!midiInputs.length}
            >
              {midiInputs.length ? (
                midiInputs.map((input) => (
                  <option key={input.id} value={input.id}>
                    {input.name}
                    {input.manufacturer ? ` (${input.manufacturer})` : ""}
                  </option>
                ))
              ) : (
                <option value="">No MIDI inputs found</option>
              )}
            </select>
          </label>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            CC1 and CC21-28 are shown on the virtual Launchkey block above; no duplicate rotaries here.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <SignalTrace label="Raw EEG channels" values={demoSignals.rawChannels} range={250} />
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Teaching Csound Console
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                leftIcon={<Clipboard className="h-3.5 w-3.5" />}
                onClick={() => void copyTeachingLogs()}
              >
                Copy
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={selectTeachingConsole}>
                Select all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                leftIcon={<Download className="h-3.5 w-3.5" />}
                onClick={downloadTeachingLogs}
              >
                .txt
              </Button>
            </div>
          </div>
          <textarea
            ref={teachingConsoleRef}
            readOnly
            spellCheck={false}
            aria-label="Teaching Csound console log"
            className="h-40 w-full cursor-text resize-none overflow-auto whitespace-pre-wrap border-0 bg-zinc-900/80 p-2 font-mono text-[11px] leading-5 text-zinc-400 outline-none ring-1 ring-inset ring-zinc-800 focus:ring-emerald-500/50"
            value={logs.length ? logs.join("\n") : "Teaching Csound messages will appear here."}
          />
        </div>
      </div>
    </div>
  );
}

type TeachingEdgeSnapshot = {
  teach_thresh: number;
  teach_edge_beta: number;
  teach_edge_gamma: number;
};

type TeachingEdgeRefsState = {
  prevBeta: number;
  prevGamma: number;
  lastBetaMs: number;
  lastGammaMs: number;
};

function bandNormForTeaching(
  band: BandName,
  latestBandsAbs: BandPowers | null,
  latestBandsRel: BandPowers | null,
): number {
  const abs = latestBandsAbs?.[band] ?? -2.5;
  const rel = latestBandsRel?.[band];
  let base =
    typeof rel === "number" && Number.isFinite(rel)
      ? clamp(rel, 0, 1)
      : clamp((abs + 2.5) / 4, 0, 1);
  if (band === "delta") {
    base = clamp(base * TEACH_DELTA_DISPLAY_TRIM + 0.02, 0, 1);
  }
  return base;
}

function scaledBandNorm(
  band: BandName,
  latestBandsAbs: BandPowers | null,
  latestBandsRel: BandPowers | null,
  scales: TeachingScales,
) {
  const n = bandNormForTeaching(band, latestBandsAbs, latestBandsRel);
  return clamp(n * scales[band], 0, 1);
}

/** Rising-edge pulses when scaled norm crosses thresh (debounced); feeds instr 907 → schedkwhen stubs. */
function computeTeachingEdgeChannels(
  betaN: number,
  gammaN: number,
  armed: boolean,
  thresh: number,
  debounceMs: number,
  betaOn: boolean,
  gammaOn: boolean,
  refs: TeachingEdgeRefsState,
  now: number,
): TeachingEdgeSnapshot {
  if (!armed) {
    refs.prevBeta = betaN;
    refs.prevGamma = gammaN;
    return { teach_thresh: thresh, teach_edge_beta: 0, teach_edge_gamma: 0 };
  }

  let pulseBeta = 0;
  let pulseGamma = 0;

  if (betaOn) {
    if (refs.prevBeta < thresh && betaN >= thresh && now - refs.lastBetaMs >= debounceMs) {
      pulseBeta = 1;
      refs.lastBetaMs = now;
    }
    refs.prevBeta = betaN;
  } else {
    refs.prevBeta = betaN;
  }

  if (gammaOn) {
    if (refs.prevGamma < thresh && gammaN >= thresh && now - refs.lastGammaMs >= debounceMs) {
      pulseGamma = 1;
      refs.lastGammaMs = now;
    }
    refs.prevGamma = gammaN;
  } else {
    refs.prevGamma = gammaN;
  }

  return {
    teach_thresh: thresh,
    teach_edge_beta: pulseBeta,
    teach_edge_gamma: pulseGamma,
  };
}

async function syncTeaching(
  csound: CsoundObj,
  data: {
    latestEEG: EEGMessage | null;
    latestBandsAbs: BandPowers | null;
    latestBandsRel: BandPowers | null;
    motion: MotionStreams;
    model: number;
    volume: number;
    transpose: number;
    pitchBend: number;
    styleFamily: "dry" | "musical" | "rhythmic";
    dryFlavor: 0 | 1 | 2;
    musicalFlavor: 0 | 1 | 2;
    rhythmicFlavor: 0 | 1 | 2;
    scales: TeachingScales;
    instrumentOn: boolean;
    edge: TeachingEdgeSnapshot;
  },
) {
  const raw = data.latestEEG?.raw ?? [];
  const accel = data.motion.accel ?? [];
  const gyro = data.motion.gyro ?? [];
  const ppg = data.motion.ppg ?? [];
  const fnirs = data.motion.fnirs ?? [];
  const styleVoice =
    data.styleFamily === "dry"
      ? data.dryFlavor
      : data.styleFamily === "musical"
        ? data.musicalFlavor
        : data.rhythmicFlavor;
  const familyIdx =
    data.styleFamily === "dry" ? 0 : data.styleFamily === "musical" ? 1 : 2;
  const transposeOut = clamp(data.transpose + data.pitchBend * 12, -48, 48);
  const writes: Promise<unknown>[] = [
    csound.setControlChannel("teach_model", data.model),
    csound.setControlChannel("teach_volume", data.volume),
    csound.setControlChannel("teach_transpose", transposeOut),
    csound.setControlChannel("teach_style_family", familyIdx),
    csound.setControlChannel("teach_style_voice", styleVoice),
    csound.setControlChannel("teach_raw_scale", data.scales.raw),
    csound.setControlChannel("teach_gate", data.instrumentOn ? 1 : 0),
    csound.setControlChannel("teach_thresh", data.edge.teach_thresh),
    csound.setControlChannel("teach_edge_beta", data.edge.teach_edge_beta),
    csound.setControlChannel("teach_edge_gamma", data.edge.teach_edge_gamma),
  ];

  for (let i = 0; i < 4; i += 1) {
    writes.push(csound.setControlChannel(`teach_raw_${i + 1}`, clamp(Number(raw[i]) || 0, -1200, 1200)));
  }

  for (const band of ["delta", "theta", "alpha", "beta", "gamma"] as BandName[]) {
    const abs = data.latestBandsAbs?.[band] ?? -2.5;
    writes.push(csound.setControlChannel(`teach_${band}`, abs));
    writes.push(
      csound.setControlChannel(
        `teach_${band}_n`,
        scaledBandNorm(band, data.latestBandsAbs, data.latestBandsRel, data.scales),
      ),
    );
  }

  writes.push(csound.setControlChannel("teach_accel_mag", clamp(accelFeature(accel) * data.scales.motion, 0, 8)));
  writes.push(csound.setControlChannel("teach_gyro_mag", clamp(gyroFeature(gyro) * data.scales.motion, 0, 8)));
  writes.push(csound.setControlChannel("teach_ppg_mag", clamp(ppgFeature(ppg) * data.scales.ppg, 0, 8)));
  writes.push(csound.setControlChannel("teach_fnirs_mag", clamp(fnirsFeature(fnirs) * data.scales.fnirs, 0, 8)));

  await Promise.all(writes);
}

function teachingOrc(sr = 48000) {
  const srN = Math.max(8000, Math.min(192000, Math.round(sr)));
  return `
sr = ${srN}
ksmps = 32
nchnls = 2
0dbfs = 1
seed 0

instr 990
  aSilence oscili 0, 20
  outs aSilence, aSilence
endin

;; Edge router: schedkwhen stubs for gamelan-like layers (driven by teach_edge_* pulses from TS)
instr 907
  kEb chnget "teach_edge_beta"
  kEg chnget "teach_edge_gamma"
  kZb init 0
  kZg init 0
  kEdgeHitBeta = 0
  kEdgeHitGamma = 0
  if (kEb > 0.5) then
    if (kZb <= 0.5) then
      kEdgeHitBeta = 1
    endif
  endif
  if (kEg > 0.5) then
    if (kZg <= 0.5) then
      kEdgeHitGamma = 1
    endif
  endif
  kZb = kEb
  kZg = kEg
  schedkwhen kEdgeHitBeta, 0.04, 12, 911, 0, 0.085, 0
  schedkwhen kEdgeHitGamma, 0.04, 12, 911, 0, 0.095, 1
endin

;; One-shot partial stack; p4=0 beta edge, p4=1 gamma edge (detuned partials)
instr 911
  ilayer = p4
  kFq = cpsmidinn(69 + ilayer * 7)
  aEnv linseg 0, 0.002, 1, p3 - 0.024, 0.001
  a1 poscil aEnv * 0.4, kFq, 1
  a2 poscil aEnv * 0.28, kFq * 3.8765, 1
  a3 poscil aEnv * 0.14, kFq * 6.02, 1
  aMix = a1 + a2 + a3
  outs aMix * (0.42 + ilayer * 0.14), aMix * (0.58 - ilayer * 0.14)
endin

instr 910
  kModel chnget "teach_model"
  kVol chnget "teach_volume"
  kGate chnget "teach_gate"
  kTranspose chnget "teach_transpose"
  kFam chnget "teach_style_family"
  kVoice chnget "teach_style_voice"
  kVo limit kVoice, 0, 2
  kRawScale chnget "teach_raw_scale"
  kRaw1 chnget "teach_raw_1"
  kRaw2 chnget "teach_raw_2"
  kRaw3 chnget "teach_raw_3"
  kRaw4 chnget "teach_raw_4"
  kDelta chnget "teach_delta"
  kTheta chnget "teach_theta"
  kAlpha chnget "teach_alpha"
  kBeta chnget "teach_beta"
  kGamma chnget "teach_gamma"
  kDeltaN chnget "teach_delta_n"
  kThetaN chnget "teach_theta_n"
  kAlphaN chnget "teach_alpha_n"
  kBetaN chnget "teach_beta_n"
  kGammaN chnget "teach_gamma_n"
  kAccel chnget "teach_accel_mag"
  kGyro chnget "teach_gyro_mag"
  kPpg chnget "teach_ppg_mag"
  kFnirs chnget "teach_fnirs_mag"
  kGate portk kGate, 0.02
  kRawShape = (kRaw1 - kRaw2 + kRaw3 - kRaw4) / 4
  kRawMotion = limit(kRawShape * kRawScale * 0.018, -36, 36)
  kRawNote = 60 + kTranspose + kRawMotion
  kRawFreq = cpsmidinn(kRawNote)
  kRawFreq portk kRawFreq, 0.025
  kPpgRate = 0.7 + limit(kPpg, 0, 8) * 2.5
  kPpgLfo lfo 0.85, kPpgRate, 0
  kGyroCutoff = 180 + limit(kGyro, 0, 8) * 1800
  kGyroCutoff portk kGyroCutoff, 0.03
  kTremRate = 0.8 + limit(kAccel, 0, 8) * 1.8
  kTrem lfo 0.48, kTremRate, 0
  kAlphaNote = 55 + kTranspose + int(kAlphaN * 12)
  kAlphaFreq = cpsmidinn(kAlphaNote)
  aRawFund poscil 0.24, kRawFreq
  aRawHarm poscil 0.035, kRawFreq * 2
  aRaw = aRawFund + aRawHarm
  aRaw tone aRaw, 2200
  aPpg poscil 0.26 * (0.45 + kPpgLfo), 220
  aGyro vco2 0.42, cpsmidinn(43 + kTranspose)
  aGyro moogladder aGyro, kGyroCutoff, 0.82
  aAccel poscil 0.24 * (0.72 + kTrem), cpsmidinn(48 + kTranspose)
  aAlpha poscil 0.20, kAlphaFreq
  aAlpha = aAlpha + poscil(0.05, cpsmidinn(kAlphaNote + 7))
  kBetaRoot = cpsmidinn(45 + kTranspose)
  aBeta poscil 0.10 + kBetaN * 0.24, kBetaRoot
  aBeta = aBeta + poscil(0.06 + kBetaN * 0.20, kBetaRoot * 1.25)
  aBeta = aBeta + poscil(0.04 + kBetaN * 0.18, kBetaRoot * 1.5)
  aGamma vco2 0.18, cpsmidinn(50 + kTranspose)
  aGamma tone aGamma, 500 + kGammaN * 9500
  aGamma = aGamma + poscil(0.03 + kGammaN * 0.20, cpsmidinn(74 + kTranspose))
  aFnirs vco2 0.20 + limit(kFnirs, 0, 8) * 0.025, cpsmidinn(38 + kTranspose)
  aFnirs tone aFnirs, 700 + limit(kFnirs, 0, 8) * 1300
  aFnirs = aFnirs + poscil(0.05 + limit(kFnirs, 0, 8) * 0.025, cpsmidinn(50 + kTranspose))
  aCompare = poscil(0.02 + kDeltaN * 0.24, cpsmidinn(36 + kTranspose))
  aCompare = aCompare + poscil(0.02 + kThetaN * 0.22, cpsmidinn(43 + kTranspose))
  aCompare = aCompare + poscil(0.02 + kAlphaN * 0.20, cpsmidinn(50 + kTranspose))
  aCompare = aCompare + poscil(0.02 + kBetaN * 0.18, cpsmidinn(57 + kTranspose))
  aCompare = aCompare + poscil(0.02 + kGammaN * 0.16, cpsmidinn(69 + kTranspose))
  kBassNote = 36 + kTranspose + limit(kRaw1 * kRawScale * 0.018, -7, 7)
  kTenorNote = 48 + kTranspose + limit(kRaw2 * kRawScale * 0.018, -7, 7)
  kAltoNote = 55 + kTranspose + limit(kRaw3 * kRawScale * 0.018, -7, 7)
  kSopranoNote = 64 + kTranspose + limit(kRaw4 * kRawScale * 0.018, -7, 7)
  aSatb = poscil(0.12, cpsmidinn(kBassNote))
  aSatb = aSatb + poscil(0.10, cpsmidinn(kTenorNote))
  aSatb = aSatb + poscil(0.09, cpsmidinn(kAltoNote))
  aSatb = aSatb + poscil(0.08, cpsmidinn(kSopranoNote))
  aSatb tone aSatb, 1100 + kBetaN * 5200
  kGroHz = 1.08 + kBetaN * 5.5 + kGammaN * 2.25 + kAccel * 0.055
  kGroPrev init 0
  kGroTrig init 0
  kGroPhase phasor kGroHz
  if (kGroPhase < kGroPrev) then
    kGroTrig = 1
  else
    kGroTrig = 0
  endif
  kGroPrev = kGroPhase
  kGroDecay init 0
  kGroDecay = kGroDecay + kGroTrig * 0.52 - kGroDecay * 0.91
  kGroMidi = 55 + kTranspose + int(kThetaN * 7)
  kGroFq = cpsmidinn(kGroMidi)
  aGroFund poscil kGroDecay * (0.34 + kVo * 0.05), kGroFq
  aGroPartial poscil kGroDecay * (0.09 + kVo * 0.08), kGroFq * (3.95 + kVo * 0.35)
  aGroNz rand kGroDecay * (0.1 + kVo * 0.18)
  aGroove = aGroFund + aGroPartial + tone(aGroNz, 880 + kVo * 2400 + kBetaN * 1100)
  aMix = aRaw
  if (kModel == 1) then
    aMix = aPpg
  elseif (kModel == 2) then
    aMix = aGyro
  elseif (kModel == 3) then
    aMix = aAccel
  elseif (kModel == 4) then
    aMix = aAlpha
  elseif (kModel == 5) then
    aMix = aBeta
  elseif (kModel == 6) then
    aMix = aGamma
  elseif (kModel == 7) then
    aMix = aCompare
  elseif (kModel == 8) then
    aMix = aFnirs
  elseif (kModel == 9) then
    aMix = aSatb
  elseif (kModel == 10) then
    aMix = aGroove
  endif
  if (kFam == 1) then
    aColor poscil 0.06 + kGammaN * (0.06 + kVo * 0.02), cpsmidinn(74 + kTranspose + kVo * 3)
    aMix = (aMix * (0.82 - kVo * 0.05)) + (aColor * (0.18 + kVo * 0.06))
  endif
  aWide delay aMix, 0.018
  if (kFam == 0) then
    kFb = 0.52 + kVo * 0.08
    kLm = 0.84 - kVo * 0.04
    kRm = 0.14 + kVo * 0.05
  elseif (kFam == 1) then
    kFb = 0.66 + kVo * 0.12
    kLm = 0.66 - kVo * 0.05
    kRm = 0.28 + kVo * 0.07
  elseif (kFam == 2) then
    kFb = 0.44 + kVo * 0.09
    kLm = 0.78 - kVo * 0.04
    kRm = 0.18 + kVo * 0.06
  else
    kFb = 0.52 + kVo * 0.08
    kLm = 0.84 - kVo * 0.04
    kRm = 0.14 + kVo * 0.05
  endif
  aRevL, aRevR reverbsc aMix, aWide, kFb, 9000
  outs (aMix * kLm + aRevL * kRm) * kVol * kGate, (aWide * kLm + aRevR * kRm) * kVol * kGate
endin

;; One-shot routing test — ignores teach_gate (if you hear this but not the preset, check Instrument On + volume)
instr 912
  aEnv linsegr 0, 0.018, 1, p3 - 0.09, 0.6, 0.04, 0
  a1 poscil 0.24 * aEnv, 440
  a2 poscil 0.085 * aEnv, 880
  outs a1 + a2, a1 + a2
endin

;; On-screen piano pluck — short click; not sustained (use USB MIDI for held notes)
instr 913
  imidi = p4
  iamp = p5
  aEnv linsegr 0, 0.012, 1, p3 - 0.07, 0.001
  a1 poscil iamp * aEnv * 0.44, cpsmidinn(imidi)
  a2 poscil iamp * aEnv * 0.11, cpsmidinn(imidi) * 2.02
  outs a1 + a2, a1 + a2
endin
`;
}

type DemoSignals = {
  rawChannels: number[];
  rawPitchHz: number;
  ppgPulseRate: number;
  gyroCutoffHz: number;
  accelTremoloHz: number;
  fnirsTimbreHz: number;
  satbMotionSemitones: number;
  groovePulseHz: number;
  bands: Record<BandName, number>;
};

function buildDemoSignals({
  latestEEG,
  latestBandsAbs,
  latestBandsRel,
  motion,
  scales,
}: {
  latestEEG: EEGMessage | null;
  latestBandsAbs: BandPowers | null;
  latestBandsRel: BandPowers | null;
  motion: MotionStreams;
  scales: TeachingScales;
}): DemoSignals {
  const rawChannels = [0, 1, 2, 3].map((i) => Number(latestEEG?.raw?.[i]) || 0);
  const rawShape = (rawChannels[0] - rawChannels[1] + rawChannels[2] - rawChannels[3]) / 4;
  const rawMotionSemis = clamp(rawShape * scales.raw * 0.018, -36, 36);
  const satbMotionSemitones =
    rawChannels.reduce((sum, value) => sum + Math.abs(clamp(value * scales.raw * 0.018, -7, 7)), 0) /
    Math.max(1, rawChannels.length);
  const accelMag = accelFeature(motion.accel ?? []) * scales.motion;
  const gyroMag = gyroFeature(motion.gyro ?? []) * scales.motion;
  const ppgMag = ppgFeature(motion.ppg ?? []) * scales.ppg;
  const fnirsMag = fnirsFeature(motion.fnirs ?? []) * scales.fnirs;
  const bands = {
    delta: clamp(normalizedBand("delta", latestBandsAbs, latestBandsRel) * scales.delta, 0, 1),
    theta: clamp(normalizedBand("theta", latestBandsAbs, latestBandsRel) * scales.theta, 0, 1),
    alpha: clamp(normalizedBand("alpha", latestBandsAbs, latestBandsRel) * scales.alpha, 0, 1),
    beta: clamp(normalizedBand("beta", latestBandsAbs, latestBandsRel) * scales.beta, 0, 1),
    gamma: clamp(normalizedBand("gamma", latestBandsAbs, latestBandsRel) * scales.gamma, 0, 1),
  };
  const groovePulseHz =
    1.08 + bands.beta * 5.5 + bands.gamma * 2.25 + clamp(accelMag * 0.012, 0, 0.45);
  return {
    rawChannels,
    rawPitchHz: midiToHz(60 + rawMotionSemis),
    ppgPulseRate: 0.7 + clamp(ppgMag, 0, 8) * 2.5,
    gyroCutoffHz: 180 + clamp(gyroMag, 0, 8) * 1800,
    accelTremoloHz: 0.8 + clamp(accelMag, 0, 8) * 1.8,
    fnirsTimbreHz: 700 + clamp(fnirsMag, 0, 8) * 1300,
    satbMotionSemitones,
    groovePulseHz,
    bands,
  };
}

function normalizedBand(
  band: BandName,
  latestBandsAbs: BandPowers | null,
  latestBandsRel: BandPowers | null,
) {
  return bandNormForTeaching(band, latestBandsAbs, latestBandsRel);
}

function midiToHz(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function DemoSignalPanel({
  model,
  signals,
  selected,
  instrumentOn,
}: {
  model: number;
  signals: DemoSignals;
  selected: ReturnType<typeof selectedSignal>;
  instrumentOn: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Visible Control Signal
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">{selected.label}</div>
        </div>
        <Badge tone={instrumentOn ? "emerald" : "neutral"} dot>
          {instrumentOn ? "Sounding" : "Muted"}
        </Badge>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between font-mono text-xs">
          <span className="text-zinc-500">{selected.units}</span>
          <span className="text-emerald-200">{selected.display}</span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-400 transition-[width]"
            style={{ width: `${Math.round(selected.normalized * 100)}%` }}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {(["delta", "theta", "alpha", "beta", "gamma"] as BandName[]).map((band) => (
          <div key={band} className="rounded-md border border-zinc-800 bg-zinc-950/70 p-2">
            <div className="text-[10px] uppercase text-zinc-500">{band}</div>
            <div className="mt-1 h-16 overflow-hidden rounded bg-zinc-900">
              <div
                className="mt-auto h-full origin-bottom rounded bg-cyan-400/80"
                style={{
                  transform: `scaleY(${signals.bands[band]})`,
                }}
              />
            </div>
            <div className="mt-1 font-mono text-[10px] text-zinc-400">{signals.bands[band].toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScaleSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Slider
      label={label}
      value={value}
      min={0.25}
      max={12}
      step={0.25}
      onChange={onChange}
      format={(v) => `${v.toFixed(2)}x`}
    />
  );
}

function WaveformTrace({
  selected,
  values,
}: {
  selected: ReturnType<typeof selectedSignal>;
  values: number[];
}) {
  const points = values.length
    ? values
        .map((value, index) => {
          const x = (index / Math.max(1, values.length - 1)) * 100;
          const y = 92 - clamp(value, 0, 1) * 84;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ")
    : "";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Time-Domain Control Stream
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">{selected.label}</div>
        </div>
        <div className="font-mono text-xs text-emerald-200">{selected.display}</div>
      </div>
      <svg className="h-36 w-full rounded-lg border border-zinc-800 bg-zinc-950" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(113,113,122,.45)" strokeWidth="0.5" />
        <polyline fill="none" stroke="rgb(45,212,191)" strokeWidth="1.8" points={points} />
      </svg>
      <div className="mt-2 text-xs leading-5 text-zinc-500">
        This is the live control value after exaggeration scaling, not audio output.
      </div>
    </div>
  );
}

function TeachingKeyboard({
  transpose,
  pitchBend,
  heldKey,
  onGate,
  onRelease,
}: {
  transpose: number;
  pitchBend: number;
  heldKey: string | null;
  onGate: (item: (typeof TEACHING_KEYBOARD)[number]) => void;
  onRelease: () => void;
}) {
  const effectiveSt = clamp(transpose + pitchBend * 12, -48, 48);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Gate / Transpose Keyboard
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">
            Base +{transpose} semitones · PB {(pitchBend * 12).toFixed(1)} st → Csound {effectiveSt >= 0 ? "+" : ""}
            {effectiveSt.toFixed(1)} st
          </div>
        </div>
        <Badge tone={heldKey ? "emerald" : "neutral"} dot>
          {heldKey ? "Key held" : "Momentary"}
        </Badge>
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {TEACHING_KEYBOARD.map((item) => (
          <button
            key={item.key}
            className={[
              "touch-none rounded-lg border px-2 py-5 text-center transition",
              heldKey === item.key
                ? "border-emerald-300 bg-emerald-300 text-zinc-950"
                : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-emerald-400 hover:bg-emerald-500/10",
            ].join(" ")}
            onMouseDown={() => onGate(item)}
            onMouseUp={onRelease}
            onMouseLeave={() => heldKey === item.key && onRelease()}
            onTouchStart={() => onGate(item)}
            onTouchEnd={onRelease}
          >
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="mt-1 font-mono text-[10px] opacity-70">{item.key.toUpperCase()}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function selectedSignal(model: number, signals: DemoSignals) {
  if (model === 1) {
    return {
      label: "PPG magnitude controls pulse rate",
      units: "pulse rate",
      display: `${signals.ppgPulseRate.toFixed(2)} Hz`,
      normalized: clamp((signals.ppgPulseRate - 1.2) / 14, 0, 1),
    };
  }
  if (model === 2) {
    return {
      label: "Gyroscope magnitude controls filter cutoff",
      units: "low-pass cutoff",
      display: `${Math.round(signals.gyroCutoffHz)} Hz`,
      normalized: clamp(signals.gyroCutoffHz / 16000, 0, 1),
    };
  }
  if (model === 3) {
    return {
      label: "Accelerometer magnitude controls tremolo",
      units: "tremolo rate",
      display: `${signals.accelTremoloHz.toFixed(2)} Hz`,
      normalized: clamp(signals.accelTremoloHz / 25, 0, 1),
    };
  }
  if (model === 4) {
    return {
      label: "Alpha relative power controls melody pitch",
      units: "alpha power",
      display: signals.bands.alpha.toFixed(3),
      normalized: signals.bands.alpha,
    };
  }
  if (model === 5) {
    return {
      label: "Beta relative power controls harmony brightness",
      units: "beta power",
      display: signals.bands.beta.toFixed(3),
      normalized: signals.bands.beta,
    };
  }
  if (model === 6) {
    return {
      label: "Gamma relative power controls upper partials",
      units: "gamma power",
      display: signals.bands.gamma.toFixed(3),
      normalized: signals.bands.gamma,
    };
  }
  if (model === 7) {
    const total = Object.values(signals.bands).reduce((sum, value) => sum + value, 0);
    return {
      label: "All five bands control five audible registers",
      units: "combined band activity",
      display: total.toFixed(3),
      normalized: clamp(total / 2, 0, 1),
    };
  }
  if (model === 8) {
    return {
      label: "fNIRS / optical activity controls timbre and space",
      units: "fNIRS timbre",
      display: `${Math.round(signals.fnirsTimbreHz)} Hz`,
      normalized: clamp((signals.fnirsTimbreHz - 700) / 10400, 0, 1),
    };
  }
  if (model === 9) {
    return {
      label: "Four EEG sensors bend bass, tenor, alto, soprano",
      units: "average voice motion",
      display: `${signals.satbMotionSemitones.toFixed(2)} semitones`,
      normalized: clamp(signals.satbMotionSemitones / 7, 0, 1),
    };
  }
  if (model === 10) {
    return {
      label: "Beta + gamma drive pulse Hz (accel adds shuffle)",
      units: "groove pulse",
      display: `${signals.groovePulseHz.toFixed(2)} Hz`,
      normalized: clamp((signals.groovePulseHz - 1) / 14, 0, 1),
    };
  }
  return {
    label: "Raw EEG channel difference controls oscillator pitch",
    units: "oscillator pitch",
    display: `${Math.round(signals.rawPitchHz)} Hz`,
    normalized: clamp((Math.log2(signals.rawPitchHz / midiToHz(60)) + 3) / 6, 0, 1),
  };
}

function SignalTrace({ label, values, range }: { label: string; values: number[]; range: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="grid gap-2">
        {values.map((value, index) => {
          const normalized = clamp((value + range) / (range * 2), 0, 1);
          return (
            <div key={index}>
              <div className="mb-1 flex justify-between font-mono text-[11px] text-zinc-400">
                <span>CH {index + 1}</span>
                <span>{value.toFixed(2)} uV</span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-zinc-800">
                <div className="absolute left-1/2 top-0 h-full w-px bg-zinc-600" />
                <div
                  className="h-full rounded-full bg-cyan-400"
                  style={{
                    marginLeft: value >= 0 ? "50%" : `${normalized * 100}%`,
                    width: `${Math.abs(normalized - 0.5) * 100}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function magnitude(values: number[]) {
  if (!values.length) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function accelFeature(values: number[]) {
  if (!values.length) return 0;
  const x = Number(values[0]) || 0;
  const y = Number(values[1]) || 0;
  const z = (Number(values[2]) || 0) - 1;
  return Math.sqrt(x * x + y * y + z * z);
}

function gyroFeature(values: number[]) {
  return magnitude(values) / 12;
}

function ppgFeature(values: number[]) {
  if (!values.length) return 0;
  const avg = values.reduce((sum, value) => sum + (Number(value) || 0), 0) / values.length;
  if (Math.abs(avg) > 1000) {
    return clamp((avg - 60000) / 7000, 0, 2);
  }
  return clamp(Math.abs(avg), 0, 2);
}

function fnirsFeature(values: number[]) {
  if (!values.length) return 0;
  return clamp(values.reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0) / values.length, 0, 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

