import type { BandName, BandPowers } from "@/lib/types";

export type BandVector = Record<BandName, number>;

/** Drive AR scenes from EEG bands when live/sim (no audio tap). */
export function eegBandAudioEnvelope(
  bands: BandVector,
  channels: number[],
  t: number,
): number {
  const meanBand =
    (bands.delta + bands.theta + bands.alpha + bands.beta + bands.gamma) / 5;
  const ch = (channels[0] + channels[1] + channels[2] + channels[3]) / 4;
  const wobble = Math.sin(t * 5.5 + meanBand * 8) * 0.07;
  return clamp(0.14 + meanBand * 0.52 + ch * 0.3 + wobble, 0, 1);
}

export type ConcertAudioReactiveMode = "eeg" | "mic" | "wasm" | "blend";

/** Tap level from mic/WASM according to mode (before EEG crossfade). */
export function concertAudioTapLevel(
  tapLevel: number,
  mode: ConcertAudioReactiveMode,
): number {
  switch (mode) {
    case "eeg":
      return 0;
    case "mic":
    case "wasm":
      return tapLevel;
    case "blend":
      return tapLevel;
    default:
      return tapLevel;
  }
}

/**
 * AR scene drive: blend audio tap (mic/WASM) with EEG band envelope.
 * @param audioMix 0 = EEG only, 1 = audio tap only (mode still picks which tap).
 */
export function blendConcertAudioLevel(
  tapLevel: number,
  bands: BandVector,
  channels: number[],
  t: number,
  mode: ConcertAudioReactiveMode,
  eegReactive: boolean,
  audioMix = 0.5,
): number {
  const pseudo = eegReactive ? eegBandAudioEnvelope(bands, channels, t) : 0;
  const tap = concertAudioTapLevel(tapLevel, mode);
  const mix = clamp(audioMix, 0, 1);
  if (mode === "eeg") return pseudo;
  return clamp(mix * tap + (1 - mix) * pseudo, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
