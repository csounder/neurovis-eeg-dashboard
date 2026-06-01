"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, AlertTriangle, Music2, Power, Square, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CopyableConsole } from "@/components/ui/CopyableConsole";
import { Slider } from "@/components/ui/Slider";
import type { BandName, BandPowers, EEGMessage } from "@/lib/types";
import {
  attachConcertWasmMeter,
  detachConcertWasmMeter,
  getConcertAudioLevel,
  stopConcertAudioMeter,
} from "@/lib/concertAudioMeter";
import {
  yieldAfterCsoundStart,
  yieldAfterOrchestraCompiled,
  yieldCsoundInstanceReady,
} from "@/lib/csoundWasmYield";
import { formatCaught } from "@/lib/formatCaught";
import { wireCsoundBeforeStart } from "@/lib/csoundWebAudioWire";
import type { CsoundObj } from "@csound/browser";
import {
  LAUNCHKEY_CC_NUMBERS,
  LAUNCHKEY_CC_ROW_BOTTOM,
  LAUNCHKEY_CC_ROW_TOP,
  LAUNCHKEY_DEFAULT_START_NOTE,
  LAUNCHKEY_KEY_COUNT,
  midiNoteName,
  MiniKeyboard,
  VerticalControl,
  VirtualKnob,
} from "./VirtualLaunchkeyControls";

const BAND_INDEX: Record<BandName, number> = {
  delta: 0,
  theta: 1,
  alpha: 2,
  beta: 3,
  gamma: 4,
};

const MIDI_NOTES = [
  { label: "C2", note: 48 },
  { label: "D2", note: 50 },
  { label: "F2", note: 53 },
  { label: "G2", note: 55 },
  { label: "C3", note: 60 },
];

const MIDI_SUSTAIN_INSTR_BASE = 1000;

const SOUND_PRESETS = [
  { id: 0, label: "Mellow Pad", description: "Soft, rounded, slow-release concert pad." },
  { id: 1, label: "Glass Choir", description: "Bright upper partials and airy shimmer." },
  { id: 2, label: "Dark Hybrid", description: "Lower, weightier tone with beta-driven edge." },
  { id: 3, label: "Huge Stage", description: "Wide, dramatic, projection-friendly chord tone." },
  { id: 4, label: "Meditative", description: "Gentle, long envelopes for slow brainwave music." },
  { id: 5, label: "Frenetic", description: "Shorter, brighter articulation for active sections." },
];

const ORCHESTRA_MODELS = [
  {
    id: 0,
    label: "01 Raw EEG Pitch Lab",
    description: "Clear teaching model: raw Muse channels gently bend warm pitches.",
  },
  {
    id: 1,
    label: "02 Band Power Organ",
    description: "Delta through gamma become a slow five-register harmonic organ.",
  },
  {
    id: 2,
    label: "03 Sensor Quartet",
    description: "Raw EEG, band power, accelerometer, and gyro each play a musical role.",
  },
  {
    id: 3,
    label: "04 Heart / Motion Temple",
    description: "PPG and movement shape pulsing resonance and spacious drones.",
  },
  {
    id: 4,
    label: "05 V12 Concert Pad",
    description: "The current MIDI-playable V12-inspired concert sonification.",
  },
  {
    id: 5,
    label: "06 Beyond V12 Generative",
    description: "More autonomous musical texture with EEG-shaped harmony and color.",
  },
];

const SENSOR_STREAMS = [
  { id: "raw", label: "Raw EEG" },
  { id: "bands", label: "Bands" },
  { id: "accel", label: "Accel" },
  { id: "gyro", label: "Gyro" },
  { id: "ppg", label: "Heart / PPG" },
  { id: "fnirs", label: "fNIRS" },
] as const;

type SensorStreamId = (typeof SENSOR_STREAMS)[number]["id"];

type MotionStreams = {
  accel: number[] | null;
  gyro: number[] | null;
  ppg: number[] | null;
  fnirs?: number[] | null;
};

type MidiInputInfo = {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
};

type AudioOutputInfo = {
  id: string;
  label: string;
};

type AudioContextWithSink = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

type RuntimeCsound = CsoundObj & {
  compileCSD?: (csd: string, mode?: number) => Promise<number> | number;
  compileCsdText?: (csd: string) => Promise<number> | number;
  perform?: () => Promise<number> | number;
  cleanup?: () => Promise<number> | number;
};

export interface V12RenderControls {
  harmonyBand: BandName;
  bassDriver: BandName;
  melodyDriver: BandName;
  rhythmDriver: BandName;
  registerDriver: BandName;
  responseMode: number;
  orchestration: number;
  motion: number;
  palette: number;
  cc1Mode: "volume" | "complexity";
  melodyVolume: number;
  melodyComplexity: number;
}

/** Browser workstation routes `/v12` … `/v18` share one Csound renderer; id is for UX + test hooks. */
export type NeuroVisWorkstationId = "v12" | "v13" | "v14" | "v15" | "v16" | "v17" | "v18";

