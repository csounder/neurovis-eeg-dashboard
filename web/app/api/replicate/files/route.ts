import { NextResponse } from "next/server";
import {
  buildAudioDataUrl,
  MAX_DATA_URL_AUDIO_BYTES,
} from "@/lib/replicateAudioMime";
import { readReplicateTokenFromRequest } from "@/lib/replicateServer";

export const runtime = "nodejs";
/** Audio blobs can be a few MB; keep route dynamic and never cached. */
export const dynamic = "force-dynamic";

/**
 * POST `/api/replicate/files`
 *
 * Accepts a multipart/form-data audio blob (`audio` field, optional `filename`) and returns a
 * `data:<mime>;base64,<bytes>` URL ready to be sent straight to Replicate's `google/
 * gemini-3.5-flash` `audio` input.
 *
 * **Why data URLs and not Replicate's Files API?**
 *   Replicate's Files API returns URLs like `https://api.replicate.com/v1/files/{id}` with no
 *   filename and no extension. The Gemini wrapper running on Replicate calls Gemini's
 *   `Part.from_uri(...)` internally, which can't infer MIME from such a URL and fails with
 *   `ValueError: Unknown mime type: Could not determine the mimetype for your file please set
 *   the 'mime_type' argument.`
 *
 *   A data URL like `data:audio/webm;base64,…` puts the MIME type *inside the URL prefix*,
 *   which the wrapper can parse without any inference. Replicate's docs explicitly recommend
 *   data URLs for files this size.
 *
 * Auth: still requires `X-Replicate-Token` so the caller is bound to a real Replicate account
 * (the token is forwarded on the actual `/v1/predictions` call, not used here).
 */
export async function POST(request: Request) {
  const token = readReplicateTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing Replicate token (header X-Replicate-Token)." },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    return NextResponse.json(
      {
        error: "Expected multipart/form-data with an `audio` file field.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }

  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json(
      { error: "Field `audio` must be a non-empty file." },
      { status: 400 },
    );
  }

  const filenameField = form.get("filename");
  const filename =
    typeof filenameField === "string" && filenameField.trim()
      ? filenameField.trim()
      : (file as File).name || undefined;

  if (file.size > MAX_DATA_URL_AUDIO_BYTES) {
    return NextResponse.json(
      {
        error: `Audio is ${(file.size / (1024 * 1024)).toFixed(2)} MB but the data-URL embed cap is ${(MAX_DATA_URL_AUDIO_BYTES / (1024 * 1024)).toFixed(0)} MB. Trim or compress the clip and retry.`,
      },
      { status: 413 },
    );
  }

  try {
    const built = await buildAudioDataUrl({ blob: file, filename });
    return NextResponse.json({
      url: built.url,
      contentType: built.contentType,
      size: built.size,
      filename: built.filename,
      /** Data URLs do not expire (they are inline). Kept for client UI parity. */
      expiresAt: null,
      mode: "data_url" as const,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to build audio data URL.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
