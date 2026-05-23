/**
 * Server-only helpers for talking to Replicate. Routes forward the user's per-request
 * `X-Replicate-Token` header. We deliberately do NOT cache or persist the token so the
 * Next server stays stateless about user secrets.
 */
import "server-only";
import {
  alignFilenameToMime,
  canonicalAudioMime,
} from "@/lib/replicateAudioMime";

/** Re-exported here so existing server-side callers keep importing from the same module. */
export {
  alignFilenameToMime,
  canonicalAudioMime,
  extensionForAudioMime,
} from "@/lib/replicateAudioMime";

export const REPLICATE_API_BASE = "https://api.replicate.com/v1";

export class ReplicateClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "ReplicateClientError";
  }
}

/**
 * Read the token from the request. We accept either the canonical NeuroVis header
 * (`x-replicate-token`) or a fallback `authorization: Bearer …` for cURL convenience.
 * Server `.env` is intentionally NOT consulted: this is a personal-key tool by design.
 */
export function readReplicateTokenFromRequest(req: Request): string | null {
  const direct = req.headers.get("x-replicate-token");
  if (direct && direct.trim()) return direct.trim();
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = /^bearer\s+(.+)$/i.exec(auth.trim());
    if (m && m[1]) return m[1].trim();
    const tok = /^token\s+(.+)$/i.exec(auth.trim());
    if (tok && tok[1]) return tok[1].trim();
  }
  return null;
}

export async function replicateFetchJson<T = unknown>(
  path: string,
  init: RequestInit & { token: string },
): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${REPLICATE_API_BASE}${path}`, {
    ...rest,
    headers: {
      /** Replicate accepts both "Bearer" and "Token"; "Bearer" is the current docs default. */
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* leave as raw text */
  }
  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? (body as { detail?: unknown }).detail
        : body;
    throw new ReplicateClientError(
      typeof detail === "string"
        ? detail
        : `Replicate ${res.status} ${res.statusText}`,
      res.status,
      body,
    );
  }
  return body as T;
}

export interface ReplicateFileUploadResponse {
  id: string;
  name?: string;
  content_type?: string;
  size?: number;
  urls: { get: string };
  expires_at?: string;
}

export async function uploadAudioToReplicate(opts: {
  token: string;
  blob: Blob;
  filename?: string;
}): Promise<ReplicateFileUploadResponse> {
  /**
   * Wrap the incoming blob in a new Blob whose `type` is the canonical Gemini-friendly MIME
   * (no codec params). `new Blob([blob], {type})` does NOT copy bytes — it just rewrites the
   * MIME metadata. This is what makes Replicate store `audio/webm` instead of
   * `audio/webm;codecs=opus`, which is what was triggering the Python wrapper's
   * `ValueError: Unknown mime type` failure.
   */
  const cleanMime = canonicalAudioMime(opts.blob.type);
  const cleanedBlob =
    opts.blob.type === cleanMime ? opts.blob : new Blob([opts.blob], { type: cleanMime });
  const cleanedFilename = alignFilenameToMime(
    opts.filename ?? "neurovis-audio",
    cleanMime,
  );

  const form = new FormData();
  /**
   * Replicate Files API expects exactly one binary part named `content`. The blob's
   * `Content-Type` is forwarded by the runtime as the multipart `Content-Type` for that part
   * — do not send a separate `type` field; some deployments reject it. The filename is the
   * third argument so the part header carries `filename="..."` matching the canonical MIME.
   */
  form.append("content", cleanedBlob, cleanedFilename);

  const res = await fetch(`${REPLICATE_API_BASE}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      Accept: "application/json",
    },
    body: form,
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw */
  }
  if (!res.ok) {
    throw new ReplicateClientError(
      `Replicate file upload ${res.status} ${res.statusText}`,
      res.status,
      body,
    );
  }
  const out = body as ReplicateFileUploadResponse;
  if (!out?.urls?.get) {
    throw new ReplicateClientError(
      "Replicate file upload returned no public URL",
      500,
      body,
    );
  }
  return out;
}

export interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string | null;
  logs?: string | null;
  created_at?: string;
  completed_at?: string | null;
  urls?: { get?: string; cancel?: string; stream?: string };
  model?: string;
  version?: string;
  metrics?: Record<string, unknown>;
}

/**
 * Create a prediction against a stable model identifier (`owner/name`). We use the model-scoped
 * endpoint so the user does not have to look up version IDs. Caller passes a free-form `input`
 * object; Replicate validates against the model schema.
 */
export async function createReplicatePrediction(opts: {
  token: string;
  model: string;
  input: Record<string, unknown>;
  webhook?: string;
  webhookEventsFilter?: ("start" | "output" | "logs" | "completed")[];
}): Promise<ReplicatePrediction> {
  const [owner, name] = opts.model.split("/");
  if (!owner || !name) {
    throw new ReplicateClientError(
      `Replicate model id "${opts.model}" must look like "owner/name".`,
      400,
    );
  }
  return replicateFetchJson<ReplicatePrediction>(
    `/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`,
    {
      token: opts.token,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: opts.input,
        webhook: opts.webhook,
        webhook_events_filter: opts.webhookEventsFilter,
      }),
    },
  );
}

export async function getReplicatePrediction(opts: {
  token: string;
  id: string;
}): Promise<ReplicatePrediction> {
  return replicateFetchJson<ReplicatePrediction>(
    `/predictions/${encodeURIComponent(opts.id)}`,
    { token: opts.token, method: "GET" },
  );
}

export async function cancelReplicatePrediction(opts: {
  token: string;
  id: string;
}): Promise<ReplicatePrediction> {
  return replicateFetchJson<ReplicatePrediction>(
    `/predictions/${encodeURIComponent(opts.id)}/cancel`,
    { token: opts.token, method: "POST" },
  );
}
