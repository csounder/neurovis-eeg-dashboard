/**
 * Mind Monitor / MuseIO-style four-float payloads for `/elements/{band}_*`.
 * Shared by server-enhanced.js (live Muse) and web/lib/bandOscChannels.ts (simulator).
 */

const OSC_BANDS = ["delta", "theta", "alpha", "beta", "gamma"];

/**
 * Absolute band power in the same numeric range as the browser/server simulator
 * (−10 … +6 dB-ish). Csound instruments calibrated against the simulator expect this.
 */
function oscAbsoluteFromRelative(relative, band) {
  const r = Number(relative?.[band]);
  if (!Number.isFinite(r)) return 0;
  return -10 + r * 20;
}

/** Map all bands to simulator-calibrated absolute OSC scalars. */
function oscAbsoluteMap(relative) {
  const out = {};
  for (const b of OSC_BANDS) {
    out[b] = oscAbsoluteFromRelative(relative, b);
  }
  return out;
}

function elementsBandAbsoluteArgs(band, absolute, trace) {
  const base = Number(absolute?.[band]) || 0;
  if (!trace || trace.length < 4) {
    return [base, base, base, base];
  }
  return trace.map((v) => base + 15 * Math.tanh(Number(v) / 30));
}

/**
 * Four TP9/AF7/AF8/TP10 floats for `/elements/{band}_absolute` (Mind Monitor "ffff").
 * Uses native Muse/Mind Monitor absolute scalars — not simulator remapping.
 */
function elementsBandAbsoluteArgsFromChannels(
  band,
  relative,
  perChannelAbs,
  trace,
  absolute,
) {
  const scalar = Number(absolute?.[band]);
  const fallback = Number.isFinite(scalar) ? scalar : 0;
  if (Array.isArray(perChannelAbs) && perChannelAbs.length >= 4) {
    return perChannelAbs.slice(0, 4).map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    });
  }
  return elementsBandAbsoluteArgs(band, { [band]: fallback }, trace);
}

function elementsBandRelativeArgs(band, relative, trace) {
  const rb = Number(relative?.[band]) || 0;
  if (!trace || trace.length < 4) {
    const q = rb / 4;
    return [q, q, q, q];
  }
  const e = trace.map((x) => Number(x) * Number(x) + 1e-12);
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => (x / s) * rb);
}

function oscFloatArgs(values) {
  return values.map((v) => ({
    type: "f",
    value: Number.isFinite(Number(v)) ? Number(v) : 0,
  }));
}

module.exports = {
  OSC_BANDS,
  oscAbsoluteFromRelative,
  oscAbsoluteMap,
  elementsBandAbsoluteArgs,
  elementsBandAbsoluteArgsFromChannels,
  elementsBandRelativeArgs,
  oscFloatArgs,
};