export function CsoundV12Renderer({
  controls,
  latestEEG,
  latestBandsAbs,
  latestBandTraces,
  motion,
  batteryPct,
  workstationId = "v12",
  enableConcertWasmMeter = false,
  onStatusChange,
}: {
  controls: V12RenderControls;
  latestEEG?: EEGMessage | null;
  latestBandsAbs: BandPowers | null;
  latestBandTraces: Record<BandName, number[]> | null;
  motion?: MotionStreams | null;
  batteryPct?: number | null;
  workstationId?: NeuroVisWorkstationId;
  /** When true, tap WASM output for Concert ⌥-scenes (mic/wasm/blend modes). */
  enableConcertWasmMeter?: boolean;
  onStatusChange?: (status: "idle" | "loading" | "compiled" | "running" | "paused" | "error") => void;
}) {
  const csoundRef = React.useRef<CsoundObj | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const midiAccessRef = React.useRef<MIDIAccess | null>(null);
  const lastCcLogRef = React.useRef(0);
  const activeSustainedNotesRef = React.useRef<Set<number>>(new Set());
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "compiled" | "running" | "paused" | "error"
  >("idle");
  const [logs, setLogs] = React.useState<string[]>([]);
  const [globalVolume, setGlobalVolume] = React.useState(0.618);
  const [metroScale, setMetroScale] = React.useState(0.25);
  const [chordRange, setChordRange] = React.useState(12);
  const [orchestraModel, setOrchestraModel] = React.useState(4);
  const [soundPreset, setSoundPreset] = React.useState(0);
  const [melodyOn, setMelodyOn] = React.useState(true);
  const [arrangementBedOn, setArrangementBedOn] = React.useState(true);
  const [arrangementMix, setArrangementMix] = React.useState(0.72);
  const [printDashboard, setPrintDashboard] = React.useState(false);
  const [launchkeyStartNote, setLaunchkeyStartNote] = React.useState(LAUNCHKEY_DEFAULT_START_NOTE);
  const [cc1Value, setCc1Value] = React.useState(0.64);
  const [pitchBendValue, setPitchBendValue] = React.useState(0);
  const [launchkeyCcs, setLaunchkeyCcs] = React.useState<Record<number, number>>(() =>
    LAUNCHKEY_CC_NUMBERS.reduce(
      (acc, cc) => {
        // CC28 = master fader in browser instr 901; default up so level is not stuck at zero.
        acc[cc] = cc === 28 ? 1 : 0;
        return acc;
      },
      {} as Record<number, number>,
    ),
  );
  const [soloSensor, setSoloSensor] = React.useState<SensorStreamId | null>(null);
  const [mutedSensors, setMutedSensors] = React.useState<Set<SensorStreamId>>(() => new Set());
  const [heldNotes, setHeldNotes] = React.useState<Set<number>>(() => new Set());
  const [midiStatus, setMidiStatus] = React.useState<
    "idle" | "unsupported" | "requesting" | "ready" | "error"
  >("idle");
  const [midiInputs, setMidiInputs] = React.useState<MidiInputInfo[]>([]);
  const [selectedMidiInputId, setSelectedMidiInputId] = React.useState("");
  const [audioOutputs, setAudioOutputs] = React.useState<AudioOutputInfo[]>([]);
  const [selectedAudioOutputId, setSelectedAudioOutputId] = React.useState("default");
  const [audioOutputStatus, setAudioOutputStatus] = React.useState<
    "default" | "ready" | "unsupported" | "error"
  >("default");

  const playwrightE2E = process.env.NEXT_PUBLIC_PLAYWRIGHT === "1";

  React.useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  React.useEffect(() => {
    if (!enableConcertWasmMeter) {
      detachConcertWasmMeter();
    }
  }, [enableConcertWasmMeter]);

  React.useEffect(() => {
    if (!playwrightE2E || typeof window === "undefined") return;
    const w = window as Window & { __nvConcertLevel?: () => number; __nvMeterProbe?: () => number };
    if (status !== "running") {
      delete w.__nvConcertLevel;
      delete w.__nvMeterProbe;
      return;
    }
    w.__nvConcertLevel = () => getConcertAudioLevel();
  }, [playwrightE2E, status]);

  const appendLog = React.useCallback((line: string) => {
    const cleaned = line.trimEnd();
    if (!cleaned) return;
    setLogs((prev) => [...prev.slice(-79), cleaned]);
  }, []);

  const sensorGains = React.useMemo(() => {
    return SENSOR_STREAMS.reduce(
      (acc, stream) => {
        acc[stream.id] = soloSensor
          ? soloSensor === stream.id ? 1 : 0
          : mutedSensors.has(stream.id) ? 0 : 1;
        return acc;
      },
      {} as Record<SensorStreamId, number>,
    );
  }, [mutedSensors, soloSensor]);

  const sensorActivity = React.useMemo<Record<SensorStreamId, number>>(() => {
    const raw = latestEEG?.raw ?? [];
    const bands = latestBandsAbs
      ? Math.max(
          ...Object.values(latestBandsAbs).map((value) =>
            clamp(((Number(value) || -2.5) + 2.5) / 4, 0, 1),
          ),
        )
      : 0;
    return {
      raw: clamp(magnitude(raw) / 220, 0, 1),
      bands,
      accel: clamp(magnitude(motion?.accel ?? []) / 2, 0, 1),
      gyro: clamp(magnitude(motion?.gyro ?? []) / 250, 0, 1),
      ppg: clamp(magnitude(motion?.ppg ?? []), 0, 1),
      fnirs: clamp(magnitude(motion?.fnirs ?? []), 0, 1),
    };
  }, [latestBandsAbs, latestEEG, motion]);

  const stop = React.useCallback(async (endStatus: "idle" | "error" = "idle") => {
    const csound = csoundRef.current;
    if (!csound) {
      if (endStatus === "error") setStatus("error");
      else setStatus("idle");
      return;
    }
    try {
      await csound.stop();
      if (hasFunction(csound, "cleanup")) {
        await csound.cleanup();
      }
      await csound.destroy();
      appendLog("Browser Csound stopped.");
    } catch (error) {
      appendLog(`Stop error: ${formatCaught(error)}`);
    } finally {
      stopConcertAudioMeter();
      csoundRef.current = null;
      audioContextRef.current = null;
      activeSustainedNotesRef.current.clear();
      setHeldNotes(new Set());
      setStatus(endStatus);
    }
  }, [appendLog]);

  const stopUnmountRef = React.useRef(stop);
  stopUnmountRef.current = stop;
  React.useEffect(() => {
    return () => {
      disconnectMidiInputs();
      void stopUnmountRef.current();
    };
  }, []);

  const audioReady = status === "running";

  React.useEffect(() => {
    const access = midiAccessRef.current;
    if (!access) return;
    for (const input of access.inputs.values()) {
      input.onmidimessage = null;
    }
    const selected = access.inputs.get(selectedMidiInputId);
    if (!selected) return;
    selected.onmidimessage = (event) => {
      try {
        if (!event.data) return;
        const [statusByte = 0, data1 = 0, data2 = 0] = Array.from(event.data);
        const csound = csoundRef.current;
        if (!csound) return;

        const kind = statusByte & 0xf0;
        if (kind === 0x90 && data2 > 0) {
          void startSustainedMidiNote(csound, data1, data2 / 127, orchestraModel, activeSustainedNotesRef.current);
          setHeldNotes((prev) => new Set(prev).add(data1));
        } else if (kind === 0x80 || (kind === 0x90 && data2 === 0)) {
          void releaseSustainedMidiNote(csound, data1, activeSustainedNotesRef.current);
          setHeldNotes((prev) => {
            const next = new Set(prev);
            next.delete(data1);
            return next;
          });
        } else if (kind === 0xb0) {
          const value = data2 / 127;
          void csound.setControlChannel(`nv_cc${data1}_value`, value);
          const launchCc = LAUNCHKEY_CC_NUMBERS.find((c) => c === data1);
          if (launchCc !== undefined) {
            setLaunchkeyCcs((prev) => ({ ...prev, [launchCc]: value }));
          }
          if (data1 === 1) {
            setCc1Value(value);
            void csound.setControlChannel("nv_cc1_value", value);
            void csound.setControlChannel(
              controls.cc1Mode === "volume" ? "nv_melody_volume" : "nv_melody_complexity",
              value,
            );
          }
          const now = performance.now();
          if (now - lastCcLogRef.current > 500) {
            appendLog(`USB MIDI CC${data1}: ${value.toFixed(3)}`);
            lastCcLogRef.current = now;
          }
        } else if (kind === 0xe0) {
          const raw14 = data1 + data2 * 128;
          const value = clamp((raw14 - 8192) / 8192, -1, 1);
          setPitchBendValue(value);
          void csound.setControlChannel("nv_pitch_bend", value);
        }
      } catch (err) {
        console.error("[NeuroVis] MIDI handler:", err);
      }
    };
    appendLog(`USB MIDI input connected: ${selected.name || "MIDI input"}`);
  }, [appendLog, controls.cc1Mode, orchestraModel, selectedMidiInputId]);

  React.useEffect(() => {
    refreshAudioOutputs();
  }, []);

  React.useEffect(() => {
    const context = audioContextRef.current;
    if (!context) return;
    void applyAudioOutput(context, selectedAudioOutputId);
  }, [selectedAudioOutputId]);

  async function start() {
    if (status === "loading") return;
    if (csoundRef.current && status === "running") return;
    if (csoundRef.current && status === "compiled") {
      appendLog("Csound is still starting — wait for the status badge “running”, or click Stop to reset.");
      return;
    }
    if (csoundRef.current) return;
    setStatus("loading");
    setLogs([]);
    try {
      const { Csound } = await import("@csound/browser");

      const csound = await Csound({
        useWorker: false,
        useSPN: false,
        outputChannelCount: 2,
        autoConnect: false,
      });
      if (!csound) throw new Error("Csound WASM failed to initialize");
      await yieldCsoundInstanceReady();

      const audioContextInit = await csound.getAudioContext();
      if (audioContextInit) {
        audioContextRef.current = audioContextInit;
        await applyAudioOutput(audioContextInit, selectedAudioOutputId);
        await audioContextInit.resume().catch(() => {});
      }
      const srHost = Math.round(audioContextInit?.sampleRate || 48000);
      appendLog(
        `Csound AudioContext "${audioContextInit?.state ?? "?"}", ${srHost} Hz (library-owned context, Etude-style init).`,
      );

      csound.on("message", (msg: unknown) => appendLog(String(msg)));
      csound.on("realtimePerformanceStarted", () => {
        appendLog("Csound realtime performance started.");
      });
      csound.on("realtimePerformanceEnded", () => {
        appendLog(
          "Csound realtime performance ended (engine event — UI stays on until you press Stop).",
        );
      });

      await csound.setOption("-odac");
      await csound.setOption("-m128");
      const compileResult = await csound.compileOrc(browserNeuroVisOrc(srHost));
      if (compileResult !== 0) {
        throw new Error(`Orchestra compilation failed with code ${compileResult}`);
      }
      appendLog("Compiled lightweight NeuroVis browser Csound orchestra.");
      setStatus("compiled");
      await yieldAfterOrchestraCompiled();

      csoundRef.current = csound;
      await syncControls(csound, controls, {
        globalVolume,
        metroScale,
        chordRange,
        orchestraModel,
        soundPreset,
        melodyOn,
        arrangementBedOn,
        arrangementMix,
        printDashboard,
        sensorGains,
      });
      await syncEeg(csound, latestBandsAbs, latestBandTraces);
      await syncSensors(csound, latestEEG, motion, batteryPct);
      await csound.readScore("f 1 0 4096 10 1\ni 999 0 86400\n");
      /** Playback before start only (`TeachingCsoundRenderer` parity). Meter attaches **after** `start()` — pre-start taps can be orphaned when WASM rewires the worklet. */
      const wiredCtx = await wireCsoundBeforeStart(csound, appendLog, {
        concertMeter: false,
        logLabel: "Csound V12",
      });
      if (!wiredCtx) {
        throw new Error("Csound audio node was not available to wire before start() — check WebAssembly / AudioWorklet.");
      }
      audioContextRef.current = wiredCtx;
      await csound.start();
      await csound.inputMessage("i 999 0 86400");
      appendLog("Csound keepalive instrument started for live performance.");
      await csound.inputMessage("i 908 0 -1");
      appendLog(
        "Auto arrangement bed on (bass + melody progression). Turn off in Mix if you want MIDI-only silence.",
      );
      await yieldAfterCsoundStart();
      const ctxAfter =
        (await csound.getAudioContext()) ?? wiredCtx ?? audioContextInit ?? null;
      if (ctxAfter) {
        audioContextRef.current = ctxAfter;
        await applyAudioOutput(ctxAfter, selectedAudioOutputId);
        for (let i = 0; i < 16; i++) {
          if (ctxAfter.state === "running") break;
          await ctxAfter.resume().catch(() => {});
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
      }
      setStatus("running");
      appendLog(`Workstation ${workstationId}: browser Csound running (same engine on /v12–/v18).`);
      await sendCcDefaults(csound, controls, { metroScale, chordRange, globalVolume });
      await primeBrowserMidiCcChannels(csound);
      appendLog("Tip: press Audition Csound Engine, Audition V12 MIDI Chord, or play USB MIDI.");
      appendLog("Browser engine: CC28 = level · CC25 = arp depth · CC26 = arp speed (full V12 arp = desktop CSD).");
      try {
        const node = await csound.getNode();
        if (node && enableConcertWasmMeter) {
          /** Must use `node.context` — analyser on a different BaseAudioContext throws and leaves RMS at 0. */
          const an = node.context.createAnalyser();
          an.fftSize = 512;
          an.smoothingTimeConstant = 0.55;
          /** Parallel tap only — do not chain analyser→destination (duplicate pulls confused Chrome in the wild). */
          node.connect(an);
          attachConcertWasmMeter(an);
          if (playwrightE2E && typeof window !== "undefined") {
            const w = window as Window & { __nvMeterProbe?: () => number };
            w.__nvMeterProbe = () => {
              const buf = new Float32Array(an.fftSize);
              an.getFloatTimeDomainData(buf);
              let peak = 0;
              for (let i = 0; i < buf.length; i += 1) {
                const x = Math.abs(buf[i] ?? 0);
                if (x > peak) peak = x;
              }
              return peak;
            };
          }
          appendLog("Concert meter: WASM → audioreactive visualizer (parallel tap).");
        } else if (!enableConcertWasmMeter) {
          appendLog("Concert WASM meter off — enable “Browser Csound” or Blend in Audioreactive source.");
        } else {
          appendLog("Concert meter: skipped — no Csound output node after start().");
        }
      } catch (err) {
        appendLog(`Concert meter attach failed: ${formatCaught(err)}`);
      }
      appendLog(
        `Csound audio graph: AudioContext "${ctxAfter?.state ?? "?"}", ${ctxAfter?.sampleRate ?? srHost} Hz.`,
      );
      if (ctxAfter && ctxAfter.state !== "running") {
        appendLog(
          `Csound browser output is still "${ctxAfter.state}" — click Resume Csound output or interact with the page; check tab/site mute and output device.`,
        );
      }
    } catch (error) {
      appendLog(`Start error: ${formatCaught(error)}`);
      await stop("error");
    }
  }

  React.useEffect(() => {
    const csound = csoundRef.current;
    if (!csound) return;
    void syncControls(csound, controls, {
      globalVolume,
      metroScale,
      chordRange,
      orchestraModel,
      soundPreset,
      melodyOn,
      arrangementBedOn,
      arrangementMix,
      printDashboard,
      sensorGains,
    });
    void sendCcDefaults(csound, controls, { metroScale, chordRange, globalVolume });
  }, [
    arrangementBedOn,
    arrangementMix,
    chordRange,
    controls,
    globalVolume,
    melodyOn,
    metroScale,
    orchestraModel,
    printDashboard,
    sensorGains,
    soundPreset,
  ]);

  React.useEffect(() => {
    if (status !== "running") return;
    let busy = false;
    const timer = window.setInterval(() => {
      const csound = csoundRef.current;
      if (!csound || busy) return;
      busy = true;
      syncEeg(csound, latestBandsAbs, latestBandTraces).finally(() => {
        syncSensors(csound, latestEEG, motion, batteryPct).finally(() => {
          busy = false;
        });
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [batteryPct, latestBandsAbs, latestBandTraces, latestEEG, motion, status]);

  const v12OrchestraLogRef = React.useRef<{ status: typeof status; model: number }>({
    status: "idle",
    model: -1,
  });
  const v12SensorMixLogRef = React.useRef<{
    status: typeof status;
    solo: SensorStreamId | null;
    mutedKey: string;
  }>({
    status: "idle",
    solo: null,
    mutedKey: "",
  });

  React.useEffect(() => {
    if (status !== "running") {
      v12OrchestraLogRef.current = { status, model: orchestraModel };
      return;
    }
    const prev = v12OrchestraLogRef.current;
    const enteredRunning = prev.status !== "running";
    const modelChanged = prev.model !== orchestraModel;
    v12OrchestraLogRef.current = { status, model: orchestraModel };
    if (!enteredRunning && !modelChanged) return;
    appendLog(`EEG orchestra: ${ORCHESTRA_MODELS[orchestraModel]?.label}`);
    void releaseHeldTest(false);
  }, [appendLog, orchestraModel, status]);

  React.useEffect(() => {
    if (status !== "running") {
      v12SensorMixLogRef.current = {
        status,
        solo: soloSensor,
        mutedKey: Array.from(mutedSensors).sort().join(","),
      };
      return;
    }
    const mutedKey = Array.from(mutedSensors).sort().join(",");
    const prev = v12SensorMixLogRef.current;
    const enteredRunning = prev.status !== "running";
    const mixChanged = prev.solo !== soloSensor || prev.mutedKey !== mutedKey;
    v12SensorMixLogRef.current = { status, solo: soloSensor, mutedKey };
    if (!enteredRunning && !mixChanged) return;
    const csound = csoundRef.current;
    if (!csound) return;
    const mutedList = Array.from(mutedSensors).join(", ");
    appendLog(
      soloSensor
        ? `Sensor solo: ${soloSensor}`
        : mutedList
          ? `Sensor muted: ${mutedList}`
          : "Sensor mix: all streams active",
    );
  }, [appendLog, mutedSensors, soloSensor, status]);

  async function noteOn(note: number) {
    const csound = csoundRef.current;
    if (!csound) return;
    await startSustainedMidiNote(csound, note, 0.82, orchestraModel, activeSustainedNotesRef.current);
    setHeldNotes((prev) => new Set(prev).add(note));
  }

  async function noteOff(note: number) {
    const csound = csoundRef.current;
    if (csound) {
      await releaseSustainedMidiNote(csound, note, activeSustainedNotesRef.current);
    }
    setHeldNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }

  async function stopAllNotes() {
    const csound = csoundRef.current;
    if (csound) {
      await releaseAllSustainedNotes(csound, activeSustainedNotesRef.current);
    }
    setHeldNotes(new Set());
  }

  async function holdTestNote() {
    const csound = csoundRef.current;
    if (!csound) {
      appendLog("Start Audio first, then hold a test note.");
      return;
    }
    await releaseHeldTest();
    appendLog("Holding test note C2. Use Release Hold to stop it.");
    await startSustainedMidiNote(csound, 48, 0.72, orchestraModel, activeSustainedNotesRef.current);
    setHeldNotes((prev) => new Set(prev).add(48));
  }

  async function holdTestChord() {
    const csound = csoundRef.current;
    if (!csound) {
      appendLog("Start Audio first, then hold a test chord.");
      return;
    }
    await releaseHeldTest();
    appendLog("Holding test chord. Use Release Hold to stop it.");
    for (const note of [48, 55, 60, 64]) {
      await startSustainedMidiNote(csound, note, 0.68, orchestraModel, activeSustainedNotesRef.current);
    }
    setHeldNotes((prev) => {
      const next = new Set(prev);
      [48, 55, 60, 64].forEach((note) => next.add(note));
      return next;
    });
  }

  async function releaseHeldTest(log = true) {
    const csound = csoundRef.current;
    if (!csound) return;
    await releaseAllSustainedNotes(csound, activeSustainedNotesRef.current);
    setHeldNotes(new Set());
    if (log) appendLog("Released held test notes.");
  }

  async function panicReset() {
    const csound = csoundRef.current;
    if (csound) {
      await releaseAllSustainedNotes(csound, activeSustainedNotesRef.current);
    }
    setHeldNotes(new Set());
    appendLog("Panic/reset requested. Stopping browser Csound engine.");
    await stop();
  }

  async function setVirtualCc(cc: number, value: number) {
    setLaunchkeyCcs((prev) => ({ ...prev, [cc]: value }));
    const csound = csoundRef.current;
    if (!csound) return;
    await csound.setControlChannel(`nv_cc${cc}_value`, value);
    appendLog(`On-screen CC${cc}: ${value.toFixed(3)}`);
  }

  async function setVirtualCc1(value: number) {
    setCc1Value(value);
    const csound = csoundRef.current;
    if (!csound) return;
    await csound.setControlChannel("nv_cc1_value", value);
    await csound.setControlChannel(
      controls.cc1Mode === "volume" ? "nv_melody_volume" : "nv_melody_complexity",
      value,
    );
  }

  async function setVirtualPitchBend(value: number) {
    setPitchBendValue(value);
    const csound = csoundRef.current;
    if (!csound) return;
    await csound.setControlChannel("nv_pitch_bend", value);
  }

  async function auditionCsoundChord() {
    const csound = csoundRef.current;
    if (!csound) {
      appendLog("Start Audio first, then audition the Csound chord.");
      return;
    }
    const notes = [48, 55, 60, 64];
    appendLog(
      "Auditioning V12 chord (instr 901, stacked voicing per tone, ~1.5s) — classic browser Csound chord sound.",
    );
    for (const note of notes) {
      await releaseSustainedMidiNote(csound, note, activeSustainedNotesRef.current);
    }
    const dur = 1.5;
    for (const note of notes) {
      await playBrowserNote(csound, note, 0.88, dur, orchestraModel);
    }
  }

  async function auditionCsoundEngine() {
    const csound = csoundRef.current;
    if (!csound) {
      appendLog("Start Audio first, then audition the Csound engine.");
      return;
    }
    appendLog("Auditioning browser Csound engine test tone.");
    await csound.inputMessage("i 900 0 1.25 440 0.28");
    await csound.inputMessage("i 900 0.08 1.15 660 0.18");
    await csound.inputMessage("i 900 0.16 1.05 880 0.14");
    const ctx = await csound.getAudioContext();
    if (ctx) {
      await ctx.resume().catch(() => {});
      appendLog(
        `After engine audition: AudioContext "${ctx.state}", ${ctx.sampleRate} Hz — if still silent, use Resume Csound output or Host tone (not Csound).`,
      );
    }
  }

  /**
   * Does not use Csound. Uses a **fresh** AudioContext so we can tell:
   * - silent here ⇒ browser/tab/system output path (mute, wrong sink), not the Csound graph
   * - audible here but no Csound ⇒ WASM / Csound wiring
   */
  async function testHostOnlyOutputTone() {
    const ephemeral = new AudioContext({ latencyHint: "interactive" });
    try {
      await ephemeral.resume();
      await applyAudioOutput(ephemeral, selectedAudioOutputId);
      await ephemeral.resume().catch(() => {});

      const t = ephemeral.currentTime + 0.06;
      const osc = ephemeral.createOscillator();
      const gain = ephemeral.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.05);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(gain);
      gain.connect(ephemeral.destination);
      osc.start(t);
      osc.stop(t + 0.45);

      const withSink = ephemeral as AudioContext & { sinkId?: string };
      appendLog(
        `Host-only beep: ephemeral AudioContext (not Csound) state="${ephemeral.state}" ${ephemeral.sampleRate} Hz · sinkId=${withSink.sinkId ?? "n/a"} — check tab/site mute & speaker output if still silent.`,
      );
      window.setTimeout(() => {
        void ephemeral.close().catch(() => {});
      }, 600);
    } catch (error) {
      appendLog(`Host-only beep failed: ${formatCaught(error)}`);
      void ephemeral.close().catch(() => {});
    }
  }

  async function resumeCsoundOutput() {
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
      appendLog("Resume Csound output: no engine yet — click Start Audio first.");
      return;
    }
    audioContextRef.current = ctx;
    await applyAudioOutput(ctx, selectedAudioOutputId);
    await ctx.resume().catch(() => {});
    appendLog(`Resume Csound output: graph state is "${ctx.state}" (want "running").`);
    if (ctx.state !== "running") {
      appendLog("Check browser tab/site mute, system volume, and click Resume again after interacting with the page.");
    }
  }

  async function refreshAudioOutputs() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setAudioOutputStatus("unsupported");
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices
        .filter((device) => device.kind === "audiooutput")
        .map((device, index) => ({
          id: device.deviceId,
          label: device.label || (device.deviceId === "default" ? "System default" : `Audio output ${index + 1}`),
        }));
      setAudioOutputs(outputs.length ? outputs : [{ id: "default", label: "System default" }]);
    } catch (error) {
      setAudioOutputStatus("error");
      appendLog(`Audio output list error: ${formatCaught(error)}`);
    }
  }

  async function applyAudioOutput(context: AudioContext, sinkId: string) {
    if (!sinkId || sinkId === "default") {
      setAudioOutputStatus("default");
      return;
    }

    const ctx = context as AudioContextWithSink;
    if (!ctx.setSinkId) {
      setAudioOutputStatus("unsupported");
      appendLog("This browser cannot route AudioContext to a selected output. Use system audio output or Chrome/Edge with AudioContext.setSinkId.");
      return;
    }
    try {
      await ctx.setSinkId(sinkId);
      setAudioOutputStatus(sinkId === "default" ? "default" : "ready");
      appendLog(`Audio output set to ${audioOutputs.find((o) => o.id === sinkId)?.label || sinkId}.`);
    } catch (error) {
      setAudioOutputStatus("error");
      appendLog(`Audio output routing error: ${formatCaught(error)}`);
    }
  }

  async function enableMidi() {
    if (!navigator.requestMIDIAccess) {
      setMidiStatus("unsupported");
      appendLog("Web MIDI is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setMidiStatus("requesting");
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = access;
      access.onstatechange = refreshMidiInputs;
      refreshMidiInputs();
      setMidiStatus("ready");
      appendLog("USB MIDI access enabled.");
    } catch (error) {
      setMidiStatus("error");
      appendLog(`MIDI access error: ${formatCaught(error)}`);
    }
  }

  function refreshMidiInputs() {
    const access = midiAccessRef.current;
    if (!access) return;
    const inputs = Array.from(access.inputs.values()).map((input) => ({
      id: input.id,
      name: input.name || "MIDI input",
      manufacturer: input.manufacturer || "",
      state: input.state || "unknown",
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
    access.onstatechange = null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-500/30 bg-sky-950/40 p-3">
        <div className="text-sm font-semibold text-sky-200">Production audio path (not browser WASM)</div>
        <p className="mt-2 text-xs leading-6 text-zinc-300">
          NeuroVis is built around the Node server sending <strong className="text-zinc-100">OSC to localhost:7400</strong> for{" "}
          <strong className="text-zinc-100">desktop Csound</strong> (your .csd with <code className="rounded bg-zinc-900 px-1 text-zinc-200">OSCinit 7400</code>
          , <code className="rounded bg-zinc-900 px-1 text-zinc-200">OSClisten</code> on <code className="text-zinc-300">/muse/…</code>). That path does{" "}
          <strong className="text-zinc-100">not</strong> depend on WebAssembly in Chrome — it is the architecture in{" "}
          <code className="text-zinc-400">README-CSOUND-INTEGRATION.md</code>. Turn streams on under{" "}
          <Link href="/osc" className="font-medium text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
            OSC / stream settings
          </Link>
          , run your Csound instrument, and keep using this UI for EEG + controls.
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          The <strong className="text-zinc-400">Start Audio</strong> section below is an optional in-browser Csound demo; Web Audio + WASM can be silent on some setups. If you need sound today, use desktop Csound + OSC — you are not starting over, you are on the supported design.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge data-testid="v12-csound-status" tone={status === "running" ? "emerald" : status === "error" ? "rose" : "neutral"} dot>
              Csound WASM {status}
            </Badge>
            <Badge tone="indigo">Csound · browser</Badge>
            <Badge tone="amber">Browser EEG bridge</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-400">
            Optional in-tab engine: compiles a browser-safe V12-inspired orchestra, feeds NeuroVis control channels, streams Muse
            values, and uses virtual or USB MIDI for instr 901. For reliable concerts and teaching with full orchestration, prefer OSC →
            desktop Csound above.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-5 text-zinc-500">
            <li>
              <span className="text-zinc-300">Still silent after Start?</span> Click{" "}
              <strong>Resume Csound output</strong> (the browser may hold Csound’s output graph{" "}
              <span className="font-mono text-zinc-400">suspended</span> until a gesture). NeuroVis disables React Strict
              Mode so dev builds do not tear down Csound right after Start.
            </li>
            <li>
              <span className="text-zinc-300">Hear something:</span> click <strong>Start Audio</strong> and wait
              until the badge is <strong>running</strong> (not compiled).{" "}
              <strong>Host tone (not Csound)</strong> uses a <strong>fresh</strong> AudioContext (bypasses Csound’s graph)
              to test the browser speaker path;{" "}
              <strong>Audition Csound Engine</strong> and <strong>Audition V12 MIDI Chord</strong> verify Csound.
            </li>
            <li>
              <span className="text-zinc-300">Layered play:</span> the <strong>Auto bass + melody bed</strong> runs from
              the matrix drivers; hold <strong>Virtual MIDI</strong> or USB keys to add the thick pad on top. Mute the
              bed in Mix if you want <strong>MIDI-only</strong> silence.
            </li>
            <li>
              <span className="text-zinc-300">Chord progression bed:</span> with{" "}
              <strong>Auto bass + melody bed</strong> on (Mix card), an eight-step <strong>bass</strong> plus{" "}
              <strong>melody</strong> line runs automatically — <strong>no MIDI required</strong>. Keys{" "}
              <strong>1–9, 0</strong> change the <strong>key center</strong>; US <strong>Shift+digit</strong> (
              <kbd>!</kbd> through <kbd>)</kbd>) maps to the same ten palettes. Matrix <strong>Bass / Melody / Rhythm</strong>{" "}
              columns pick which EEG bands wobble bass pitch, melody pitch, and step rate. Hold MIDI keys to layer the pad. Full
              V12 composition is still in the desktop <strong>CSD</strong>.
            </li>
          </ul>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="workstation-start-audio"
            data-neurovis-workstation={workstationId}
            onClick={start}
            disabled={status === "loading" || status === "running"}
            leftIcon={<Power className="h-4 w-4" />}
          >
            Start Audio
          </Button>
          <Button
            variant="outline"
            onClick={() => void stop()}
            disabled={status !== "loading" && status !== "running" && status !== "compiled"}
            leftIcon={<Square className="h-4 w-4" />}
          >
            Stop
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <Volume2 className="h-4 w-4 text-emerald-400" />
            Browser Csound Mix
          </div>
          <Slider
            label="Global volume"
            value={globalVolume}
            min={0}
            max={1}
            step={0.01}
            onChange={setGlobalVolume}
            format={(v) => v.toFixed(3)}
          />
          <Slider
            label="MIDI note pulse scale"
            value={metroScale}
            min={0.01}
            max={3}
            step={0.01}
            onChange={setMetroScale}
            format={(v) => `${v.toFixed(2)}x`}
          />
          <Slider
            label="Chord range"
            value={chordRange}
            min={1}
            max={12}
            step={1}
            onChange={setChordRange}
            format={(v) => String(Math.round(v))}
          />
          <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">
            Auto bass + melody bed (palette drives key)
            <input
              type="checkbox"
              checked={arrangementBedOn}
              onChange={(e) => setArrangementBedOn(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          <Slider
            label="Arrangement bed level"
            value={arrangementMix}
            min={0}
            max={1}
            step={0.01}
            onChange={setArrangementMix}
            format={(v) => v.toFixed(2)}
          />
          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-400">EEG orchestra</span>
            <select
              className="nv-select outline-none focus:border-emerald-500/70"
              value={orchestraModel}
              onChange={(event) => setOrchestraModel(Number(event.target.value))}
            >
              {ORCHESTRA_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <span className="block text-[11px] leading-4 text-zinc-500">
              {ORCHESTRA_MODELS[orchestraModel]?.description}
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-400">Sound preset</span>
            <select
              className="nv-select outline-none focus:border-emerald-500/70"
              value={soundPreset}
              onChange={(event) => setSoundPreset(Number(event.target.value))}
            >
              {SOUND_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <span className="block text-[11px] leading-4 text-zinc-500">
              {SOUND_PRESETS[soundPreset]?.description}
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-400">Audio output device</span>
            <select
              className="nv-select outline-none focus:border-emerald-500/70"
              value={selectedAudioOutputId}
              onChange={(event) => setSelectedAudioOutputId(event.target.value)}
              onFocus={refreshAudioOutputs}
            >
              <option value="default">System default</option>
              {audioOutputs
                .filter((output) => output.id !== "default")
                .map((output) => (
                  <option key={output.id} value={output.id}>
                    {output.label}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              title="Browser Oscillator only — does not run through Csound"
              onClick={testHostOnlyOutputTone}
            >
              Host tone (not Csound)
            </Button>
            <Button size="sm" variant="outline" onClick={() => void resumeCsoundOutput()}>
              Resume Csound output
            </Button>
            <Badge
              tone={
                audioOutputStatus === "ready"
                  ? "emerald"
                  : audioOutputStatus === "error"
                    ? "rose"
                    : "neutral"
              }
            >
              {audioOutputStatus}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <Music2 className="h-4 w-4 text-emerald-400" />
            Virtual MIDI Chord Keys
          </div>
          <div className="grid grid-cols-5 gap-2">
            {MIDI_NOTES.map(({ label, note }) => (
              <button
                key={note}
                className="touch-none rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-4 font-mono text-xs text-zinc-100 hover:border-emerald-500 hover:bg-emerald-500/10 disabled:opacity-40"
                disabled={!audioReady}
                onMouseDown={() => void noteOn(note)}
                onMouseUp={() => void noteOff(note)}
                onMouseLeave={() => heldNotes.has(note) && void noteOff(note)}
                onTouchStart={() => {
                  void noteOn(note);
                }}
                onTouchEnd={() => {
                  void noteOff(note);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={stopAllNotes} disabled={!heldNotes.size}>
            Stop held notes
          </Button>
          <Button
            data-testid="v12-audition-csound-engine"
            size="sm"
            variant="outline"
            onClick={auditionCsoundEngine}
            disabled={!audioReady}
          >
            Audition Csound Engine
          </Button>
          <Button size="sm" onClick={auditionCsoundChord} disabled={!audioReady}>
            Audition V12 MIDI Chord
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 lg:col-span-2 xl:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
              <Music2 className="h-4 w-4 text-emerald-400" />
              Launchkey Mini MK4-style Controller
            </div>
            <Badge tone="indigo">25 keys · CC21–24 / CC25–28 · CC1 mod strip</Badge>
          </div>
          <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <div className="flex justify-center rounded-xl border border-zinc-800 bg-zinc-950/70 px-2 py-3">
                <VerticalControl
                  label="PB"
                  value={pitchBendValue}
                  min={-1}
                  max={1}
                  step={0.01}
                  center
                  onChange={(value) => void setVirtualPitchBend(value)}
                />
              </div>
              <div className="flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                <span className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                  Mod wheel
                </span>
                <VerticalControl
                  label="CC1"
                  value={cc1Value}
                  min={0}
                  max={1}
                  step={0.01}
                  size="large"
                  onChange={(value) => void setVirtualCc1(value)}
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
                      value={launchkeyCcs[cc] ?? 0}
                      onChange={(value) => void setVirtualCc(cc, value)}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {LAUNCHKEY_CC_ROW_BOTTOM.map((cc) => (
                    <VirtualKnob
                      key={cc}
                      cc={cc}
                      value={launchkeyCcs[cc] ?? 0}
                      onChange={(value) => void setVirtualCc(cc, value)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
                <div className="font-mono text-[11px] text-zinc-400">
                  Range {midiNoteName(launchkeyStartNote)}-{midiNoteName(launchkeyStartNote + LAUNCHKEY_KEY_COUNT - 1)}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLaunchkeyStartNote((note) => Math.max(0, note - 12))}
                  >
                    Octave Down
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setLaunchkeyStartNote((note) =>
                        Math.min(127 - LAUNCHKEY_KEY_COUNT + 1, note + 12),
                      )
                    }
                  >
                    Octave Up
                  </Button>
                </div>
              </div>
              <MiniKeyboard
                startNote={launchkeyStartNote}
                disabled={!audioReady}
                heldNotes={heldNotes}
                onNoteOn={(note) => void noteOn(note)}
                onNoteOff={(note) => void noteOff(note)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <Music2 className="h-4 w-4 text-emerald-400" />
            USB MIDI Input
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={enableMidi}>
              Enable USB MIDI
            </Button>
            <Badge
              tone={
                midiStatus === "ready"
                  ? "emerald"
                  : midiStatus === "error" || midiStatus === "unsupported"
                    ? "rose"
                    : "neutral"
              }
              dot={midiStatus === "ready"}
            >
              {midiStatus}
            </Badge>
          </div>
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">MIDI keyboard/controller</span>
            <select
              className="nv-select outline-none focus:border-emerald-500/70"
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
          <p className="text-xs leading-5 text-zinc-500">
            Chrome/Edge will ask for permission. Notes and CCs from the selected input are sent
            directly to the browser Csound engine.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Browser Bridge Toggles
          </div>
          <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">
            Melody generator
            <input
              type="checkbox"
              checked={melodyOn}
              onChange={(e) => setMelodyOn(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">
            Csound dashboard print
            <input
              type="checkbox"
              checked={printDashboard}
              onChange={(e) => setPrintDashboard(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          <p className="text-xs leading-5 text-zinc-500">
            Browser audio starts only after a user click. If Chrome blocks audio, press Stop and Start Audio again. By
            default, the <strong>auto bass + melody bed</strong> plays when the bed toggle is on; turn it off in Mix for
            silent idle until MIDI.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={holdTestNote} disabled={!audioReady}>
              Hold Test Note
            </Button>
            <Button size="sm" variant="outline" onClick={holdTestChord} disabled={!audioReady}>
              Hold Test Chord
            </Button>
            <Button size="sm" variant="outline" onClick={() => void releaseHeldTest()} disabled={!audioReady}>
              Release Hold
            </Button>
          </div>
          <Button size="sm" variant="danger" onClick={panicReset} disabled={!audioReady}>
            Panic / Reset Audio
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
          <Activity className="h-4 w-4 text-emerald-400" />
          Sensor Orchestra Mixer
        </div>
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {SENSOR_STREAMS.map((stream) => {
            const muted = mutedSensors.has(stream.id);
            const soloed = soloSensor === stream.id;
            const activity = sensorActivity[stream.id] ?? 0;
            return (
              <div key={stream.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-zinc-200">
                  <span>{stream.label}</span>
                  <span className="font-mono text-[10px] text-zinc-500">{activity.toFixed(2)}</span>
                </div>
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${Math.round(activity * 100)}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={soloed ? "primary" : "outline"}
                    onClick={() => {
                      setSoloSensor((current) => (current === stream.id ? null : stream.id));
                      setMutedSensors(new Set());
                    }}
                  >
                    Solo
                  </Button>
                  <Button
                    size="sm"
                    variant={muted ? "danger" : "outline"}
                    onClick={() => {
                      setSoloSensor(null);
                      setMutedSensors((current) => {
                        const next = new Set(current);
                        if (next.has(stream.id)) next.delete(stream.id);
                        else next.add(stream.id);
                        return next;
                      });
                    }}
                  >
                    Mute
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          These gains feed the Csound orchestra models, so simple demos can isolate one sensor
          family and advanced models can blend them into a single musical texture.
        </p>
      </div>

      <CopyableConsole
        title="Csound Console"
        text={logs.join("\n")}
        emptyPlaceholder="Csound messages will appear here after Start Audio."
        downloadBasename="neurovis-v12-csound"
        ariaLabel="V12 Csound console log"
        onNotify={appendLog}
        headerEnd={
          <Button size="sm" variant="ghost" onClick={() => setLogs([])}>
            Clear
          </Button>
        }
        data-testid="v12-csound-console-panel"
        textareaTestId="v12-csound-console"
      />
    </div>
  );
}

/** Palette 0-9 → baseline semitone transpose; chord range 1-12 scales spread (browser pad + arrangement bed). */
function progRootSemi(palette: number, chordRange: number): number {
  const bases = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
  const pal = Math.max(0, Math.min(9, Math.round(palette)));
  const base = bases[pal] ?? 0;
  const cr = Math.max(1, Math.min(12, chordRange));
  const scale = 0.5 + (cr / 12) * 0.85;
  return base * scale;
}

async function syncControls(
  csound: CsoundObj,
  controls: V12RenderControls,
  local: {
    globalVolume: number;
    metroScale: number;
    chordRange: number;
    orchestraModel: number;
    soundPreset: number;
    melodyOn: boolean;
    arrangementBedOn: boolean;
    arrangementMix: number;
    printDashboard: boolean;
    sensorGains: Record<SensorStreamId, number>;
  },
) {
  await Promise.all([
    csound.setControlChannel("nv_web_active", 1),
    csound.setControlChannel("nv_palette", controls.palette),
    csound.setControlChannel("nv_prog_root_semi", progRootSemi(controls.palette, local.chordRange)),
    csound.setControlChannel("nv_harmony_band", BAND_INDEX[controls.harmonyBand]),
    csound.setControlChannel("nv_bass_driver", BAND_INDEX[controls.bassDriver]),
    csound.setControlChannel("nv_melody_driver", BAND_INDEX[controls.melodyDriver]),
    csound.setControlChannel("nv_rhythm_driver", BAND_INDEX[controls.rhythmDriver]),
    csound.setControlChannel("nv_register_driver", BAND_INDEX[controls.registerDriver]),
    csound.setControlChannel("nv_response_mode", controls.responseMode),
    csound.setControlChannel("nv_orchestra_mode", controls.orchestration),
    csound.setControlChannel("nv_motion_mode", controls.motion),
    csound.setControlChannel("nv_cc1_mode", controls.cc1Mode === "volume" ? 0 : 1),
    csound.setControlChannel("nv_melody_volume", controls.melodyVolume),
    csound.setControlChannel("nv_melody_complexity", controls.melodyComplexity),
    csound.setControlChannel("nv_global_volume", local.globalVolume),
    csound.setControlChannel("nv_metro_scale", local.metroScale),
    csound.setControlChannel("nv_chord_range", local.chordRange),
    csound.setControlChannel("nv_orchestra_model", local.orchestraModel),
    csound.setControlChannel("nv_sound_preset", local.soundPreset),
    csound.setControlChannel("nv_melody_on", local.melodyOn ? 1 : 0),
    csound.setControlChannel("nv_arrangement_on", local.arrangementBedOn ? 1 : 0),
    csound.setControlChannel("nv_arrangement_mix", Math.max(0, Math.min(1, local.arrangementMix))),
    csound.setControlChannel("nv_print_toggle", local.printDashboard ? 1 : 0),
    csound.setControlChannel("nv_stream_raw", local.sensorGains.raw),
    csound.setControlChannel("nv_stream_bands", local.sensorGains.bands),
    csound.setControlChannel("nv_stream_accel", local.sensorGains.accel),
    csound.setControlChannel("nv_stream_gyro", local.sensorGains.gyro),
    csound.setControlChannel("nv_stream_ppg", local.sensorGains.ppg),
    csound.setControlChannel("nv_stream_fnirs", local.sensorGains.fnirs),
  ]);
}

async function sendCcDefaults(
  csound: CsoundObj,
  controls: V12RenderControls,
  local: { metroScale: number; chordRange: number; globalVolume: number },
) {
  await Promise.all([
    csound.setControlChannel(
      "nv_cc1_value",
      controls.cc1Mode === "volume" ? controls.melodyVolume : controls.melodyComplexity,
    ),
    csound.setControlChannel("nv_pitch_bend", 0),
    csound.setControlChannel("nv_chord_range", local.chordRange),
    csound.setControlChannel("nv_metro_scale", local.metroScale),
    csound.setControlChannel("nv_global_volume", local.globalVolume),
  ]);
}

/** Seed Launchkey CC channels once at Csound start (not on every controls sync — avoids wiping live MIDI). */
async function primeBrowserMidiCcChannels(csound: CsoundObj) {
  await Promise.all(
    LAUNCHKEY_CC_NUMBERS.map((cc) =>
      csound.setControlChannel(`nv_cc${cc}_value`, cc === 28 ? 1 : 0),
    ),
  );
}

/** Finite instr 901 events: stacked partials per chord tone (orchestra model selects voicing). */
async function playBrowserNote(
  csound: CsoundObj,
  note: number,
  velocity = 0.75,
  duration = 2.5,
  orchestraModel = 4,
  instrument = 901,
) {
  const amp = clamp(0.06 + velocity * 0.18, 0.05, 0.28);
  const voicing = getOrchestraVoicing(orchestraModel);
  for (let index = 0; index < voicing.length; index += 1) {
    const voice = voicing[index];
    await csound.inputMessage(
      `i ${instrument} ${voice.delay.toFixed(3)} ${duration.toFixed(3)} ${(note + voice.interval).toFixed(3)} ${(amp * voice.amp).toFixed(3)} ${orchestraModel} ${index}`,
    );
  }
}

async function startSustainedMidiNote(
  csound: CsoundObj,
  note: number,
  velocity: number,
  orchestraModel: number,
  activeNotes: Set<number>,
) {
  if (activeNotes.has(note)) return;
  const instrument = sustainInstrumentForNote(note);
  const amp = clamp(0.06 + velocity * 0.18, 0.05, 0.28);
  await csound.inputMessage(
    `i ${instrument} 0 86400 ${note.toFixed(3)} ${amp.toFixed(3)} ${orchestraModel} 0`,
  );
  activeNotes.add(note);
}

async function releaseSustainedMidiNote(
  csound: CsoundObj,
  note: number,
  activeNotes: Set<number>,
) {
  if (!activeNotes.has(note)) return;
  const instrument = sustainInstrumentForNote(note);
  await csound.inputMessage(`i 905 0 0.01 ${instrument}`);
  activeNotes.delete(note);
}

async function releaseAllSustainedNotes(csound: CsoundObj, activeNotes: Set<number>) {
  const instruments = Array.from(
    { length: 128 },
    (_, note) => MIDI_SUSTAIN_INSTR_BASE + note,
  );
  await Promise.all(
    instruments.map((instrument) => csound.inputMessage(`i 905 0 0.01 ${instrument}`)),
  );
  activeNotes.clear();
}

function sustainInstrumentForNote(note: number) {
  return MIDI_SUSTAIN_INSTR_BASE + clamp(Math.round(note), 0, 127);
}

function getOrchestraVoicing(orchestraModel: number) {
  const voicings = [
    [
      { interval: 0, amp: 1, delay: 0 },
      { interval: 12, amp: 0.22, delay: 0.018 },
    ],
    [
      { interval: -12, amp: 0.55, delay: 0 },
      { interval: 0, amp: 1, delay: 0 },
      { interval: 12, amp: 0.72, delay: 0.012 },
      { interval: 19, amp: 0.42, delay: 0.024 },
      { interval: 24, amp: 0.24, delay: 0.036 },
    ],
    [
      { interval: -12, amp: 0.48, delay: 0 },
      { interval: 0, amp: 0.92, delay: 0.014 },
      { interval: 6, amp: 0.34, delay: 0.028 },
      { interval: 11, amp: 0.38, delay: 0.042 },
      { interval: 17, amp: 0.24, delay: 0.056 },
    ],
    [
      { interval: -24, amp: 0.52, delay: 0 },
      { interval: -12, amp: 0.72, delay: 0.02 },
      { interval: 0, amp: 0.92, delay: 0.04 },
      { interval: 7, amp: 0.46, delay: 0.06 },
    ],
    [
      { interval: -12, amp: 0.42, delay: 0 },
      { interval: 0, amp: 1, delay: 0 },
      { interval: 7, amp: 0.56, delay: 0.018 },
      { interval: 14, amp: 0.32, delay: 0.036 },
      { interval: 19, amp: 0.22, delay: 0.054 },
    ],
    [
      { interval: -12, amp: 0.40, delay: 0 },
      { interval: 0, amp: 0.90, delay: 0.012 },
      { interval: 4, amp: 0.36, delay: 0.024 },
      { interval: 7, amp: 0.44, delay: 0.036 },
      { interval: 11, amp: 0.30, delay: 0.048 },
      { interval: 16, amp: 0.22, delay: 0.06 },
      { interval: 23, amp: 0.18, delay: 0.072 },
    ],
  ];
  return voicings[clamp(Math.round(orchestraModel), 0, voicings.length - 1)];
}

function sustainInstrumentList() {
  return Array.from({ length: 128 }, (_, note) => String(MIDI_SUSTAIN_INSTR_BASE + note)).join(", ");
}

async function syncEeg(
  csound: CsoundObj,
  latestBandsAbs: BandPowers | null,
  latestBandTraces: Record<BandName, number[]> | null,
) {
  const writes: Promise<unknown>[] = [];
  for (const band of Object.keys(BAND_INDEX) as BandName[]) {
    const base = latestBandsAbs?.[band] ?? -1.25;
    for (let ch = 0; ch < 4; ch += 1) {
      const trace = latestBandTraces?.[band]?.[ch] ?? 0;
      const value = clamp(base + Math.tanh(trace / 20) * 0.35, -2.5, 1.5);
      writes.push(csound.setControlChannel(`nv_${band}_${ch + 1}`, value));
    }
  }
  await Promise.all(writes);
}

async function syncSensors(
  csound: CsoundObj,
  latestEEG: EEGMessage | null | undefined,
  motion: MotionStreams | null | undefined,
  batteryPct: number | null | undefined,
) {
  const raw = latestEEG?.raw ?? [];
  const accel = motion?.accel ?? [];
  const gyro = motion?.gyro ?? [];
  const ppg = motion?.ppg ?? [];
  const fnirs = motion?.fnirs ?? [];
  const writes: Promise<unknown>[] = [];

  for (let ch = 0; ch < 4; ch += 1) {
    writes.push(csound.setControlChannel(`nv_raw_${ch + 1}`, clamp(Number(raw[ch]) || 0, -250, 250)));
  }

  for (let axis = 0; axis < 3; axis += 1) {
    writes.push(csound.setControlChannel(`nv_accel_${axis + 1}`, clamp(Number(accel[axis]) || 0, -4, 4)));
    writes.push(csound.setControlChannel(`nv_gyro_${axis + 1}`, clamp(Number(gyro[axis]) || 0, -500, 500)));
    writes.push(csound.setControlChannel(`nv_ppg_${axis + 1}`, clamp(Number(ppg[axis]) || 0, -1, 1)));
    writes.push(csound.setControlChannel(`nv_fnirs_${axis + 1}`, clamp(Number(fnirs[axis]) || 0, -1, 1)));
  }

  const accelMag = magnitude(accel);
  const gyroMag = magnitude(gyro) / 250;
  const ppgMag = magnitude(ppg);
  const fnirsMag = magnitude(fnirs);
  writes.push(csound.setControlChannel("nv_accel_mag", clamp(accelMag, 0, 4)));
  writes.push(csound.setControlChannel("nv_gyro_mag", clamp(gyroMag, 0, 4)));
  writes.push(csound.setControlChannel("nv_ppg_mag", clamp(ppgMag, 0, 2)));
  writes.push(csound.setControlChannel("nv_fnirs_mag", clamp(fnirsMag, 0, 2)));
  writes.push(csound.setControlChannel("nv_battery_pct", batteryPct ?? 100));

  await Promise.all(writes);
}

function magnitude(values: number[]) {
  if (!values.length) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hasFunction<T extends keyof RuntimeCsound>(
  csound: CsoundObj,
  name: T,
): csound is CsoundObj & Pick<Required<RuntimeCsound>, T> {
  return typeof (csound as RuntimeCsound)[name] === "function";
}

function browserNeuroVisOrc(sr = 48000) {
  const srN = Math.max(8000, Math.min(192000, Math.round(sr)));
  return `
sr = ${srN}
ksmps = 32
nchnls = 2
0dbfs = 1
seed 0

instr 5 ; Browser MIDI chord voice
  iFreq cpsmidi
  iAmp ampmidi 0.42
  kEnv madsr 0.02, 0.18, 0.62, 0.38
  kVol chnget "nv_global_volume"
  kAlpha chnget "nv_alpha_1"
  kBeta chnget "nv_beta_1"
  kGamma chnget "nv_gamma_1"
  kBright = limit((kBeta + 2.5) / 4, 0, 1)
  kWide = limit((kGamma + 2.5) / 4, 0, 1)
  aFund poscil iAmp * kEnv * kVol * 0.34, iFreq
  aFifth poscil iAmp * kEnv * kVol * (0.08 + kBright * 0.12), iFreq * 1.5
  aOct poscil iAmp * kEnv * kVol * (0.05 + kWide * 0.10), iFreq * 2.01
  aTone = aFund + aFifth + aOct
  aTone tone aTone, 900 + kBright * 4200
  aL, aR pan2 aTone, 0.5 + (kWide - 0.5) * 0.38
  outs aL, aR
endin

instr 999 ; Silent keepalive so browser Csound remains open for live input
  aSilence oscili 0, 20
  outs aSilence, aSilence
endin

instr 900 ; Browser Csound engine smoke test
  iFreq = p4
  iAmp = p5
  aEnv linsegr 0, 0.02, 1, p3 - 0.05, 0.7, 0.03, 0
  aTone oscili iAmp * aEnv, iFreq
  aTone = aTone + oscili(iAmp * 0.35 * aEnv, iFreq * 2.01)
  outs aTone, aTone
endin

instr 901, ${sustainInstrumentList()} ; Browser Csound finite and true MIDI-gated note voices
  iNote = p4
  iAmp = p5
  iModel = p6
  iVoice = p7
  kVol chnget "nv_global_volume"
  kCc1 chnget "nv_cc1_value"
  kPitchBend chnget "nv_pitch_bend"
  kCc21 chnget "nv_cc21_value"
  kCc22 chnget "nv_cc22_value"
  kCc23 chnget "nv_cc23_value"
  kCc24 chnget "nv_cc24_value"
  kCc25 chnget "nv_cc25_value"
  kCc26 chnget "nv_cc26_value"
  kCc27 chnget "nv_cc27_value"
  kCc28 chnget "nv_cc28_value"
  kMetro chnget "nv_metro_scale"
  kProgRoot chnget "nv_prog_root_semi"
  kHarmBand chnget "nv_harmony_band"
  kRawGain chnget "nv_stream_raw"
  kBandGain chnget "nv_stream_bands"
  kAccelGain chnget "nv_stream_accel"
  kGyroGain chnget "nv_stream_gyro"
  kPpgGain chnget "nv_stream_ppg"
  kFnirsGain chnget "nv_stream_fnirs"
  kPreset chnget "nv_sound_preset"
  kRaw1 chnget "nv_raw_1"
  kRaw2 chnget "nv_raw_2"
  kDelta chnget "nv_delta_1"
  kTheta chnget "nv_theta_1"
  kAlpha chnget "nv_alpha_1"
  kBeta chnget "nv_beta_1"
  kGamma chnget "nv_gamma_1"
  kAccel chnget "nv_accel_mag"
  kGyro chnget "nv_gyro_mag"
  kPpg chnget "nv_ppg_mag"
  kFnirs chnget "nv_fnirs_mag"
  kAlphaN = limit((kAlpha + 2.5) / 4, 0, 1)
  kBetaN = limit((kBeta + 2.5) / 4, 0, 1)
  kGammaN = limit((kGamma + 2.5) / 4, 0, 1)
  kThetaN = limit((kTheta + 2.5) / 4, 0, 1)
  kDeltaN = limit((kDelta + 2.5) / 4, 0, 1)
  kHarmDrv = kAlphaN
  kH = limit(int(kHarmBand + 0.5), 0, 4)
  if (kH == 0) then
    kHarmDrv = kDeltaN
  elseif (kH == 1) then
    kHarmDrv = kThetaN
  elseif (kH == 2) then
    kHarmDrv = kAlphaN
  elseif (kH == 3) then
    kHarmDrv = kBetaN
  else
    kHarmDrv = kGammaN
  endif
  kEegHarmNudge = (kHarmDrv - 0.48) * 5.5 * (0.35 + kBandGain * 0.65)
  kTranspose = kProgRoot + limit(kEegHarmNudge, -4, 4)
  aEnv linsegr 0, 0.025, 1, max(0.05, p3 - 0.65), 0.62, 0.62, 0
  kBright = 0.45 + kBetaN * 0.62 + kCc1 * 0.25 + kCc23 * 0.45
  kWide = 0.45 + kGammaN * 0.55 + kCc24 * 0.35 + kCc27 * 0.30
  kSubMix = 0.04
  kPitchDrift = 0
  kPulseDepth = 0.08
  kModelGain = 1
  kModelFifth = 1
  kModelOct = 1
  if (kPreset == 1) then
    kBright = kBright + 0.55
  elseif (kPreset == 2) then
    kBright = kBright - 0.10
    kSubMix = 0.18
  elseif (kPreset == 3) then
    kWide = kWide + 0.45
  elseif (kPreset == 5) then
    kBright = kBright + 0.50
  endif
  if (iModel == 0) then
    kPitchDrift = limit((kRaw1 + kRaw2) * kRawGain * 0.10, -18, 18)
    kBright = 0.16 + kRawGain * 0.10
    kModelFifth = 0.12
    kModelOct = 0.08
    kPulseDepth = 0.02
  elseif (iModel == 1) then
    kSubMix = kSubMix + kDeltaN * kBandGain * 0.16
    kBright = kBright + kGammaN * kBandGain * 0.28
    kModelOct = 1.6
  elseif (iModel == 2) then
    kPulseDepth = 0.26 + limit(kAccel + kGyro, 0, 2) * 0.16
    kWide = kWide + limit(kGyro, 0, 2) * kGyroGain * 0.30
    kBright = kBright + 0.22
  elseif (iModel == 3) then
    kPulseDepth = 0.24 + limit(kPpg, 0, 2) * kPpgGain * 0.14
    kSubMix = kSubMix + 0.24
    kBright = kBright * 0.55
    kModelOct = 0.35
  elseif (iModel == 4) then
    kBright = kBright + kAlphaN * 0.16
    kWide = kWide + 0.18
  else
    kBright = kBright + (kGammaN * kBandGain + limit(kFnirs, 0, 2) * kFnirsGain) * 0.24
    kModelOct = 1.35
    kWide = kWide + 0.25
  endif
  kPitchDrift = kPitchDrift + ((kAlphaN - 0.5) * 5.2 + (kBetaN - 0.5) * 4.0 + (kThetaN - 0.5) * 2.8) * (0.4 + kBandGain * 0.6)
  kPulseDepth = limit(kPulseDepth + abs(kThetaN - 0.5) * 0.14 * kBandGain + abs(kBetaN - 0.5) * 0.1 * kBandGain, 0.02, 0.52)
  kPlayVol = kVol * (0.55 + kCc1 * 0.75) * (0.55 + kCc21 * 0.70) * limit(0.02 + kCc28 * 0.98, 0, 1)
  kArpPhase init 0
  kArpHz = 0.001 + (1.1 + kMetro * 3.8 + kCc26 * 5.5) * limit(kCc25, 0, 1)
  kArpPhase = kArpPhase + kArpHz / kr
  kArpPhase = kArpPhase - int(kArpPhase)
  kArpStep = int(kArpPhase * 4)
  kArpSemi = 0
  if (kArpStep == 1) then
    kArpSemi = 4
  elseif (kArpStep == 2) then
    kArpSemi = 7
  elseif (kArpStep == 3) then
    kArpSemi = 12
  endif
  kArpMix = kCc25 * (0.09 + kMetro * 0.14 + kCc22 * 0.05)
  kMetroLfo lfo 0.5, 0.6 + kMetro * 2.4 + kCc22 * 3.0, 0
  kPulse = 1 - kPulseDepth + kPulseDepth * (0.5 + kMetroLfo * 1.45)
  kFreq = cpsmidinn(iNote + kPitchBend * 2 + kTranspose) + kPitchDrift
  aFund poscil iAmp * aEnv * kPlayVol * kPulse * kModelGain * 0.70, kFreq
  aFifth poscil iAmp * aEnv * kPlayVol * kPulse * (0.08 + kBright * 0.18) * kModelFifth, kFreq * 1.5
  aOct poscil iAmp * aEnv * kPlayVol * kPulse * (0.04 + kGammaN * 0.16) * kModelOct, kFreq * 2.01
  aSub poscil iAmp * aEnv * kPlayVol * kPulse * kSubMix, kFreq * 0.5
  aArp poscil iAmp * aEnv * kPlayVol * kPulse * kArpMix, cpsmidinn(iNote + kPitchBend * 2 + kTranspose + kArpSemi) + kPitchDrift
  aTone = aFund + aFifth + aOct + aSub + aArp
  aTone tone aTone, 900 + kBright * 5200
  aDelay delay aTone, 0.024
  kPos = limit(0.5 + (iVoice - 2) * 0.075 + (kWide - 0.5) * 0.18, 0.05, 0.95)
  aWL, aWR pan2 aTone, kPos
  aL = aWL * (0.90 + kWide * 0.08) + aDelay * (0.08 + kWide * 0.18)
  aR = aWR * (0.90 + kWide * 0.08) + aDelay * (0.12 + kWide * 0.22)
  aRevL, aRevR reverbsc aL, aR, 0.82, 11000
  outs (aL * 0.72) + (aRevL * 0.28), (aR * 0.72) + (aRevR * 0.28)
endin

instr 908 ; Auto bass + melody bed — chord degree cycles, follows palette root + matrix drivers
  kArr chnget "nv_arrangement_on"
  kVol chnget "nv_global_volume"
  kMix chnget "nv_arrangement_mix"
  kRoot chnget "nv_prog_root_semi"
  kMetro chnget "nv_metro_scale"
  kMelW chnget "nv_melody_volume"
  kBandGain chnget "nv_stream_bands"
  kBD chnget "nv_bass_driver"
  kMD chnget "nv_melody_driver"
  kRD chnget "nv_rhythm_driver"
  kDelta chnget "nv_delta_1"
  kTheta chnget "nv_theta_1"
  kAlpha chnget "nv_alpha_1"
  kBeta chnget "nv_beta_1"
  kGamma chnget "nv_gamma_1"
  kAlphaN = limit((kAlpha + 2.5) / 4, 0, 1)
  kBetaN = limit((kBeta + 2.5) / 4, 0, 1)
  kGammaN = limit((kGamma + 2.5) / 4, 0, 1)
  kThetaN = limit((kTheta + 2.5) / 4, 0, 1)
  kDeltaN = limit((kDelta + 2.5) / 4, 0, 1)
  kBdrv = kDeltaN
  khB = limit(int(kBD + 0.5), 0, 4)
  if (khB == 1) then
    kBdrv = kThetaN
  elseif (khB == 2) then
    kBdrv = kAlphaN
  elseif (khB == 3) then
    kBdrv = kBetaN
  elseif (khB == 4) then
    kBdrv = kGammaN
  endif
  kMdrv = kDeltaN
  khM = limit(int(kMD + 0.5), 0, 4)
  if (khM == 1) then
    kMdrv = kThetaN
  elseif (khM == 2) then
    kMdrv = kAlphaN
  elseif (khM == 3) then
    kMdrv = kBetaN
  elseif (khM == 4) then
    kMdrv = kGammaN
  endif
  kRdrv = kDeltaN
  khR = limit(int(kRD + 0.5), 0, 4)
  if (khR == 1) then
    kRdrv = kThetaN
  elseif (khR == 2) then
    kRdrv = kAlphaN
  elseif (khR == 3) then
    kRdrv = kBetaN
  elseif (khR == 4) then
    kRdrv = kGammaN
  endif
  kRate = 0.095 + kMetro * 0.30 + kRdrv * 0.24
  kAccum init 0
  kAccum = kAccum + kRate / kr
wrapx:
  if (kAccum < 8) goto wrapok
  kAccum = kAccum - 8
  goto wrapx
wrapok:
  kI = int(kAccum)
  kDeg = 0
  if (kI == 1) then
    kDeg = 7
  elseif (kI == 2) then
    kDeg = 5
  elseif (kI == 3) then
    kDeg = 9
  elseif (kI == 4) then
    kDeg = 7
  elseif (kI == 5) then
    kDeg = 0
  elseif (kI == 6) then
    kDeg = 4
  elseif (kI == 7) then
    kDeg = 5
  endif
  kHop = int(kI - int(kI / 3) * 3) * 2
  kBassMidi = limit(32 + kRoot + kDeg + (kBdrv - 0.48) * 9 * kBandGain, 24, 58)
  kMelMidi = limit(62 + kRoot + kDeg + kHop + (kMdrv - 0.50) * 8 * kBandGain, 52, 96)
  kGate = 0
  if (kArr > 0.5) then
    kGate = 1
  endif
  kBedDrive = limit(0.22 + kBandGain * 0.78, 0, 1)
  kbAss = 0.12 * kVol * kMix * kBedDrive * kGate
  kMel = 0.075 * kVol * kMix * kMelW * kBedDrive * kGate
  aB poscil kbAss, cpsmidinn(kBassMidi)
  aB tone aB, 380 + kBdrv * 320
  aM poscil kMel, cpsmidinn(kMelMidi)
  aM tone aM, 1600 + kMdrv * 2400
  aL = aB * 0.58 + aM * 0.42
  aR = aB * 0.42 + aM * 0.58
  outs aL, aR
endin

instr 905 ; Release one sustained MIDI-key instrument
  iInstr = p4
  turnoff2 iInstr, 0, 1
  turnoff
endin

instr 903 ; Optional warm pulse, reserved for explicit tests
  iFreq = p4
  iAmp = p5
  iModel = p6
  aEnv linsegr 0, 0.006, 1, max(0.03, p3 - 0.06), 0.38, 0.05, 0
  aTone poscil iAmp * aEnv, iFreq
  aTone = aTone + poscil(iAmp * 0.38 * aEnv, iFreq * (1.5 + iModel * 0.01))
  aTone tone aTone, 950 + iModel * 520
  aTap delay aTone, 0.018
  aRevL, aRevR reverbsc aTone, aTap, 0.76, 9000
  outs aTone * 0.72 + aRevL * 0.18, aTap * 0.72 + aRevR * 0.18
endin

instr 902 ; Optional EEG orchestra bed, not scheduled by default
  kModel chnget "nv_orchestra_model"
  kVol chnget "nv_global_volume"
  kRawGain chnget "nv_stream_raw"
  kBandGain chnget "nv_stream_bands"
  kAccelGain chnget "nv_stream_accel"
  kGyroGain chnget "nv_stream_gyro"
  kPpgGain chnget "nv_stream_ppg"
  kFnirsGain chnget "nv_stream_fnirs"
  kRaw1 chnget "nv_raw_1"
  kRaw2 chnget "nv_raw_2"
  kRaw3 chnget "nv_raw_3"
  kRaw4 chnget "nv_raw_4"
  kDelta chnget "nv_delta_1"
  kTheta chnget "nv_theta_1"
  kAlpha chnget "nv_alpha_1"
  kBeta chnget "nv_beta_1"
  kGamma chnget "nv_gamma_1"
  kAccel chnget "nv_accel_mag"
  kGyro chnget "nv_gyro_mag"
  kPpg chnget "nv_ppg_mag"
  kFnirs chnget "nv_fnirs_mag"
  kDeltaN = limit((kDelta + 2.5) / 4, 0, 1)
  kThetaN = limit((kTheta + 2.5) / 4, 0, 1)
  kAlphaN = limit((kAlpha + 2.5) / 4, 0, 1)
  kBetaN = limit((kBeta + 2.5) / 4, 0, 1)
  kGammaN = limit((kGamma + 2.5) / 4, 0, 1)
  kRawPitch = 110 + limit(abs(kRaw1) + abs(kRaw2) + abs(kRaw3) + abs(kRaw4), 0, 420) * 0.72
  kBandRoot = 82.41 + kAlphaN * 55 + kThetaN * 27.5
  kMotionRate = 0.18 + limit(kAccel + kGyro, 0, 3) * 0.22
  kPulseRaw lfo 0.5, 0.7 + limit(kPpg, 0, 2) * 2.2, 0
  kPulse = 0.5 + kPulseRaw
  aRaw poscil kRawGain * (0.018 + kAlphaN * 0.018), kRawPitch
  aRaw2 poscil kRawGain * 0.014, kRawPitch * 1.498
  aBand poscil kBandGain * (0.030 + kDeltaN * 0.030), kBandRoot
  aBand2 poscil kBandGain * (0.018 + kBetaN * 0.018), kBandRoot * 1.5
  aBand3 poscil kBandGain * (0.012 + kGammaN * 0.020), kBandRoot * 2.0
  aMotion poscil kAccelGain * (0.010 + limit(kAccel, 0, 2) * 0.018), 55 + kMotionRate * 90
  aGyro poscil kGyroGain * (0.006 + limit(kGyro, 0, 2) * 0.012), 220 + kGyro * 80
  aHeart poscil kPpgGain * (0.010 + kPulse * 0.026), kBandRoot * 0.5
  aFnirs poscil kFnirsGain * (0.006 + limit(kFnirs, 0, 2) * 0.018), kBandRoot * 0.25
  aModel0 = (aRaw + aRaw2) * 1.20
  aModel1 = (aBand + aBand2 + aBand3) * 1.10
  aModel2 = aRaw * 0.55 + aBand * 0.90 + aMotion * 0.70 + aGyro * 0.35
  aModel3 = aHeart * 1.20 + aBand * 0.62 + aMotion * 0.35 + aFnirs * 0.45
  aModel4 = aBand * 0.75 + aBand2 * 0.60 + aRaw2 * 0.25 + aFnirs * 0.25
  aModel5 = aBand * 0.52 + aBand2 * 0.44 + aBand3 * 0.48 + aHeart * 0.40 + aMotion * 0.25 + aFnirs * 0.30
  aMix = aModel5
  if (kModel == 0) then
    aMix = aModel0
  elseif (kModel == 1) then
    aMix = aModel1
  elseif (kModel == 2) then
    aMix = aModel2
  elseif (kModel == 3) then
    aMix = aModel3
  elseif (kModel == 4) then
    aMix = aModel4
  endif
  aSensorReveal = aRaw * 0.18 + aBand * 0.18 + aMotion * 0.35 + aGyro * 0.18 + aHeart * 0.40 + aFnirs * 0.30
  aMix = aMix + aSensorReveal * 0.45
  aMix tone aMix, 1200 + kBetaN * 3600 + kGammaN * 2800
  aWide delay aMix, 0.031
  aRevL, aRevR reverbsc aMix, aWide, 0.88, 12000
  outs (aMix * 0.42 + aRevL * 0.58) * kVol, (aWide * 0.42 + aRevR * 0.58) * kVol
endin

`;
}

async function compileBrowserOrc(csound: CsoundObj, csd: string) {
  const orc = extractCsInstruments(csd);
  return await csound.compileOrc(orc);
}

function extractCsInstruments(csd: string) {
  const startTag = "<CsInstruments>";
  const endTag = "</CsInstruments>";
  const start = csd.indexOf(startTag);
  const end = csd.indexOf(endTag);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Unable to find CsInstruments in V12 CSD");
  }
  return csd.slice(start + startTag.length, end);
}

function toBrowserCsd(source: string) {
  const endTag = "</CsoundSynthesizer>";
  const end = source.indexOf(endTag);
  let csd = end >= 0 ? source.slice(0, end + endTag.length) : source;

  if (!csd.includes("<CsOptions>")) {
    csd = csd.replace(
      "<CsoundSynthesizer>",
      `<CsoundSynthesizer>
<CsOptions>
-odac -m128
</CsOptions>`,
    );
  }

  csd = csd.replace(
    /schedule 12, 0, -1 ; V12 EEG control dashboard/,
    `schedule 12, 0, -1 ; V12 EEG control dashboard
schedule 90, 0, -1 ; Browser NeuroVis control bridge`,
  );

  csd = csd.replace(
    /\s*gihandle OSCinit 7400\s*\n\s*kk1 OSClisten[^\n]*\n\s*kk2 OSClisten[^\n]*\n\s*kk3 OSClisten[^\n]*\n\s*kk4 OSClisten[^\n]*\n\s*kk5 OSClisten[^\n]*/m,
    `
	gkDeltaAbs1 chnget "nv_delta_1"
	gkDeltaAbs2 chnget "nv_delta_2"
	gkDeltaAbs3 chnget "nv_delta_3"
	gkDeltaAbs4 chnget "nv_delta_4"
	gkThetaAbs1 chnget "nv_theta_1"
	gkThetaAbs2 chnget "nv_theta_2"
	gkThetaAbs3 chnget "nv_theta_3"
	gkThetaAbs4 chnget "nv_theta_4"
	gkAlphaAbs1 chnget "nv_alpha_1"
	gkAlphaAbs2 chnget "nv_alpha_2"
	gkAlphaAbs3 chnget "nv_alpha_3"
	gkAlphaAbs4 chnget "nv_alpha_4"
	gkBetaAbs1 chnget "nv_beta_1"
	gkBetaAbs2 chnget "nv_beta_2"
	gkBetaAbs3 chnget "nv_beta_3"
	gkBetaAbs4 chnget "nv_beta_4"
	gkGammaAbs1 chnget "nv_gamma_1"
	gkGammaAbs2 chnget "nv_gamma_2"
	gkGammaAbs3 chnget "nv_gamma_3"
	gkGammaAbs4 chnget "nv_gamma_4"`,
  );

  return csd.replace(
    "</CsInstruments>",
    `
instr 901 ; Browser-only Csound engine smoke test
	iFreq = p4
	iAmp = p5
	aEnv linsegr 0, 0.02, 1, p3 - 0.05, 0.7, 0.03, 0
	aTone oscili iAmp * aEnv, iFreq
	aTone = aTone + oscili(iAmp * 0.35 * aEnv, iFreq * 2.01)
	outs aTone, aTone
endin

instr 90 ; Browser NeuroVis → Csound control bridge
	kWebActive chnget "nv_web_active"
	if kWebActive < 0.5 goto done

	kPalette chnget "nv_palette"
	kHarmonyBand chnget "nv_harmony_band"
	kBassDriver chnget "nv_bass_driver"
	kMelodyDriver chnget "nv_melody_driver"
	kRhythmDriver chnget "nv_rhythm_driver"
	kRegisterDriver chnget "nv_register_driver"
	kResponseMode chnget "nv_response_mode"
	kOrchestraMode chnget "nv_orchestra_mode"
	kMotionMode chnget "nv_motion_mode"
	kCc1Mode chnget "nv_cc1_mode"
	kMelodyVolume chnget "nv_melody_volume"
	kMelodyComplexity chnget "nv_melody_complexity"
	kGlobalVolume chnget "nv_global_volume"
	kMetroScale chnget "nv_metro_scale"
	kChordRange chnget "nv_chord_range"
	kMelodyOn chnget "nv_melody_on"
	kPrintToggle chnget "nv_print_toggle"

	gkCurrentProgression = limit(int(kPalette) + 1, 1, 10)
	gkBandSelect = limit(int(kHarmonyBand), 0, 4)
	gkBassDriver = limit(int(kBassDriver), 0, 4)
	gkMelodyDriver = limit(int(kMelodyDriver), 0, 4)
	gkRhythmDriver = limit(int(kRhythmDriver), 0, 4)
	gkRegisterDriver = limit(int(kRegisterDriver), 0, 4)
	gkResponseMode = limit(int(kResponseMode), 0, 4)
	gkOrchestraMode = limit(int(kOrchestraMode), 0, 2)
	gkHarmonyMotionMode = limit(int(kMotionMode), 0, 2)
	gkMelodyCC1Mode = limit(int(kCc1Mode), 0, 1)
	gkMelodyVolume = limit(kMelodyVolume, 0, 1)
	gkMelodyComplexity = limit(kMelodyComplexity, 0, 1)
	gkGlobalVolume = limit(kGlobalVolume, 0, 1)
	gkMetroScale = limit(kMetroScale, 0.01, 3)
	gkChordRange = limit(int(kChordRange), 1, 12)
	gkMelodyOn = limit(int(kMelodyOn), 0, 1)
	gkPrintToggle = limit(int(kPrintToggle), 0, 1)
done:
endin

</CsInstruments>`,
  );
}
