"use client";

import * as React from "react";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileAudio,
  KeyRound,
  Link2,
  Loader2,
  Mic,
  Music,
  Play,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { CopyableConsole } from "@/components/ui/CopyableConsole";
import { formatCaught } from "@/lib/formatCaught";
import {
  buildResearchAiSnapshot,
  snapshotAsPromptBlock,
  type ResearchAiSnapshot,
} from "@/lib/researchAiSnapshot";
import {
  DEFAULT_REPLICATE_MODEL,
  looksLikeReplicateToken,
  maskReplicateToken,
  readReplicateModel,
  readReplicateToken,
  writeReplicateModel,
  writeReplicateToken,
} from "@/lib/replicateApiKey";
import {
  buildGeminiInput,
  concatenateGeminiOutput,
  type GeminiThinkingLevel,
} from "@/lib/replicateGeminiInput";
import {
  isPlayCaptureBusy,
  MAX_GEMINI_AUDIO_DURATION_MS,
  type PlayCaptureAutoPhase,
  sealPlayCaptureWindow,
  validatePlayCaptureFile,
} from "@/lib/researchPlayCapture";
import { useNeuroStore } from "@/lib/store";

/**
 * Lifecycle of the Replicate prediction itself (NOT the audio upload — that's tracked separately
 * by the `uploading` boolean). Mirrors the Replicate prediction status enum plus a local
 * "submitting" phase between user-click and Replicate accepting the request.
 */
type Phase =
  | "idle"
  | "submitting"
  | "starting"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

/**
 * Two ways to feed audio into this card. They are mutually exclusive — switching modes
 * clears the previously prepared blob/URL so a stale clip can't accidentally be analyzed.
 *  - `record_and_capture` : 3-2-1 countdown → record from the browser mic (MediaRecorder)
 *                           → on Stop, auto-upload + auto-run analysis.
 *  - `play_and_capture`   : pick a file, play it in-tab, capture an EEG window aligned to the
 *                           playback span, then auto-upload + auto-run analysis.
 *
 * Both modes drive the same shared `autoPhase` state machine (see `researchPlayCapture.ts` —
 * naming is historical; the helpers are mode-agnostic).
 */
type AudioMode = "record_and_capture" | "play_and_capture";

/** Default seconds for the pre-record countdown. User can pick 0 / 3 / 5. */
const COUNTDOWN_OPTIONS = [0, 3, 5] as const;
const DEFAULT_COUNTDOWN_SEC = 3;

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string | null;
  logs?: string | null;
  urls?: { get?: string; cancel?: string };
};

interface ApiError {
  error: string;
  detail?: unknown;
}

const DEFAULT_SYSTEM_INSTRUCTION = `You are an EEG ↔ music correlation analyst working with the NeuroVis dashboard. The user provides one audio clip (input field "audio") plus an EEG snapshot embedded inline in the prompt as a structured text block. The EEG snapshot was captured during (or just after) the audio clip, with a wall-clock window when available. Only reason about what is actually present in the audio + EEG; never invent measurements. Be explicit about what cannot be inferred from a single short snapshot. Always reply in Markdown.`;

const DEFAULT_PROMPT = `Tasks:
1. Briefly describe the audio (instruments, tempo, dynamics, mood, any vocals).
2. Describe the EEG snapshot in plain language: which band dominates, any obvious shift across the bandHistoryRel timeline, and key ratios (theta/beta, alpha/theta, engagement, fatigue).
3. Identify plausible correlations between musical features and EEG features at this moment (e.g. high-energy passage → reduced alpha, slow legato → elevated theta). Note correlations that the data does NOT support.
4. Suggest one concrete experiment design that could test the strongest correlation you flagged (with stimulus type, EEG marker, and analysis window).

Return four Markdown sections matching the four tasks above.`;

const THINKING_LEVELS: GeminiThinkingLevel[] = ["none", "low", "high"];

const REPLICATE_MODEL_DOC_URL = "https://replicate.com/google/gemini-3.5-flash";

const MIME_PRIORITY = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
];

function pickRecorderMimeType(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const Rec = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!Rec || typeof Rec.isTypeSupported !== "function") return undefined;
  for (const mime of MIME_PRIORITY) {
    try {
      if (Rec.isTypeSupported(mime)) return mime;
    } catch {
      /* keep trying */
    }
  }
  return undefined;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}


