"use client";

import { canonicalAudioMime, extensionForAudioMime } from "@/lib/replicateAudioMime";
import { getConcertRecordingAudioStream } from "@/lib/concertAudioMeter";

export type ConcertPerformanceRecordMode = "video" | "audio";

export type ConcertPerformanceRecorderStatus = {
  recording: boolean;
  mode: ConcertPerformanceRecordMode | null;
  startedAt: number;
  elapsedMs: number;
  error: string | null;
};

type Listener = (s: ConcertPerformanceRecorderStatus) => void;

function pickVideoMime(): string | undefined {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

function pickAudioMime(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function timestampLabel() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function filenameForBlob(mode: ConcertPerformanceRecordMode, mime: string): string {
  const ts = timestampLabel();
  if (mode === "video") {
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    return `neurovis-concert-${ts}.${ext}`;
  }
  const clean = canonicalAudioMime(mime);
  return `neurovis-concert-audio-${ts}.${extensionForAudioMime(clean)}`;
}

async function buildMicStream(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
  } catch {
    return null;
  }
}

async function buildTabAudioStream(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    stream.getVideoTracks().forEach((t) => {
      t.stop();
      stream.removeTrack(t);
    });
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }
    return stream;
  } catch {
    return null;
  }
}

async function mixAudioStream(opts: {
  includeMic: boolean;
  includeWasmTap: boolean;
  includeTabAudio: boolean;
}): Promise<{ stream: MediaStream | null; cleanup: () => void }> {
  const parts: MediaStream[] = [];
  const cleanupTracks: MediaStreamTrack[] = [];

  if (opts.includeWasmTap) {
    const wasm = getConcertRecordingAudioStream();
    if (wasm && wasm.getAudioTracks().length > 0) parts.push(wasm);
  }

  if (opts.includeMic) {
    const mic = await buildMicStream();
    if (mic) {
      parts.push(mic);
      cleanupTracks.push(...mic.getTracks());
    }
  }

  if (opts.includeTabAudio) {
    const tab = await buildTabAudioStream();
    if (tab) {
      parts.push(tab);
      cleanupTracks.push(...tab.getTracks());
    }
  }

  if (parts.length === 0) {
    return { stream: null, cleanup: () => {} };
  }

  if (parts.length === 1) {
    return {
      stream: parts[0]!,
      cleanup: () => cleanupTracks.forEach((t) => t.stop()),
    };
  }

  const ctx = new AudioContext();
  await ctx.resume();
  const dest = ctx.createMediaStreamDestination();
  for (const stream of parts) {
    ctx.createMediaStreamSource(stream).connect(dest);
  }
  return {
    stream: dest.stream,
    cleanup: () => {
      cleanupTracks.forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

class ConcertPerformanceRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mode: ConcertPerformanceRecordMode | null = null;
  private startedAt = 0;
  private tickId: number | undefined;
  private audioCleanup: (() => void) | null = null;
  private error: string | null = null;
  private listeners = new Set<Listener>();

  status(): ConcertPerformanceRecorderStatus {
    return {
      recording: this.recorder?.state === "recording",
      mode: this.mode,
      startedAt: this.startedAt,
      elapsedMs: this.startedAt ? Date.now() - this.startedAt : 0,
      error: this.error,
    };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.status());
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const s = this.status();
    for (const fn of this.listeners) fn(s);
  }

  async start(opts: {
    mode: ConcertPerformanceRecordMode;
    stageElement: HTMLElement | null;
    fps?: number;
    includeMic?: boolean;
    includeWasmTap?: boolean;
    includeTabAudio?: boolean;
  }): Promise<{ ok: boolean; error?: string }> {
    await this.stopAndDownload(false);
    if (typeof MediaRecorder === "undefined") {
      return { ok: false, error: "MediaRecorder is not available in this browser." };
    }

    this.error = null;
    this.mode = opts.mode;
    const fps = opts.fps ?? 30;

    const { stream: audioStream, cleanup } = await mixAudioStream({
      includeMic: opts.includeMic !== false,
      includeWasmTap: opts.includeWasmTap !== false,
      includeTabAudio: !!opts.includeTabAudio,
    });
    this.audioCleanup = cleanup;

    let combined: MediaStream;
    if (opts.mode === "video") {
      const canvas = opts.stageElement?.querySelector("canvas");
      if (!canvas) {
        cleanup();
        this.audioCleanup = null;
        return { ok: false, error: "No visualizer canvas found on stage." };
      }
      const videoStream = canvas.captureStream(fps);
      combined = new MediaStream([...videoStream.getVideoTracks()]);
      if (audioStream) {
        for (const t of audioStream.getAudioTracks()) combined.addTrack(t);
      }
    } else {
      if (!audioStream) {
        cleanup();
        this.audioCleanup = null;
        return {
          ok: false,
          error:
            "No audio source. Start WASM or mic audio, or enable “Include tab audio” for headless Csound.",
        };
      }
      combined = audioStream;
    }

    if (opts.mode === "video" && combined.getVideoTracks().length === 0) {
      cleanup();
      this.audioCleanup = null;
      return { ok: false, error: "Could not capture video from canvas." };
    }

    const mime = opts.mode === "video" ? pickVideoMime() : pickAudioMime();
    if (!mime) {
      cleanup();
      this.audioCleanup = null;
      return { ok: false, error: "No supported recording MIME type in this browser." };
    }

    try {
      this.chunks = [];
      this.recorder = new MediaRecorder(combined, {
        mimeType: mime,
        videoBitsPerSecond: opts.mode === "video" ? 8_000_000 : undefined,
      });
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder.onerror = () => {
        this.error = "Recording failed.";
        this.emit();
      };
      this.recorder.start(1000);
      this.startedAt = Date.now();
      this.tickId = window.setInterval(() => this.emit(), 500) as number;
      this.emit();
      return { ok: true };
    } catch (err) {
      cleanup();
      this.audioCleanup = null;
      const msg = err instanceof Error ? err.message : String(err);
      this.error = msg;
      this.emit();
      return { ok: false, error: msg };
    }
  }

  async stopAndDownload(download = true): Promise<void> {
    if (this.tickId !== undefined) {
      window.clearInterval(this.tickId);
      this.tickId = undefined;
    }

    const rec = this.recorder;
    const mode = this.mode;
    if (!rec || rec.state === "inactive") {
      this.recorder = null;
      this.mode = null;
      this.startedAt = 0;
      this.audioCleanup?.();
      this.audioCleanup = null;
      this.emit();
      return;
    }

    await new Promise<void>((resolve) => {
      rec.onstop = () => {
        const mime = rec.mimeType || (mode === "video" ? "video/webm" : "audio/webm");
        const blob = new Blob(this.chunks, { type: mime });
        this.chunks = [];
        this.recorder = null;
        this.mode = null;
        this.startedAt = 0;
        this.audioCleanup?.();
        this.audioCleanup = null;
        if (download && blob.size > 0 && mode) {
          downloadBlob(blob, filenameForBlob(mode, mime));
        }
        this.emit();
        resolve();
      };
      try {
        rec.stop();
      } catch {
        this.recorder = null;
        this.mode = null;
        this.audioCleanup?.();
        this.audioCleanup = null;
        this.emit();
        resolve();
      }
    });
  }
}

export const concertPerformanceRecorder = new ConcertPerformanceRecorder();
