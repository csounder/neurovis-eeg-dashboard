import { describe, expect, it } from "vitest";
import {
  alignFilenameToMime,
  buildAudioDataUrl,
  canonicalAudioMime,
  extensionForAudioMime,
  MAX_DATA_URL_AUDIO_BYTES,
} from "./replicateAudioMime";

describe("canonicalAudioMime", () => {
  it("strips codec parameters from MediaRecorder output (the actual user bug)", () => {
    expect(canonicalAudioMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(canonicalAudioMime("audio/ogg;codecs=opus")).toBe("audio/ogg");
    expect(canonicalAudioMime("audio/webm; codecs=opus")).toBe("audio/webm");
  });

  it("normalizes common aliases to Gemini-supported canonical values", () => {
    expect(canonicalAudioMime("audio/x-wav")).toBe("audio/wav");
    expect(canonicalAudioMime("audio/wave")).toBe("audio/wav");
    expect(canonicalAudioMime("audio/vnd.wave")).toBe("audio/wav");
    expect(canonicalAudioMime("audio/mp3")).toBe("audio/mpeg");
    expect(canonicalAudioMime("audio/mpga")).toBe("audio/mpeg");
    expect(canonicalAudioMime("audio/x-m4a")).toBe("audio/m4a");
    expect(canonicalAudioMime("audio/x-aac")).toBe("audio/aac");
    expect(canonicalAudioMime("audio/x-flac")).toBe("audio/flac");
  });

  it("preserves already-canonical Gemini MIMEs", () => {
    for (const mime of [
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/m4a",
      "audio/mpeg",
      "audio/wav",
      "audio/flac",
      "audio/aac",
      "audio/pcm",
    ]) {
      expect(canonicalAudioMime(mime)).toBe(mime);
    }
  });

  it("falls back to audio/webm for blank, missing, or non-audio types", () => {
    expect(canonicalAudioMime(null)).toBe("audio/webm");
    expect(canonicalAudioMime(undefined)).toBe("audio/webm");
    expect(canonicalAudioMime("")).toBe("audio/webm");
    expect(canonicalAudioMime("application/octet-stream")).toBe("audio/webm");
    expect(canonicalAudioMime("video/mp4")).toBe("audio/webm");
  });
});

describe("extensionForAudioMime / alignFilenameToMime", () => {
  it("maps each canonical MIME to the right file extension", () => {
    expect(extensionForAudioMime("audio/webm")).toBe("webm");
    expect(extensionForAudioMime("audio/ogg")).toBe("ogg");
    expect(extensionForAudioMime("audio/mp4")).toBe("mp4");
    expect(extensionForAudioMime("audio/m4a")).toBe("m4a");
    expect(extensionForAudioMime("audio/mpeg")).toBe("mp3");
    expect(extensionForAudioMime("audio/wav")).toBe("wav");
    expect(extensionForAudioMime("audio/flac")).toBe("flac");
    expect(extensionForAudioMime("audio/aac")).toBe("aac");
  });

  it("rewrites filename extension to match the canonical MIME", () => {
    expect(alignFilenameToMime("clip.bogus", "audio/webm")).toBe("clip.webm");
    expect(alignFilenameToMime("clip", "audio/mp4")).toBe("clip.mp4");
    expect(alignFilenameToMime("nested.path.clip.opus", "audio/webm")).toBe(
      "nested.path.clip.webm",
    );
    expect(alignFilenameToMime("", "audio/wav")).toBe("neurovis-audio.wav");
  });

  it("does not invent a name from a leading dot", () => {
    expect(alignFilenameToMime(".hidden", "audio/webm")).toBe("neurovis-audio.webm");
  });
});

describe("buildAudioDataUrl", () => {
  function makeBlob(contents: Uint8Array, mime: string): Blob {
    /** Build a fresh ArrayBuffer copy so TS narrows away the SharedArrayBuffer union. */
    const ab = new ArrayBuffer(contents.byteLength);
    new Uint8Array(ab).set(contents);
    return new Blob([ab], { type: mime });
  }

  it("returns a `data:<canonical-mime>;base64,…` URL with the canonical MIME embedded", async () => {
    const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const out = await buildAudioDataUrl({
      blob: makeBlob(bytes, "audio/webm;codecs=opus"),
      filename: "clip.opus",
    });
    /** Canonical MIME (no codec param) goes into the URL prefix. */
    expect(out.url.startsWith("data:audio/webm;base64,")).toBe(true);
    expect(out.contentType).toBe("audio/webm");
    expect(out.size).toBe(5);
    /** Filename extension is rewritten to match the canonical MIME. */
    expect(out.filename).toBe("clip.webm");

    const base64 = out.url.split(",", 2)[1] ?? "";
    expect(Buffer.from(base64, "base64").toString("utf8")).toBe("Hello");
  });

  it("rejects blobs larger than the data-URL cap", async () => {
    /** Allocate 1 byte past the cap. We don't actually allocate the full cap to keep the test fast. */
    const tinyCap = 16;
    await expect(
      buildAudioDataUrl({
        blob: makeBlob(new Uint8Array(tinyCap + 1), "audio/wav"),
        maxBytes: tinyCap,
      }),
    ).rejects.toThrow(/data-URL embedding caps/);
  });

  it("uses MAX_DATA_URL_AUDIO_BYTES as the default cap", () => {
    /** Lock the cap at 3 MB so any future bump is intentional. */
    expect(MAX_DATA_URL_AUDIO_BYTES).toBe(3 * 1024 * 1024);
  });
});
