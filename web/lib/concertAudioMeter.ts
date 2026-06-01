/**
 * Audio levels for Concert Mode ⌥1–⌥0 (audioreactive) scenes.
 * Sources: browser Csound WASM tap, microphone, or EEG-band envelope (in visualizer).
 */

export type ConcertAudioReactiveMode = "eeg" | "mic" | "wasm" | "blend";

let reactiveMode: ConcertAudioReactiveMode = "blend";
let wasmLevel = 0;
let micLevel = 0;
let wasmPollId: number | undefined;
let micPollId: number | undefined;
let micStream: MediaStream | null = null;
let micContext: AudioContext | null = null;

export function getConcertAudioReactiveMode(): ConcertAudioReactiveMode {
  return reactiveMode;
}

export function setConcertAudioReactiveMode(mode: ConcertAudioReactiveMode): void {
  reactiveMode = mode;
  if (mode !== "mic" && mode !== "blend") {
    stopConcertMicTap();
  }
  if (mode !== "wasm" && mode !== "blend") {
    detachConcertWasmMeter();
  }
}

/** RMS 0–1 for mic/wasm/blend modes (read by ConcertVisualizer). */
export function getConcertAudioLevel(): number {
  if (reactiveMode === "mic") return micLevel;
  if (reactiveMode === "wasm") return wasmLevel;
  if (reactiveMode === "blend") return Math.max(micLevel, wasmLevel);
  return 0;
}

export function stopConcertAudioMeter(): void {
  detachConcertWasmMeter();
  stopConcertMicTap();
}

function startAnalyserPoll(
  analyser: AnalyserNode,
  onLevel: (v: number) => void,
  gain = 5.5,
): number {
  const buffer = new Float32Array(analyser.fftSize);
  let smooth = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const s = buffer[i] ?? 0;
      sum += s * s;
    }
    const rms = Math.sqrt(sum / buffer.length);
    const inst = Math.min(1, rms * gain);
    smooth = smooth * 0.88 + inst * 0.12;
    onLevel(smooth);
  };
  tick();
  return window.setInterval(tick, 32) as number;
}

/** Browser Csound WASM output (parallel analyser tap). */
export function attachConcertWasmMeter(analyser: AnalyserNode): void {
  detachConcertWasmMeter();
  wasmPollId = startAnalyserPoll(analyser, (v) => {
    wasmLevel = v;
  });
}

export function detachConcertWasmMeter(): void {
  if (wasmPollId !== undefined) {
    window.clearInterval(wasmPollId);
    wasmPollId = undefined;
  }
  wasmLevel = 0;
}

/** @deprecated use attachConcertWasmMeter */
export const attachConcertAudioMeter = attachConcertWasmMeter;

export async function startConcertMicTap(): Promise<{ ok: boolean; error?: string }> {
  stopConcertMicTap();
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: "Microphone API not available in this browser." };
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    micContext = new AudioContext();
    await micContext.resume();
    const source = micContext.createMediaStreamSource(micStream);
    const analyser = micContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.55;
    source.connect(analyser);
    micPollId = startAnalyserPoll(analyser, (v) => {
      micLevel = v;
    }, 6);
    return { ok: true };
  } catch (err) {
    stopConcertMicTap();
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function stopConcertMicTap(): void {
  if (micPollId !== undefined) {
    window.clearInterval(micPollId);
    micPollId = undefined;
  }
  micStream?.getTracks().forEach((t) => t.stop());
  micStream = null;
  void micContext?.close();
  micContext = null;
  micLevel = 0;
}
