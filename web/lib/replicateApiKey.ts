/**
 * Replicate personal API token (`r8_...`) lives in `localStorage` only — it never persists in the
 * Next server, never ships to the bridge, and never enters the bundle. Server proxy routes accept
 * it via `X-Replicate-Token` per request so we can keep the key out of `.env`.
 */
export const REPLICATE_TOKEN_LS_KEY = "neurovis.replicate.apiToken" as const;

/** Local default for the Replicate model the Research page calls into. User-editable. */
export const REPLICATE_MODEL_LS_KEY = "neurovis.replicate.model" as const;

export const DEFAULT_REPLICATE_MODEL = "google/gemini-3.5-flash" as const;

export function readReplicateToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REPLICATE_TOKEN_LS_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeReplicateToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = token.trim();
    if (trimmed) {
      window.localStorage.setItem(REPLICATE_TOKEN_LS_KEY, trimmed);
    } else {
      window.localStorage.removeItem(REPLICATE_TOKEN_LS_KEY);
    }
  } catch {
    /* private mode / quota — silently skip */
  }
}

export function readReplicateModel(): string {
  if (typeof window === "undefined") return DEFAULT_REPLICATE_MODEL;
  try {
    return (
      window.localStorage.getItem(REPLICATE_MODEL_LS_KEY)?.trim() ||
      DEFAULT_REPLICATE_MODEL
    );
  } catch {
    return DEFAULT_REPLICATE_MODEL;
  }
}

export function writeReplicateModel(model: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = model.trim();
    if (trimmed && trimmed !== DEFAULT_REPLICATE_MODEL) {
      window.localStorage.setItem(REPLICATE_MODEL_LS_KEY, trimmed);
    } else {
      window.localStorage.removeItem(REPLICATE_MODEL_LS_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Token must look like a Replicate token (`r8_...`); UI shows a hint without revealing the value. */
export function looksLikeReplicateToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) return false;
  if (trimmed.length < 20) return false;
  return /^r8_[A-Za-z0-9_-]{16,}$/.test(trimmed) || /^[A-Za-z0-9_-]{20,}$/.test(trimmed);
}

export function maskReplicateToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 10) return "•".repeat(trimmed.length);
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}
