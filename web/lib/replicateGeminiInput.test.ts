import { describe, expect, it } from "vitest";
import {
  buildGeminiInput,
  concatenateGeminiOutput,
} from "./replicateGeminiInput";

describe("buildGeminiInput", () => {
  it("requires a non-empty prompt", () => {
    expect(() => buildGeminiInput({ prompt: "" })).toThrow();
    expect(() => buildGeminiInput({ prompt: "   " })).toThrow();
  });

  it("returns ONLY the schema-valid keys (no audio_url, no eeg_snapshot)", () => {
    const input = buildGeminiInput({
      prompt: "analyze this",
      audioUrl: "https://replicate.delivery/x.webm",
      systemInstruction: "Be concise.",
      thinkingLevel: "low",
      temperature: 1,
      maxOutputTokens: 1024,
    });
    expect(Object.keys(input).sort()).toEqual([
      "audio",
      "max_output_tokens",
      "prompt",
      "system_instruction",
      "temperature",
      "thinking_level",
    ]);
    expect(input).not.toHaveProperty("audio_url");
    expect(input).not.toHaveProperty("eeg_snapshot");
  });

  it("omits empty / null / NaN optionals so the API never sees junk", () => {
    const input = buildGeminiInput({
      prompt: "hi",
      audioUrl: "   ",
      systemInstruction: "",
      thinkingLevel: undefined,
      temperature: NaN,
      topP: null,
      maxOutputTokens: null,
      images: [],
      videos: [],
    });
    expect(input).toEqual({ prompt: "hi" });
  });

  it("clamps temperature to [0, 2] and floors max_output_tokens", () => {
    const lo = buildGeminiInput({ prompt: "x", temperature: -5, maxOutputTokens: 100.7 });
    expect(lo.temperature).toBe(0);
    expect(lo.max_output_tokens).toBe(100);

    const hi = buildGeminiInput({ prompt: "x", temperature: 99 });
    expect(hi.temperature).toBe(2);
  });

  it("clamps top_p to [0, 1]", () => {
    expect(buildGeminiInput({ prompt: "x", topP: 5 }).top_p).toBe(1);
    expect(buildGeminiInput({ prompt: "x", topP: -1 }).top_p).toBe(0);
    expect(buildGeminiInput({ prompt: "x", topP: 0.7 }).top_p).toBe(0.7);
  });

  it("caps images and videos arrays at 10 each (matches Replicate model limits)", () => {
    const tooMany = Array.from({ length: 25 }, (_, i) => `https://x/${i}`);
    const input = buildGeminiInput({ prompt: "x", images: tooMany, videos: tooMany });
    expect(input.images).toHaveLength(10);
    expect(input.videos).toHaveLength(10);
  });
});

describe("concatenateGeminiOutput", () => {
  it("joins an array of strings with no separator (model README: concatenate)", () => {
    expect(concatenateGeminiOutput(["Hello, ", "world", "!"]))
      .toBe("Hello, world!");
  });

  it("returns a plain string unchanged for legacy single-string outputs", () => {
    expect(concatenateGeminiOutput("Hello")).toBe("Hello");
  });

  it("returns empty string for null/undefined", () => {
    expect(concatenateGeminiOutput(null)).toBe("");
    expect(concatenateGeminiOutput(undefined)).toBe("");
  });

  it("JSON-encodes non-string array elements rather than dropping them", () => {
    expect(concatenateGeminiOutput(["A", { x: 1 }, "B"])).toBe('A{"x":1}B');
  });
});
