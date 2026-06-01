import { computePSD } from "@/lib/fft";

export type SpectrumFrame = {
  freqs: Float64Array;
  psdDb: Float64Array;
} | null;

export function computeConcertSpectrum(
  rollingRaw: number[][] | null | undefined,
  sampleRate: number,
  channel = 0,
): SpectrumFrame {
  const buf = rollingRaw?.[channel];
  if (!buf || buf.length < 64 || sampleRate <= 0) return null;
  return computePSD(buf, sampleRate, { targetN: 256, minFreq: 0, maxFreq: 50, window: "hamming" });
}
