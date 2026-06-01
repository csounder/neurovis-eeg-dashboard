import { describe, expect, it } from "vitest";
import { blendConcertAudioLevel, eegBandAudioEnvelope } from "./concertAudioBlend";

const bands = {
  delta: 0.4,
  theta: 0.5,
  alpha: 0.6,
  beta: 0.35,
  gamma: 0.25,
};

describe("concertAudioBlend", () => {
  it("eeg mode ignores tap level", () => {
    const v = blendConcertAudioLevel(0.9, bands, [0.2, 0.2, 0.2, 0.2], 1, "eeg", true);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
    const silent = blendConcertAudioLevel(0.9, bands, [0.2, 0.2, 0.2, 0.2], 1, "eeg", false);
    expect(silent).toBe(0);
  });

  it("mic mode uses tap only", () => {
    expect(blendConcertAudioLevel(0.42, bands, [0, 0, 0, 0], 0, "mic", true)).toBe(0.42);
  });

  it("blend takes max of tap and eeg", () => {
    const tap = 0.1;
    const pseudo = eegBandAudioEnvelope(bands, [0.3, 0.3, 0.3, 0.3], 2);
    const blended = blendConcertAudioLevel(tap, bands, [0.3, 0.3, 0.3, 0.3], 2, "blend", true);
    expect(blended).toBe(Math.max(tap, pseudo));
  });
});
