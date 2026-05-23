import { BAND_NAMES, type BandPowers, type BandName } from "@/lib/types";

/**
 * Compact, JSON-friendly EEG snapshot used as Replicate / Gemini input alongside an audio URL.
 * Keeps the payload small (no per-sample arrays) so it survives prompt limits while preserving
 * the time-aligned signal an LLM needs for music↔EEG correlation reasoning.
 */
export interface ResearchAiSnapshot {
  /** Wall-clock ms when the snapshot was sealed (`Date.now()`). */
  capturedAt: number;
  device: string | null;
  estimatedEegHz: number | null;
  packetCount: number;
  /** Latest absolute band powers (dB-like). May be null if no data has arrived. */
  bandsAbs: BandPowers | null;
  /** Latest relative band powers (0–1 share). */
  bandsRel: BandPowers | null;
  /** Up to N most recent {t, rel} samples — coarse trajectory for time alignment. */
  bandHistoryRel: { t: number; bands: BandPowers }[];
  /** Audio recording window (wall-clock ms), present when EEG was filtered to it. */
  audioWindow?: {
    startMs: number;
    endMs: number;
    durationMs: number;
    samplesInWindow: number;
  } | null;
  /** Computed simple ratios that often appear in music/EEG correlation studies. */
  derived: {
    thetaBeta: number | null;
    alphaTheta: number | null;
    engagement: number | null;
    fatigue: number | null;
    dominantBand: BandName | null;
  };
  motion?: {
    accelMag: number | null;
    gyroMag: number | null;
    ppgPresent: boolean;
  };
}

function safeMag(values: number[] | null | undefined): number | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v * v;
  return Math.sqrt(sum / values.length);
}

function ratio(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (b === 0) return null;
  return a / b;
}

export function buildResearchAiSnapshot(opts: {
  device: string | null;
  estimatedEegHz: number | null;
  packetCount: number;
  bandsAbs: BandPowers | null;
  bandsRel: BandPowers | null;
  bandHistory: { t: number; rel: BandPowers }[];
  motion?: { accel?: number[] | null; gyro?: number[] | null; ppg?: number[] | null };
  /** Audio recording window in wall-clock ms; when supplied we filter `bandHistory` to it. */
  audioWindow?: { startMs: number; endMs: number } | null;
}): ResearchAiSnapshot {
  const { bandsAbs, bandsRel, bandHistory, audioWindow } = opts;

  let windowed: { t: number; bands: BandPowers }[];
  let resolvedAudioWindow: ResearchAiSnapshot["audioWindow"] = null;
  if (audioWindow && audioWindow.endMs > audioWindow.startMs) {
    const inRange = bandHistory.filter(
      (entry) => entry.t >= audioWindow.startMs && entry.t <= audioWindow.endMs,
    );
    /** Cap to 64 samples evenly spaced — keeps prompt budget bounded for long recordings. */
    const capped = inRange.length <= 64
      ? inRange
      : (() => {
          const out: typeof inRange = [];
          const step = inRange.length / 64;
          for (let i = 0; i < 64; i += 1) {
            out.push(inRange[Math.floor(i * step)]!);
          }
          return out;
        })();
    windowed = capped.map((entry) => ({ t: entry.t, bands: { ...entry.rel } }));
    resolvedAudioWindow = {
      startMs: audioWindow.startMs,
      endMs: audioWindow.endMs,
      durationMs: audioWindow.endMs - audioWindow.startMs,
      samplesInWindow: inRange.length,
    };
  } else {
    windowed = bandHistory
      .slice(-32)
      .map((entry) => ({ t: entry.t, bands: { ...entry.rel } }));
  }

  let dominant: BandName | null = null;
  if (bandsRel) {
    let maxVal = -Infinity;
    for (const name of BAND_NAMES) {
      const v = bandsRel[name];
      if (typeof v === "number" && v > maxVal) {
        maxVal = v;
        dominant = name;
      }
    }
  }

  const theta = bandsAbs?.theta ?? bandsRel?.theta ?? null;
  const alpha = bandsAbs?.alpha ?? bandsRel?.alpha ?? null;
  const beta = bandsAbs?.beta ?? bandsRel?.beta ?? null;

  return {
    capturedAt: Date.now(),
    audioWindow: resolvedAudioWindow,
    device: opts.device,
    estimatedEegHz: opts.estimatedEegHz,
    packetCount: opts.packetCount,
    bandsAbs,
    bandsRel,
    bandHistoryRel: windowed,
    derived: {
      thetaBeta: ratio(theta, beta),
      alphaTheta: ratio(alpha, theta),
      engagement: theta != null && alpha != null && beta != null && theta + alpha !== 0
        ? beta / (alpha + theta)
        : null,
      fatigue: theta != null && alpha != null && beta != null && beta !== 0
        ? (theta + alpha) / beta
        : null,
      dominantBand: dominant,
    },
    motion: opts.motion
      ? {
          accelMag: safeMag(opts.motion.accel ?? null),
          gyroMag: safeMag(opts.motion.gyro ?? null),
          ppgPresent: Array.isArray(opts.motion.ppg) && opts.motion.ppg.length > 0,
        }
      : undefined,
  };
}

