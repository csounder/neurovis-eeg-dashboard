import type { CsoundObj } from "@csound/browser";
import { attachConcertAudioMeter } from "@/lib/concertAudioMeter";

/**
 * Connect Csound's output for hearing + optional RMS tap.
 * Always use a **direct** `node → destination` path for playback. The meter uses a parallel branch:
 * `node → analyser → gain(0) → destination` so Chrome pulls the analyser (orphan analysers often
 * stay zero in `getFloatTimeDomainData`). Playback stays unchanged vs `node → destination` alone.
 */
function connectCsoundOutputGraph(
  node: AudioNode,
  audioContext: AudioContext,
  concertMeter: boolean,
): void {
  node.connect(audioContext.destination);
  if (concertMeter) {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.55;
    node.connect(analyser);
    const silent = audioContext.createGain();
    silent.gain.value = 0;
    analyser.connect(silent).connect(audioContext.destination);
    attachConcertAudioMeter(analyser);
  }
}

/**
 * With `autoConnect: false`, the Csound AudioWorkletNode is not connected until we
 * attach it. Wiring **before** `csound.start()` avoids engines that begin realtime
 * performance with no-pull / silent output when the graph is rewired only after start.
 */
export async function wireCsoundBeforeStart(
  csound: CsoundObj,
  log: (line: string) => void,
  opts: { concertMeter: boolean; logLabel: string },
): Promise<AudioContext | null> {
  const maxAttempts = 20;
  const pauseMs = 60;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
    try {
      const [node, audioContext] = await Promise.all([
        csound.getNode(),
        csound.getAudioContext(),
      ]);
      if (!node || !audioContext) {
        continue;
      }

      connectCsoundOutputGraph(node, audioContext, opts.concertMeter);

      await audioContext.resume().catch(() => {});

      const chain = opts.concertMeter
        ? "node → destination (playback) + node → analyser → gain(0) → destination (meter pull)"
        : "node → destination";
      log(
        attempt > 0
          ? `${opts.logLabel}: ${chain} before start() (attempt ${attempt + 1}).`
          : `${opts.logLabel}: ${chain} before start() (explicit graph, autoConnect off).`,
      );
      return audioContext;
    } catch (err) {
      if (attempt === maxAttempts - 1) {
        log(`${opts.logLabel} wiring failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return null;
}

/**
 * `@csound/browser` finishes hooking realtime output inside `start()`. If the worklet only begins
 * pulling the graph after that point, a **pre-start** connection can end up silent in some Chrome
 * builds. Rewire **outgoing** links once performance has started (microphone inputs use the node's
 * *inputs* and are unaffected by `disconnect()` on outputs).
 */
export async function rewireCsoundAfterStart(
  csound: CsoundObj,
  log: (line: string) => void,
  opts: { concertMeter: boolean; logLabel: string },
): Promise<AudioContext | null> {
  try {
    const [node, audioContext] = await Promise.all([csound.getNode(), csound.getAudioContext()]);
    if (!node || !audioContext) {
      log(`${opts.logLabel} post-start rewire skipped: missing node or context.`);
      return null;
    }
    try {
      node.disconnect();
    } catch {
      /* no outgoing edges */
    }
    connectCsoundOutputGraph(node, audioContext, opts.concertMeter);
    await audioContext.resume().catch(() => {});
    const chain = opts.concertMeter
      ? "node → destination (playback) + node → analyser → gain(0) → destination (meter pull)"
      : "node → destination";
    log(`${opts.logLabel}: ${chain} after start() (output rewired).`);
    return audioContext;
  } catch (err) {
    log(`${opts.logLabel} post-start rewire failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
