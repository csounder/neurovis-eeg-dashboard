/**
 * Smoothed RMS from the browser Csound output (AnalyserNode).
 * Timer-driven so levels update even when `requestAnimationFrame` is throttled (background tabs,
 * some automation), keeping the concert canvas + Playwright probes consistent.
 */

let pollId: number | undefined;
let level = 0;

export function getConcertAudioLevel(): number {
  return level;
}

export function stopConcertAudioMeter(): void {
  if (pollId !== undefined) {
    window.clearInterval(pollId);
    pollId = undefined;
  }
  level = 0;
}

/** Call after `source.connect(analyser)` (tap only; analyser need not connect to destination). */
export function attachConcertAudioMeter(analyser: AnalyserNode): void {
  stopConcertAudioMeter();
  const buffer = new Float32Array(analyser.fftSize);
  let smooth = 0;

  const tick = () => {
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const s = buffer[i] ?? 0;
      sum += s * s;
    }
    const rms = Math.sqrt(sum / buffer.length);
    const inst = Math.min(1, rms * 5.5);
    smooth = smooth * 0.88 + inst * 0.12;
    level = smooth;
  };
  tick();
  pollId = window.setInterval(tick, 32) as number;
}
