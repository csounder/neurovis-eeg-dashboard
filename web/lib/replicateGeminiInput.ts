/**
 * Strict Replicate `google/gemini-3.5-flash` input builder.
 *
 * Schema (verified at https://replicate.com/google/gemini-3.5-flash, README + llms.txt):
 *   - prompt              (required, string)
 *   - audio               (optional, single string URL — Replicate-hosted file URL)
 *   - images              (optional, array of strings — up to 10, each ≤7 MB)
 *   - videos              (optional, array of strings — up to 10, each ≤45 minutes)
 *   - system_instruction  (optional, string)
 *   - thinking_level      (optional, "none" | "low" | "high")
 *   - temperature         (optional, 0–2)
 *   - top_p               (optional, 0–1)
 *   - max_output_tokens   (optional, integer)
 *
 * Output shape (model returns):
 *   `{ "type": "array", "items": { "type": "string" } }` — concatenate for display.
 */

export type GeminiThinkingLevel = "none" | "low" | "high";

export interface BuildGeminiInputArgs {
  prompt: string;
  audioUrl?: string | null;
  systemInstruction?: string | null;
  thinkingLevel?: GeminiThinkingLevel;
  temperature?: number | null;
  topP?: number | null;
  maxOutputTokens?: number | null;
  images?: string[] | null;
  videos?: string[] | null;
}

export type GeminiInput = {
  prompt: string;
  audio?: string;
  images?: string[];
  videos?: string[];
  system_instruction?: string;
  thinking_level?: GeminiThinkingLevel;
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Build a request payload that strictly conforms to the Replicate `google/gemini-3.5-flash`
 * schema. Empty / null / NaN optional fields are removed so the API does not see junk values.
 */
export function buildGeminiInput(args: BuildGeminiInputArgs): GeminiInput {
  const prompt = String(args.prompt ?? "").trim();
  if (!prompt) {
    throw new Error("buildGeminiInput: `prompt` is required and must be non-empty.");
  }
  const out: GeminiInput = { prompt };
  if (args.audioUrl && args.audioUrl.trim()) {
    out.audio = args.audioUrl.trim();
  }
  if (args.images && args.images.length > 0) {
    /** Replicate caps `images` at 10. */
    out.images = args.images.slice(0, 10);
  }
  if (args.videos && args.videos.length > 0) {
    /** Replicate caps `videos` at 10. */
    out.videos = args.videos.slice(0, 10);
  }
  if (args.systemInstruction && args.systemInstruction.trim()) {
    out.system_instruction = args.systemInstruction.trim();
  }
  if (args.thinkingLevel) {
    out.thinking_level = args.thinkingLevel;
  }
  if (args.temperature != null && Number.isFinite(args.temperature)) {
    out.temperature = clampNumber(args.temperature, 0, 2);
  }
  if (args.topP != null && Number.isFinite(args.topP)) {
    out.top_p = clampNumber(args.topP, 0, 1);
  }
  if (args.maxOutputTokens != null && Number.isFinite(args.maxOutputTokens)) {
    out.max_output_tokens = Math.max(1, Math.floor(args.maxOutputTokens));
  }
  return out;
}

/**
 * Concatenate the model's array-of-strings output for display, matching the README's
 * `x-cog-array-display: "concatenate"` directive. Tolerant of legacy single-string outputs.
 */
export function concatenateGeminiOutput(output: unknown): string {
  if (output == null) return "";
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    return output
      .map((piece) => (typeof piece === "string" ? piece : JSON.stringify(piece)))
      .join("");
  }
  if (typeof output === "object") {
    return JSON.stringify(output, null, 2);
  }
  return String(output);
}
