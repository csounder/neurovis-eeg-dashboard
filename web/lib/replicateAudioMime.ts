/**
 * Pure (non-server-only) helpers for normalizing audio MIME types and filenames before they
 * reach Replicate's Files API.
 *
 * These exist in their own module so vitest can import them in Node without pulling in
 * `server-only` from `replicateServer.ts`.
 *
 * Why this matters:
 *   `MediaRecorder` produces blobs whose `Content-Type` includes a codec parameter, e.g.
 *   `audio/webm;codecs=opus`. Replicate stores that string verbatim, and Gemini's Python
 *   wrapper rejects it with `ValueError: Unknown mime type: …`. Stripping the codec param
 *   (and a couple of common aliases) fixes the upstream error.
 *
 * Allowed Gemini audio MIMEs (Google docs, mirrored on Replicate's gemini-3.5-flash README):
 *   audio/aac, audio/x-aac, audio/flac, audio/mp3, audio/mpeg, audio/mpga, audio/m4a,
 *   audio/mp4, audio/ogg, audio/pcm, audio/wav, audio/webm.
 */

export function canonicalAudioMime(rawMime: string | null | undefined): string {
  const fallback = "audio/webm";
  if (!rawMime) return fallback;
  /** Strip codec / charset / boundary params: `audio/webm;codecs=opus` → `audio/webm`. */
  const base = rawMime.split(";")[0]?.trim().toLowerCase() ?? fallback;
  if (!base.startsWith("audio/")) return fallback;
  switch (base) {
    case "audio/x-wav":
    case "audio/wave":
    case "audio/vnd.wave":
      return "audio/wav";
    case "audio/mp3":
    case "audio/mpga":
      return "audio/mpeg";
    case "audio/x-m4a":
      return "audio/m4a";
    case "audio/x-aac":
      return "audio/aac";
    case "audio/x-flac":
      return "audio/flac";
    default:
      return base;
  }
}

/** Pick a sensible file extension for a canonical MIME so Gemini's MIME sniffing on the
 * file URL also succeeds (the model wrapper falls back to filename extension when
 * `content_type` is inconclusive). */
export function extensionForAudioMime(mime: string): string {
  switch (mime) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
      return "mp4";
    case "audio/m4a":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
      return "wav";
    case "audio/flac":
      return "flac";
    case "audio/aac":
      return "aac";
    case "audio/pcm":
      return "pcm";
    default:
      return "audio";
  }
}

/** Ensure `filename` ends with the canonical extension for `mime`; replace the existing
 * extension when it disagrees so the URL Gemini sees is internally consistent. */
export function alignFilenameToMime(filename: string, mime: string): string {
  const ext = extensionForAudioMime(mime);
  const trimmed = (filename ?? "").trim();
  /** A leading-dot input like ".hidden" has no useful base — use a default name. */
  if (!trimmed || trimmed.startsWith(".")) {
    return `neurovis-audio.${ext}`;
  }
  const base = trimmed.replace(/\.[^./\\]+$/i, "");
  return `${base || "neurovis-audio"}.${ext}`;
}

/**
 * Hard cap on raw audio bytes when embedding via a `data:` URL. Replicate prediction request
 * bodies are accepted up to roughly 5 MB; base64 inflates payload by ~4/3, so 3 MB binary
 * stays comfortably under that limit and we keep the rest of the JSON budget for the prompt.
 */
export const MAX_DATA_URL_AUDIO_BYTES = 3 * 1024 * 1024;

export interface AudioDataUrlBuild {
  /** `data:<mime>;base64,<bytes>` ready to be passed straight into Replicate's `audio` input. */
  url: string;
  /** Canonical Gemini-supported MIME embedded in the data URL prefix. */
  contentType: string;
  /** Size of the original (non-base64) bytes. */
  size: number;
  /** Filename with the extension aligned to the canonical MIME (for UI display only). */
  filename: string;
}

/**
 * Build a `data:` URL for a given audio blob using the canonical MIME.
 *
 * Why a data URL? Replicate's Files API returns URLs like
 * `https://api.replicate.com/v1/files/{id}` with no filename and no extension. The `google/
 * gemini-3.5-flash` wrapper internally calls Gemini's `Part.from_uri(...)` which infers MIME
 * from filename / `Content-Type` — neither of which is exposed by that URL — and fails with
 * `ValueError: Unknown mime type: …`. A data URL embeds the MIME directly in the URL prefix,
 * which the wrapper can parse without any inference.
 *
 * Throws when the blob exceeds {@link MAX_DATA_URL_AUDIO_BYTES} so callers can surface a clear
 * error to the user instead of silently truncating or generating an oversize Replicate body.
 */
export async function buildAudioDataUrl(opts: {
  blob: Blob;
  filename?: string;
  maxBytes?: number;
}): Promise<AudioDataUrlBuild> {
  const limit = opts.maxBytes ?? MAX_DATA_URL_AUDIO_BYTES;
  if (opts.blob.size > limit) {
    throw new Error(
      `Audio is ${opts.blob.size} bytes; data-URL embedding caps at ${limit} bytes (~${Math.round(
        limit / (1024 * 1024),
      )} MB). Trim or compress the clip and try again.`,
    );
  }
  const cleanMime = canonicalAudioMime(opts.blob.type);
  const cleanedFilename = alignFilenameToMime(opts.filename ?? "neurovis-audio", cleanMime);

  const arrayBuffer = await opts.blob.arrayBuffer();
  const base64 = encodeBase64(new Uint8Array(arrayBuffer));
  return {
    url: `data:${cleanMime};base64,${base64}`,
    contentType: cleanMime,
    size: arrayBuffer.byteLength,
    filename: cleanedFilename,
  };
}

/** Isomorphic base64 encoder — uses Node's `Buffer` when available (Next route, vitest), and
 *  falls back to a manual binary-string + `btoa` path for the browser. */
function encodeBase64(bytes: Uint8Array): string {
  /** Node / Bun / Deno-compat (via shim) all expose `Buffer`. */
  const NodeBuffer = (globalThis as { Buffer?: { from: (b: Uint8Array) => { toString: (e: string) => string } } }).Buffer;
  if (NodeBuffer) {
    return NodeBuffer.from(bytes).toString("base64");
  }
  /** Browser path. Chunked to avoid blowing the call stack on large arrays. */
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
