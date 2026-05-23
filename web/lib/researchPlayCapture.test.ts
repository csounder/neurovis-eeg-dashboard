import { describe, expect, it } from "vitest";
import {
  MAX_GEMINI_AUDIO_DURATION_MS,
  PLAY_CAPTURE_MIN_DURATION_MS,
  isPlayCaptureBusy,
  sealPlayCaptureWindow,
  validatePlayCaptureFile,
} from "./researchPlayCapture";

function makeFile(opts: { name?: string; type?: string; size?: number }): File {
  const bytes = new Uint8Array(opts.size ?? 16);
  return new File([bytes], opts.name ?? "clip.mp3", { type: opts.type ?? "audio/mpeg" });
}

describe("validatePlayCaptureFile", () => {
  const MAX = 10 * 1024 * 1024;

  it("accepts a plain audio/* file under the byte cap", () => {
    expect(validatePlayCaptureFile(makeFile({ size: 4096 }), MAX)).toEqual({ ok: true });
  });

  it("rejects null / missing files", () => {
    const r = validatePlayCaptureFile(null, MAX);
    expect(r.ok).toBe(false);
  });

  it("rejects empty files even with an audio MIME", () => {
    const r = validatePlayCaptureFile(makeFile({ size: 0 }), MAX);
    expect(r.ok).toBe(false);
  });

  it("rejects oversized files", () => {
    const r = validatePlayCaptureFile(makeFile({ size: MAX + 1 }), MAX);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/too large/);
  });

  it("rejects clearly non-audio MIME with no audio extension", () => {
    const r = validatePlayCaptureFile(
      makeFile({ name: "thing.txt", type: "text/plain" }),
      MAX,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/doesn't look like an audio file/);
  });

  it("accepts a file with no MIME but a known audio extension (some browsers omit type)", () => {
    const r = validatePlayCaptureFile(
      makeFile({ name: "clip.flac", type: "" }),
      MAX,
    );
    expect(r).toEqual({ ok: true });
  });
});

describe("sealPlayCaptureWindow", () => {
  it("seals a window when the elapsed gap clears the minimum threshold", () => {
    const r = sealPlayCaptureWindow(1_000, 1_000 + PLAY_CAPTURE_MIN_DURATION_MS + 5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.window.startMs).toBe(1_000);
      expect(r.window.endMs).toBe(1_000 + PLAY_CAPTURE_MIN_DURATION_MS + 5);
    }
  });

  it("rejects a window where playback never started", () => {
    const r = sealPlayCaptureWindow(0, 2_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("never-started");
  });

  it("rejects a window with no positive duration", () => {
    const r = sealPlayCaptureWindow(2_000, 2_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-short");
  });

  it("rejects a window shorter than the minimum (default 250 ms)", () => {
    const r = sealPlayCaptureWindow(1_000, 1_100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-short");
  });

  it("accepts a tiny window when the caller relaxes the minimum", () => {
    const r = sealPlayCaptureWindow(1_000, 1_050, 10);
    expect(r.ok).toBe(true);
  });
});

describe("isPlayCaptureBusy", () => {
  it("locks the UI for playing / uploading / analyzing", () => {
    expect(isPlayCaptureBusy("playing")).toBe(true);
    expect(isPlayCaptureBusy("uploading")).toBe(true);
    expect(isPlayCaptureBusy("analyzing")).toBe(true);
  });

  it("frees the UI for idle / done / error", () => {
    expect(isPlayCaptureBusy("idle")).toBe(false);
    expect(isPlayCaptureBusy("done")).toBe(false);
    expect(isPlayCaptureBusy("error")).toBe(false);
  });
});

describe("MAX_GEMINI_AUDIO_DURATION_MS", () => {
  it("matches the 8.4-hour documented Replicate ceiling", () => {
    expect(MAX_GEMINI_AUDIO_DURATION_MS).toBe(8.4 * 60 * 60 * 1000);
  });
});