export function ResearchGeminiAnalysis() {
  // ----- API key + model -----
  /**
   * Two-state pattern:
   *   - `savedToken` mirrors what is currently persisted in localStorage and is used for ALL API
   *     calls (we never send the in-flight typed value).
   *   - `tokenInput` is what is rendered in the field; the user can type freely without affecting
   *     the saved token until they hit "Save".
   */
  const [savedToken, setSavedToken] = React.useState("");
  const [tokenInput, setTokenInput] = React.useState("");
  const [showToken, setShowToken] = React.useState(false);
  const [model, setModelState] = React.useState<string>(DEFAULT_REPLICATE_MODEL);

  React.useEffect(() => {
    const t = readReplicateToken();
    setSavedToken(t);
    setTokenInput(t);
    setModelState(readReplicateModel());
  }, []);

  /** The token actually used by the upload + prediction calls. */
  const token = savedToken;

  const persistToken = React.useCallback((value: string) => {
    const next = value.trim();
    writeReplicateToken(next);
    setSavedToken(next);
    setTokenInput(next);
  }, []);

  const persistModel = React.useCallback((value: string) => {
    writeReplicateModel(value);
    setModelState((value || "").trim() || DEFAULT_REPLICATE_MODEL);
  }, []);

  // ----- Audio source (record + upload + play_and_capture) -----
  const [audioMode, setAudioMode] = React.useState<AudioMode>("record_and_capture");
  const [countdownSec, setCountdownSec] = React.useState<number>(DEFAULT_COUNTDOWN_SEC);
  const [countdownRemaining, setCountdownRemaining] = React.useState<number | null>(null);
  const countdownTimerRef = React.useRef<number | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [recorderError, setRecorderError] = React.useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = React.useState<Blob | null>(null);
  const [recordedFilename, setRecordedFilename] = React.useState<string | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = React.useState(0);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  /**
   * Wall-clock window of an in-tab recording (`null` when audio came from a file upload because
   * we have no way to know when that audio was originally captured). When non-null this is used
   * to filter the EEG `bandHistory` to only the matching range — that's the actual time alignment
   * between the audio clip and the EEG snapshot we send to the model.
   */
  const [audioWindow, setAudioWindow] = React.useState<{ startMs: number; endMs: number } | null>(
    null,
  );

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recordStartedAtRef = React.useRef<number>(0);
  const tickRef = React.useRef<number | null>(null);

  // ----- play_and_capture transport state -----
  /**
   * The `<audio>` element we control for the synchronized playback flow. Kept in a ref so
   * the play/pause handlers don't trigger a re-render storm during the elapsed timer tick.
   */
  const audioElementRef = React.useRef<HTMLAudioElement | null>(null);
  /** Wall-clock ms when `audio.play` fired (`0` until the first real `play` event). */
  const playStartedAtMsRef = React.useRef<number>(0);
  /**
   * Guard so the `onEnded` handler does not double-fire after the user already clicked Stop
   * (which itself pauses + seals). Without this the auto-upload could run twice on natural
   * end-of-track if Stop happened to be clicked within ~1 frame.
   */
  const playCaptureFinalizedRef = React.useRef<boolean>(false);
  const [playCapturePhase, setPlayCapturePhase] = React.useState<PlayCaptureAutoPhase>("idle");
  const [playCaptureError, setPlayCaptureError] = React.useState<string | null>(null);
  const [playElapsedMs, setPlayElapsedMs] = React.useState(0);
  const playTickRef = React.useRef<number | null>(null);
  /** Reported by the `<audio>` element once metadata loads; used for the 8.4-h warning. */
  const [audioDurationSec, setAudioDurationSec] = React.useState<number | null>(null);

  // ----- Remote URL via Replicate Files API -----
  const [remoteUrl, setRemoteUrl] = React.useState<string | null>(null);
  const [remoteUrlExpiresAt, setRemoteUrlExpiresAt] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  /**
   * Lets `handleUpload` be cancelled by the surrounding lifecycle — unmount, mode switch,
   * or starting a fresh upload while a previous one is mid-flight. We always abort the prior
   * controller before kicking off a new request so we never leak two parallel uploads.
   */
  const uploadAbortRef = React.useRef<AbortController | null>(null);

  const cancelCountdown = React.useCallback(() => {
    if (countdownTimerRef.current != null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownRemaining(null);
  }, []);

  const stopRecording = React.useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      }
      streamRef.current = null;
    }
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stopPlayCaptureTick = React.useCallback(() => {
    if (playTickRef.current != null) {
      window.clearInterval(playTickRef.current);
      playTickRef.current = null;
    }
  }, []);

  const cleanupAudio = React.useCallback(() => {
    cancelCountdown();
    stopRecording();
    stopPlayCaptureTick();
    /** Cancel any upload that was racing this teardown; the proxy will see a client disconnect. */
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }
    setRecordedBlob(null);
    setRecordedFilename(null);
    setRecordedDurationMs(0);
    setAudioWindow(null);
    /** Stale Replicate URL no longer matches any local audio — clear it so users can't accidentally analyze the previous clip. */
    setRemoteUrl(null);
    setRemoteUrlExpiresAt(null);
    setUploadError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setAudioDurationSec(null);
    /** Reset the play_and_capture sub-state so a freshly picked file starts from idle. */
    playStartedAtMsRef.current = 0;
    playCaptureFinalizedRef.current = false;
    setPlayCapturePhase("idle");
    setPlayCaptureError(null);
    setPlayElapsedMs(0);
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      } catch {
        /* ignore — element may already be detached */
      }
    }
  }, [cancelCountdown, previewUrl, stopPlayCaptureTick, stopRecording]);

  React.useEffect(() => () => cancelCountdown(), [cancelCountdown]);
  React.useEffect(() => () => stopRecording(), [stopRecording]);
  React.useEffect(() => () => stopPlayCaptureTick(), [stopPlayCaptureTick]);
  /**
   * Hard-stop any in-flight upload on unmount so a fetch outliving the component can't try
   * to call `setState` after we're gone, and so we don't keep a stranded TCP connection alive.
   */
  React.useEffect(
    () => () => {
      if (uploadAbortRef.current) {
        uploadAbortRef.current.abort();
        uploadAbortRef.current = null;
      }
    },
    [],
  );
  React.useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const startRecording = async () => {
    setRecorderError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecorderError(
        "Browser microphone capture is not available. Use the file upload below.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      rec.onstop = () => {
        const type = rec.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (blob.size === 0) {
          setRecorderError(
            "Recording produced an empty file (microphone may be muted or permission was just revoked).",
          );
          setRecording(false);
          return;
        }
        const ext = type.includes("ogg")
          ? "ogg"
          : type.includes("mp4") || type.includes("mpeg")
            ? "m4a"
            : "webm";
        const filename = `neurovis-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
        const startMs = recordStartedAtRef.current;
        const endMs = Date.now();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setRecordedBlob(blob);
        setRecordedFilename(filename);
        setRecordedDurationMs(endMs - startMs);
        setAudioWindow({ startMs, endMs });
        /** Prior URL is now stale relative to the new clip — force a fresh upload step. */
        setRemoteUrl(null);
        setRemoteUrlExpiresAt(null);
        setRecording(false);
        /**
         * Record & capture parity with Play & capture: as soon as the recorder hands us a
         * non-empty blob and a sealed wall-clock window, kick off the auto upload + analyze
         * pipeline. `finalizePlayCapture` is mode-agnostic; it reads `recordedBlob` via the
         * effect chain and uses `startMs`/`endMs` we just sealed for the EEG snapshot window.
         */
        playCaptureFinalizedRef.current = false;
        setPlayCapturePhase("uploading");
        /**
         * Defer one tick so React commits `setRecordedBlob` etc. before `handleUpload`
         * reads from state — without this, the upload reads the stale (null) blob.
         */
        window.setTimeout(() => void finalizePlayCapture(startMs, endMs), 0);
      };
      rec.onerror = (event) => {
        const msg = (event as unknown as { error?: { message?: string } }).error?.message ?? "Recorder error";
        setRecorderError(msg);
        setRecording(false);
      };
      recorderRef.current = rec;
      recordStartedAtRef.current = Date.now();
      setRecordedDurationMs(0);
      rec.start(250);
      tickRef.current = window.setInterval(() => {
        setRecordedDurationMs(Date.now() - recordStartedAtRef.current);
      }, 250);
      setRecording(true);
    } catch (error) {
      setRecorderError(formatCaught(error));
      setRecording(false);
    }
  };

  /**
   * Record & capture entry point. Runs an optional 0/3/5 s pre-recording countdown so the
   * user can settle their EEG cap and intention, then starts the MediaRecorder pipeline. The
   * countdown writes to `countdownRemaining` so the UI can paint a big ticking number; on
   * reach zero we cancel the timer and call `startRecording()` exactly once.
   */
  const startCountdownThenRecord = async () => {
    setRecorderError(null);
    cancelCountdown();
    if (countdownSec <= 0) {
      await startRecording();
      return;
    }
    setCountdownRemaining(countdownSec);
    countdownTimerRef.current = window.setInterval(() => {
      setCountdownRemaining((prev) => {
        if (prev == null) return null;
        const next = prev - 1;
        if (next <= 0) {
          cancelCountdown();
          void startRecording();
          return null;
        }
        return next;
      });
    }, 1000);
  };

  /**
   * Hard cap that matches the server-side data-URL embed cap (`MAX_DATA_URL_AUDIO_BYTES` in
   * `lib/replicateAudioMime.ts`) so the file picker / Play & capture flow can warn before the
   * round-trip. Keep these two values in lockstep.
   */
  const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

  /**
   * Upload `recordedBlob` to the Replicate Files API via our Next proxy. Returns the public
   * URL on success (so the auto play_and_capture flow can chain straight into `runAnalysis`
   * without round-tripping through React state), or `null` on failure / missing prerequisites.
   *
   * Accepts an optional `externalSignal` so a caller (component unmount, mode switch) can
   * abort the upload. We always abort any prior in-flight controller before starting a new
   * one so the user can't accidentally race two uploads for two different blobs.
   */
  const handleUpload = async (externalSignal?: AbortSignal): Promise<string | null> => {
    setUploadError(null);
    if (!token) {
      setUploadError("Add your Replicate API key first (above).");
      return null;
    }
    if (!recordedBlob) {
      setUploadError("Record audio or pick a file before encoding the audio payload.");
      return null;
    }
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
    }
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    /**
     * Bridge an external signal (e.g. from an outer AbortController owned by the auto-flow)
     * into our local controller so a single `controller.abort()` call here cancels the fetch.
     */
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
    setUploading(true);
    try {
      const form = new FormData();
      const filename = recordedFilename ?? "neurovis-audio.webm";
      form.append("audio", recordedBlob, filename);
      form.append("filename", filename);
      const res = await fetch("/api/replicate/files", {
        method: "POST",
        headers: { "X-Replicate-Token": token },
        body: form,
        signal: controller.signal,
      });
      const json = (await res.json()) as { url?: string; expiresAt?: string | null } & ApiError;
      if (!res.ok || !json.url) {
        throw new Error(
          json.error ||
            `Replicate file upload failed (HTTP ${res.status}). ${
              typeof json.detail === "string" ? json.detail : ""
            }`,
        );
      }
      setRemoteUrl(json.url);
      setRemoteUrlExpiresAt(json.expiresAt ?? null);
      return json.url;
    } catch (error) {
      setRemoteUrl(null);
      setRemoteUrlExpiresAt(null);
      /** Aborts are part of normal cancellation; don't show them as an error to the user. */
      if (controller.signal.aborted) {
        setUploadError(null);
      } else {
        setUploadError(formatCaught(error));
      }
      return null;
    } finally {
      if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploading(false);
    }
  };

  // ----- EEG snapshot from store -----
  const latestEEG = useNeuroStore((s) => s.latestEEG);
  const estimatedEegHz = useNeuroStore((s) => s.estimatedEegHz);
  const bandsAbs = useNeuroStore((s) => s.latestBandsAbs);
  const bandsRel = useNeuroStore((s) => s.latestBandsRel);
  const bandHistory = useNeuroStore((s) => s.bandHistory);
  const motion = useNeuroStore((s) => s.motion);
  const activeDeviceName = useNeuroStore((s) => s.activeDeviceName);
  const storeDeviceName = useNeuroStore((s) => s.deviceName);
  const storePacketCount = useNeuroStore((s) => s.packetCount);

  const [snapshotPreview, setSnapshotPreview] = React.useState<ResearchAiSnapshot | null>(null);

  const captureSnapshot = React.useCallback((): ResearchAiSnapshot => {
    return buildResearchAiSnapshot({
      device: activeDeviceName ?? storeDeviceName ?? latestEEG?.deviceName ?? null,
      estimatedEegHz,
      packetCount:
        latestEEG?.packetCount ??
        (typeof storePacketCount === "number" ? storePacketCount : bandHistory.length),
      bandsAbs,
      bandsRel,
      bandHistory,
      motion: {
        accel: motion.accel ?? null,
        gyro: motion.gyro ?? null,
        ppg: motion.ppg ?? null,
      },
      audioWindow,
    });
  }, [
    activeDeviceName,
    storeDeviceName,
    storePacketCount,
    latestEEG,
    estimatedEegHz,
    bandsAbs,
    bandsRel,
    bandHistory,
    motion,
    audioWindow,
  ]);

  // ----- Prompt + model controls (matching Replicate google/gemini-3.5-flash schema) -----
  const [systemInstruction, setSystemInstruction] = React.useState(DEFAULT_SYSTEM_INSTRUCTION);
  const [prompt, setPrompt] = React.useState(DEFAULT_PROMPT);
  const [thinkingLevel, setThinkingLevel] = React.useState<GeminiThinkingLevel>("low");
  const [temperature, setTemperature] = React.useState<number>(1);
  const [maxOutputTokens, setMaxOutputTokens] = React.useState<number>(2048);

  // ----- Prediction lifecycle -----
  const [prediction, setPrediction] = React.useState<ReplicatePrediction | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const pollRef = React.useRef<number | null>(null);

  const stopPolling = React.useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  React.useEffect(() => () => stopPolling(), [stopPolling]);

  const pollOnce = React.useCallback(
    async (id: string) => {
      const res = await fetch(`/api/replicate/predictions?id=${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { "X-Replicate-Token": token },
      });
      const json = (await res.json()) as ReplicatePrediction & ApiError;
      if (!res.ok) {
        throw new Error(
          json.error ||
            `Replicate poll failed (HTTP ${res.status}). ${
              typeof json.detail === "string" ? json.detail : ""
            }`,
        );
      }
      return json as ReplicatePrediction;
    },
    [token],
  );

  /**
   * Submit a Replicate prediction. `urlOverride` lets the auto play_and_capture flow pass the
   * URL it just got back from `handleUpload` without waiting for the asynchronous `setRemoteUrl`
   * commit to land in state.
   */
  const runAnalysis = async (urlOverride?: string): Promise<boolean> => {
    setAnalysisError(null);
    if (!token) {
      setAnalysisError("Add your Replicate API key first.");
      return false;
    }
    const effectiveUrl = urlOverride ?? remoteUrl;
    if (!effectiveUrl) {
      setAnalysisError(
        "Encode the audio payload first (record/play/capture, then click ‘Encode audio for Replicate’).",
      );
      return false;
    }
    if (!model) {
      setAnalysisError("Set a Replicate model id (e.g. google/gemini-3.5-flash).");
      return false;
    }
    stopPolling();
    setPhase("submitting");
    setPrediction(null);

    const snapshot = captureSnapshot();
    setSnapshotPreview(snapshot);
    const eegBlock = snapshotAsPromptBlock(snapshot);
    const fullPrompt = `${prompt.trim()}\n\n${eegBlock}`;

    /**
     * Strict schema build — see `lib/replicateGeminiInput.ts` for the contract verified against
     * https://replicate.com/google/gemini-3.5-flash. We never send keys the model does not
     * declare (no `audio_url`, no `eeg_snapshot`) so Replicate's input validator stays happy.
     */
    const input = buildGeminiInput({
      prompt: fullPrompt,
      audioUrl: effectiveUrl,
      systemInstruction,
      thinkingLevel,
      temperature,
      maxOutputTokens,
    });

    try {
      const res = await fetch("/api/replicate/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Replicate-Token": token,
        },
        body: JSON.stringify({ model, input }),
      });
      const json = (await res.json()) as ReplicatePrediction & ApiError;
      if (!res.ok) {
        throw new Error(
          json.error ||
            `Replicate prediction failed to start (HTTP ${res.status}). ${
              typeof json.detail === "string" ? json.detail : ""
            }`,
        );
      }
      const initial = json as ReplicatePrediction;
      setPrediction(initial);
      setPhase(initial.status === "starting" ? "starting" : initial.status);
      if (
        initial.status === "succeeded" ||
        initial.status === "failed" ||
        initial.status === "canceled"
      ) {
        return initial.status === "succeeded";
      }
      pollRef.current = window.setInterval(async () => {
        try {
          const next = await pollOnce(initial.id);
          setPrediction(next);
          setPhase(next.status === "starting" ? "starting" : next.status);
          if (
            next.status === "succeeded" ||
            next.status === "failed" ||
            next.status === "canceled"
          ) {
            stopPolling();
          }
        } catch (error) {
          stopPolling();
          setAnalysisError(formatCaught(error));
          setPhase("failed");
        }
      }, 1500);
      /**
       * Returning `true` here means "successfully submitted + polling". The auto-flow uses
       * this to advance into its `done` UI marker; actual prediction completion is reported
       * separately through `phase` from the poll loop.
       */
      return true;
    } catch (error) {
      setAnalysisError(formatCaught(error));
      setPhase("failed");
      return false;
    }
  };

  const cancelAnalysis = async () => {
    if (!prediction || !token) return;
    try {
      await fetch(
        `/api/replicate/predictions?id=${encodeURIComponent(prediction.id)}`,
        {
          method: "DELETE",
          headers: { "X-Replicate-Token": token },
        },
      );
    } catch (error) {
      setAnalysisError(formatCaught(error));
    } finally {
      stopPolling();
      setPhase("canceled");
    }
  };

  const resetRun = () => {
    stopPolling();
    setPrediction(null);
    setPhase("idle");
    setAnalysisError(null);
  };

  // ----- play_and_capture: file pick + transport + auto-flow -----

  /**
   * Specialized file picker for the play_and_capture mode. Validates audio type/size up front
   * (via the pure helper), wires the file into the shared `recordedBlob` slot so the existing
   * upload + snapshot pipeline keeps working, and resets the playback transport.
   */
  const onPickPlayCaptureFile = (file: File | null) => {
    setPlayCaptureError(null);
    setRecorderError(null);
    const check = validatePlayCaptureFile(file, MAX_AUDIO_BYTES);
    if (!check.ok) {
      setPlayCaptureError(check.error);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file!));
    setRecordedBlob(file!);
    setRecordedFilename(file!.name);
    setRecordedDurationMs(0);
    /** Window will be sealed from the audio element's play/ended events; clear any prior one. */
    setAudioWindow(null);
    setRemoteUrl(null);
    setRemoteUrlExpiresAt(null);
    setUploadError(null);
    setAudioDurationSec(null);
    playStartedAtMsRef.current = 0;
    playCaptureFinalizedRef.current = false;
    setPlayCapturePhase("idle");
    setPlayElapsedMs(0);
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  };

  /**
   * Run the full post-capture pipeline: seal the EEG window, upload to Replicate Files,
   * then submit the prediction. Called by:
   *   - `audio.ended` / Play & capture Stop button (`startMs` = playback start)
   *   - `MediaRecorder.onstop` for Record & capture mode (`startMs` = recording start)
   * The shared name `finalizePlayCapture` is historical; behaviour is mode-agnostic.
   */
  const finalizePlayCapture = async (startMs: number, endMs: number) => {
    if (playCaptureFinalizedRef.current) return;
    playCaptureFinalizedRef.current = true;
    stopPlayCaptureTick();
    /** Also stop the record-mode tick if it's still running (idempotent). */
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const sealed = sealPlayCaptureWindow(startMs, endMs);
    if (!sealed.ok) {
      setPlayCapturePhase("idle");
      setPlayCaptureError(
        sealed.reason === "never-started"
          ? "Playback never started — nothing to analyze."
          : `Captured window too short (${(sealed.durationMs / 1000).toFixed(2)}s < 0.25s). Try again.`,
      );
      return;
    }
    setAudioWindow(sealed.window);
    setRecordedDurationMs(sealed.window.endMs - sealed.window.startMs);
    setPlayCapturePhase("uploading");
    const url = await handleUpload();
    if (!url) {
      setPlayCapturePhase("error");
      return;
    }
    setPlayCapturePhase("analyzing");
    const ok = await runAnalysis(url);
    setPlayCapturePhase(ok ? "done" : "error");
  };

  const startPlayCapture = async () => {
    setPlayCaptureError(null);
    setAnalysisError(null);
    const el = audioElementRef.current;
    if (!el) {
      setPlayCaptureError("Audio element not ready yet — try again.");
      return;
    }
    if (!recordedBlob) {
      setPlayCaptureError("Pick an audio file first.");
      return;
    }
    /**
     * Hard-block files longer than Replicate's documented 8.4-hour `google/gemini-3.5-flash`
     * audio ceiling — submitting longer clips wastes the upload and gets rejected anyway.
     */
    if (audioDurationSec != null && audioDurationSec * 1000 > MAX_GEMINI_AUDIO_DURATION_MS) {
      setPlayCaptureError(
        `Clip is ${(audioDurationSec / 3600).toFixed(2)} h — Replicate's google/gemini-3.5-flash caps audio around 8.4 h per call. Trim the file before retrying.`,
      );
      return;
    }
    /** Reset transport state for a fresh run. */
    playCaptureFinalizedRef.current = false;
    playStartedAtMsRef.current = 0;
    setPlayElapsedMs(0);
    try {
      el.currentTime = 0;
      await el.play();
    } catch (error) {
      /**
       * Browser autoplay policies surface as a rejected `play()` promise (NotAllowedError).
       * Surface it verbatim so the user knows to interact with the page first.
       */
      setPlayCaptureError(formatCaught(error));
      setPlayCapturePhase("error");
    }
  };

  const stopPlayCapture = () => {
    const el = audioElementRef.current;
    const endMs = Date.now();
    if (el) {
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    }
    void finalizePlayCapture(playStartedAtMsRef.current, endMs);
  };

  const restartPlayCapture = () => {
    stopPlayCaptureTick();
    playStartedAtMsRef.current = 0;
    playCaptureFinalizedRef.current = false;
    setPlayCapturePhase("idle");
    setPlayElapsedMs(0);
    setPlayCaptureError(null);
    setAudioWindow(null);
    setRemoteUrl(null);
    setRemoteUrlExpiresAt(null);
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  };

  const playCaptureBusy = isPlayCaptureBusy(playCapturePhase);
  const audioTooLong =
    audioDurationSec != null && audioDurationSec * 1000 > MAX_GEMINI_AUDIO_DURATION_MS;

  const tokenLooksOk = looksLikeReplicateToken(token);
  const audioReady = Boolean(recordedBlob);
  const remoteUrlReady = Boolean(remoteUrl);
  const running = phase === "submitting" || phase === "starting" || phase === "processing";
  const completed = phase === "succeeded";
  const failed = phase === "failed" || phase === "canceled";

  const outputText = prediction ? concatenateGeminiOutput(prediction.output) : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle
          icon={<Brain className="h-4 w-4 text-emerald-400" />}
          description={
            <>
              Send a recorded audio clip plus a synchronized EEG snapshot to{" "}
              <a
                href={REPLICATE_MODEL_DOC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                <code>google/gemini-3.5-flash</code> on Replicate
              </a>{" "}
              for music ↔ EEG correlation analysis. Inputs follow the model schema (
              <code>prompt</code>, <code>audio</code>, <code>system_instruction</code>,{" "}
              <code>thinking_level</code>, <code>temperature</code>, <code>max_output_tokens</code>
              ); the streamed text array output is concatenated for display. Your Replicate API
              key stays in this browser.
            </>
          }
          actions={
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                tokenLooksOk
                  ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-700/60 bg-amber-500/10 text-amber-300"
              }`}
              title={tokenLooksOk ? "Replicate token saved in localStorage" : "Token not set"}
            >
              <KeyRound className="h-3 w-3" />
              {tokenLooksOk ? `key ${maskReplicateToken(token)}` : "key missing"}
            </span>
          }
        >
          AI music ↔ EEG analysis (Replicate · Gemini 3.5 Flash)
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* --- API key --- */}
        <section className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              Replicate API key
            </h4>
            <a
              href="https://replicate.com/account/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
            >
              Get a token <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                type={showToken ? "text" : "password"}
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="r8_••••••••••••••••••••"
                spellCheck={false}
                autoComplete="off"
                aria-label="Replicate API token"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 pr-10 font-mono text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute inset-y-0 right-1.5 inline-flex items-center px-1 text-zinc-500 hover:text-zinc-200"
                aria-label={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => persistToken(tokenInput)}
              disabled={!tokenInput.trim() || tokenInput.trim() === savedToken}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => persistToken("")}
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              disabled={!savedToken}
            >
              Forget
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-[11px] uppercase tracking-wide text-zinc-500" htmlFor="replicate-model">
              Model
            </label>
            <input
              id="replicate-model"
              value={model}
              onChange={(event) => setModelState(event.target.value)}
              onBlur={(event) => persistModel(event.target.value)}
              placeholder={DEFAULT_REPLICATE_MODEL}
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-[11px] text-zinc-500">
              Default <code>{DEFAULT_REPLICATE_MODEL}</code>. Any audio-capable Replicate model works.
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Your token is stored only in this browser&apos;s localStorage. It is sent on a single
            header (<code>X-Replicate-Token</code>) to a local Next.js proxy route that forwards to
            Replicate; the Node bridge never sees it.
          </p>
        </section>

        {/* --- Audio source --- */}
        <section className="space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              Audio source
            </h4>
            {/**
             * Segmented mode switch — clearly highlights the active mode and clears any
             * stale clip when the user switches so we never analyze the wrong source.
             */}
            <div
              role="tablist"
              aria-label="Audio source mode"
              className="inline-flex overflow-hidden rounded-md border border-zinc-700 bg-zinc-900/60 text-[11px]"
            >
              {([
                { id: "record_and_capture", label: "Record & capture", Icon: Mic },
                { id: "play_and_capture", label: "Play & capture", Icon: Music },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={audioMode === id}
                  disabled={recording || playCaptureBusy}
                  onClick={() => {
                    if (audioMode === id) return;
                    cleanupAudio();
                    setAudioMode(id);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium transition ${
                    audioMode === id
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-specific input controls */}
          {audioMode === "record_and_capture" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {!recording && countdownRemaining == null ? (
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<Mic className="h-3.5 w-3.5" />}
                    disabled={!tokenLooksOk || playCaptureBusy}
                    onClick={() => void startCountdownThenRecord()}
                  >
                    {countdownSec > 0 ? `Record & capture (${countdownSec}s)` : "Record & capture"}
                  </Button>
                ) : null}
                {countdownRemaining != null && !recording ? (
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={<X className="h-3.5 w-3.5" />}
                    onClick={cancelCountdown}
                  >
                    Cancel countdown
                  </Button>
                ) : null}
                {recording ? (
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={<Square className="h-3.5 w-3.5" />}
                    onClick={stopRecording}
                  >
                    Stop ({formatDuration(recordedDurationMs)})
                  </Button>
                ) : null}
                <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
                  Countdown
                  <select
                    aria-label="Pre-record countdown seconds"
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                    value={countdownSec}
                    disabled={recording || countdownRemaining != null || playCaptureBusy}
                    onChange={(event) => setCountdownSec(Number(event.target.value))}
                  >
                    {COUNTDOWN_OPTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec === 0 ? "no countdown" : `${sec}s`}
                      </option>
                    ))}
                  </select>
                </label>
                {recordedBlob && !recording && countdownRemaining == null && !playCaptureBusy ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<X className="h-3.5 w-3.5" />}
                    onClick={cleanupAudio}
                  >
                    Clear audio
                  </Button>
                ) : null}
              </div>
              {countdownRemaining != null ? (
                <div
                  role="status"
                  aria-live="assertive"
                  className="flex items-center justify-center rounded-lg border border-emerald-700/60 bg-emerald-500/10 py-6 text-center"
                >
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">
                      starting in
                    </div>
                    <div className="font-mono text-5xl font-semibold text-emerald-200 tabular-nums">
                      {countdownRemaining}
                    </div>
                  </div>
                </div>
              ) : null}
              <p className="text-[11px] text-zinc-500">
                Click <strong>Record &amp; capture</strong> — after the optional countdown, the
                browser mic starts recording and an EEG window is sealed to the recording span.
                When you press <strong>Stop</strong>, NeuroVis auto-uploads to Replicate and runs
                Gemini analysis (no manual buttons needed).
              </p>
            </div>
          ) : null}

          {audioMode === "play_and_capture" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    disabled={playCaptureBusy}
                    onChange={(event) => onPickPlayCaptureFile(event.target.files?.[0] ?? null)}
                  />
                  <span
                    className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 text-xs text-zinc-200 hover:bg-zinc-800/60 ${
                      playCaptureBusy ? "cursor-not-allowed opacity-50" : ""
                    }`}
                  >
                    <FileAudio className="h-3.5 w-3.5" />
                    {recordedBlob ? "Pick a different file" : "Pick audio file"}
                  </span>
                </label>
                {recordedBlob ? (
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={
                      playCaptureBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )
                    }
                    disabled={
                      !tokenLooksOk ||
                      playCaptureBusy ||
                      playCapturePhase === "playing" ||
                      audioTooLong
                    }
                    onClick={() => void startPlayCapture()}
                  >
                    {playCapturePhase === "uploading"
                      ? "Uploading…"
                      : playCapturePhase === "analyzing"
                        ? "Analyzing…"
                        : "Play & capture"}
                  </Button>
                ) : null}
                {playCapturePhase === "playing" ? (
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={<Square className="h-3.5 w-3.5" />}
                    onClick={stopPlayCapture}
                  >
                    Stop ({formatDuration(playElapsedMs)})
                  </Button>
                ) : null}
                {recordedBlob && playCapturePhase !== "playing" && !playCaptureBusy ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                    onClick={restartPlayCapture}
                  >
                    Reset transport
                  </Button>
                ) : null}
                {recordedBlob ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<X className="h-3.5 w-3.5" />}
                    disabled={playCaptureBusy}
                    onClick={cleanupAudio}
                  >
                    Clear audio
                  </Button>
                ) : null}
              </div>
              {playCaptureError ? (
                <p className="flex items-start gap-1.5 text-[11px] text-rose-300">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  {playCaptureError}
                </p>
              ) : null}
              {audioTooLong ? (
                <p className="flex items-start gap-1.5 text-[11px] text-rose-300">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  This clip is{" "}
                  {audioDurationSec ? `${(audioDurationSec / 3600).toFixed(2)} h` : "very long"} —
                  Replicate&apos;s {`google/gemini-3.5-flash`} caps audio around 8.4 h per call.
                  Trim the file before retrying.
                </p>
              ) : null}
              {playCapturePhase === "done" ? (
                <p className="flex items-start gap-1.5 text-[11px] text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                  Auto-flow finished — see the analysis output below.
                </p>
              ) : null}
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Press <span className="text-zinc-300">Play &amp; capture</span> to play this clip
                in-tab. The EEG snapshot will be sealed to the playback window, the file will be
                uploaded to Replicate, and the analysis will run automatically. Click{" "}
                <span className="text-zinc-300">Stop</span> to finalize early.
              </p>
            </div>
          ) : null}

          {recorderError ? (
            <p className="flex items-start gap-1.5 text-[11px] text-rose-300">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {recorderError}
            </p>
          ) : null}
          {recordedBlob ? (
            <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                <span className="text-zinc-200">{recordedFilename ?? "audio"}</span>
                <span>· {formatBytes(recordedBlob.size)}</span>
                <span>· {recordedBlob.type || "audio/*"}</span>
                {recordedDurationMs > 0 ? <span>· {formatDuration(recordedDurationMs)}</span> : null}
                <span
                  className={
                    audioWindow
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }
                  title={
                    audioWindow
                      ? `EEG history will be filtered to ${new Date(audioWindow.startMs).toLocaleTimeString()} → ${new Date(audioWindow.endMs).toLocaleTimeString()}`
                      : "Uploaded files have no original capture timestamp; the snapshot will use the most recent EEG history instead."
                  }
                >
                  · {audioWindow ? "EEG window aligned" : "no EEG time alignment"}
                </span>
              </div>
              {previewUrl ? (
                <audio
                  ref={audioMode === "play_and_capture" ? audioElementRef : null}
                  src={previewUrl}
                  /**
                   * In `play_and_capture` we drive the element ourselves and hide native controls
                   * to keep the elapsed-window measurement honest (no surprise pauses or seeks
                   * via the built-in transport). The other modes keep the existing read-only preview.
                   */
                  controls={audioMode !== "play_and_capture"}
                  className="w-full"
                  preload="metadata"
                  data-testid="research-ai-audio-preview"
                  data-audio-mode={audioMode}
                  onLoadedMetadata={(event) => {
                    const d = event.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) setAudioDurationSec(d);
                  }}
                  onPlay={() => {
                    if (audioMode !== "play_and_capture") return;
                    /**
                     * `Date.now()` here is the wall-clock instant playback truly began (the
                     * event fires after the audio engine has actually started). We use it
                     * verbatim as `audioWindow.startMs` so the EEG snapshot lines up.
                     */
                    playStartedAtMsRef.current = Date.now();
                    playCaptureFinalizedRef.current = false;
                    setPlayCapturePhase("playing");
                    setPlayElapsedMs(0);
                    stopPlayCaptureTick();
                    playTickRef.current = window.setInterval(() => {
                      setPlayElapsedMs(Date.now() - playStartedAtMsRef.current);
                    }, 250);
                  }}
                  onEnded={() => {
                    if (audioMode !== "play_and_capture") return;
                    void finalizePlayCapture(playStartedAtMsRef.current, Date.now());
                  }}
                  onError={(event) => {
                    if (audioMode !== "play_and_capture") return;
                    const mediaError = (event.currentTarget as HTMLAudioElement).error;
                    setPlayCaptureError(
                      mediaError?.message ||
                        `Audio playback error (code ${mediaError?.code ?? "?"}).`,
                    );
                    setPlayCapturePhase("error");
                    stopPlayCaptureTick();
                  }}
                />
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500">
              {audioMode === "play_and_capture"
                ? "Pick an audio file to play in-tab; we'll capture an EEG window aligned to its playback span and auto-run the analysis."
                : "Record live audio in this browser with an optional pre-record countdown; the EEG snapshot is aligned to the recording window and the run starts automatically."}
            </p>
          )}
        </section>

        {/* --- Audio payload (data URL) --- */}
        <section className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
            Audio payload
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              disabled={!audioReady || !tokenLooksOk || uploading || playCaptureBusy}
              onClick={() => void handleUpload()}
            >
              {playCaptureBusy
                ? "(automatic — play & capture)"
                : uploading
                  ? "Encoding…"
                  : remoteUrlReady
                    ? "Re-encode payload"
                    : "Encode audio for Replicate"}
            </Button>
          </div>
          {uploadError ? (
            <p className="flex items-start gap-1.5 text-[11px] text-rose-300">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {uploadError}
            </p>
          ) : null}
          {remoteUrl ? (
            <div className="space-y-1 rounded-md border border-emerald-900/50 bg-emerald-950/20 p-2 text-[11px] text-emerald-200">
              <div className="flex flex-wrap items-center gap-2 font-sans">
                <span className="rounded-full border border-emerald-700/60 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  data URL
                </span>
                <span className="font-mono">{recordedBlob?.type || "audio/*"}</span>
                {recordedBlob ? (
                  <span className="text-emerald-400/80">{formatBytes(recordedBlob.size)} embedded inline</span>
                ) : null}
              </div>
              <p className="font-sans text-[10px] text-emerald-400/80">
                MIME-tagged via the URL prefix so Gemini&apos;s wrapper does not have to infer the
                file type — this avoids the &quot;Unknown mime type&quot; error returned by
                <code> Part.from_uri</code> when no extension is present.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500">
              Audio is base64-embedded as a <code>data:&lt;mime&gt;;base64,…</code> URL with a
              canonical Gemini-supported MIME type. Capped at <strong>3 MB</strong> per clip
              (Replicate body limit). For Play &amp; capture and Record &amp; capture, this step
              runs automatically.
            </p>
          )}
        </section>

        {/* --- Model controls (Gemini 3.5 Flash schema) --- */}
        <section className="space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
            Model controls
          </h4>
          <div className="space-y-1">
            <label
              htmlFor="research-ai-system-instruction"
              className="text-[11px] uppercase tracking-wide text-zinc-500"
            >
              system_instruction
            </label>
            <textarea
              id="research-ai-system-instruction"
              value={systemInstruction}
              onChange={(event) => setSystemInstruction(event.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950/80 p-2 font-mono text-[11px] leading-relaxed text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-zinc-500">
              Steers the model&apos;s role. Sent verbatim as the model&apos;s{" "}
              <code>system_instruction</code> input. Leave blank to omit.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label
                htmlFor="research-ai-thinking-level"
                className="text-[11px] uppercase tracking-wide text-zinc-500"
              >
                thinking_level
              </label>
              <select
                id="research-ai-thinking-level"
                value={thinkingLevel}
                onChange={(event) =>
                  setThinkingLevel(event.target.value as GeminiThinkingLevel)
                }
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {THINKING_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-500">
                higher = more reasoning, more latency.
              </p>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="research-ai-temperature"
                className="text-[11px] uppercase tracking-wide text-zinc-500"
              >
                temperature ({temperature.toFixed(2)})
              </label>
              <input
                id="research-ai-temperature"
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
                className="w-full accent-emerald-500"
              />
              <p className="text-[10px] text-zinc-500">0 = deterministic, 2 = wild.</p>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="research-ai-max-output-tokens"
                className="text-[11px] uppercase tracking-wide text-zinc-500"
              >
                max_output_tokens
              </label>
              <input
                id="research-ai-max-output-tokens"
                type="number"
                min={64}
                max={65535}
                step={64}
                value={maxOutputTokens}
                onChange={(event) =>
                  setMaxOutputTokens(Math.max(64, Math.min(65535, Number(event.target.value) || 0)))
                }
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-zinc-500">cap on generated tokens.</p>
            </div>
          </div>
        </section>

        {/* --- Prompt + EEG snapshot preview --- */}
        <section className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
            prompt &amp; EEG context
          </h4>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950/80 p-2 font-mono text-[11px] leading-relaxed text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
            aria-label="Replicate prompt"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => setPrompt(DEFAULT_PROMPT)}
            >
              Reset prompt
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSnapshotPreview(captureSnapshot())}
            >
              Preview EEG snapshot
            </Button>
            <span className="text-[11px] text-zinc-500">
              The EEG snapshot is appended to <code>prompt</code> as a structured text block (the
              model schema does not expose a dedicated EEG field).
            </span>
          </div>
          {snapshotPreview ? (
            <CopyableConsole
              title="EEG snapshot (appended to prompt)"
              text={JSON.stringify(snapshotPreview, null, 2)}
              emptyPlaceholder="{}"
              downloadBasename="neurovis-eeg-snapshot"
              ariaLabel="EEG snapshot JSON"
              textareaClassName="max-h-[260px] min-h-[120px] h-auto"
              className="border-zinc-800/90 bg-zinc-950/60"
            />
          ) : null}
        </section>

        {/* --- Run --- */}
        <section className="space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="md"
              variant="primary"
              leftIcon={running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              disabled={!tokenLooksOk || !remoteUrlReady || running || playCaptureBusy}
              onClick={() => void runAnalysis()}
            >
              {playCaptureBusy
                ? "(automatic — play & capture)"
                : running
                  ? `Analyzing… (${phase})`
                  : "Run analysis"}
            </Button>
            {running && prediction ? (
              <Button size="sm" variant="danger" onClick={() => void cancelAnalysis()}>
                Cancel
              </Button>
            ) : null}
            {(completed || failed) && prediction ? (
              <Button size="sm" variant="ghost" onClick={resetRun}>
                Reset
              </Button>
            ) : null}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                completed
                  ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-300"
                  : failed
                    ? "border-rose-700/60 bg-rose-500/10 text-rose-300"
                    : running
                      ? "border-sky-700/60 bg-sky-500/10 text-sky-300"
                      : "border-zinc-700 bg-zinc-800/60 text-zinc-400"
              }`}
            >
              {completed ? <CheckCircle2 className="h-3 w-3" /> : null}
              {failed ? <AlertCircle className="h-3 w-3" /> : null}
              {running ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              status: {phase}
            </span>
            {prediction?.urls?.get ? (
              <a
                href={prediction.urls.get}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
              >
                View on Replicate
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          {analysisError ? (
            <p className="flex items-start gap-1.5 text-[11px] text-rose-300">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {analysisError}
            </p>
          ) : null}
          {prediction?.error ? (
            <p className="flex items-start gap-1.5 text-[11px] text-rose-300">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {prediction.error}
            </p>
          ) : null}
          {prediction ? (
            <CopyableConsole
              title={`Replicate output${prediction.id ? ` · ${prediction.id}` : ""}`}
              text={outputText || (prediction.logs ?? "")}
              emptyPlaceholder="(waiting for model output…)"
              downloadBasename={`neurovis-replicate-${prediction.id || "run"}`}
              ariaLabel="Replicate output text"
              textareaClassName="max-h-[420px] min-h-[180px] h-auto"
              className="border-zinc-800/90 bg-zinc-950/60"
            />
          ) : null}
        </section>
      </CardBody>
    </Card>
  );
}
