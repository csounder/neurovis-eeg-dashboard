import type { BandName } from "@/lib/types";
import {
  BAND_COLORS,
  BAND_ORDER,
  type BandVector,
  type ConcertParticle,
  dot,
  project3d,
  rgba,
} from "@/lib/concert/concertDrawKit";

type DrawArgs = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  bands: BandVector;
  channels: number[];
  particles: ConcertParticle[];
  t: number;
  intensity: number;
  audio: number;
};

export const CONCERT_BRAIN_ART_SCENES = [
  { id: "axonParticleStorm" as const, title: "Axon Particle Storm", subtitle: "EEG + audio · axon streams erupt from an activating cortex." },
  { id: "neuralStreamCascade" as const, title: "Neural Stream Cascade", subtitle: "EEG + audio · ribbon currents pour through a lit brain." },
  { id: "synapseFineWeb" as const, title: "Synapse Fine Web", subtitle: "EEG + audio · hairline synaptic mesh over responding tissue." },
  { id: "helixDnaPulse" as const, title: "Helix DNA Pulse", subtitle: "EEG + audio · twin helices orbit an activating silhouette." },
  { id: "spiralGalaxyMind" as const, title: "Spiral Galaxy Mind", subtitle: "EEG + audio · galactic arms cradle a glowing brain core." },
  { id: "neuronForest3d" as const, title: "Neuron Forest 3D", subtitle: "EEG + audio · dendritic trees pulse with band-colored somas." },
  { id: "synapticPulseField" as const, title: "Synaptic Pulse Field", subtitle: "EEG + audio · field of firing synapses around cortex." },
  { id: "corticalParticleVeil" as const, title: "Cortical Particle Veil", subtitle: "EEG + audio · particle veil shimmers on brain surface." },
  { id: "microgliaSparkSea" as const, title: "Microglia Spark Sea", subtitle: "EEG + audio · glittering sea with deep brain beacon." },
  { id: "activatedConnectome3d" as const, title: "Activated Connectome", subtitle: "EEG + audio · 3D graph lights pathways on cortex." },
];

export type ConcertBrainArtSceneId = (typeof CONCERT_BRAIN_ART_SCENES)[number]["id"];

export function drawConcertBrainArtScene(
  id: ConcertBrainArtSceneId,
  args: DrawArgs,
): void {
  const fns: Record<ConcertBrainArtSceneId, (a: DrawArgs) => void> = {
    axonParticleStorm: drawAxonParticleStorm,
    neuralStreamCascade: drawNeuralStreamCascade,
    synapseFineWeb: drawSynapseFineWeb,
    helixDnaPulse: drawHelixDnaPulse,
    spiralGalaxyMind: drawSpiralGalaxyMind,
    neuronForest3d: drawNeuronForest3d,
    synapticPulseField: drawSynapticPulseField,
    corticalParticleVeil: drawCorticalParticleVeil,
    microgliaSparkSea: drawMicrogliaSparkSea,
    activatedConnectome3d: drawActivatedConnectome3d,
  };
  fns[id](args);
}

