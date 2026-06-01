import type { BandName } from "@/lib/types";

export type BandVector = Record<BandName, number>;

export const BAND_COLORS: Record<BandName, [number, number, number]> = {
  delta: [80, 155, 255],
  theta: [165, 120, 255],
  alpha: [45, 225, 160],
  beta: [255, 180, 60],
  gamma: [255, 90, 185],
};

export const BAND_ORDER: BandName[] = ["delta", "theta", "alpha", "beta", "gamma"];

export type ConcertParticle = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  band: number;
  z?: number;
};

export type BrainDrawOpts = {
  cx: number;
  cy: number;
  scale: number;
  t: number;
  rotY?: number;
  rotX?: number;
  /**
   * `none` — draw nothing (use for brain-art scenes; each has its own look).
   * `outline` — faint static cortical wire only (data-art backdrop).
   */
  silhouette?: "none" | "outline";
  wireAlpha?: number;
};

/** Slow, smooth motion for brain / data-art concert scenes (audience-safe). */
export const CONCERT_ART_CALM = {
  phaseScale: 0.16,
  motionScale: 0.4,
  audioScale: 0.34,
  envelopeAlpha: 0.055,
} as const;

export function smoothToward(prev: number, next: number, alpha: number) {
  return prev + (next - prev) * alpha;
}

export function smoothBandVector(prev: BandVector, next: BandVector, alpha: number): BandVector {
  return BAND_ORDER.reduce((acc, band) => {
    acc[band] = smoothToward(prev[band], next[band], alpha);
    return acc;
  }, {} as BandVector);
}

export function calmArtTime(t: number, audio: number) {
  return t * (CONCERT_ART_CALM.phaseScale + audio * 0.1);
}

export function calmArtMotion(intensity: number, audio: number) {
  return intensity * (CONCERT_ART_CALM.motionScale + audio * 0.22);
}

export function calmArtAudio(audio: number) {
  return audio * CONCERT_ART_CALM.audioScale;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function rgba([r, g, b]: [number, number, number], a: number) {
  return `rgba(${r}, ${g}, ${b}, ${clamp(a, 0, 1)})`;
}

export function project3d(
  x: number,
  y: number,
  z: number,
  rotX: number,
  rotY: number,
  scale: number,
  cx: number,
  cy: number,
) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y1 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;
  // Keep depth in a stable range — huge pixel-space y/z used to blow up to max depth (laser spikes).
  const denom = clamp(1.9 - z2 * 0.42, 0.45, 3.5);
  const depth = clamp(1 / denom, 0.25, 2.2);
  return {
    x2: cx + x1 * scale * depth,
    y2: cy + y1 * scale * depth,
    depth: clamp(depth, 0.35, 1.85),
    z2,
  };
}

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  const rad = Math.min(r * 3.5, 120);
  if (!Number.isFinite(rad) || rad <= 0) return;
  try {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color);
    g.addColorStop(0.45, color.replace(/[\d.]+\)$/u, "0.18)"));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  } catch {
    // Canvas rejects non-finite gradient params during resize / bad band samples.
  }
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Parametric cortical silhouette (side-ish view), returns 2D points in brain-local space. */
export function brainOutlinePoints(
  scale: number,
  t: number,
  bands: BandVector,
  channels: number[],
  intensity: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 200; i += 1) {
    const a = (i / 200) * Math.PI * 2;
    const ripple =
      Math.sin(a * 7 + t * (0.18 + bands.beta * 0.25)) * scale * 0.012 * intensity +
      Math.sin(a * 13 - t * 0.12) * scale * 0.006;
    const lobe =
      1 +
      Math.sin(a * 2 - 0.8) * 0.12 +
      Math.cos(a * 3 + 0.6) * 0.08 +
      channels[i % 4] * 0.09;
    const x = Math.cos(a) * (scale * lobe + ripple) * 1.05;
    const y = Math.sin(a) * (scale * 0.72 * lobe + ripple) * 0.92;
    pts.push({ x, y });
  }
  return pts;
}

/** Optional cortical outline — not a pulsing center blob. Brain-art scenes use `silhouette: "none"`. */
export function drawStylizedBrain(
  ctx: CanvasRenderingContext2D,
  bands: BandVector,
  channels: number[],
  intensity: number,
  _audio: number,
  opts: BrainDrawOpts,
) {
  if ((opts.silhouette ?? "none") !== "outline") return;

  const { cx, cy, scale, t } = opts;
  const rotY = opts.rotY ?? t * 0.035;
  const rotX = opts.rotX ?? -0.18;
  const outline = brainOutlinePoints(scale, t, bands, channels, intensity * 0.45);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = "source-over";

  ctx.beginPath();
  for (let i = 0; i < outline.length; i += 1) {
    const p = outline[i];
    const nx = p.x / scale;
    const ny = p.y / scale;
    const pr = project3d(nx, ny, 0, rotX, rotY, scale, 0, 0);
    const x = Number.isFinite(pr.x2) ? pr.x2 : nx * scale;
    const y = Number.isFinite(pr.y2) ? pr.y2 : ny * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const alpha = opts.wireAlpha ?? 0.1;
  ctx.strokeStyle = `rgba(90, 140, 175, ${alpha + bands.alpha * 0.05})`;
  ctx.lineWidth = 0.85;
  ctx.stroke();

  ctx.restore();
}

export function makeParticles(count: number): ConcertParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * 1600,
    y: Math.random() * 900,
    angle: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 1.8,
    size: 0.8 + Math.random() * 2.8,
    band: i % BAND_ORDER.length,
    z: Math.random() * 2 - 1,
  }));
}