/**
 * Render the snapshot into a tight, model-friendly text block. Used inside the analysis prompt
 * so reasoning models can read structured EEG context next to the audio URL.
 */
export function snapshotAsPromptBlock(snapshot: ResearchAiSnapshot): string {
  const lines: string[] = [];
  lines.push("EEG snapshot (NeuroVis, time-aligned with audio):");
  lines.push(`  capturedAt: ${new Date(snapshot.capturedAt).toISOString()}`);
  if (snapshot.audioWindow) {
    lines.push(
      `  audioWindow: ${new Date(snapshot.audioWindow.startMs).toISOString()} → ${new Date(snapshot.audioWindow.endMs).toISOString()} (${(snapshot.audioWindow.durationMs / 1000).toFixed(2)}s)`,
    );
  }
  if (snapshot.device) lines.push(`  device: ${snapshot.device}`);
  if (snapshot.estimatedEegHz) lines.push(`  eegHz: ${snapshot.estimatedEegHz.toFixed(1)}`);
  lines.push(`  packetCount: ${snapshot.packetCount}`);
  if (snapshot.bandsRel) {
    const rel = snapshot.bandsRel;
    lines.push(
      `  bandsRel: delta=${(rel.delta ?? 0).toFixed(3)} theta=${(rel.theta ?? 0).toFixed(3)} alpha=${(rel.alpha ?? 0).toFixed(3)} beta=${(rel.beta ?? 0).toFixed(3)} gamma=${(rel.gamma ?? 0).toFixed(3)}`,
    );
  }
  if (snapshot.bandsAbs) {
    const abs = snapshot.bandsAbs;
    lines.push(
      `  bandsAbs(dB): delta=${(abs.delta ?? 0).toFixed(2)} theta=${(abs.theta ?? 0).toFixed(2)} alpha=${(abs.alpha ?? 0).toFixed(2)} beta=${(abs.beta ?? 0).toFixed(2)} gamma=${(abs.gamma ?? 0).toFixed(2)}`,
    );
  }
  const d = snapshot.derived;
  lines.push(
    `  derived: theta/beta=${d.thetaBeta?.toFixed(3) ?? "—"} alpha/theta=${d.alphaTheta?.toFixed(3) ?? "—"} engagement=${d.engagement?.toFixed(3) ?? "—"} fatigue=${d.fatigue?.toFixed(3) ?? "—"} dominant=${d.dominantBand ?? "—"}`,
  );
  if (snapshot.bandHistoryRel.length) {
    lines.push(
      `  bandHistoryRel (${snapshot.bandHistoryRel.length} samples, oldest→newest):`,
    );
    for (const entry of snapshot.bandHistoryRel) {
      const b = entry.bands;
      lines.push(
        `    t=${entry.t} d=${(b.delta ?? 0).toFixed(2)} t=${(b.theta ?? 0).toFixed(2)} a=${(b.alpha ?? 0).toFixed(2)} b=${(b.beta ?? 0).toFixed(2)} g=${(b.gamma ?? 0).toFixed(2)}`,
      );
    }
  }
  if (snapshot.motion) {
    lines.push(
      `  motion: accel=${snapshot.motion.accelMag?.toFixed(3) ?? "—"} gyro=${snapshot.motion.gyroMag?.toFixed(3) ?? "—"} ppg=${snapshot.motion.ppgPresent ? "present" : "—"}`,
    );
  }
  return lines.join("\n");
}