function drawAxonParticleStorm({ ctx, w, h, bands, channels, particles, t, intensity, audio }: DrawArgs) {
  const cx = w / 2;
  const cy = h * 0.5;
  const scale = Math.min(w, h) * 0.32;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const speed = 0.25 + bands.gamma * 1.4 + audio * 1.8;
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];
    const band = BAND_ORDER[p.band];
    const hubAngle = (i / particles.length) * Math.PI * 2;
    const hx = cx + Math.cos(hubAngle) * scale * 0.35;
    const hy = cy + Math.sin(hubAngle) * scale * 0.25;
    p.x += (hx - p.x) * 0.02 + Math.cos(p.angle + t * 0.2) * speed * p.speed;
    p.y += (hy - p.y) * 0.02 + Math.sin(p.angle + t * 0.17) * speed * p.speed;
    p.angle += (bands[band] - 0.35) * 0.02;
    if (p.x < -40) p.x = w + 40;
    if (p.x > w + 40) p.x = -40;
    if (p.y < -40) p.y = h + 40;
    if (p.y > h + 40) p.y = -40;
    dot(ctx, p.x, p.y, p.size * (1.2 + bands[band] * 3 + audio * 4), rgba(BAND_COLORS[band], 0.2 + bands[band] * 0.7));
    if (i % 5 === 0) {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = rgba(BAND_COLORS[band], 0.08 + bands[band] * 0.35);
      ctx.lineWidth = 0.4 + audio * 1.2;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawNeuralStreamCascade({ ctx, w, h, bands, channels, t, intensity, audio }: DrawArgs) {
  const cx = w / 2;
  const cy = h * 0.48;
  const scale = Math.min(w, h) * 0.3;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const streams = 24;
  for (let s = 0; s < streams; s += 1) {
    const band = BAND_ORDER[s % BAND_ORDER.length];
    const side = s % 2 === 0 ? -1 : 1;
    ctx.beginPath();
    for (let u = 0; u <= 1; u += 0.02) {
      const y = h * (0.05 + u * 0.9);
      const sway =
        Math.sin(u * 12 + t * (0.4 + bands[band]) + s) * (40 + bands[band] * 120 + audio * 140) * intensity;
      const x = cx + side * (scale * 0.9 + u * w * 0.22) + sway + channels[s % 4] * 30;
      if (u === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const g = ctx.createLinearGradient(cx - w * 0.3, 0, cx + w * 0.3, h);
    g.addColorStop(0, rgba(BAND_COLORS[band], 0.02));
    g.addColorStop(0.35, rgba(BAND_COLORS[band], 0.25 + bands[band] * 0.45));
    g.addColorStop(1, rgba(BAND_COLORS[band], 0.04));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.2 + bands[band] * 3.5 + audio * 4;
    ctx.shadowBlur = 0;
    ctx.shadowColor = rgba(BAND_COLORS[band], 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSynapseFineWeb({ ctx, w, h, bands, channels, t, intensity, audio }: DrawArgs) {
  if (!(w > 1 && h > 1) || !Number.isFinite(t)) return;
  const cx = w / 2;
  const cy = h * 0.5;
  const scale = Math.min(w, h) * 0.34;
  if (!Number.isFinite(scale) || scale <= 0) return;

  const nodes: { x: number; y: number; b: number }[] = [];
  const n = 48;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + t * 0.05;
    const r = scale * (0.55 + (i % 7) * 0.04 + bands[BAND_ORDER[i % 5]] * 0.2);
    nodes.push({
      x: cx + Math.cos(a) * r * 1.15,
      y: cy + Math.sin(a * 1.08) * r * 0.78,
      b: i % 5,
    });
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 3) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < scale * 0.95 + audio * 80) {
        const band = BAND_ORDER[(a.b + b.b) % BAND_ORDER.length];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = rgba(BAND_COLORS[band], (1 - d / (scale * 1.4)) * (0.06 + bands[band] * 0.42 + audio * 0.25));
        ctx.lineWidth = 0.25 + bands[band] * 0.9;
        ctx.stroke();
      }
    }
  }
  for (const p of nodes) {
    const band = BAND_ORDER[p.b];
    dot(ctx, p.x, p.y, 1.2 + bands[band] * 4 + channels[p.b] * 3, rgba(BAND_COLORS[band], 0.35 + bands[band] * 0.5));
  }
  ctx.restore();
}

function drawHelixDnaPulse({ ctx, w, h, bands, channels, t, intensity, audio }: DrawArgs) {
  const cx = w / 2;
  const cy = h * 0.5;
  const scale = Math.min(w, h) * 0.28;

  const rotY = t * 0.12;
  const helixH = scale * 2.4;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let strand = 0; strand < 2; strand += 1) {
    const band = BAND_ORDER[strand === 0 ? 2 : 4];
    ctx.beginPath();
    for (let i = 0; i <= 140; i += 1) {
      const u = i / 140;
      const y3 = (u - 0.5) * helixH / scale;
      const phase = u * Math.PI * 10 + t * (0.6 + bands[band]) + strand * Math.PI;
      const x3 = Math.cos(phase) * (0.55 + bands[band] * 0.25 + audio * 0.35);
      const z3 = Math.sin(phase) * 0.55;
      const p = project3d(x3, y3, z3, 0.35, rotY, scale * 0.95, cx, cy);
      if (i === 0) ctx.moveTo(p.x2, p.y2);
      else ctx.lineTo(p.x2, p.y2);
      if (i % 9 === 0) {
        const p2 = project3d(-x3, y3, -z3, 0.35, rotY, scale * 0.95, cx, cy);
        ctx.moveTo(p.x2, p.y2);
        ctx.lineTo(p2.x2, p2.y2);
        ctx.moveTo(p.x2, p.y2);
      }
    }
    ctx.strokeStyle = rgba(BAND_COLORS[band], 0.22 + bands[band] * 0.55 + audio * 0.2);
    ctx.lineWidth = 1.4 + bands[band] * 4 * intensity;
    ctx.stroke();
  }
  for (let rung = 0; rung < 22; rung += 1) {
    const u = rung / 21;
    const y3 = (u - 0.5) * helixH / scale;
    const phase = u * Math.PI * 10 + t * 0.6;
    const band = BAND_ORDER[rung % BAND_ORDER.length];
    const a = project3d(Math.cos(phase) * 0.55, y3, Math.sin(phase) * 0.55, 0.35, rotY, scale * 0.95, cx, cy);
    const b = project3d(-Math.cos(phase) * 0.55, y3, -Math.sin(phase) * 0.55, 0.35, rotY, scale * 0.95, cx, cy);
    ctx.beginPath();
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(b.x2, b.y2);
    ctx.strokeStyle = rgba(BAND_COLORS[band], 0.12 + bands[band] * 0.4);
    ctx.lineWidth = 0.6 + bands[band] * 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpiralGalaxyMind({ ctx, w, h, bands, channels, particles, t, intensity, audio }: DrawArgs) {
  const cx = w / 2;
  const cy = h * 0.5;
  const scale = Math.min(w, h) * 0.3;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let arm = 0; arm < 5; arm += 1) {
    const band = BAND_ORDER[arm];
    ctx.beginPath();
    for (let i = 0; i <= 200; i += 1) {
      const u = i / 200;
      const a = u * Math.PI * 5 + arm * 1.25 + t * (0.06 + bands.gamma * 0.12 + audio * 0.1);
      const r = u * Math.min(w, h) * 0.48;
      dot(
        ctx,
        cx + Math.cos(a) * r,
        cy + Math.sin(a) * r * 0.72,
        0.8 + bands[band] * 3 + audio * 2,
        rgba(BAND_COLORS[band], 0.15 + (1 - u) * bands[band] * 0.5),
      );
    }
  }
  for (const p of particles.slice(0, 120)) {
    const band = BAND_ORDER[p.band];
    const radius = 0.15 + ((p.band * 37) % 100) / 100;
    const angle = t * 0.05 + radius * 8 + p.angle;
    p.x = cx + Math.cos(angle) * radius * Math.min(w, h) * 0.55;
    p.y = cy + Math.sin(angle * 1.1) * radius * Math.min(w, h) * 0.4;
    dot(ctx, p.x, p.y, p.size * (1 + bands[band] * 2), rgba(BAND_COLORS[band], 0.2 + bands[band] * 0.55));
  }
  ctx.restore();
}

function drawNeuronForest3d({ ctx, w, h, bands, channels, t, intensity, audio }: DrawArgs) {
  const cx = w / 2;
  const cy = h * 0.55;
  const scale = Math.min(w, h) * 0.022;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const trees = 28;
  for (let tr = 0; tr < trees; tr += 1) {
    const band = BAND_ORDER[tr % BAND_ORDER.length];
    const gx = ((tr * 73) % 100) / 100 - 0.5;
    const gz = ((tr * 41) % 100) / 100 - 0.5;
    const soma = project3d(gx * 2.8, gz * 1.6, 0, 0.5, t * 0.1, scale * 14, cx, cy);
    dot(ctx, soma.x2, soma.y2, 3 + bands[band] * 8 + audio * 6, rgba(BAND_COLORS[band], 0.45 + bands[band] * 0.45));
    const branches = 5 + Math.floor(bands[band] * 4);
    for (let b = 0; b < branches; b += 1) {
      ctx.beginPath();
      ctx.moveTo(soma.x2, soma.y2);
      let px = gx;
      let py = gz;
      let pz = 0;
      for (let seg = 1; seg <= 6; seg += 1) {
        const bend = seg / 6;
        px += Math.sin(t * 0.3 + tr + seg) * 0.12 * bend;
        py += 0.22 * bend;
        pz += Math.cos(t * 0.25 + b) * 0.08 * bend;
        const p = project3d(px * 2.8, py * 1.6, pz, 0.5, t * 0.1, scale * 14, cx, cy);
        ctx.lineTo(p.x2, p.y2);
      }
      ctx.strokeStyle = rgba(BAND_COLORS[band], 0.1 + bands[band] * 0.38);
      ctx.lineWidth = 0.5 + bands[band] * 2.2 * intensity;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSynapticPulseField({ ctx, w, h, bands, channels, t, intensity, audio }: DrawArgs) {
  const cx = w / 2;
  const cy = h * 0.5;
  const scale = Math.min(w, h) * 0.33;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pulses = 80;
  for (let i = 0; i < pulses; i += 1) {
    const band = BAND_ORDER[i % BAND_ORDER.length];
    const gate = bands[band] + channels[i % 4] * 0.4 + audio * 0.5;
    if (gate < 0.22) continue;
    const a = (i / pulses) * Math.PI * 2 + t * (0.5 + gate);
    const r = scale * (0.4 + (i % 9) * 0.05 + gate * 0.35);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a * 1.05) * r * 0.75;
    const ring = scale * 0.06 * (1 + Math.sin(t * 6 + i) * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, ring * (1 + gate * 2), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(BAND_COLORS[band], 0.2 + gate * 0.6);
    ctx.lineWidth = 0.5 + gate * 2.5;
    ctx.stroke();
    dot(ctx, x, y, 1.5 + gate * 5, rgba(BAND_COLORS[band], 0.4 + gate * 0.45));
  }
  ctx.restore();
}

function drawCorticalParticleVeil({ ctx, w, h, bands, channels, particles, t, intensity, audio }: DrawArgs) {
  const cx = w / 2;
  const cy = h * 0.5;
  const scale = Math.min(w, h) * 0.34;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    const band = BAND_ORDER[p.band];
    const a = Math.atan2(p.y - cy, p.x - cx);
    const dist = Math.hypot(p.x - cx, p.y - cy);
    const targetR = scale * (0.95 + Math.sin(a * 3 + t) * 0.08);
    if (dist > targetR * 1.15) {
      p.x = cx + Math.cos(a) * targetR;
      p.y = cy + Math.sin(a) * targetR * 0.72;
    }
    p.x += Math.cos(p.angle + t * 0.4) * (0.4 + bands[band] + audio);
    p.y += Math.sin(p.angle + t * 0.35) * (0.4 + bands[band] + audio);
    dot(ctx, p.x, p.y, p.size * (0.8 + bands[band] * 2.5 + audio * 3), rgba(BAND_COLORS[band], 0.18 + bands[band] * 0.65));
  }
  ctx.restore();
}

function drawMicrogliaSparkSea({ ctx, w, h, bands, particles, t, audio }: DrawArgs) {
  for (let y = 0; y < h; y += 3) {
    const wave = Math.sin(y * 0.02 + t * 0.3) * 8;
    ctx.fillStyle = `rgba(8,24,48,${0.15 + bands.delta * 0.08})`;
    ctx.fillRect(0, y + wave, w, 2);
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    const band = BAND_ORDER[p.band];
    p.y += 0.3 + bands[band] * 1.2 + audio * 2;
    p.x += Math.sin(t + p.angle) * 0.8;
    if (p.y > h + 20) {
      p.y = -20;
      p.x = Math.random() * w;
    }
    dot(ctx, p.x, p.y, p.size * (1 + audio * 5), rgba(BAND_COLORS[band], 0.12 + bands[band] * 0.55));
  }
  ctx.restore();
}

function drawActivatedConnectome3d({ ctx, w, h, bands, channels, particles, t, intensity, audio }: DrawArgs) {
  const cx = w / 2;
  const cy = h * 0.52;
  const scale = Math.min(w, h) * 0.36;

  const projected = particles.slice(0, 160).map((p, i) => {
    const band = BAND_ORDER[p.band];
    const radius = 0.25 + ((i * 0.031) % 1.1);
    const angle = t * (0.07 + bands.gamma * 0.15 + audio * 0.1) + radius * 4.5;
    const z = Math.sin(t * 0.2 + i * 0.11) * 0.85;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle * 1.12) * radius * 0.65;
    return { bandName: band, bandIdx: p.band, ...project3d(x, y, z, 0.45, t * 0.14, scale * 0.95, cx, cy) };
  });

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < projected.length; i += 1) {
    const a = projected[i];
    for (let j = i + 9; j < projected.length; j += 17) {
      const b = projected[j];
      const dx = a.x2 - b.x2;
      const dy = a.y2 - b.y2;
      const d = Math.sqrt(dx * dx + dy * dy);
      const bp = (bands[a.bandName] + bands[b.bandName]) * 0.5;
      if (d < 220 + bp * 180 + audio * 120) {
        ctx.beginPath();
        ctx.moveTo(a.x2, a.y2);
        ctx.lineTo(b.x2, b.y2);
        ctx.strokeStyle = rgba(BAND_COLORS[a.bandName], (1 - d / 400) * (0.1 + bp * 0.55 + audio * 0.35));
        ctx.lineWidth = 0.5 + bp * 2.8 * intensity;
        ctx.stroke();
      }
    }
    dot(
      ctx,
      a.x2,
      a.y2,
      (1.5 + bands[a.bandName] * 6) * a.depth,
      rgba(BAND_COLORS[a.bandName], 0.28 + bands[a.bandName] * 0.65),
    );
  }
  ctx.restore();
}
