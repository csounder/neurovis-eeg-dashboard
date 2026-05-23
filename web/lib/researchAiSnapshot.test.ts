import { describe, expect, it } from "vitest";
import {
  buildResearchAiSnapshot,
  snapshotAsPromptBlock,
} from "./researchAiSnapshot";
import type { BandPowers } from "./types";

const bands = (
  delta: number,
  theta: number,
  alpha: number,
  beta: number,
  gamma: number,
): BandPowers => ({ delta, theta, alpha, beta, gamma });

describe("buildResearchAiSnapshot", () => {
  it("falls back to last-32 history and reports null audioWindow when no window is provided", () => {
    const history = Array.from({ length: 50 }, (_, i) => ({
      t: 1_000 + i * 100,
      rel: bands(0.1, 0.2, 0.3, 0.25, 0.15),
    }));
    const snap = buildResearchAiSnapshot({
      device: "Muse-33C1",
      estimatedEegHz: 250,
      packetCount: 999,
      bandsAbs: bands(1, 2, 3, 4, 5),
      bandsRel: bands(0.1, 0.2, 0.3, 0.25, 0.15),
      bandHistory: history,
    });
    expect(snap.audioWindow).toBeNull();
    expect(snap.bandHistoryRel).toHaveLength(32);
    expect(snap.bandHistoryRel[0]?.t).toBe(history[history.length - 32]?.t);
    expect(snap.derived.dominantBand).toBe("alpha");
    expect(snap.derived.thetaBeta).toBeCloseTo(2 / 4, 6);
    expect(snap.derived.alphaTheta).toBeCloseTo(3 / 2, 6);
  });

  it("filters bandHistory strictly to the audio window, keeps boundaries, and reports samplesInWindow", () => {
    const history = [
      { t: 1_000, rel: bands(0.1, 0.1, 0.1, 0.1, 0.1) },
      { t: 2_000, rel: bands(0.2, 0.2, 0.2, 0.2, 0.2) },
      { t: 3_000, rel: bands(0.3, 0.3, 0.3, 0.3, 0.3) },
      { t: 4_000, rel: bands(0.4, 0.4, 0.4, 0.4, 0.4) },
      { t: 5_000, rel: bands(0.5, 0.5, 0.5, 0.5, 0.5) },
    ];
    const snap = buildResearchAiSnapshot({
      device: null,
      estimatedEegHz: null,
      packetCount: 0,
      bandsAbs: null,
      bandsRel: null,
      bandHistory: history,
      audioWindow: { startMs: 2_000, endMs: 4_000 },
    });
    expect(snap.audioWindow).toEqual({
      startMs: 2_000,
      endMs: 4_000,
      durationMs: 2_000,
      samplesInWindow: 3,
    });
    expect(snap.bandHistoryRel.map((s) => s.t)).toEqual([2_000, 3_000, 4_000]);
  });

  it("downsamples to 64 samples when an audio window contains more", () => {
    const history = Array.from({ length: 500 }, (_, i) => ({
      t: 10_000 + i,
      rel: bands(0, 0, 0, 0, 0),
    }));
    const snap = buildResearchAiSnapshot({
      device: null,
      estimatedEegHz: null,
      packetCount: 0,
      bandsAbs: null,
      bandsRel: null,
      bandHistory: history,
      audioWindow: { startMs: 10_000, endMs: 10_499 },
    });
    expect(snap.bandHistoryRel).toHaveLength(64);
    expect(snap.audioWindow?.samplesInWindow).toBe(500);
  });

  it("returns null derived ratios when input bands are missing or zero", () => {
    const snap = buildResearchAiSnapshot({
      device: null,
      estimatedEegHz: null,
      packetCount: 0,
      bandsAbs: null,
      bandsRel: null,
      bandHistory: [],
    });
    expect(snap.derived.thetaBeta).toBeNull();
    expect(snap.derived.engagement).toBeNull();
    expect(snap.derived.dominantBand).toBeNull();
    expect(snap.bandHistoryRel).toHaveLength(0);
  });

  it("computes accel/gyro magnitudes and ppg presence when motion is supplied", () => {
    const snap = buildResearchAiSnapshot({
      device: null,
      estimatedEegHz: null,
      packetCount: 0,
      bandsAbs: null,
      bandsRel: null,
      bandHistory: [],
      motion: { accel: [3, 4, 0], gyro: null, ppg: [12, 15] },
    });
    expect(snap.motion?.accelMag).toBeCloseTo(Math.sqrt((9 + 16) / 3), 6);
    expect(snap.motion?.gyroMag).toBeNull();
    expect(snap.motion?.ppgPresent).toBe(true);
  });

  it("mirrors window metadata and sample lines into the prompt block", () => {
    const snap = buildResearchAiSnapshot({
      device: "Muse-S",
      estimatedEegHz: 256,
      packetCount: 12,
      bandsAbs: bands(1, 2, 3, 4, 5),
      bandsRel: bands(0.1, 0.2, 0.3, 0.25, 0.15),
      bandHistory: [
        { t: 100, rel: bands(0.1, 0.1, 0.1, 0.1, 0.1) },
        { t: 200, rel: bands(0.2, 0.2, 0.2, 0.2, 0.2) },
      ],
      audioWindow: { startMs: 100, endMs: 200 },
    });
    const text = snapshotAsPromptBlock(snap);
    expect(text).toMatch(/audioWindow:.*0\.10s/);
    expect(text).toMatch(/Muse-S/);
    expect(text).toMatch(/eegHz: 256\.0/);
    expect(text).toMatch(/bandHistoryRel \(2 samples/);
  });
});
