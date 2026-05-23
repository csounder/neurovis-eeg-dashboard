/**
 * Helpers for the Research page's `play_and_capture` audio-source mode, where the user
 * plays an audio file in-tab and we simultaneously capture an EEG window whose start/end
 * wall-clock instants are derived from the `<audio>` element's `play` / `ended` events.
 *
 * These functions are kept pure so the component can defer state-machine decisions to
 * something testable in vitest (the React side handles refs, DOM, and async chaining).
 */

/**
 * Minimum elapsed wall-clock duration (ms) between `audio.play` and the seal event for
 * the capture to be considered useful. Below this we treat the run as a no-op so a quick
 * accidental stop doesn't fire a useless Replicate prediction.
 */
export const PLAY_CAPTURE_MIN_DURATION_MS = 250;

/**
 * Replicate `google/gemini-3.5-flash` documents an upper bound around 8.4 hours of audio per
 * call (see https://replicate.com/google/gemini-3.5-flash). We warn before reaching it; the
 * actual hard reject still comes from Replicate.
 */
export const MAX_GEMINI_AUDIO_DURATION_MS = 8.4 * 60 * 60 * 1000;

export type PlayCaptureFileValidation =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validate a `File` picked for the `play_and_capture` mode. Rejects non-audio MIME types,
 * empty files, and files larger than the Replicate Files-API upload ceiling we enforce.
 */
export function validatePlayCaptureFile(
  file: File | null | undefined,
  maxBytes: number,
): PlayCaptureFileValidation {
  if (!file) {
    return { ok: false, error: "No file selected." };
  }
  /**
   * `audio/*` covers what Chrome/Firefox/Safari hand us; some browsers leave MIME blank for
   * unusual containers, so we fall back to the extension before rejecting outright.
   */
  const mimeLooksAudio = typeof file.type === "string" && file.type.startsWith("audio/");
  const extLooksAudio = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm|weba|aiff?|wma)$/i.test(
    file.name || "",
  );
  if (!mimeLooksAudio && !extLooksAudio) {
    return {
      ok: false,
      error: `"${file.name}" doesn't look like an audio file (MIME "${file.type || "unknown"}"). Pick an audio/* file.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, error: "Selected file is empty." };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `File is too large (${file.size} bytes); keep audio under ${maxBytes} bytes for Replicate uploads.`,
    };
  }
  return { ok: true };
}

export type PlayCaptureWindowResult =
  | { ok: true; window: { startMs: number; endMs: number } }
  | { ok: false; reason: "never-started" | "too-short"; durationMs: number };

/**
 * Decide whether a `[startMs, endMs]` pair captured around audio playback is large enough
 * to seal as the EEG `audioWindow` for the snapshot. Used by both the `ended` event and
 * the user-driven Stop button so the rule lives in one place.
 */
export function sealPlayCaptureWindow(
  startMs: number,
  endMs: number,
  minDurationMs: number = PLAY_CAPTURE_MIN_DURATION_MS,
): PlayCaptureWindowResult {
  if (!Number.isFinite(startMs) || startMs <= 0) {
    return { ok: false, reason: "never-started", durationMs: 0 };
  }
  if (!Number.isFinite(endMs) || endMs <= startMs) {
    return { ok: false, reason: "too-short", durationMs: 0 };
  }
  const durationMs = endMs - startMs;
  if (durationMs < minDurationMs) {
    return { ok: false, reason: "too-short", durationMs };
  }
  return { ok: true, window: { startMs, endMs } };
}

/**
 * Lifecycle phases for the auto-flow that follows a `play_and_capture` run. The component
 * surfaces these in the UI so the user can see why the manual buttons are disabled and
 * what the auto-pipeline is currently doing.
 */
export type PlayCaptureAutoPhase =
  | "idle"
  | "playing"
  | "uploading"
  | "analyzing"
  | "done"
  | "error";

/** True when the auto-pipeline is mid-flight and manual upload / run buttons must be locked. */
export function isPlayCaptureBusy(phase: PlayCaptureAutoPhase): boolean {
  return phase === "playing" || phase === "uploading" || phase === "analyzing";
}
